import { z } from 'zod';
import {
  ErrorModelo,
  leerCuerpo,
  pedir,
  tipoPorEstado,
  type Mensajes,
  type PeticionProveedor,
  type Proveedor,
  type RespuestaProveedor,
} from './tipos.js';

export const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com';

const respuestaGemini = z
  .object({
    candidates: z
      .array(
        z
          .object({
            content: z
              .object({ parts: z.array(z.object({ text: z.string().optional(), thought: z.boolean().optional() }).loose()).optional() })
              .loose()
              .optional(),
            finishReason: z.string().optional(),
          })
          .loose(),
      )
      .optional(),
    promptFeedback: z.object({ blockReason: z.string().optional() }).loose().optional(),
    usageMetadata: z
      .object({
        promptTokenCount: z.number().optional(),
        candidatesTokenCount: z.number().optional(),
        thoughtsTokenCount: z.number().optional(),
        totalTokenCount: z.number().optional(),
      })
      .loose()
      .optional(),
    modelVersion: z.string().optional(),
  })
  .loose();

const errorGemini = z
  .object({
    error: z
      .object({
        code: z.number().optional(),
        message: z.string().optional(),
        status: z.string().optional(),
        details: z
          .array(
            z
              .object({
                '@type': z.string().optional(),
                retryDelay: z.string().optional(),
                violations: z
                  .array(
                    z
                      .object({ quotaId: z.string().optional(), quotaMetric: z.string().optional(), quotaValue: z.string().optional() })
                      .loose(),
                  )
                  .optional(),
              })
              .loose(),
          )
          .optional(),
      })
      .loose(),
  })
  .loose();

/** "31s" o "1.5s" → milisegundos. */
function duracionMs(valor: string | undefined): number | undefined {
  const m = valor?.match(/^(\d+(?:\.\d+)?)s$/);
  return m ? Math.round(Number(m[1]) * 1000) : undefined;
}

type DetalleError = NonNullable<z.infer<typeof errorGemini>['error']['details']>;

/**
 * Qué cuota se superó en un 429, según el detalle QuotaFailure de Google
 * ("cuota: GenerateRequestsPerDay…, límite 0"). Va antes del mensaje genérico,
 * que es largo y se recorta.
 */
function cuotasSuperadas(detalles: DetalleError | undefined): string {
  const violaciones = (detalles ?? []).filter((d) => d['@type']?.endsWith('QuotaFailure')).flatMap((d) => d.violations ?? []);
  const textos = violaciones.map((v) => {
    const nombre = v.quotaId ?? v.quotaMetric ?? 'sin nombre';
    return v.quotaValue !== undefined ? `${nombre}, límite ${v.quotaValue}` : nombre;
  });
  return textos.length > 0 ? ` · cuota: ${textos.join('; ')}` : '';
}

/** Si alguna cuota superada es por día (GenerateRequestsPerDay…): esperar no sirve hasta mañana (H8). */
function esCuotaDiaria(detalles: DetalleError | undefined): boolean {
  return (detalles ?? [])
    .filter((d) => d['@type']?.endsWith('QuotaFailure'))
    .flatMap((d) => d.violations ?? [])
    .some((v) => /PerDay/i.test(`${v.quotaId ?? ''} ${v.quotaMetric ?? ''}`));
}

// Motivos de corte que no son una respuesta normal.
const CORTES = new Set(['SAFETY', 'RECITATION', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII', 'LANGUAGE', 'OTHER']);

/**
 * Adaptador de Gemini (API generateContent). Pide la salida en JSON; el formato
 * exacto lo define el prompt y lo valida Zod en la capa común.
 */
export class ProveedorGemini implements Proveedor {
  readonly nombre = 'Gemini' as const;

  constructor(
    private readonly apiKey: string,
    readonly modelo: string,
    private readonly baseUrl = GEMINI_BASE_URL,
  ) {}

  async completar(peticion: PeticionProveedor): Promise<RespuestaProveedor> {
    const { texto, modelo, tokens } = await this.generarContenido(peticion, {
      generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
    });
    return { texto, modelo, tokens };
  }

  private async generarContenido(mensajes: Mensajes, extra: Record<string, unknown>) {
    const url = `${this.baseUrl}/v1beta/models/${encodeURIComponent(this.modelo)}:generateContent`;
    const r = await pedir(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': this.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: mensajes.sistema }] },
        contents: [{ role: 'user', parts: [{ text: mensajes.usuario }] }],
        ...extra,
      }),
    });
    const cuerpo: unknown = await leerCuerpo(r);

    if (!r.ok) {
      const e = errorGemini.safeParse(cuerpo);
      const detalle = e.success ? e.data.error : undefined;
      const espera = duracionMs(detalle?.details?.find((d) => d['@type']?.endsWith('RetryInfo'))?.retryDelay);
      const mensaje = `Gemini respondió ${r.status}${detalle?.status ? ` (${detalle.status})` : ''}${cuotasSuperadas(detalle?.details)}: ${detalle?.message ?? 'sin detalle'}`;
      throw new ErrorModelo(mensaje.slice(0, 500), tipoPorEstado(r.status), {
        estadoHttp: r.status,
        ...(r.status === 429 && esCuotaDiaria(detalle?.details) ? { diario: true } : {}),
        ...(espera !== undefined ? { esperaMs: espera } : {}),
      });
    }

    const datos = respuestaGemini.safeParse(cuerpo);
    if (!datos.success) throw new ErrorModelo('Gemini devolvió una respuesta con un formato inesperado.', 'otro');
    const { candidates, promptFeedback, usageMetadata, modelVersion } = datos.data;

    if (promptFeedback?.blockReason) {
      throw new ErrorModelo(`Gemini bloqueó el pedido (${promptFeedback.blockReason}).`, 'bloqueo');
    }
    const candidato = candidates?.[0];
    if (candidato?.finishReason && CORTES.has(candidato.finishReason)) {
      throw new ErrorModelo(`Gemini cortó la respuesta (${candidato.finishReason}).`, 'bloqueo');
    }
    // Los modelos con razonamiento pueden devolver partes de "pensamiento": no son la respuesta.
    const texto = (candidato?.content?.parts ?? [])
      .filter((p) => !p.thought)
      .map((p) => p.text ?? '')
      .join('');

    const entrada = usageMetadata?.promptTokenCount ?? 0;
    const salida = (usageMetadata?.candidatesTokenCount ?? 0) + (usageMetadata?.thoughtsTokenCount ?? 0);
    return {
      texto,
      modelo: modelVersion ?? this.modelo,
      tokens: { entrada, salida, total: usageMetadata?.totalTokenCount ?? entrada + salida },
    };
  }
}

import { z } from 'zod';
import {
  ErrorModelo,
  pedir,
  tipoPorEstado,
  type Mensajes,
  type PeticionProveedor,
  type Proveedor,
  type ProveedorBusqueda,
  type RespuestaBusqueda,
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
            groundingMetadata: z
              .object({
                groundingChunks: z
                  .array(z.object({ web: z.object({ uri: z.string(), title: z.string().optional() }).loose().optional() }).loose())
                  .optional(),
              })
              .loose()
              .optional(),
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
        details: z.array(z.object({ '@type': z.string().optional(), retryDelay: z.string().optional() }).loose()).optional(),
      })
      .loose(),
  })
  .loose();

/** "31s" o "1.5s" → milisegundos. */
function duracionMs(valor: string | undefined): number | undefined {
  const m = valor?.match(/^(\d+(?:\.\d+)?)s$/);
  return m ? Math.round(Number(m[1]) * 1000) : undefined;
}

// Motivos de corte que no son una respuesta normal.
const CORTES = new Set(['SAFETY', 'RECITATION', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII', 'LANGUAGE', 'OTHER']);

/**
 * Adaptador de Gemini (API generateContent). Pide la salida en JSON; el formato
 * exacto lo define el prompt y lo valida Zod en la capa común.
 */
export class ProveedorGemini implements Proveedor, ProveedorBusqueda {
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

  /**
   * Búsqueda con Google Search (H6). Las fuentes salen de los metadatos de la búsqueda,
   * no del texto del modelo: así el modelo no puede inventar una dirección.
   */
  async buscar(mensajes: Mensajes): Promise<RespuestaBusqueda> {
    const { modelo, tokens, fuentes } = await this.generarContenido(mensajes, {
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0.2 },
    });
    return { fuentes, modelo, tokens };
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
    const cuerpo: unknown = await r.json().catch(() => undefined);

    if (!r.ok) {
      const e = errorGemini.safeParse(cuerpo);
      const detalle = e.success ? e.data.error : undefined;
      const espera = duracionMs(detalle?.details?.find((d) => d['@type']?.endsWith('RetryInfo'))?.retryDelay);
      const mensaje = `Gemini respondió ${r.status}${detalle?.status ? ` (${detalle.status})` : ''}: ${detalle?.message ?? 'sin detalle'}`;
      throw new ErrorModelo(mensaje.slice(0, 500), tipoPorEstado(r.status), {
        estadoHttp: r.status,
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

    const fuentes = (candidato?.groundingMetadata?.groundingChunks ?? []).flatMap((c) =>
      c.web ? [{ url: c.web.uri, titulo: c.web.title?.trim() ?? '' }] : [],
    );

    const entrada = usageMetadata?.promptTokenCount ?? 0;
    const salida = (usageMetadata?.candidatesTokenCount ?? 0) + (usageMetadata?.thoughtsTokenCount ?? 0);
    return {
      texto,
      fuentes,
      modelo: modelVersion ?? this.modelo,
      tokens: { entrada, salida, total: usageMetadata?.totalTokenCount ?? entrada + salida },
    };
  }
}

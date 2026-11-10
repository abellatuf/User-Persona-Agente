import { z } from 'zod';
import {
  ErrorModelo,
  esperaDeCabecera,
  leerCuerpo,
  pedir,
  tipoPorEstado,
  type PeticionProveedor,
  type Proveedor,
  type RespuestaProveedor,
} from './tipos.js';

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

const respuestaOpenRouter = z
  .object({
    model: z.string().optional(),
    choices: z
      .array(
        z
          .object({
            message: z.object({ content: z.string().nullable().optional() }).loose().optional(),
            finish_reason: z.string().nullable().optional(),
            error: z.object({ code: z.number().optional(), message: z.string().optional() }).loose().optional(),
          })
          .loose(),
      )
      .optional(),
    usage: z
      .object({
        prompt_tokens: z.number().optional(),
        completion_tokens: z.number().optional(),
        total_tokens: z.number().optional(),
      })
      .loose()
      .optional(),
  })
  .loose();

const errorOpenRouter = z
  .object({ error: z.object({ code: z.number().optional(), message: z.string().optional() }).loose() })
  .loose();

/**
 * Adaptador de OpenRouter (API compatible con OpenAI). Pide la salida con el
 * esquema JSON; si el modelo no lo respeta, la validación de Zod lo detecta igual.
 */
export class ProveedorOpenRouter implements Proveedor {
  readonly nombre = 'OpenRouter' as const;

  constructor(
    private readonly apiKey: string,
    readonly modelo: string,
    private readonly baseUrl = OPENROUTER_BASE_URL,
  ) {}

  async completar(peticion: PeticionProveedor): Promise<RespuestaProveedor> {
    const r = await pedir(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
        'X-OpenRouter-Title': 'User-Persona Agente',
      },
      body: JSON.stringify({
        model: this.modelo,
        messages: [
          { role: 'system', content: peticion.sistema },
          { role: 'user', content: peticion.usuario },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'respuesta', strict: false, schema: peticion.esquemaJson },
        },
        temperature: 0.2,
      }),
    });
    const cuerpo: unknown = await leerCuerpo(r);

    if (!r.ok) {
      const e = errorOpenRouter.safeParse(cuerpo);
      const espera = esperaDeCabecera(r.headers.get('retry-after'));
      // 402: sin crédito. No se resuelve esperando, así que se trata como credencial.
      const tipo = r.status === 402 ? 'credencial' : tipoPorEstado(r.status);
      const mensaje = `OpenRouter respondió ${r.status}: ${e.success ? (e.data.error.message ?? 'sin detalle') : 'sin detalle'}`;
      throw new ErrorModelo(mensaje.slice(0, 500), tipo, {
        estadoHttp: r.status,
        ...(espera !== undefined ? { esperaMs: espera } : {}),
      });
    }

    const datos = respuestaOpenRouter.safeParse(cuerpo);
    if (!datos.success) {
      // Solo la ruta y el tipo de problema: el cuerpo puede repetir datos del prompt.
      const motivo =
        cuerpo === undefined
          ? 'el cuerpo no es un JSON'
          : datos.error.issues
              .slice(0, 3)
              .map((i) => `${i.path.join('.') || '(raíz)'}: ${i.code}`)
              .join('; ');
      throw new ErrorModelo(`OpenRouter devolvió una respuesta con un formato inesperado (${motivo}).`, 'transitorio');
    }
    const eleccion = datos.data.choices?.[0];
    // OpenRouter puede devolver 200 con el error del proveedor dentro de la elección.
    if (eleccion?.error) {
      const codigo = eleccion.error.code ?? 0;
      throw new ErrorModelo(`OpenRouter: ${eleccion.error.message ?? 'error del proveedor'}`, codigo ? tipoPorEstado(codigo) : 'otro', {
        ...(codigo ? { estadoHttp: codigo } : {}),
      });
    }
    if (eleccion?.finish_reason === 'content_filter') {
      throw new ErrorModelo('OpenRouter cortó la respuesta por el filtro de contenido.', 'bloqueo');
    }

    const u = datos.data.usage;
    const entrada = u?.prompt_tokens ?? 0;
    const salida = u?.completion_tokens ?? 0;
    return {
      texto: eleccion?.message?.content ?? '',
      modelo: datos.data.model ?? this.modelo,
      tokens: { entrada, salida, total: u?.total_tokens ?? entrada + salida },
    };
  }
}

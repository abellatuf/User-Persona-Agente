import { z } from 'zod';
import { ErrorModelo, esperaDeCabecera, pedir, tipoPorEstado, type FuenteEncontrada, type ProveedorBusqueda } from './tipos.js';

export const TAVILY_BASE_URL = 'https://api.tavily.com';

/** Resultados por consulta: 4 temas × 8 alcanzan para las 30 candidatas de la etapa. */
export const RESULTADOS_POR_CONSULTA = 8;
const TIMEOUT_BUSQUEDA_MS = 30_000;

const respuestaTavily = z
  .object({
    results: z.array(z.object({ url: z.string(), title: z.string().optional() }).loose()),
  })
  .loose();

const errorTavily = z
  .object({ detail: z.union([z.string(), z.object({ error: z.string().optional() }).loose()]).optional() })
  .loose();

/**
 * Tipo de error de Tavily. 432 y 433 son el tope de créditos del plan: como el 429,
 * cortan las búsquedas que faltan en la corrida.
 */
function tipoTavily(estado: number): ErrorModelo['tipo'] {
  return estado === 432 || estado === 433 ? 'limite' : tipoPorEstado(estado);
}

/**
 * Buscador de Tavily (H6). Búsqueda básica: 1 crédito por consulta, de los 1.000
 * gratuitos por mes. Las URL salen de la respuesta del buscador, no del texto de un modelo.
 */
export class ProveedorTavily implements ProveedorBusqueda {
  readonly nombre = 'Tavily';
  readonly modelo = 'búsqueda básica';

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = TAVILY_BASE_URL,
  ) {}

  async buscar(consulta: string): Promise<FuenteEncontrada[]> {
    const r = await pedir(
      `${this.baseUrl}/search`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({ query: consulta, search_depth: 'basic', max_results: RESULTADOS_POR_CONSULTA, topic: 'general' }),
      },
      TIMEOUT_BUSQUEDA_MS,
    );
    const cuerpo: unknown = await r.json().catch(() => undefined);

    if (!r.ok) {
      const e = errorTavily.safeParse(cuerpo);
      const detalle = e.success ? (typeof e.data.detail === 'string' ? e.data.detail : e.data.detail?.error) : undefined;
      const espera = esperaDeCabecera(r.headers.get('retry-after'));
      throw new ErrorModelo(`Tavily respondió ${r.status}: ${detalle ?? 'sin detalle'}`.slice(0, 500), tipoTavily(r.status), {
        estadoHttp: r.status,
        ...(espera !== undefined ? { esperaMs: espera } : {}),
      });
    }

    const datos = respuestaTavily.safeParse(cuerpo);
    if (!datos.success) throw new ErrorModelo('Tavily devolvió una respuesta con un formato inesperado.', 'otro');
    return datos.data.results.map((x) => ({ url: x.url, titulo: x.title?.trim() ?? '' }));
  }
}

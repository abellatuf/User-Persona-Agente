/**
 * Interfaz común de los modelos de lenguaje (T3.1, RNF-02). Las etapas no conocen
 * a Gemini ni a OpenRouter: piden una generación y reciben datos ya validados.
 */

/** Lo que se le manda a un proveedor: instrucciones de sistema y mensaje del usuario. */
export interface Mensajes {
  sistema: string;
  usuario: string;
}

export interface PeticionProveedor extends Mensajes {
  /** Esquema JSON de la respuesta esperada, para los proveedores que lo aceptan. */
  esquemaJson: Record<string, unknown>;
}

export interface Tokens {
  entrada: number;
  salida: number;
  total: number;
}

export interface RespuestaProveedor {
  /** Texto crudo de la respuesta: debería ser un JSON. */
  texto: string;
  /** Modelo que respondió de verdad (puede diferir del pedido, por ejemplo con un router). */
  modelo: string;
  tokens: Tokens;
}

/** Una fuente que devolvió la búsqueda web: la dirección (todavía sin verificar) y su título. */
export interface FuenteEncontrada {
  url: string;
  titulo: string;
}

/**
 * Buscador web, separado del modelo de lenguaje (H6, decisión C revisada): recibe una
 * consulta y devuelve las fuentes que encontró. No usa tokens.
 */
export interface ProveedorBusqueda {
  readonly nombre: string;
  /** Tipo de búsqueda, para el registro (por ejemplo, «búsqueda básica»). */
  readonly modelo: string;
  buscar(consulta: string): Promise<FuenteEncontrada[]>;
}

export type NombreProveedor = 'Gemini' | 'OpenRouter';

export interface Proveedor {
  readonly nombre: NombreProveedor;
  /** Modelo pedido, tal como está en Configuración o el valor por defecto. */
  readonly modelo: string;
  completar(peticion: PeticionProveedor): Promise<RespuestaProveedor>;
}

/**
 * Tipos de error de un proveedor:
 * - limite: límite de uso (429). Se reintenta y después se pasa al respaldo. Si es el límite
 *   diario (opción «diario»), no se reintenta: esperar no sirve hasta el día siguiente (H8).
 * - transitorio: error del servidor (5xx) o timeout. Igual que limite.
 * - credencial: clave inválida o sin permisos (401/403). Pasa directo al respaldo.
 * - modelo: el modelo no existe o no está disponible (404). Pasa directo al respaldo.
 * - bloqueo: el proveedor cortó la respuesta (seguridad, contenido). Pasa al respaldo.
 * - otro: cualquier otro error (por ejemplo, 400). Pasa al respaldo.
 */
export type TipoErrorModelo = 'limite' | 'transitorio' | 'credencial' | 'modelo' | 'bloqueo' | 'otro';

export class ErrorModelo extends Error {
  override name = 'ErrorModelo';
  constructor(
    message: string,
    readonly tipo: TipoErrorModelo,
    readonly opciones: { estadoHttp?: number; esperaMs?: number; diario?: boolean } = {},
  ) {
    super(message);
  }
}

/** Clasifica un estado HTTP de error. */
export function tipoPorEstado(estado: number): TipoErrorModelo {
  if (estado === 429) return 'limite';
  if (estado === 401 || estado === 403) return 'credencial';
  if (estado === 404) return 'modelo';
  if (estado === 408 || estado >= 500) return 'transitorio';
  return 'otro';
}

/** Lee la cabecera Retry-After (segundos o fecha HTTP) en milisegundos. */
export function esperaDeCabecera(valor: string | null, ahora = Date.now()): number | undefined {
  if (!valor) return undefined;
  const segundos = Number(valor);
  if (Number.isFinite(segundos)) return Math.max(0, segundos * 1000);
  const fecha = Date.parse(valor);
  return Number.isNaN(fecha) ? undefined : Math.max(0, fecha - ahora);
}

/**
 * Tiempo máximo de una llamada a un modelo, incluida la lectura de la respuesta. Era de 90 s:
 * una persona sintetizada por un modelo gratuito de OpenRouter (4.000 a 8.000 tokens) no llegaba (H9, 2026-11-10).
 */
export const TIMEOUT_MS = 180_000;

const esCortePorTiempo = (e: unknown) => e instanceof Error && e.name === 'TimeoutError';
const segundos = (ms: number) => `${Math.round(ms / 1000)} s`;

/** Hace la llamada HTTP y convierte las fallas de red o timeout en ErrorModelo transitorio. */
export async function pedir(url: string, init: RequestInit, timeoutMs = TIMEOUT_MS): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    if (esCortePorTiempo(e)) throw new ErrorModelo(`No llegó respuesta en ${segundos(timeoutMs)}.`, 'transitorio');
    const mensaje = e instanceof Error ? e.message : String(e);
    throw new ErrorModelo(`No se pudo conectar: ${mensaje}`, 'transitorio');
  }
}

/**
 * Lee el cuerpo JSON de la respuesta, o undefined si no es JSON. El tiempo máximo de `pedir`
 * sigue corriendo durante la lectura: si se cumple, lo dice, en lugar de parecer un cuerpo que no es JSON.
 */
export async function leerCuerpo(r: Pick<Response, 'json'>, timeoutMs = TIMEOUT_MS): Promise<unknown> {
  try {
    return await r.json();
  } catch (e) {
    if (esCortePorTiempo(e)) throw new ErrorModelo(`La respuesta se cortó a los ${segundos(timeoutMs)}, antes de terminar de llegar.`, 'transitorio');
    return undefined;
  }
}

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

export interface RespuestaBusqueda {
  fuentes: FuenteEncontrada[];
  modelo: string;
  tokens: Tokens;
}

/** Proveedor que puede buscar en la web (solo Gemini, con Google Search). */
export interface ProveedorBusqueda {
  readonly nombre: NombreProveedor;
  readonly modelo: string;
  buscar(mensajes: Mensajes): Promise<RespuestaBusqueda>;
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
 * - limite: límite de uso (429). Se reintenta y después se pasa al respaldo.
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
    readonly opciones: { estadoHttp?: number; esperaMs?: number } = {},
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

/** Tiempo máximo de espera de una llamada a un modelo. */
export const TIMEOUT_MS = 90_000;

/** Hace la llamada HTTP y convierte las fallas de red o timeout en ErrorModelo transitorio. */
export async function pedir(url: string, init: RequestInit, timeoutMs = TIMEOUT_MS): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e);
    throw new ErrorModelo(`No se pudo conectar: ${mensaje}`, 'transitorio');
  }
}

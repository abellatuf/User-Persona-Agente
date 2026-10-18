import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/** Una fuente no se pudo leer: se saltea y el motivo queda en Ejecuciones. */
export class ErrorFuente extends Error {
  override name = 'ErrorFuente';
}

export interface OpcionesDescarga {
  maxBytes: number;
  timeoutMs?: number;
  /** Solo para pruebas: permite servidores locales. En producción, siempre false. */
  permitirLocal?: boolean;
}

export interface Descarga {
  bytes: Uint8Array;
  tipo: string;
  urlFinal: string;
}

const MAX_REDIRECCIONES = 3;

function ipv4Privada(ip: string): boolean {
  const [a = 0, b = 0] = ip.split('.').map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

/** Direcciones locales, privadas o reservadas: el agente no las lee (evita leer la red interna). */
export function esDireccionPrivada(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) return ipv4Privada(ip);
  if (v === 6) {
    const s = ip.toLowerCase();
    const mapeada = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapeada) return ipv4Privada(mapeada[1]!);
    return s === '::' || s === '::1' || /^f[cd]/.test(s) || /^fe[89ab]/.test(s);
  }
  return true;
}

async function verificarDestino(url: URL, permitirLocal: boolean): Promise<void> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ErrorFuente(`solo se leen direcciones http o https (${url.protocol}).`);
  }
  if (permitirLocal) return;
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost')) {
    throw new ErrorFuente('no se leen direcciones locales.');
  }
  const ips = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map((r) => r.address);
  if (ips.length === 0) throw new ErrorFuente(`no se encontró el servidor ${host}.`);
  if (ips.some(esDireccionPrivada)) throw new ErrorFuente('no se leen direcciones locales ni privadas.');
}

async function leerCuerpo(respuesta: Response, maxBytes: number): Promise<Uint8Array> {
  const largo = Number(respuesta.headers.get('content-length') ?? 0);
  if (largo > maxBytes) throw new ErrorFuente(`supera el tamaño máximo (${Math.round(maxBytes / 1_000_000)} MB).`);
  const partes: Uint8Array[] = [];
  let total = 0;
  for await (const parte of respuesta.body ?? []) {
    total += parte.length;
    if (total > maxBytes) throw new ErrorFuente(`supera el tamaño máximo (${Math.round(maxBytes / 1_000_000)} MB).`);
    partes.push(parte);
  }
  const bytes = new Uint8Array(total);
  let desde = 0;
  for (const parte of partes) {
    bytes.set(parte, desde);
    desde += parte.length;
  }
  return bytes;
}

/**
 * Descarga una dirección con límites de tamaño y tiempo. Sigue hasta 3 redirecciones,
 * revisando cada destino, y rechaza direcciones locales o privadas.
 */
export async function descargar(direccion: string, opciones: OpcionesDescarga): Promise<Descarga> {
  let url: URL;
  try {
    url = new URL(direccion);
  } catch {
    throw new ErrorFuente('la dirección no es válida.');
  }
  const senal = AbortSignal.timeout(opciones.timeoutMs ?? 20_000);
  for (let salto = 0; ; salto++) {
    await verificarDestino(url, opciones.permitirLocal ?? false);
    let r: Response;
    try {
      r = await fetch(url, { redirect: 'manual', signal: senal, headers: { 'user-agent': 'User-Persona-Agente/0.1' } });
    } catch (e) {
      throw new ErrorFuente(`no se pudo conectar (${e instanceof Error ? e.message : String(e)}).`);
    }
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) {
      if (salto >= MAX_REDIRECCIONES) throw new ErrorFuente('demasiadas redirecciones.');
      url = new URL(r.headers.get('location')!, url);
      continue;
    }
    if (!r.ok) throw new ErrorFuente(`respondió ${r.status}.`);
    return {
      bytes: await leerCuerpo(r, opciones.maxBytes),
      tipo: (r.headers.get('content-type') ?? '').toLowerCase(),
      urlFinal: url.toString(),
    };
  }
}

import { createHash } from 'node:crypto';

/**
 * Claves estables para no duplicar filas al repetir una etapa (RNF-04, T2.6).
 * La clave se guarda en la propiedad «Clave» de cada base que la usa.
 */

/** Minúsculas, sin acentos ni puntuación, con los espacios unificados. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** URL comparable: sin protocolo, «www.», fragmento, parámetros de seguimiento ni barra final. */
export function normalizarUrl(url: string): string {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return normalizar(url);
  }
  for (const p of [...u.searchParams.keys()]) {
    if (/^(utm_|fbclid$|gclid$)/i.test(p)) u.searchParams.delete(p);
  }
  u.searchParams.sort();
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  const ruta = u.pathname.replace(/\/+$/, '');
  const consulta = u.searchParams.toString();
  return `${host}${ruta}${consulta ? `?${consulta}` : ''}`;
}

/** Clave con prefijo legible y un hash corto de las partes normalizadas. */
export function crearClave(tipo: string, ...partes: string[]): string {
  const hash = createHash('sha256').update(partes.map(normalizar).join('|')).digest('hex').slice(0, 16);
  return `${tipo}:${hash}`;
}

export const claves = {
  persona: (segmento: string, version: number) => crearClave('persona', segmento, String(version)),
  atributo: (clavePersona: string, categoria: string, afirmacion: string) =>
    crearClave('atributo', clavePersona, categoria, afirmacion),
  evidenciaPublica: (url: string) => `publica:${createHash('sha256').update(normalizarUrl(url)).digest('hex').slice(0, 16)}`,
  evidenciaDelEquipo: (entrevistaId: string, respuesta: string) => crearClave('equipo', entrevistaId, respuesta),
  supuesto: (claveAtributo: string) => crearClave('supuesto', claveAtributo),
};

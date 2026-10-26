import { extractText } from 'unpdf';
import { htmlATexto } from './html.js';
import { descargar, ErrorFuente } from './red.js';

export { ErrorFuente } from './red.js';

/** Texto de una fuente, listo para el prompt. El nombre es el que cita el modelo. */
export interface Fuente {
  nombre: string;
  texto: string;
  recortada: boolean;
}

/** Una página web leída: además del texto, la dirección final (después de las redirecciones) y su título. */
export interface PaginaLeida extends Fuente {
  urlFinal: string;
  titulo: string;
}

export interface OpcionesFuentes {
  permitirLocal?: boolean;
}

/** Tope de caracteres por fuente, para cuidar la cuota gratuita. */
export const MAX_CARACTERES_FUENTE = 60_000;
const MAX_BYTES_DOCUMENTO = 10_000_000;
const MAX_BYTES_PAGINA = 2_000_000;

const EXTENSIONES_DE_TEXTO = ['.md', '.markdown', '.txt', '.csv'];

function recortarFuente(nombre: string, texto: string): Fuente {
  // Se saca la marca de orden de bytes (BOM, U+FEFF) que dejan algunos editores.
  const sinBom = texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto;
  const limpio = sinBom.replace(/\r\n?/g, '\n').trim();
  const recortada = limpio.length > MAX_CARACTERES_FUENTE;
  return { nombre, texto: recortada ? limpio.slice(0, MAX_CARACTERES_FUENTE) : limpio, recortada };
}

function extension(nombre: string): string {
  const m = nombre.toLowerCase().match(/\.[a-z0-9]+$/);
  return m ? m[0] : '';
}

const decodificar = (bytes: Uint8Array) => new TextDecoder('utf-8').decode(bytes);

/** Lee un documento adjunto en Notion (T4.1): texto plano, Markdown, CSV o PDF. */
export async function leerDocumento(archivo: { nombre: string; url: string }, opciones: OpcionesFuentes = {}): Promise<Fuente> {
  const ext = extension(archivo.nombre);
  const esPdf = ext === '.pdf';
  if (!esPdf && !EXTENSIONES_DE_TEXTO.includes(ext)) {
    throw new ErrorFuente(`el formato ${ext || '(sin extensión)'} no se lee todavía. Se leen .md, .txt, .csv y .pdf.`);
  }
  const { bytes } = await descargar(archivo.url, { maxBytes: MAX_BYTES_DOCUMENTO, timeoutMs: 30_000, ...opciones });
  if (!esPdf) return recortarFuente(archivo.nombre, decodificar(bytes));
  let texto: string;
  try {
    texto = (await extractText(bytes, { mergePages: true })).text;
  } catch (e) {
    throw new ErrorFuente(`no se pudo leer el PDF (${e instanceof Error ? e.message : String(e)}).`);
  }
  if (!texto.trim()) throw new ErrorFuente('el PDF no tiene texto (puede ser una imagen escaneada).');
  return recortarFuente(archivo.nombre, texto);
}

/** Lee una página web pública (T4.2): una sola página, sin seguir enlaces. */
export async function leerPaginaWeb(url: string, opciones: OpcionesFuentes = {}): Promise<PaginaLeida> {
  const { bytes, tipo, urlFinal } = await descargar(url, { maxBytes: MAX_BYTES_PAGINA, timeoutMs: 20_000, ...opciones });
  const crudo = decodificar(bytes);
  if (tipo.includes('html') || (!tipo && /<html[\s>]/i.test(crudo))) {
    const { titulo, texto } = htmlATexto(crudo);
    if (!texto) throw new ErrorFuente('la página no tiene texto legible.');
    return { ...recortarFuente(url, titulo ? `${titulo}\n\n${texto}` : texto), urlFinal, titulo };
  }
  if (tipo.startsWith('text/')) return { ...recortarFuente(url, crudo), urlFinal, titulo: '' };
  throw new ErrorFuente(`el contenido es de tipo ${tipo || 'desconocido'} y no se lee como página.`);
}

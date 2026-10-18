/**
 * Extractor simple de texto de una página HTML: saca scripts, estilos y etiquetas,
 * respeta los cortes de bloque y decodifica las entidades más comunes.
 */

const ENTIDADES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  aacute: 'á',
  eacute: 'é',
  iacute: 'í',
  oacute: 'ó',
  uacute: 'ú',
  ntilde: 'ñ',
  uuml: 'ü',
  Aacute: 'Á',
  Eacute: 'É',
  Iacute: 'Í',
  Oacute: 'Ó',
  Uacute: 'Ú',
  Ntilde: 'Ñ',
  iexcl: '¡',
  iquest: '¿',
  laquo: '«',
  raquo: '»',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  ldquo: '“',
  rdquo: '”',
  lsquo: '‘',
  rsquo: '’',
};

export function decodificarEntidades(texto: string): string {
  return texto.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entera, cuerpo: string) => {
    if (cuerpo[0] === '#') {
      const codigo = cuerpo[1]?.toLowerCase() === 'x' ? parseInt(cuerpo.slice(2), 16) : parseInt(cuerpo.slice(1), 10);
      return Number.isFinite(codigo) && codigo > 0 && codigo <= 0x10ffff ? String.fromCodePoint(codigo) : entera;
    }
    return ENTIDADES[cuerpo] ?? entera;
  });
}

const BLOQUES = /<\/?(p|div|section|article|header|footer|main|aside|nav|li|ul|ol|h[1-6]|tr|table|blockquote|pre|br|hr)\b[^>]*>/gi;

export function htmlATexto(html: string): { titulo: string; texto: string } {
  const titulo = decodificarEntidades(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  const texto = decodificarEntidades(
    html
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(script|style|noscript|svg|template|iframe|head)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(BLOQUES, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    // Todo espacio en blanco salvo el salto de línea (incluye el espacio duro de &nbsp;).
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    // Cada etiqueta de bloque (apertura y cierre) deja un salto: se unifican en uno.
    .replace(/\n{2,}/g, '\n')
    .trim();
  return { titulo, texto };
}

/**
 * Repreguntas en el cuerpo de la página de cada entrevista (HU-05 y HU-06).
 * El servidor MCP de Notion solo escribe párrafos, así que cada repregunta usa
 * renglones con una marca fija: el código los vuelve a encontrar para leer las respuestas.
 *
 *   ❓ Repregunta 1 · sobre tu respuesta a P04 («…»)
 *   ¿Texto de la repregunta?
 *   ✍️ Tu respuesta:
 *   (lo que escribe el miembro, en uno o más renglones)
 */

export const MARCA_REPREGUNTA = '❓ Repregunta';
export const MARCA_RESPUESTA = '✍️ Tu respuesta:';

export const INTRODUCCION =
  '📝 Repreguntas del agente. Respondé debajo de cada «✍️ Tu respuesta:» y, cuando termines, pasá la entrevista a Completa. No borres los renglones que empiezan con ❓ o ✍️.';

export interface RepreguntaParaEscribir {
  /** Código de la pregunta del formulario que la motivó (P01…). */
  sobre: string;
  texto: string;
  /** Lo que respondió el miembro a esa pregunta, para recordárselo. */
  respuestaOriginal: string;
}

export interface RepreguntaLeida {
  numero: number;
  sobre: string;
  texto: string;
  /** Lo que escribió el miembro debajo de «✍️ Tu respuesta:». Vacío si todavía no respondió. */
  respuesta: string;
}

const FRAGMENTO_PALABRAS = 15;

function fragmento(texto: string): string {
  const palabras = texto.trim().split(/\s+/);
  return palabras.length <= FRAGMENTO_PALABRAS ? palabras.join(' ') : `${palabras.slice(0, FRAGMENTO_PALABRAS).join(' ')}…`;
}

/** Párrafos a agregar al cuerpo de la entrevista. */
export function parrafosDeRepreguntas(repreguntas: RepreguntaParaEscribir[]): string[] {
  return [
    INTRODUCCION,
    ...repreguntas.flatMap((r, i) => [
      `${MARCA_REPREGUNTA} ${i + 1} · sobre tu respuesta a ${r.sobre} («${fragmento(r.respuestaOriginal)}»)`,
      r.texto,
      MARCA_RESPUESTA,
    ]),
  ];
}

const ENCABEZADO = /^❓\s*Repregunta\s+(\d+)\s*·\s*sobre\s+tu\s+respuesta\s+a\s+(P\d{2})\b/u;

/** El cuerpo ya tiene repreguntas escritas por el agente. */
export function tieneRepreguntas(textos: string[]): boolean {
  return textos.some((t) => ENCABEZADO.test(t.trim()));
}

/**
 * Lee las repreguntas y sus respuestas del cuerpo de la página. Lo que está antes de
 * la primera repregunta se ignora. La respuesta es todo lo que hay después de
 * «✍️ Tu respuesta:» (en el mismo renglón o en los siguientes) hasta la próxima repregunta.
 */
export function leerRepreguntas(textos: string[]): RepreguntaLeida[] {
  const leidas: RepreguntaLeida[] = [];
  let actual: { leida: RepreguntaLeida; respondiendo: boolean; partes: string[] } | undefined;

  const cerrar = () => {
    if (actual) leidas.push({ ...actual.leida, respuesta: actual.partes.join('\n').trim() });
  };

  for (const crudo of textos) {
    const texto = crudo.trim();
    const encabezado = ENCABEZADO.exec(texto);
    if (encabezado) {
      cerrar();
      actual = {
        leida: { numero: Number(encabezado[1]), sobre: encabezado[2]!, texto: '', respuesta: '' },
        respondiendo: false,
        partes: [],
      };
      continue;
    }
    if (!actual || !texto) continue;
    if (texto.startsWith(MARCA_RESPUESTA)) {
      actual.respondiendo = true;
      const mismoRenglon = texto.slice(MARCA_RESPUESTA.length).trim();
      if (mismoRenglon) actual.partes.push(mismoRenglon);
    } else if (actual.respondiendo) {
      actual.partes.push(texto);
    } else if (!actual.leida.texto) {
      actual.leida.texto = texto;
    }
  }
  cerrar();
  return leidas;
}

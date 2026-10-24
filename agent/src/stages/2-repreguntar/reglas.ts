import { normalizar } from '../../guards/claves.js';
import type { FilaEntrevista } from '../../notion/espacio.js';
import { MAX_REPREGUNTAS, PREGUNTAS } from './formulario.js';

/**
 * Reglas de las repreguntas que decide el código, no el modelo (Fase 4 y HU-05):
 * hasta 5 por miembro, cada una vinculada a una respuesta que existe, sin repetir
 * el formulario y sin mencionar a otros miembros ni lo que respondieron.
 */

export interface RepreguntaPropuesta {
  sobre: string;
  texto: string;
}

export interface Descarte {
  texto: string;
  motivo: string;
}

/**
 * Frases que muestran o insinúan lo que dijo otro miembro. Decisión C (2026-10-24):
 * se puede repreguntar sobre el mismo tema, pero sin revelar la otra postura.
 */
const MENCIONES_A_OTROS = [
  // «El resto del equipo» no se bloquea: es parte de la pregunta P11 y se puede repreguntar sobre ella.
  /\botr[oa]s?\s+(miembros?|personas?\s+del\s+equipo|integrantes?|companer[oa]s?|roles?)\b/,
  /\bcompaner[oa]s?\b/,
  /\balguien\s+(mas\s+)?del\s+equipo\b/,
  /\b(otros?|algunos?|varios?)\s+(del|en\s+el)\s+equipo\b/,
  /\b(segun|como\s+dijo|como\s+dicen|a\s+diferencia\s+de)\s+(otr[oa]s?|alguien|el\s+equipo|tu\s+equipo)\b/,
  /\b(el\s+equipo|tu\s+equipo)\s+(dice|dijo|cree|piensa|opina|respondio|sostiene)\b/,
  /\bmiembro\s+(a|b|c|d|e|\d+)\b/,
  /\b(hay|existe)\s+(un\s+)?(desacuerdo|contradiccion|diferencia\s+de\s+opinion)\b/,
];

/** Menciona a otros miembros o a lo que dijeron (texto normalizado: sin acentos, en minúsculas). */
export function mencionaAOtros(texto: string, nombresDeOtros: string[] = []): boolean {
  const t = normalizar(texto);
  if (MENCIONES_A_OTROS.some((patron) => patron.test(t))) return true;
  return nombresDeOtros
    .map(normalizar)
    .filter((n) => n.length >= 3)
    .some((n) => new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(t));
}

const PREGUNTAS_NORMALIZADAS = PREGUNTAS.map((q) => normalizar(q.texto));

function repiteElFormulario(texto: string): boolean {
  const t = normalizar(texto);
  // Igual a una pregunta del formulario, o a una de sus oraciones.
  return PREGUNTAS.some((q, i) => {
    if (t === PREGUNTAS_NORMALIZADAS[i]) return true;
    return q.texto
      .split(/(?<=[?.])\s+/)
      .map(normalizar)
      .some((oracion) => oracion.length > 0 && oracion === t);
  });
}

export function filtrarRepreguntas(
  propuestas: RepreguntaPropuesta[],
  respuestas: Record<string, string>,
  nombresDeOtros: string[] = [],
): { aceptadas: RepreguntaPropuesta[]; descartadas: Descarte[] } {
  const aceptadas: RepreguntaPropuesta[] = [];
  const descartadas: Descarte[] = [];
  const vistas = new Set<string>();

  for (const propuesta of propuestas) {
    const texto = propuesta.texto.trim();
    const sobre = propuesta.sobre.trim().toUpperCase();
    const descartar = (motivo: string) => descartadas.push({ texto: texto || '(vacía)', motivo });

    if (!texto) descartar('está vacía.');
    else if (!respuestas[sobre]?.trim()) descartar(`no está vinculada a una respuesta que exista («${propuesta.sobre}»).`);
    else if (repiteElFormulario(texto)) descartar('repite una pregunta del formulario.');
    else if (mencionaAOtros(texto, nombresDeOtros)) descartar('menciona a otros miembros o lo que respondieron.');
    else if (vistas.has(normalizar(texto))) descartar('está repetida.');
    else if (aceptadas.length >= MAX_REPREGUNTAS) descartar(`supera el tope de ${MAX_REPREGUNTAS} repreguntas por miembro.`);
    else {
      vistas.add(normalizar(texto));
      aceptadas.push({ sobre, texto });
    }
  }
  return { aceptadas, descartadas };
}

// Entrevistas que entran en la síntesis (T5.4, HU-06). Se usa desde el H7.

export const OPCION_AVANZAR_SIN_INCOMPLETAS = 'avanzar sin las entrevistas incompletas';

export function pideAvanzarSinIncompletas(opciones: string): boolean {
  const o = normalizar(opciones);
  return o.includes(normalizar(OPCION_AVANZAR_SIN_INCOMPLETAS)) || /\bavanzar sin (las )?incompletas\b/.test(o);
}

export type EntrevistasParaSintetizar =
  | { ok: true; incluidas: FilaEntrevista[]; excluidas: FilaEntrevista[]; nota: string }
  | { ok: false; motivo: string };

const describir = (e: FilaEntrevista) => `${e.nombreMiembro || e.titulo || e.id} (${e.estado ?? 'sin estado'})`;

/**
 * Solo entran las entrevistas Completas. Si falta alguna, la síntesis no arranca,
 * salvo que la solicitud pida avanzar sin ellas: en ese caso queda registrado cuáles faltaron.
 */
export function entrevistasParaSintetizar(entrevistas: FilaEntrevista[], opciones: string): EntrevistasParaSintetizar {
  const incluidas = entrevistas.filter((e) => e.estado === 'Completa');
  const excluidas = entrevistas.filter((e) => e.estado !== 'Completa');
  if (incluidas.length === 0) {
    return { ok: false, motivo: 'No hay ninguna entrevista Completa para sintetizar.' };
  }
  if (excluidas.length === 0) {
    return { ok: true, incluidas, excluidas, nota: `Entrevistas usadas: ${incluidas.length}, todas Completas.` };
  }
  const lista = excluidas.map(describir).join(', ');
  if (!pideAvanzarSinIncompletas(opciones)) {
    return {
      ok: false,
      motivo: `Hay ${excluidas.length} entrevista(s) sin completar: ${lista}. Esperá a que las completen o escribí «${OPCION_AVANZAR_SIN_INCOMPLETAS}» en Opciones de la solicitud.`,
    };
  }
  return {
    ok: true,
    incluidas,
    excluidas,
    nota: `El PM pidió avanzar sin las entrevistas incompletas. Quedaron afuera: ${lista}.`,
  };
}

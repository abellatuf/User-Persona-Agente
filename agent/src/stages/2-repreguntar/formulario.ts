/**
 * Formulario base de la entrevista (T5.1, HU-04), aprobado por Abel el 2026-10-24.
 * Cada pregunta es una propiedad de texto de la base Entrevistas, con su código
 * adelante («P01 · …»). No menciona ninguna industria ni producto (RNF-12).
 */

export interface PreguntaBase {
  /** Código estable de la pregunta: P01 a P13. */
  codigo: string;
  texto: string;
}

const TEXTOS = [
  '¿Quiénes creés que son los usuarios principales del producto? Si hay más de un tipo, describí cada uno.',
  'Pensá en un usuario concreto, real o que te imagines con claridad. ¿Cómo es su día a día en lo que tiene que ver con el problema que resolvemos?',
  '¿Qué problema o necesidad tiene ese usuario que el producto busca resolver? ¿Qué le pasa si no lo resuelve?',
  '¿Cómo lo resuelve hoy, sin nuestro producto? (herramientas, personas, procesos, trucos)',
  '¿Qué es lo que más le molesta o le cuesta de esa forma actual?',
  '¿Qué tendría que pasar para que decida probar el producto? ¿Qué lo frenaría?',
  '¿Qué resultado concreto espera lograr? ¿Cómo se daría cuenta de que el producto le sirvió?',
  '¿En qué contexto lo usaría? (dónde, cuándo, con qué frecuencia, con quién)',
  '¿Qué diferencias importantes hay entre los distintos tipos de usuario? ¿Alguno necesita algo muy distinto?',
  '¿Quién decide usarlo, quién lo usa y quién paga? ¿Son la misma persona?',
  '¿Qué creés que el resto del equipo da por sentado sobre los usuarios y vos no estás tan seguro?',
  '¿En qué te basás para lo que respondiste? (charlas con usuarios, datos, experiencia propia, intuición) ¿Qué pesa más?',
  'Si pudieras hacerle una sola pregunta a un usuario real, ¿cuál sería?',
];

export const PREGUNTAS: readonly PreguntaBase[] = TEXTOS.map((texto, i) => ({
  codigo: `P${String(i + 1).padStart(2, '0')}`,
  texto,
}));

/** Nombre de la propiedad de Notion de una pregunta: «P01 · ¿Quiénes…». */
export const propiedadDe = (pregunta: PreguntaBase) => `${pregunta.codigo} · ${pregunta.texto}`;

export const ROLES = ['PM', 'Diseño', 'Ingeniería', 'Negocio', 'Otro'] as const;

export const ESTADOS_ENTREVISTA = ['Pendiente', 'Base respondida', 'Repreguntas pendientes', 'Completa'] as const;
export type EstadoEntrevista = (typeof ESTADOS_ENTREVISTA)[number];

/** Tope de repreguntas por miembro (Fase 4). */
export const MAX_REPREGUNTAS = 5;

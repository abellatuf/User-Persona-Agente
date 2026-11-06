import { z } from 'zod';
import { normalizar } from '../../guards/claves.js';
import { recortar } from '../../notion/propiedades.js';

/**
 * Reglas del plan de validación que controla el código, no el modelo (H8, HU-14):
 * método válido, perfil, de 3 a 5 preguntas y ninguna pregunta sesgada.
 */

export const METODOS = ['Entrevista', 'Encuesta', 'Prueba', 'Analítica'] as const;
export type Metodo = (typeof METODOS)[number];
export const MIN_PREGUNTAS = 3;
export const MAX_PREGUNTAS = 5;
const MAX_CARACTERES_SUPUESTO = 300;
const MAX_CARACTERES_PERFIL = 300;
const MAX_CARACTERES_PREGUNTA = 300;

export const esquemaPlan = z.object({
  supuestos: z.array(
    z.object({
      atributo: z.string(),
      supuesto: z.string(),
      metodo: z.string(),
      perfil: z.string(),
      preguntas: z.array(z.string()),
    }),
  ),
});

export type PlanPropuesto = z.infer<typeof esquemaPlan>['supuestos'][number];

export interface PlanValidado {
  ref: string;
  supuesto: string;
  metodo: Metodo;
  perfil: string;
  preguntas: string[];
}

/**
 * Verbos en condicional que piden imaginar el futuro («¿Pagarías…?»): la gente contesta lo
 * que cree que haría, no lo que hace. Se pregunta por lo que hizo.
 */
const FUTURO_O_HIPOTESIS =
  /\b(pagarias|usarias|comprarias|contratarias|probarias|recomendarias|cambiarias|elegirias|adoptarias|abonarias|te gustaria|te interesaria|estarias dispuest[oa]s?|estaria dispuest[oa]|estarian dispuest[oa]s|si existiera|si hubiera|si tuvieras)\b/;

/** Palabras con contenido (4 letras o más) de un texto normalizado. */
const palabras = (texto: string) => normalizar(texto).split(' ').filter((p) => p.length >= 4);

/**
 * Motivo por el que una pregunta está sesgada, o null si está bien:
 * - empieza con «¿No…?», que sugiere la respuesta;
 * - pregunta por el futuro o por una hipótesis;
 * - repite la afirmación del atributo (así se la confirma en lugar de validarla).
 */
export function sesgoDePregunta(pregunta: string, afirmacion: string): string | null {
  const texto = pregunta.trim();
  if (!texto.includes('?')) return 'no es una pregunta (falta el signo «?»)';
  const normal = normalizar(texto);
  if (/^no\b/.test(normal)) return 'empieza con «¿No…?» y sugiere la respuesta';
  if (FUTURO_O_HIPOTESIS.test(normal)) return 'pregunta por el futuro o por una hipótesis; preguntá por lo que la persona hizo';
  const deLaAfirmacion = [...new Set(palabras(afirmacion))];
  if (deLaAfirmacion.length >= 3) {
    const enLaPregunta = new Set(palabras(texto));
    const repetidas = deLaAfirmacion.filter((p) => enLaPregunta.has(p)).length;
    if (repetidas / deLaAfirmacion.length >= 0.6) return 'repite la afirmación del atributo y sugiere la respuesta';
  }
  return null;
}

export interface ResultadoValidacion {
  validos: PlanValidado[];
  /** Problemas por referencia (A1…), para pedir una corrección. */
  problemas: Map<string, string[]>;
}

/**
 * Valida el plan de cada atributo (A1, A2…). Un plan con problemas no se acepta: el código
 * pide una corrección y, si sigue mal, lo descarta.
 */
export function validarPlanes(propuestos: PlanPropuesto[], atributos: Map<string, { afirmacion: string }>): ResultadoValidacion {
  const validos: PlanValidado[] = [];
  const problemas = new Map<string, string[]>();
  const vistos = new Set<string>();
  for (const s of propuestos) {
    const ref = s.atributo.trim().toUpperCase().replace(/[^A0-9]/g, '');
    const atributo = atributos.get(ref);
    if (!atributo || vistos.has(ref)) continue;
    vistos.add(ref);
    const lista: string[] = [];
    const supuesto = recortar(s.supuesto.trim(), MAX_CARACTERES_SUPUESTO);
    const metodo = METODOS.find((m) => normalizar(m) === normalizar(s.metodo));
    const perfil = recortar(s.perfil.trim(), MAX_CARACTERES_PERFIL);
    if (!supuesto) lista.push('falta el supuesto');
    if (!metodo) lista.push(`el método «${s.metodo}» no es Entrevista, Encuesta, Prueba ni Analítica`);
    if (!perfil) lista.push('falta el perfil a contactar');

    const preguntas: string[] = [];
    for (const original of s.preguntas) {
      const pregunta = recortar(original.trim(), MAX_CARACTERES_PREGUNTA);
      if (!pregunta) continue;
      const sesgo = sesgoDePregunta(pregunta, atributo.afirmacion);
      if (sesgo) lista.push(`la pregunta «${pregunta}» ${sesgo}`);
      else if (!preguntas.some((q) => normalizar(q) === normalizar(pregunta))) preguntas.push(pregunta);
    }
    if (preguntas.length < MIN_PREGUNTAS) lista.push(`tiene ${preguntas.length} pregunta(s) válida(s) y hacen falta al menos ${MIN_PREGUNTAS}`);

    if (lista.length > 0 || !metodo) problemas.set(ref, lista);
    else validos.push({ ref, supuesto, metodo, perfil, preguntas: preguntas.slice(0, MAX_PREGUNTAS) });
  }
  for (const ref of atributos.keys()) {
    if (!vistos.has(ref)) problemas.set(ref, ['el modelo no propuso un plan para este atributo']);
  }
  return { validos, problemas };
}

/** Texto de «Preguntas sugeridas»: una por renglón, numeradas. */
export const textoDePreguntas = (preguntas: string[]) => preguntas.map((q, i) => `${i + 1}. ${q}`).join('\n');

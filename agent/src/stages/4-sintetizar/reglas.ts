import { z } from 'zod';
import { normalizar } from '../../guards/claves.js';
import { calcularConfianza, type Confianza, type TipoEvidencia } from '../../guards/confianza.js';
import type { FilaContexto, FilaEntrevista, FilaEvidencia } from '../../notion/espacio.js';
import { recortar } from '../../notion/propiedades.js';
import { CAMPOS, estaLibre } from '../1-armar-contexto/campos.js';

/**
 * Reglas de la síntesis que controla el código, no el modelo (H7, decisiones A a D):
 * evidencia real, confianza calculada, divergencias con su autor y topes.
 */

export const MAX_PERSONAS = 5;
export const MAX_ATRIBUTOS = 10;
export const CATEGORIAS = ['Objetivo', 'Problema', 'Comportamiento', 'Contexto'] as const;
const MAX_CARACTERES_EXTRACTO = 500;
const MAX_CARACTERES_AFIRMACION = 300;
export const FUENTE_CONTEXTO = 'Contexto confirmado por el PM';

const TIPOS: readonly TipoEvidencia[] = ['Supuesto del equipo', 'Pública', 'Investigación propia'];

export const esquemaSegmentos = z.object({
  segmentos: z.array(
    z.object({
      nombre: z.string(),
      porQueDistinto: z.string(),
      evidencias: z.array(z.string()),
      personaExistente: z.string(),
    }),
  ),
  informacionQueFalta: z.string(),
});

export const esquemaPersona = z.object({
  atributos: z.array(
    z.object({
      afirmacion: z.string(),
      categoria: z.string(),
      evidencias: z.array(z.string()),
      posturas: z.array(z.object({ postura: z.string(), evidencias: z.array(z.string()), campoDelContexto: z.string().default('') })),
      atributoExistente: z.string().default(''),
    }),
  ),
  informacionQueFalta: z.string(),
  cambiosRespectoDeLaAnterior: z.string(),
});

/** Una fila de Evidencia lista para el prompt: con su referencia corta (E1…) y de quién es. */
export interface EvidenciaPreparada {
  ref: string;
  id: string;
  tipo: TipoEvidencia | null;
  /** Quién la sostiene: "Ana (PM)", "Pública: título"… Distingue fuentes en una divergencia. */
  fuente: string;
  texto: string;
  /** Creación de la fila en Notion: junto con «Sintetizada el» dice si es evidencia nueva (H8). */
  creada: string | null;
}

/**
 * Tipo de una evidencia. Una fila cargada con el formulario de investigación puede no
 * tener «Tipo»: si tiene método o viene de ese formulario, es investigación propia.
 */
export function tipoDe(fila: FilaEvidencia): TipoEvidencia | null {
  if (fila.tipo && (TIPOS as readonly string[]).includes(fila.tipo)) return fila.tipo as TipoEvidencia;
  if (fila.metodo || fila.etapa === 'Formulario de investigación') return 'Investigación propia';
  return null;
}

export const quienRespondio = (e: FilaEntrevista) => `${e.nombreMiembro || 'Sin nombre'} (${e.rolMiembro ?? 'Otro'})`;

/**
 * Asigna E1, E2… a la evidencia que entra en la síntesis. La del equipo solo entra si su
 * entrevista está incluida; el autor sale de la entrevista, no del modelo.
 */
export function prepararEvidencias(filas: FilaEvidencia[], incluidas: FilaEntrevista[], todas: FilaEntrevista[]): EvidenciaPreparada[] {
  const porId = new Map(todas.map((e) => [e.id, e]));
  const incluidasIds = new Set(incluidas.map((e) => e.id));
  const preparadas: EvidenciaPreparada[] = [];
  for (const fila of filas) {
    const tipo = tipoDe(fila);
    // El PM la sacó con «Excluir de la síntesis» (H8).
    if (fila.excluida || (!fila.extracto && !fila.titulo)) continue;
    let fuente: string;
    if (tipo === 'Supuesto del equipo') {
      const entrevista = fila.entrevistas.map((id) => porId.get(id)).find((e) => e !== undefined);
      if (entrevista && !incluidasIds.has(entrevista.id)) continue;
      fuente = entrevista ? quienRespondio(entrevista) : 'Equipo (sin entrevista vinculada)';
    } else if (tipo === 'Pública') {
      fuente = `Pública: ${fila.titulo || fila.url || fila.id}`;
    } else if (tipo === 'Investigación propia') {
      fuente = `Investigación propia: ${fila.titulo || fila.id}`;
    } else {
      fuente = `Sin tipo: ${fila.titulo || fila.id}`;
    }
    const detalle = [fila.titulo, fila.metodo ? `método: ${fila.metodo}` : '', fila.muestra ? `muestra: ${fila.muestra}` : '']
      .filter(Boolean)
      .join(' · ');
    preparadas.push({
      ref: `E${preparadas.length + 1}`,
      id: fila.id,
      tipo,
      fuente,
      texto: `${tipo ?? 'Sin tipo'} · ${fuente} · ${detalle}\n${recortar(fila.extracto, MAX_CARACTERES_EXTRACTO)}`,
      creada: fila.creada,
    });
  }
  return preparadas;
}

/** Busca las referencias (E12, e12, «E12»…). Las que no existen quedan anotadas. */
function resolver(refs: string[], mapa: Map<string, EvidenciaPreparada>, donde: string, notas: string[]): EvidenciaPreparada[] {
  const encontradas: EvidenciaPreparada[] = [];
  for (const ref of refs) {
    const limpia = ref.trim().toUpperCase().replace(/[^E0-9]/g, '');
    const e = mapa.get(limpia);
    if (e) encontradas.push(e);
    else notas.push(`${donde}: se descartó la referencia «${ref}», que no es una evidencia de la síntesis.`);
  }
  return encontradas;
}

const unicas = (evidencias: EvidenciaPreparada[]) => [...new Map(evidencias.map((e) => [e.id, e])).values()];

export interface AtributoValidado {
  afirmacion: string;
  categoria: (typeof CATEGORIAS)[number];
  evidencias: EvidenciaPreparada[];
  divergencia: boolean;
  /** Texto para «Posturas»: cada postura con sus fuentes, puestas por el código. */
  posturas: string;
  confianza: Confianza;
  /** Referencia del atributo actual al que corresponde (A1…), tal como la mandó el modelo. */
  existente: string;
}

/** Campos del contexto con contenido, por nombre normalizado: una postura del contexto los copia tal cual. */
export function camposConTexto(contexto: FilaContexto | undefined): Map<string, { nombre: string; texto: string }> {
  const campos = new Map<string, { nombre: string; texto: string }>();
  for (const { propiedad } of CAMPOS) {
    const texto = contexto?.textos[propiedad]?.trim();
    if (texto && !estaLibre(texto)) campos.set(normalizar(propiedad), { nombre: propiedad, texto });
  }
  return campos;
}

/**
 * Valida los atributos que propuso el modelo para una persona:
 * - la categoría es una de las cuatro;
 * - cada evidencia citada existe (decisión A) y queda al menos una (trazabilidad);
 * - una postura del contexto lleva el texto del campo, copiado por el código, no el del modelo;
 * - hay divergencia solo si al menos dos posturas tienen fuentes distintas, sin compartir ninguna (decisión C);
 * - la confianza la calcula el código (decisión B);
 * - hasta MAX_ATRIBUTOS, sin repetidos (decisión D).
 */
export function validarAtributos(
  propuestos: z.infer<typeof esquemaPersona>['atributos'],
  mapa: Map<string, EvidenciaPreparada>,
  persona: string,
  notas: string[],
  campos: Map<string, { nombre: string; texto: string }>,
): AtributoValidado[] {
  const aceptados: AtributoValidado[] = [];
  const vistas = new Set<string>();
  for (const a of propuestos) {
    const afirmacion = recortar(a.afirmacion.trim(), MAX_CARACTERES_AFIRMACION);
    const donde = `${persona} · «${afirmacion}»`;
    const categoria = CATEGORIAS.find((c) => normalizar(c) === normalizar(a.categoria));
    if (!afirmacion) continue;
    if (!categoria) {
      notas.push(`${donde}: atributo descartado, la categoría «${a.categoria}» no es Objetivo, Problema, Comportamiento ni Contexto.`);
      continue;
    }
    if (vistas.has(normalizar(afirmacion))) continue;

    const respaldo = resolver(a.evidencias, mapa, donde, notas);
    const posturas = a.posturas.map((po) => {
      const evidencias = resolver(po.evidencias, mapa, donde, notas);
      const fuentes = new Set(evidencias.map((e) => e.fuente));
      let texto = po.postura.trim();
      const pedido = po.campoDelContexto.trim();
      if (pedido) {
        const campo = campos.get(normalizar(pedido));
        if (campo) {
          fuentes.add(FUENTE_CONTEXTO);
          const literal = `Campo ${campo.nombre}: «${campo.texto}»`;
          texto = evidencias.length > 0 && texto ? `${texto} · ${literal}` : literal;
        } else {
          notas.push(`${donde}: se descartó la fuente de contexto «${pedido}», que no es un campo con contenido.`);
        }
      }
      return { texto, evidencias, fuentes };
    });
    const validas = posturas.filter((po) => po.texto && po.fuentes.size > 0);
    const evidencias = unicas([...respaldo, ...validas.flatMap((po) => po.evidencias)]);
    if (evidencias.length === 0) {
      notas.push(`${donde}: atributo descartado, no cita ninguna evidencia válida (trazabilidad).`);
      continue;
    }

    let divergencia = false;
    let textoPosturas = '';
    if (validas.length >= 2) {
      const todas = validas.flatMap((po) => [...po.fuentes]);
      const sinRepetir = new Set(todas);
      if (sinRepetir.size === todas.length) {
        divergencia = true;
        textoPosturas = validas.map((po) => `• ${po.texto} — ${[...po.fuentes].join('; ')}`).join('\n');
      } else {
        notas.push(`${donde}: no se marca divergencia, porque una misma fuente aparece en más de una postura.`);
      }
    } else if (a.posturas.length > 0) {
      notas.push(`${donde}: no se marca divergencia, porque no hay al menos dos posturas con evidencia.`);
    }

    if (aceptados.length >= MAX_ATRIBUTOS) {
      notas.push(`${donde}: atributo descartado, la persona ya tiene ${MAX_ATRIBUTOS} (tope por persona).`);
      continue;
    }
    vistas.add(normalizar(afirmacion));
    aceptados.push({
      afirmacion,
      categoria,
      evidencias,
      divergencia,
      posturas: textoPosturas,
      existente: a.atributoExistente,
      confianza: calcularConfianza(
        evidencias.map((e) => ({ id: e.id, tipo: e.tipo })),
        divergencia,
      ),
    });
  }
  return aceptados;
}

export interface SegmentoValidado {
  nombre: string;
  porQueDistinto: string;
  /** Referencia de la persona existente (P1…) a la que corresponde, si la hay. */
  personaExistente: string | null;
}

/** Hasta MAX_PERSONAS segmentos con nombre, sin repetir nombre ni persona existente. */
export function validarSegmentos(
  propuestos: z.infer<typeof esquemaSegmentos>['segmentos'],
  refsPersonas: Set<string>,
  notas: string[],
): SegmentoValidado[] {
  const aceptados: SegmentoValidado[] = [];
  const nombres = new Set<string>();
  const usadas = new Set<string>();
  for (const s of propuestos) {
    const nombre = recortar(s.nombre.trim(), 100);
    if (!nombre || nombres.has(normalizar(nombre))) continue;
    if (aceptados.length >= MAX_PERSONAS) {
      notas.push(`Segmento «${nombre}» descartado: ya hay ${MAX_PERSONAS} personas (tope por síntesis).`);
      continue;
    }
    let existente: string | null = s.personaExistente.trim().toUpperCase() || null;
    if (existente && !refsPersonas.has(existente)) {
      notas.push(`Segmento «${nombre}»: la persona «${s.personaExistente}» no existe, se trata como nueva.`);
      existente = null;
    }
    if (existente && usadas.has(existente)) {
      notas.push(`Segmento «${nombre}»: ${existente} ya corresponde a otro segmento, se trata como nueva.`);
      existente = null;
    }
    if (existente) usadas.add(existente);
    nombres.add(normalizar(nombre));
    aceptados.push({ nombre, porQueDistinto: s.porQueDistinto.trim(), personaExistente: existente });
  }
  return aceptados;
}

/** Resumen de la persona (HU-11): lo arma el código con lo que se escribió. */
export function armarResumen(datos: {
  atributos: AtributoValidado[];
  entrevistas: number;
  informacionQueFalta: string;
  hayPublica: boolean;
  hayPropia: boolean;
  notaEntrevistas: string;
}): string {
  const usadas = unicas(datos.atributos.flatMap((a) => a.evidencias));
  const contar = (tipo: TipoEvidencia) => usadas.filter((e) => e.tipo === tipo).length;
  const nivel = (c: Confianza) => datos.atributos.filter((a) => a.confianza === c).length;
  const divergencias = datos.atributos.filter((a) => a.divergencia);
  const lineas = [
    `Fuentes usadas: ${contar('Supuesto del equipo')} evidencias del equipo (de ${datos.entrevistas} entrevistas), ${contar('Pública')} públicas y ${contar('Investigación propia')} de investigación propia. ${datos.notaEntrevistas}`,
    `Atributos: ${datos.atributos.length} (Alta ${nivel('Alta')} · Media ${nivel('Media')} · Baja ${nivel('Baja')}).`,
    divergencias.length
      ? `Divergencias: ${divergencias.length} — ${divergencias.map((a) => `«${a.afirmacion}»`).join('; ')}.`
      : 'Divergencias: ninguna.',
    `Falta: ${datos.informacionQueFalta.trim() || 'No encontrado'}`,
  ];
  if (!datos.hayPublica) lineas.push('No hay evidencia pública: la síntesis se apoya solo en el equipo y la investigación propia.');
  if (!datos.hayPropia) lineas.push('Todavía no hay investigación propia, así que ningún atributo puede tener confianza Alta.');
  return lineas.join('\n');
}

/**
 * Propiedad «Controles»: qué controles pasó la persona y qué falta (Fase 4).
 * La arman la síntesis y la etapa 5: todo atributo tiene evidencia por la regla de trazabilidad.
 */
export function armarControles(atributos: number, plan: { bajas: number; conPlan: number }): string {
  const evidencia = atributos > 0 ? `✅ ${atributos} de ${atributos} atributos con evidencia (100 %)` : '⚠️ La persona no tiene atributos';
  const supuestos =
    plan.bajas === 0
      ? '✅ No hay atributos de confianza baja'
      : plan.conPlan >= plan.bajas
        ? `✅ ${plan.bajas} de ${plan.bajas} supuestos de confianza baja con plan`
        : `⏳ ${plan.conPlan} de ${plan.bajas} supuestos de confianza baja con plan: pedí «Planificar validación»`;
  return [evidencia, '✅ Confianza calculada por código', supuestos].join(' · ');
}

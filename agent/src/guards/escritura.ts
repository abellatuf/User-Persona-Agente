import type { ClaveBase } from '../config.js';
import { texto } from '../notion/propiedades.js';
import { ESQUEMA_ESPERADO } from '../stages/0-verificar-espacio/esquema-esperado.js';

/**
 * Reglas que se aplican antes de cada escritura en Notion (T2.2 a T2.4 y T2.6).
 * Son funciones puras: reciben la operación y, si la bloquean, devuelven el motivo.
 */

export type Propiedades = Record<string, unknown>;

/** Lo que el agente sabe de la página antes de modificarla o archivarla. */
export interface EstadoActual {
  estado: string | null;
  editadoPorPm: boolean;
  ultimaEdicionDelAgente: boolean;
  creadaPorAgente: boolean;
  /** Para atributos: la persona a la que pertenece ya no está en Borrador. */
  personaCongelada: boolean;
  /** La página está en otra base que la declarada. */
  deOtraBase: boolean;
}

export interface OperacionEscritura {
  accion: 'crear' | 'actualizar' | 'archivar';
  base: ClaveBase;
  propiedades: Propiedades;
  actual?: EstadoActual;
}

/** Bases cuyas filas crea el agente y que necesitan clave para no duplicarse. */
export const BASES_CON_CLAVE: readonly ClaveBase[] = ['evidencia', 'atributos', 'personas', 'supuestos'];

/** Bases en las que hay que leer la página antes de modificarla o archivarla. */
export const BASES_CON_LECTURA_PREVIA: readonly ClaveBase[] = ['contexto', 'personas', 'atributos', 'evidencia', 'supuestos'];

/** Bases en las que el agente puede archivar filas. */
const BASES_ARCHIVABLES: readonly ClaveBase[] = ['atributos', 'supuestos', 'evidencia'];

const ESTADOS_SOLO_DEL_PM: Partial<Record<ClaveBase, readonly string[]>> = {
  personas: ['En revisión', 'Aprobada', 'Rechazada'],
  contexto: ['Confirmado'],
};

const nombreBase = (base: ClaveBase) => ESQUEMA_ESPERADO[base].nombre;

/** Lee el nombre de un estado o selección en formato de escritura ({ status: { name } }). */
export function valorElegido(valor: unknown): string | null {
  const v = valor as { status?: { name?: string } | null; select?: { name?: string } | null } | undefined;
  return v?.status?.name ?? v?.select?.name ?? null;
}

function vinculos(valor: unknown): number | null {
  const v = valor as { relation?: unknown[] } | undefined;
  return Array.isArray(v?.relation) ? v.relation.length : null;
}

function textoEscrito(valor: unknown): string {
  const v = valor as { rich_text?: Array<{ text?: { content?: string } }>; title?: Array<{ text?: { content?: string } }> };
  return (v?.rich_text ?? v?.title ?? []).map((t) => t.text?.content ?? '').join('');
}

type Regla = (op: OperacionEscritura) => string | null;

const soloBasesDelProyecto: Regla = (op) => (op.actual?.deOtraBase ? `la página no pertenece a la base «${nombreBase(op.base)}».` : null);

const estadosProhibidos: Regla = (op) => {
  const elegido = valorElegido(op.propiedades['Estado']);
  const prohibidos = ESTADOS_SOLO_DEL_PM[op.base] ?? [];
  return elegido && prohibidos.includes(elegido)
    ? `el estado «${elegido}» en «${nombreBase(op.base)}» solo lo puede poner el PM.`
    : null;
};

const personaSoloEnBorrador: Regla = (op) => {
  if (op.base !== 'personas' || op.accion !== 'actualizar' || !op.actual) return null;
  const actual = op.actual.estado;
  if (actual === null || actual === 'Borrador') return null;
  // La única escritura permitida sobre una persona aprobada es marcarla como reemplazada.
  const claves = Object.keys(op.propiedades);
  const soloReemplazar = actual === 'Aprobada' && claves.length === 1 && valorElegido(op.propiedades['Estado']) === 'Reemplazada';
  return soloReemplazar ? null : `la persona está en «${actual}»: el agente solo modifica personas en Borrador.`;
};

const contextoConfirmadoIntocable: Regla = (op) =>
  op.base === 'contexto' && op.accion === 'actualizar' && op.actual?.estado === 'Confirmado'
    ? 'el contexto ya está Confirmado por el PM y el agente no lo modifica.'
    : null;

const atributoDePersonaCongelada: Regla = (op) =>
  op.base === 'atributos' && op.accion !== 'crear' && op.actual?.personaCongelada
    ? 'el atributo pertenece a una persona que ya no está en Borrador.'
    : null;

const archivoPermitido: Regla = (op) => {
  if (op.accion !== 'archivar') return null;
  if (!BASES_ARCHIVABLES.includes(op.base)) return `el agente no archiva filas de «${nombreBase(op.base)}».`;
  const actual = op.actual;
  if (!actual) return 'no se pudo leer la página antes de archivarla.';
  if (!actual.creadaPorAgente) return 'el agente solo archiva filas que creó él.';
  if (op.base === 'atributos' && (actual.editadoPorPm || !actual.ultimaEdicionDelAgente)) {
    return 'el atributo tiene ediciones del PM y no se archiva.';
  }
  if (op.base === 'supuestos' && actual.estado !== null && actual.estado !== 'Pendiente') {
    return `el supuesto está en «${actual.estado}» y no se archiva.`;
  }
  return null;
};

const trazabilidad: Regla = (op) => {
  if (op.base !== 'atributos' || op.accion === 'archivar') return null;
  const n = vinculos(op.propiedades['Evidencias']);
  if (op.accion === 'crear' && !n) return 'un atributo no se puede crear sin evidencia vinculada.';
  if (op.accion === 'actualizar' && n === 0) return 'un atributo no puede quedar sin evidencia vinculada.';
  return null;
};

const claveObligatoria: Regla = (op) =>
  op.accion === 'crear' && BASES_CON_CLAVE.includes(op.base) && !textoEscrito(op.propiedades['Clave'])
    ? `las filas de «${nombreBase(op.base)}» necesitan una clave para no duplicarse.`
    : null;

const REGLAS: Regla[] = [
  soloBasesDelProyecto,
  estadosProhibidos,
  personaSoloEnBorrador,
  contextoConfirmadoIntocable,
  atributoDePersonaCongelada,
  archivoPermitido,
  trazabilidad,
  claveObligatoria,
];

/** Devuelve el motivo del bloqueo, o null si la escritura está permitida. */
export function evaluarEscritura(op: OperacionEscritura): string | null {
  for (const regla of REGLAS) {
    const motivo = regla(op);
    if (motivo) return motivo;
  }
  return null;
}

// No pisar al PM (T2.4).

const NO_SE_SUGIEREN = new Set(['Clave', 'Sugerencia del agente', 'Editado por el PM']);

function describirValor(valor: unknown): string {
  const v = valor as Record<string, unknown>;
  if ('title' in v || 'rich_text' in v) return `«${textoEscrito(valor)}»`;
  if ('select' in v || 'status' in v) return valorElegido(valor) ?? '(vacío)';
  if ('number' in v) return String(v['number']);
  if ('checkbox' in v) return v['checkbox'] ? 'Sí' : 'No';
  if ('relation' in v) return `${vinculos(valor)} vínculo(s)`;
  if ('date' in v) return String((v['date'] as { start?: string } | null)?.start ?? '(vacía)');
  return JSON.stringify(valor);
}

/** Texto de la sugerencia: lo que el agente habría escrito, propiedad por propiedad. */
export function describirPropuesta(propiedades: Propiedades): string {
  const partes = Object.entries(propiedades)
    .filter(([nombre]) => !NO_SE_SUGIEREN.has(nombre))
    .map(([nombre, valor]) => `${nombre}: ${describirValor(valor)}`);
  return `Propuesta del agente: ${partes.join(' · ')}`;
}

/**
 * Si el PM editó el atributo (o ya estaba marcado como editado), el agente no pisa
 * sus campos: deja la propuesta en «Sugerencia del agente» y marca «Editado por el PM».
 * Devuelve la operación a ejecutar y si fue redirigida.
 */
export function respetarEdicionesDelPm(op: OperacionEscritura): { op: OperacionEscritura; redirigida: boolean } {
  const actual = op.actual;
  const editadoPorPm = actual && (actual.editadoPorPm || !actual.ultimaEdicionDelAgente);
  if (op.base !== 'atributos' || op.accion !== 'actualizar' || !editadoPorPm) return { op, redirigida: false };
  return {
    op: {
      ...op,
      propiedades: {
        'Sugerencia del agente': texto(describirPropuesta(op.propiedades)),
        'Editado por el PM': { checkbox: true },
      },
    },
    redirigida: true,
  };
}

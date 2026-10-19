import type { Generador } from '../llm/index.js';
import type { EspacioNotion, EtapaSolicitable, Solicitud } from '../notion/espacio.js';
import { armarContexto } from './1-armar-contexto/index.js';

export interface ContextoEtapa {
  solicitud: Solicitud;
  /** Lecturas con espacio, escrituras siempre con espacio.escritor (pasan por las reglas). */
  espacio: EspacioNotion;
  /** Acceso a los modelos. Ausente si faltan las claves o los modelos de Configuración no son válidos. */
  generar?: Generador;
  /** Por qué no hay modelo disponible, para explicarlo en Ejecuciones. */
  sinModelo?: string;
}

export interface ResultadoEtapa {
  resultado: 'Lista' | 'Error' | 'Incompleta';
  notas: string[];
  errores: string[];
  /** Proveedor y modelo de lenguaje usados, o "Ninguno". */
  proveedorModelo: string;
}

export type FuncionEtapa = (ctx: ContextoEtapa) => Promise<ResultadoEtapa>;

/** Marcador del H1: la etapa todavía no existe, termina sin llamar a ningún modelo. */
const marcador: FuncionEtapa = async () => ({
  resultado: 'Lista',
  notas: ['Etapa no implementada todavía (H1: esqueleto). No se llamó a ningún modelo.'],
  errores: [],
  proveedorModelo: 'Ninguno (H1)',
});

/**
 * Precondición de las etapas 2 a 5 (T4.4): el contexto tiene que estar Confirmado por el PM.
 * Devuelve el motivo si no lo está, o null.
 */
export async function motivoSinContextoConfirmado(espacio: EspacioNotion, etapa: string): Promise<string | null> {
  const filas = await espacio.leerContextos();
  if (filas.length === 1 && filas[0]!.estado === 'Confirmado') return null;
  if (filas.length > 1) {
    return `La base «Contexto del producto» tiene ${filas.length} filas y tiene que haber una sola. No se puede pedir «${etapa}» hasta resolverlo.`;
  }
  return `El contexto del producto no está Confirmado. Pedí «Armar contexto» (o cargalo a mano), revisalo y marcalo como Confirmado antes de pedir «${etapa}».`;
}

export function conContextoConfirmado(etapa: string, funcion: FuncionEtapa): FuncionEtapa {
  return async (ctx) => {
    const motivo = await motivoSinContextoConfirmado(ctx.espacio, etapa);
    if (motivo) return { resultado: 'Error', notas: [], errores: [motivo], proveedorModelo: 'Ninguno' };
    return funcion(ctx);
  };
}

export const ETAPAS: Record<EtapaSolicitable, FuncionEtapa> = {
  'Armar contexto': armarContexto,
  Repreguntar: conContextoConfirmado('Repreguntar', marcador),
  'Relevar la web': conContextoConfirmado('Relevar la web', marcador),
  Sintetizar: conContextoConfirmado('Sintetizar', marcador),
  'Planificar validación': conContextoConfirmado('Planificar validación', marcador),
};

import { BASES, type ClaveBase } from '../../config.js';
import type { EsquemaBase, EspacioNotion } from '../../notion/espacio.js';
import { ESQUEMA_ESPERADO, type BaseEsperada } from './esquema-esperado.js';

export interface ResultadoVerificacion {
  ok: boolean;
  /** Lista legible de lo que falta o no coincide, para el PM. */
  faltantes: string[];
}

/** Compara el esquema real de una base con el esperado. Función pura. */
export function compararEsquema(esperada: BaseEsperada, real: EsquemaBase | null): string[] {
  if (!real) {
    return [`Falta la base «${esperada.nombre}» (no existe o no está compartida con la integración).`];
  }
  const faltantes: string[] = [];
  for (const [nombre, prop] of Object.entries(esperada.propiedades)) {
    const actual = real.propiedades[nombre];
    if (!actual) {
      faltantes.push(`${esperada.nombre}: falta la propiedad «${nombre}» (${prop.tipo}).`);
      continue;
    }
    if (actual.tipo !== prop.tipo) {
      faltantes.push(`${esperada.nombre}: «${nombre}» es de tipo ${actual.tipo} y debería ser ${prop.tipo}.`);
      continue;
    }
    const sinOpcion = (prop.opciones ?? []).filter((o) => !actual.opciones?.includes(o));
    if (sinOpcion.length > 0) {
      faltantes.push(`${esperada.nombre}: a «${nombre}» le faltan las opciones ${sinOpcion.map((o) => `«${o}»`).join(', ')}.`);
    }
  }
  return faltantes;
}

/** Etapa 0: verifica que estén todas las bases y propiedades obligatorias. */
export async function verificarEspacio(espacio: EspacioNotion): Promise<ResultadoVerificacion> {
  const faltantes: string[] = [];
  for (const clave of Object.keys(ESQUEMA_ESPERADO) as ClaveBase[]) {
    const real = await espacio.leerEsquema(BASES[clave]);
    faltantes.push(...compararEsquema(ESQUEMA_ESPERADO[clave], real));
  }
  return { ok: faltantes.length === 0, faltantes };
}

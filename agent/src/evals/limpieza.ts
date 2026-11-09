import { BASES_EVALUACION, type ClaveBase } from '../config.js';
import type { LlamadorHerramientas } from '../notion/cliente-mcp.js';
import { resultadoConsulta } from '../schemas/notion.js';

/** Bases que se vacían antes de cada evaluación. Configuración queda: la carga el PM una vez. */
export const BASES_A_VACIAR: readonly ClaveBase[] = [
  'solicitudes',
  'ejecuciones',
  'supuestos',
  'atributos',
  'personas',
  'evidencia',
  'entrevistas',
  'contexto',
  'equipo',
];

/**
 * Comprueba que las bases sean las del espacio de evaluación, clave por clave.
 * Es la única defensa entre la limpieza y el espacio del PM: no depende de ESPACIO.
 */
export function esEspacioDeEvaluacion(bases: Readonly<Record<ClaveBase, string>>): boolean {
  return (Object.keys(BASES_EVALUACION) as ClaveBase[]).every((c) => bases[c] === BASES_EVALUACION[c]);
}

/**
 * Manda a la papelera todas las filas del espacio de evaluación, salvo Configuración.
 * Se niega si las bases no son las de evaluación. Devuelve cuántas filas archivó por base.
 */
export async function vaciarEspacioDeEvaluacion(
  mcp: LlamadorHerramientas,
  bases: Readonly<Record<ClaveBase, string>>,
): Promise<Partial<Record<ClaveBase, number>>> {
  if (!esEspacioDeEvaluacion(bases)) {
    throw new Error('La limpieza solo corre sobre el espacio de evaluación: las bases recibidas no son esas.');
  }
  const archivadas: Partial<Record<ClaveBase, number>> = {};
  for (const clave of BASES_A_VACIAR) {
    let total = 0;
    // Cada vuelta vuelve a consultar desde el principio: las filas archivadas ya no aparecen.
    for (;;) {
      const r = resultadoConsulta.parse(
        await mcp.llamar('API-query-data-source', { data_source_id: bases[clave], page_size: 100 }),
      );
      const vivas = r.results.filter((f) => !f.in_trash);
      if (vivas.length === 0) break;
      for (const fila of vivas) {
        if (fila.parent?.data_source_id && fila.parent.data_source_id !== bases[clave]) {
          throw new Error(`La fila ${fila.id} no es de la base que se está vaciando: se corta la limpieza.`);
        }
        await mcp.llamar('API-patch-page', { page_id: fila.id, in_trash: true });
        total++;
      }
    }
    archivadas[clave] = total;
  }
  return archivadas;
}

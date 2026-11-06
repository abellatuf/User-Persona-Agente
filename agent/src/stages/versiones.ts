import type { EspacioNotion } from '../notion/espacio.js';
import * as p from '../notion/propiedades.js';

/**
 * Persona viva (H8, HU-15): cuando el PM aprueba la versión siguiente de una persona aprobada,
 * la anterior pasa a «Reemplazada». Corre en cada ejecución, sin modelo. Es la única escritura
 * que el agente hace sobre una persona aprobada, y solo cambia el Estado.
 */
export async function marcarReemplazadas(espacio: EspacioNotion): Promise<string[]> {
  const personas = await espacio.leerPersonas();
  const porId = new Map(personas.map((x) => [x.id, x]));
  const notas: string[] = [];
  for (const anterior of personas.filter((x) => x.estado === 'Aprobada')) {
    const siguiente = anterior.versionSiguiente.map((id) => porId.get(id)).find((x) => x?.estado === 'Aprobada');
    if (!siguiente) continue;
    await espacio.escritor.actualizar('personas', anterior.id, { Estado: p.estado('Reemplazada') });
    notas.push(
      `Persona «${anterior.nombre}» (versión ${anterior.version ?? 1}): pasó a Reemplazada porque el PM aprobó la versión ${siguiente.version ?? '?'}.`,
    );
  }
  return notas;
}

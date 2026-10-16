/**
 * Cálculo del nivel de confianza de un atributo (regla de la Fase 3, T2.1).
 *
 * Una evidencia vinculada a un atributo significa que lo respalda: la evidencia
 * que lo contradice no se vincula, se registra como divergencia.
 */
export type TipoEvidencia = 'Supuesto del equipo' | 'Pública' | 'Investigación propia';
export type Confianza = 'Alta' | 'Media' | 'Baja';

export interface EvidenciaVinculada {
  /** Id de la fila de Evidencia: dos filas distintas son fuentes independientes. */
  id: string;
  tipo: TipoEvidencia | null;
}

export function calcularConfianza(evidencias: EvidenciaVinculada[], divergenciaSinResolver: boolean): Confianza {
  const contar = (tipo: TipoEvidencia) => new Set(evidencias.filter((e) => e.tipo === tipo).map((e) => e.id)).size;
  const propias = contar('Investigación propia');
  const publicas = contar('Pública');
  const delEquipo = contar('Supuesto del equipo');

  let confianza: Confianza;
  if (propias >= 2) confianza = 'Alta';
  else if (propias === 1 || (publicas >= 1 && delEquipo >= 1)) confianza = 'Media';
  else confianza = 'Baja';

  // Un atributo con divergencia sin resolver nunca tiene confianza alta.
  if (divergenciaSinResolver && confianza === 'Alta') confianza = 'Media';
  return confianza;
}

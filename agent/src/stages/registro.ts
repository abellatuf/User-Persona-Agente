import type { EspacioNotion, EtapaSolicitable, Solicitud } from '../notion/espacio.js';

export interface ContextoEtapa {
  solicitud: Solicitud;
  /** Lecturas con espacio, escrituras siempre con espacio.escritor (pasan por las reglas). */
  espacio: EspacioNotion;
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

export const ETAPAS: Record<EtapaSolicitable, FuncionEtapa> = {
  'Armar contexto': marcador,
  Repreguntar: marcador,
  'Relevar la web': marcador,
  Sintetizar: marcador,
  'Planificar validación': marcador,
};

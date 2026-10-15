import { BASES, type ClaveBase } from '../../src/config.js';
import type {
  AperturaEjecucion,
  CierreEjecucion,
  Configuracion,
  EsquemaBase,
  EspacioNotion,
  EstadoSolicitud,
  Solicitud,
} from '../../src/notion/espacio.js';
import { ESQUEMA_ESPERADO } from '../../src/stages/0-verificar-espacio/esquema-esperado.js';

/** Esquema "real" igual al esperado, en el formato de EsquemaBase. */
export function esquemaCompleto(clave: ClaveBase): EsquemaBase {
  const esperada = ESQUEMA_ESPERADO[clave];
  const propiedades: EsquemaBase['propiedades'] = {};
  for (const [nombre, prop] of Object.entries(esperada.propiedades)) {
    propiedades[nombre] = { tipo: prop.tipo, ...(prop.opciones ? { opciones: [...prop.opciones] } : {}) };
  }
  return { titulo: esperada.nombre, propiedades };
}

export interface FilaEjecucion {
  id: string;
  apertura: AperturaEjecucion;
  cierre?: CierreEjecucion;
}

/** Espacio de Notion en memoria para probar el bucle sin red. */
export class EspacioFalso implements EspacioNotion {
  configuracion: Configuracion = { agenteActivo: true };
  solicitudes: Array<Solicitud & { estado: EstadoSolicitud }> = [];
  esquemas = new Map<string, EsquemaBase | null>(
    (Object.keys(BASES) as ClaveBase[]).map((c) => [BASES[c], esquemaCompleto(c)]),
  );
  ejecuciones: FilaEjecucion[] = [];
  historialEstados: Array<{ id: string; estado: EstadoSolicitud }> = [];
  falla: Partial<Record<'leerConfiguracion' | 'marcarSolicitud' | 'crearEjecucion', Error>> = {};
  private lecturas = 0;
  private escrituras = 0;

  agregarSolicitud(s: Partial<Solicitud> & { id: string }) {
    this.solicitudes.push({ titulo: s.id, etapa: 'Armar contexto', opciones: '', estado: 'Pendiente', ...s });
  }

  estadoDe(id: string) {
    return this.solicitudes.find((s) => s.id === id)?.estado;
  }

  contadores() {
    return { lecturas: this.lecturas, escrituras: this.escrituras };
  }

  async leerConfiguracion() {
    this.lecturas++;
    if (this.falla.leerConfiguracion) throw this.falla.leerConfiguracion;
    return this.configuracion;
  }

  async solicitudesPendientes(maximo: number) {
    this.lecturas++;
    return this.solicitudes
      .filter((s) => s.estado === 'Pendiente')
      .slice(0, maximo)
      .map((s) => ({ id: s.id, titulo: s.titulo, etapa: s.etapa, opciones: s.opciones }));
  }

  async leerEsquema(id: string) {
    this.lecturas++;
    return this.esquemas.get(id) ?? null;
  }

  async marcarSolicitud(id: string, estado: EstadoSolicitud) {
    this.escrituras++;
    if (this.falla.marcarSolicitud) throw this.falla.marcarSolicitud;
    const s = this.solicitudes.find((x) => x.id === id);
    if (!s) throw new Error(`No existe la solicitud ${id}`);
    s.estado = estado;
    this.historialEstados.push({ id, estado });
  }

  async crearEjecucion(apertura: AperturaEjecucion) {
    this.escrituras++;
    if (this.falla.crearEjecucion) throw this.falla.crearEjecucion;
    const id = `ejec-${this.ejecuciones.length + 1}`;
    this.ejecuciones.push({ id, apertura });
    return id;
  }

  async cerrarEjecucion(id: string, cierre: CierreEjecucion) {
    this.escrituras++;
    const fila = this.ejecuciones.find((e) => e.id === id);
    if (!fila) throw new Error(`No existe la ejecución ${id}`);
    fila.cierre = cierre;
  }
}

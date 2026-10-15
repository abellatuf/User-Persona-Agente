import { BASES } from '../config.js';
import { dataSource, paginaCreada, resultadoConsulta } from '../schemas/notion.js';
import { ErrorNotion, type LlamadorHerramientas } from './cliente-mcp.js';
import * as p from './propiedades.js';

/** Etapas que el PM puede pedir desde Solicitudes. */
export const ETAPAS_SOLICITABLES = [
  'Armar contexto',
  'Repreguntar',
  'Relevar la web',
  'Sintetizar',
  'Planificar validación',
] as const;
export type EtapaSolicitable = (typeof ETAPAS_SOLICITABLES)[number];

export type EtapaEjecucion = 'Verificar espacio' | EtapaSolicitable;
export type EstadoSolicitud = 'Pendiente' | 'En curso' | 'Lista' | 'Error';
export type ResultadoEjecucion = 'Lista' | 'Error' | 'Incompleta' | 'Pausado' | 'Sin pendientes';

export interface Configuracion {
  agenteActivo: boolean;
}

export interface Solicitud {
  id: string;
  titulo: string;
  /** Texto tal como está en Notion; puede no ser una etapa válida. */
  etapa: string | null;
  opciones: string;
}

/** Esquema de una base: propiedad → tipo y, si es selección o estado, sus opciones. */
export interface EsquemaBase {
  titulo: string;
  propiedades: Record<string, { tipo: string; opciones?: string[] }>;
}

export interface AperturaEjecucion {
  titulo: string;
  inicio: Date;
  etapa?: EtapaEjecucion;
  solicitudId?: string;
}

export interface CierreEjecucion {
  fin: Date;
  resultado: ResultadoEjecucion;
  errores: string[];
  notas: string[];
  lecturas: number;
  escrituras: number;
  intentosBloqueados: number;
  proveedorModelo: string;
}

export interface Contadores {
  lecturas: number;
  escrituras: number;
}

/**
 * Acceso del agente a su espacio de Notion. El bucle y las etapas dependen de esta
 * interfaz y no de MCP, así se pueden probar con un espacio falso en memoria.
 */
export interface EspacioNotion {
  leerConfiguracion(): Promise<Configuracion>;
  solicitudesPendientes(maximo: number): Promise<Solicitud[]>;
  /** Devuelve null si la base no existe o no está compartida con la integración. */
  leerEsquema(dataSourceId: string): Promise<EsquemaBase | null>;
  marcarSolicitud(id: string, estado: EstadoSolicitud): Promise<void>;
  crearEjecucion(apertura: AperturaEjecucion): Promise<string>;
  cerrarEjecucion(id: string, cierre: CierreEjecucion): Promise<void>;
  contadores(): Contadores;
}

export class ErrorEspacio extends Error {
  override name = 'ErrorEspacio';
}

/** Implementación de EspacioNotion sobre el servidor MCP de Notion. */
export class EspacioNotionMcp implements EspacioNotion {
  private lecturas = 0;
  private escrituras = 0;

  constructor(private readonly mcp: LlamadorHerramientas) {}

  contadores(): Contadores {
    return { lecturas: this.lecturas, escrituras: this.escrituras };
  }

  private async leer(herramienta: string, args: Record<string, unknown>) {
    this.lecturas++;
    return this.mcp.llamar(herramienta, args);
  }

  private async escribir(herramienta: string, args: Record<string, unknown>) {
    this.escrituras++;
    return this.mcp.llamar(herramienta, args);
  }

  async leerConfiguracion(): Promise<Configuracion> {
    const r = resultadoConsulta.parse(
      await this.leer('API-query-data-source', {
        data_source_id: BASES.configuracion,
        sorts: [{ timestamp: 'created_time', direction: 'ascending' }],
        page_size: 1,
      }),
    );
    const fila = r.results[0];
    if (!fila) throw new ErrorEspacio('La base Configuración no tiene ninguna fila.');
    return { agenteActivo: p.leerCasilla(fila, 'Agente activo') };
  }

  async solicitudesPendientes(maximo: number): Promise<Solicitud[]> {
    const r = resultadoConsulta.parse(
      await this.leer('API-query-data-source', {
        data_source_id: BASES.solicitudes,
        filter: { property: 'Estado', status: { equals: 'Pendiente' } },
        sorts: [{ timestamp: 'created_time', direction: 'ascending' }],
        page_size: maximo,
      }),
    );
    return r.results.map((fila) => ({
      id: fila.id,
      titulo: p.leerTexto(fila, 'Solicitud'),
      etapa: p.leerSeleccion(fila, 'Etapa'),
      opciones: p.leerTexto(fila, 'Opciones'),
    }));
  }

  async leerEsquema(dataSourceId: string): Promise<EsquemaBase | null> {
    let datos: unknown;
    try {
      datos = await this.leer('API-retrieve-a-data-source', { data_source_id: dataSourceId });
    } catch (e) {
      if (e instanceof ErrorNotion && (e.codigo === 'object_not_found' || e.estadoHttp === 404)) return null;
      throw e;
    }
    const ds = dataSource.parse(datos);
    const propiedades: EsquemaBase['propiedades'] = {};
    for (const [nombre, def] of Object.entries(ds.properties)) {
      const opciones = (def.select ?? def.status)?.options.map((o) => o.name);
      propiedades[nombre] = { tipo: def.type, ...(opciones ? { opciones } : {}) };
    }
    return { titulo: (ds.title ?? []).map((t) => t.plain_text).join(''), propiedades };
  }

  async marcarSolicitud(id: string, estado: EstadoSolicitud): Promise<void> {
    paginaCreada.parse(
      await this.escribir('API-patch-page', { page_id: id, properties: { Estado: p.estado(estado) } }),
    );
  }

  async crearEjecucion(apertura: AperturaEjecucion): Promise<string> {
    const propiedades: Record<string, unknown> = {
      'Ejecución': p.titulo(apertura.titulo),
      Inicio: p.fecha(apertura.inicio),
    };
    if (apertura.etapa) propiedades['Etapa'] = p.seleccion(apertura.etapa);
    if (apertura.solicitudId) propiedades['Solicitud'] = p.relacion([apertura.solicitudId]);
    const creada = paginaCreada.parse(
      await this.escribir('API-post-page', {
        parent: { type: 'data_source_id', data_source_id: BASES.ejecuciones },
        properties: propiedades,
      }),
    );
    return creada.id;
  }

  async cerrarEjecucion(id: string, cierre: CierreEjecucion): Promise<void> {
    paginaCreada.parse(
      await this.escribir('API-patch-page', {
        page_id: id,
        properties: {
          Fin: p.fecha(cierre.fin),
          Resultado: p.seleccion(cierre.resultado),
          Errores: p.texto(cierre.errores.join('\n')),
          Lecturas: p.numero(cierre.lecturas),
          Escrituras: p.numero(cierre.escrituras),
          'Intentos bloqueados': p.numero(cierre.intentosBloqueados),
          'Proveedor y modelo': p.texto(cierre.proveedorModelo),
        },
      }),
    );
    if (cierre.notas.length > 0) {
      await this.escribir('API-patch-block-children', {
        block_id: id,
        children: cierre.notas.map((n) => p.parrafo(n)),
      });
    }
  }
}

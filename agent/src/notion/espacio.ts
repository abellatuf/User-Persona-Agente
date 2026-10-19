import { BASES } from '../config.js';
import { dataSource, resultadoConsulta } from '../schemas/notion.js';
import { ErrorNotion, type LlamadorHerramientas } from './cliente-mcp.js';
import { Contador, type Contadores } from './contador.js';
import { EscritorNotion, type Escritor } from './escritor.js';
import * as p from './propiedades.js';

export type { Contadores } from './contador.js';

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
  /** Vacío o ausente: se usa el modelo por defecto (src/config.ts). */
  modeloPrincipal?: string;
  modeloRespaldo?: string;
}

export interface Solicitud {
  id: string;
  titulo: string;
  /** Texto tal como está en Notion; puede no ser una etapa válida. */
  etapa: string | null;
  opciones: string;
}

/** Una fila de Contexto del producto, con lo que necesitan las etapas. */
export interface FilaContexto {
  id: string;
  titulo: string;
  estado: string | null;
  /** Archivos de «Documentos fuente». */
  documentos: Array<{ nombre: string; url: string }>;
  /** «URL fuente», o null si está vacía. */
  urlFuente: string | null;
  /** Texto de cada propiedad de texto (Problema, Problema · fuente, Idioma…). */
  textos: Record<string, string>;
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

/**
 * Acceso del agente a su espacio de Notion. El bucle y las etapas dependen de esta
 * interfaz y no de MCP, así se pueden probar con un espacio falso en memoria.
 */
export interface EspacioNotion {
  leerConfiguracion(): Promise<Configuracion>;
  solicitudesPendientes(maximo: number): Promise<Solicitud[]>;
  /** Filas de Contexto del producto (debería haber una sola). */
  leerContextos(): Promise<FilaContexto[]>;
  /** Devuelve null si la base no existe o no está compartida con la integración. */
  leerEsquema(dataSourceId: string): Promise<EsquemaBase | null>;
  marcarSolicitud(id: string, estado: EstadoSolicitud): Promise<void>;
  crearEjecucion(apertura: AperturaEjecucion): Promise<string>;
  cerrarEjecucion(id: string, cierre: CierreEjecucion): Promise<void>;
  /** Único punto de escritura para las etapas: aplica las reglas en código. */
  readonly escritor: Escritor;
  contadores(): Contadores;
  /** Avisos (sugerencias, filas archivadas) desde la posición indicada en Contadores.avisos. */
  avisosDesde(desde: number): string[];
}

export class ErrorEspacio extends Error {
  override name = 'ErrorEspacio';
}

/** Implementación de EspacioNotion sobre el servidor MCP de Notion. */
export class EspacioNotionMcp implements EspacioNotion {
  private readonly contador = new Contador();
  readonly escritor: Escritor;

  constructor(private readonly mcp: LlamadorHerramientas) {
    this.escritor = new EscritorNotion(mcp, this.contador);
  }

  contadores(): Contadores {
    return this.contador.instantanea();
  }

  avisosDesde(desde: number): string[] {
    return this.contador.avisosDesde(desde);
  }

  private async leer(herramienta: string, args: Record<string, unknown>) {
    this.contador.lecturas++;
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
    return {
      agenteActivo: p.leerCasilla(fila, 'Agente activo'),
      modeloPrincipal: p.leerTexto(fila, 'Modelo principal').trim(),
      modeloRespaldo: p.leerTexto(fila, 'Modelo de respaldo').trim(),
    };
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

  async leerContextos(): Promise<FilaContexto[]> {
    const r = resultadoConsulta.parse(
      await this.leer('API-query-data-source', {
        data_source_id: BASES.contexto,
        sorts: [{ timestamp: 'created_time', direction: 'ascending' }],
        page_size: 10,
      }),
    );
    return r.results.map((fila) => ({
      id: fila.id,
      titulo: p.leerTexto(fila, 'Nombre'),
      estado: p.leerSeleccion(fila, 'Estado'),
      documentos: p.leerArchivos(fila, 'Documentos fuente'),
      urlFuente: p.leerUrl(fila, 'URL fuente'),
      textos: Object.fromEntries(
        Object.entries(fila.properties)
          .filter(([, v]) => v.type === 'rich_text')
          .map(([nombre]) => [nombre, p.leerTexto(fila, nombre)]),
      ),
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
    await this.escritor.actualizar('solicitudes', id, { Estado: p.estado(estado) });
  }

  async crearEjecucion(apertura: AperturaEjecucion): Promise<string> {
    const propiedades: Record<string, unknown> = {
      'Ejecución': p.titulo(apertura.titulo),
      Inicio: p.fecha(apertura.inicio),
    };
    if (apertura.etapa) propiedades['Etapa'] = p.seleccion(apertura.etapa);
    if (apertura.solicitudId) propiedades['Solicitud'] = p.relacion([apertura.solicitudId]);
    const { id } = await this.escritor.guardar('ejecuciones', propiedades);
    return id;
  }

  async cerrarEjecucion(id: string, cierre: CierreEjecucion): Promise<void> {
    await this.escritor.actualizar('ejecuciones', id, {
      Fin: p.fecha(cierre.fin),
      Resultado: p.seleccion(cierre.resultado),
      Errores: p.texto(cierre.errores.join('\n')),
      Lecturas: p.numero(cierre.lecturas),
      Escrituras: p.numero(cierre.escrituras),
      'Intentos bloqueados': p.numero(cierre.intentosBloqueados),
      'Proveedor y modelo': p.texto(cierre.proveedorModelo),
    });
    await this.escritor.agregarParrafos(id, cierre.notas);
  }
}

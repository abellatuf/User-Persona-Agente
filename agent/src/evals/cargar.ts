import type { ClaveBase } from '../config.js';
import { claves } from '../guards/claves.js';
import type { LlamadorHerramientas } from '../notion/cliente-mcp.js';
import type { EtapaSolicitable } from '../notion/espacio.js';
import * as p from '../notion/propiedades.js';
import { paginaCreada, resultadoConsulta } from '../schemas/notion.js';
import { PREGUNTAS, propiedadDe } from '../stages/2-repreguntar/formulario.js';
import type { Caso } from './caso.js';
import { esEspacioDeEvaluacion } from './limpieza.js';

/**
 * Carga un caso en el espacio de evaluación haciendo de PM: escribe directo por MCP,
 * sin el Escritor del agente, porque lo que carga el PM no pasa por las reglas del agente.
 * Por eso solo acepta las bases de evaluación.
 */
export class CargadorEvaluacion {
  constructor(
    private readonly mcp: LlamadorHerramientas,
    private readonly bases: Readonly<Record<ClaveBase, string>>,
  ) {
    if (!esEspacioDeEvaluacion(bases)) {
      throw new Error('El cargador de casos solo escribe en el espacio de evaluación: las bases recibidas no son esas.');
    }
  }

  private async crear(base: ClaveBase, properties: Record<string, unknown>): Promise<string> {
    const r = paginaCreada.parse(
      await this.mcp.llamar('API-post-page', { parent: { type: 'data_source_id', data_source_id: this.bases[base] }, properties }),
    );
    return r.id;
  }

  async cargarEquipo(caso: Caso): Promise<void> {
    for (const m of caso.equipo) await this.crear('equipo', { Nombre: p.titulo(m.nombre), Rol: p.seleccion(m.rol) });
  }

  /** Entrevistas en «Base respondida», como si cada miembro hubiera completado el formulario. */
  async cargarEntrevistas(caso: Caso): Promise<void> {
    for (const e of caso.entrevistas) {
      const propiedades: Record<string, unknown> = {
        Entrevista: p.titulo(e.miembro),
        'Nombre del miembro': p.texto(e.miembro),
        'Rol del miembro': p.seleccion(e.rol),
        Estado: p.estado('Base respondida'),
      };
      for (const q of PREGUNTAS) {
        const respuesta = e.respuestas[q.codigo]?.trim();
        if (respuesta) propiedades[propiedadDe(q)] = p.texto(respuesta);
      }
      await this.crear('entrevistas', propiedades);
    }
  }

  /** Evidencia pública fija del caso: reemplaza a «Relevar la web» para que la corrida sea comparable. */
  async cargarEvidenciaPublica(caso: Caso): Promise<void> {
    for (const ev of caso.evidenciaPublica) {
      await this.crear('evidencia', {
        'Título': p.titulo(ev.titulo),
        Extracto: p.texto(ev.extracto),
        Tipo: p.seleccion('Pública'),
        URL: p.url(ev.url),
        'Fecha de consulta': p.dia(ev.fecha),
        'Etapa que la creó': p.seleccion('Relevar la web'),
        Clave: p.texto(claves.evidenciaPublica(ev.url)),
      });
    }
  }

  /** Contexto sin confirmar con una URL fuente, para que lo arme el agente. */
  async cargarContextoParaArmar(caso: Caso, urlFuente: string): Promise<string> {
    return this.crear('contexto', {
      Nombre: p.titulo(caso.contexto['Nombre']!),
      Idioma: p.texto(caso.contexto['Idioma'] ?? ''),
      'URL fuente': p.url(urlFuente),
      Estado: p.estado('Por confirmar'),
    });
  }

  /** El contexto confirmado del caso, como si el PM lo hubiera revisado. */
  async cargarContextoConfirmado(caso: Caso): Promise<string> {
    const propiedades: Record<string, unknown> = { Estado: p.estado('Confirmado') };
    for (const [nombre, valor] of Object.entries(caso.contexto)) {
      propiedades[nombre] = nombre === 'Nombre' ? p.titulo(valor) : p.texto(valor);
    }
    return this.crear('contexto', propiedades);
  }

  async pedir(etapa: EtapaSolicitable, opciones = ''): Promise<string> {
    return this.crear('solicitudes', {
      Solicitud: p.titulo(`Evaluación · ${etapa}`),
      Etapa: p.seleccion(etapa),
      Estado: p.estado('Pendiente'),
      Opciones: p.texto(opciones),
    });
  }

  async archivar(id: string): Promise<void> {
    await this.mcp.llamar('API-patch-page', { page_id: id, in_trash: true });
  }

  /** El equipo «respondió» las repreguntas: las entrevistas pasan a Completa para poder sintetizar. */
  async completarEntrevistas(): Promise<number> {
    const r = resultadoConsulta.parse(await this.mcp.llamar('API-query-data-source', { data_source_id: this.bases.entrevistas, page_size: 100 }));
    for (const fila of r.results) await this.mcp.llamar('API-patch-page', { page_id: fila.id, properties: { Estado: p.estado('Completa') } });
    return r.results.length;
  }
}

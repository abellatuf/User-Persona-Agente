import { ErrorNotion, type LlamadorHerramientas } from '../../src/notion/cliente-mcp.js';
import { aFormatoLectura, textoDe } from './formato.js';

type Propiedades = Record<string, Record<string, unknown>>;

export const ID_AGENTE = 'usuario-agente';
export const ID_PM = 'usuario-pm';

interface PaginaFalsa {
  parent: string;
  properties: Propiedades;
  creadaPor: string;
  editadaPor: string;
  enPapelera: boolean;
}

/**
 * Notion falso a nivel de herramientas del servidor MCP, en memoria.
 * Sirve para probar el Escritor y sus reglas sin levantar el servidor.
 */
export class LlamadorFalso implements LlamadorHerramientas {
  paginas = new Map<string, PaginaFalsa>();
  llamadas: Array<{ herramienta: string; args: Record<string, unknown> }> = [];
  private siguiente = 1;

  /** Crea una página como si la hubiera creado alguien (por defecto, el agente). */
  sembrar(dataSourceId: string, properties: Propiedades, autor = ID_AGENTE): string {
    const id = `pagina-${this.siguiente++}`;
    this.paginas.set(id, { parent: dataSourceId, properties, creadaPor: autor, editadaPor: autor, enPapelera: false });
    return id;
  }

  /** Simula que el PM editó la página desde Notion. */
  editarComoPm(id: string, properties: Propiedades) {
    const p = this.paginas.get(id)!;
    Object.assign(p.properties, properties);
    p.editadaPor = ID_PM;
  }

  filasDe(dataSourceId: string) {
    return [...this.paginas.entries()].filter(([, p]) => p.parent === dataSourceId && !p.enPapelera);
  }

  escrituras() {
    return this.llamadas.filter((l) => l.herramienta === 'API-post-page' || l.herramienta === 'API-patch-page');
  }

  private paginaApi(id: string) {
    const p = this.paginas.get(id)!;
    return {
      object: 'page',
      id,
      parent: { type: 'data_source_id', data_source_id: p.parent },
      created_by: { object: 'user', id: p.creadaPor },
      last_edited_by: { object: 'user', id: p.editadaPor },
      in_trash: p.enPapelera,
      properties: aFormatoLectura(p.properties),
    };
  }

  async llamar(herramienta: string, args: Record<string, unknown>): Promise<unknown> {
    this.llamadas.push({ herramienta, args });
    switch (herramienta) {
      case 'API-get-self':
        return { object: 'user', id: ID_AGENTE, type: 'bot' };
      case 'API-query-data-source': {
        const filtro = args['filter'] as { property: string; rich_text?: { equals: string } } | undefined;
        let filas = this.filasDe(args['data_source_id'] as string);
        if (filtro?.rich_text) filas = filas.filter(([, p]) => textoDe(p.properties[filtro.property]) === filtro.rich_text!.equals);
        return { object: 'list', results: filas.map(([id]) => this.paginaApi(id)), has_more: false };
      }
      case 'API-retrieve-a-page': {
        const id = args['page_id'] as string;
        if (!this.paginas.has(id)) throw new ErrorNotion('No existe', 'object_not_found', 404);
        return this.paginaApi(id);
      }
      case 'API-post-page': {
        const parent = args['parent'] as { data_source_id: string };
        return this.paginaApi(this.sembrar(parent.data_source_id, args['properties'] as Propiedades));
      }
      case 'API-patch-page': {
        const id = args['page_id'] as string;
        const p = this.paginas.get(id);
        if (!p) throw new ErrorNotion('No existe', 'object_not_found', 404);
        if (args['properties']) Object.assign(p.properties, args['properties'] as Propiedades);
        if (args['in_trash'] === true) p.enPapelera = true;
        p.editadaPor = ID_AGENTE;
        return this.paginaApi(id);
      }
      case 'API-patch-block-children':
        return { object: 'list', results: [] };
      default:
        throw new Error(`LlamadorFalso: herramienta no simulada ${herramienta}`);
    }
  }
}

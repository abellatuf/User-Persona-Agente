import { ErrorNotion, type LlamadorHerramientas } from '../../src/notion/cliente-mcp.js';
import { aFormatoLectura, textoDe } from './formato.js';

type Propiedades = Record<string, Record<string, unknown>>;

const parrafoFalso = (texto: string) => ({
  object: 'block',
  type: 'paragraph',
  paragraph: { rich_text: [{ type: 'text', text: { content: texto } }] },
});

/** Bloque en el formato que devuelve la API al leer: cada fragmento con plain_text. */
function aBloqueDeLectura(bloque: Record<string, unknown>) {
  const tipo = bloque['type'] as string;
  const contenido = bloque[tipo] as { rich_text?: Array<{ text?: { content?: string } }> } | undefined;
  return {
    ...bloque,
    [tipo]: { ...contenido, rich_text: (contenido?.rich_text ?? []).map((t) => ({ ...t, plain_text: t.text?.content ?? '' })) },
  };
}

export const ID_AGENTE = 'usuario-agente';
export const ID_PM = 'usuario-pm';

interface PaginaFalsa {
  parent: string;
  properties: Propiedades;
  creadaPor: string;
  editadaPor: string;
  enPapelera: boolean;
  /** Fecha de creación (ISO). Cada página nueva es un segundo posterior a la anterior. */
  creada: string;
}

const INICIO_DEL_RELOJ = Date.UTC(2026, 0, 1);

/**
 * Notion falso a nivel de herramientas del servidor MCP, en memoria.
 * Sirve para probar el Escritor y sus reglas sin levantar el servidor.
 */
export class LlamadorFalso implements LlamadorHerramientas {
  paginas = new Map<string, PaginaFalsa>();
  llamadas: Array<{ herramienta: string; args: Record<string, unknown> }> = [];
  /** Cuerpo de cada página: bloques en formato de escritura, con su id. */
  bloques = new Map<string, Array<Record<string, unknown>>>();
  private siguiente = 1;

  /** Texto plano del cuerpo de una página, un renglón por bloque. */
  cuerpoDe(id: string): string[] {
    return (this.bloques.get(id) ?? []).map((b) => textoDe(b[b['type'] as string]));
  }

  /** Simula que alguien escribió párrafos en el cuerpo de la página desde Notion. */
  escribirEnCuerpo(id: string, ...textos: string[]) {
    const nuevos = textos.map((t) => ({ ...parrafoFalso(t), id: `bloque-${this.siguiente++}` }));
    this.bloques.set(id, [...(this.bloques.get(id) ?? []), ...nuevos]);
  }

  /** Crea una página como si la hubiera creado alguien (por defecto, el agente). */
  sembrar(dataSourceId: string, properties: Propiedades, autor = ID_AGENTE): string {
    const n = this.siguiente++;
    const id = `pagina-${n}`;
    const creada = new Date(INICIO_DEL_RELOJ + n * 1000).toISOString();
    this.paginas.set(id, { parent: dataSourceId, properties, creadaPor: autor, editadaPor: autor, enPapelera: false, creada });
    return id;
  }

  /** Cambia la fecha de creación de una página (por ejemplo, para que una evidencia sea anterior o posterior a una síntesis). */
  fechar(id: string, creada: string) {
    this.paginas.get(id)!.creada = creada;
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
      created_time: p.creada,
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
      case 'API-patch-block-children': {
        const id = args['block_id'] as string;
        const nuevos = (args['children'] as Array<Record<string, unknown>>).map((b) => ({ ...b, id: `bloque-${this.siguiente++}` }));
        this.bloques.set(id, [...(this.bloques.get(id) ?? []), ...nuevos]);
        return { object: 'list', results: nuevos };
      }
      case 'API-get-block-children': {
        const bloques = this.bloques.get(args['block_id'] as string) ?? [];
        return { object: 'list', results: bloques.map((b) => aBloqueDeLectura(b)), has_more: false };
      }
      default:
        throw new Error(`LlamadorFalso: herramienta no simulada ${herramienta}`);
    }
  }
}

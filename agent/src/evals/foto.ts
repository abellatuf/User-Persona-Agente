import type { ClaveBase } from '../config.js';
import type { LlamadorHerramientas } from '../notion/cliente-mcp.js';
import * as p from '../notion/propiedades.js';
import { listaDeBloques, resultadoConsulta, type Pagina } from '../schemas/notion.js';
import { leerRepreguntas } from '../stages/2-repreguntar/cuerpo.js';

/** Lo que quedó escrito en el espacio al terminar una corrida: sobre esto se miden los chequeos. */
export interface Foto {
  contexto: Array<{ id: string; estado: string | null; textos: Record<string, string> }>;
  /** Cada entrevista con cuántas repreguntas le escribió el agente en el cuerpo. */
  entrevistas: Array<{ id: string; miembro: string; repreguntas: number }>;
  evidencias: Array<{ id: string; titulo: string; tipo: string | null; url: string | null; entrevistas: string[]; excluida: boolean }>;
  personas: Array<{ id: string; nombre: string; resumen: string; porQue: string; estado: string | null }>;
  atributos: Array<{
    id: string;
    afirmacion: string;
    categoria: string | null;
    confianza: string | null;
    personas: string[];
    evidencias: string[];
    divergencia: boolean;
    posturas: string;
  }>;
  supuestos: Array<{ id: string; supuesto: string; atributos: string[]; metodo: string | null; perfil: string; preguntas: string }>;
}

async function filas(mcp: LlamadorHerramientas, dataSourceId: string): Promise<Pagina[]> {
  const todas: Pagina[] = [];
  let cursor: string | undefined;
  do {
    const r = resultadoConsulta.parse(
      await mcp.llamar('API-query-data-source', {
        data_source_id: dataSourceId,
        page_size: 100,
        ...(cursor ? { start_cursor: cursor } : {}),
      }),
    );
    todas.push(...r.results.filter((f) => !f.in_trash));
    cursor = r.has_more && r.next_cursor ? r.next_cursor : undefined;
  } while (cursor);
  return todas;
}

const textos = (f: Pagina) =>
  Object.fromEntries(
    Object.entries(f.properties)
      .filter(([, v]) => v.type === 'rich_text' || v.type === 'title')
      .map(([nombre]) => [nombre, p.leerTexto(f, nombre).trim()]),
  );

export async function sacarFoto(mcp: LlamadorHerramientas, bases: Readonly<Record<ClaveBase, string>>): Promise<Foto> {
  const [contexto, entrevistas, evidencias, personas, atributos, supuestos] = await Promise.all([
    filas(mcp, bases.contexto),
    filas(mcp, bases.entrevistas),
    filas(mcp, bases.evidencia),
    filas(mcp, bases.personas),
    filas(mcp, bases.atributos),
    filas(mcp, bases.supuestos),
  ]);
  return {
    contexto: contexto.map((f) => ({ id: f.id, estado: p.leerSeleccion(f, 'Estado'), textos: textos(f) })),
    entrevistas: await Promise.all(
      entrevistas.map(async (f) => ({
        id: f.id,
        miembro: p.leerTexto(f, 'Nombre del miembro').trim(),
        repreguntas: leerRepreguntas(await cuerpo(mcp, f.id)).length,
      })),
    ),
    evidencias: evidencias.map((f) => ({
      id: f.id,
      titulo: p.leerTexto(f, 'Título').trim(),
      tipo: p.leerSeleccion(f, 'Tipo'),
      url: p.leerUrl(f, 'URL'),
      entrevistas: p.leerRelacion(f, 'Entrevista'),
      excluida: p.leerCasilla(f, 'Excluir de la síntesis'),
    })),
    personas: personas.map((f) => ({
      id: f.id,
      nombre: p.leerTexto(f, 'Nombre').trim(),
      resumen: p.leerTexto(f, 'Resumen').trim(),
      porQue: p.leerTexto(f, 'Por qué es un segmento distinto').trim(),
      estado: p.leerSeleccion(f, 'Estado'),
    })),
    atributos: atributos.map((f) => ({
      id: f.id,
      afirmacion: p.leerTexto(f, 'Afirmación').trim(),
      categoria: p.leerSeleccion(f, 'Categoría'),
      confianza: p.leerSeleccion(f, 'Confianza'),
      personas: p.leerRelacion(f, 'Persona'),
      evidencias: p.leerRelacion(f, 'Evidencias'),
      divergencia: p.leerCasilla(f, 'Divergencia'),
      posturas: p.leerTexto(f, 'Posturas').trim(),
    })),
    supuestos: supuestos.map((f) => ({
      id: f.id,
      supuesto: p.leerTexto(f, 'Supuesto').trim(),
      atributos: p.leerRelacion(f, 'Atributo'),
      metodo: p.leerSeleccion(f, 'Método'),
      perfil: p.leerTexto(f, 'Perfil a contactar').trim(),
      preguntas: p.leerTexto(f, 'Preguntas sugeridas').trim(),
    })),
  };
}

async function cuerpo(mcp: LlamadorHerramientas, paginaId: string): Promise<string[]> {
  const textos: string[] = [];
  let cursor: string | undefined;
  do {
    const r = listaDeBloques.parse(
      await mcp.llamar('API-get-block-children', { block_id: paginaId, page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) }),
    );
    textos.push(...r.results.map(p.textoDeBloque));
    cursor = r.has_more && r.next_cursor ? r.next_cursor : undefined;
  } while (cursor);
  return textos;
}

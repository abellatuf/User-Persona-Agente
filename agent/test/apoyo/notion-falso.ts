import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { BASES, type ClaveBase } from '../../src/config.js';
import { ESQUEMA_ESPERADO } from '../../src/stages/0-verificar-espacio/esquema-esperado.js';
import { aFormatoLectura, textoDe } from './formato.js';

export const ID_BOT = 'bot-agente';
export const ID_PERSONA_PM = 'persona-pm';

export interface PeticionRegistrada {
  metodo: string;
  ruta: string;
  cabeceras: http.IncomingHttpHeaders;
  cuerpo: Record<string, unknown> | undefined;
}

type Propiedades = Record<string, Record<string, unknown>>;

const rich = (texto: string) => [{ type: 'text', plain_text: texto, text: { content: texto } }];

/** Respuesta de "retrieve a data source" armada a partir del esquema esperado. */
function dataSourceApi(clave: ClaveBase) {
  const esperada = ESQUEMA_ESPERADO[clave];
  const properties: Record<string, unknown> = {};
  for (const [nombre, prop] of Object.entries(esperada.propiedades)) {
    const opciones = prop.opciones ? { options: prop.opciones.map((name) => ({ name })) } : { options: [] };
    properties[nombre] = {
      id: nombre,
      name: nombre,
      type: prop.tipo,
      ...(prop.tipo === 'select' || prop.tipo === 'status' ? { [prop.tipo]: opciones } : {}),
    };
  }
  return { object: 'data_source', id: BASES[clave], title: rich(esperada.nombre), properties };
}

/**
 * API de Notion falsa, en memoria, para probar el agente con el servidor MCP real.
 * Implementa solo los endpoints que usa el agente.
 */
export class NotionFalso {
  peticiones: PeticionRegistrada[] = [];
  paginas = new Map<
    string,
    { parent: string; properties: Propiedades; hijos: unknown[]; editadaPor: string; creadaPor: string; enPapelera: boolean }
  >();
  basesOcultas = new Set<string>();
  private servidor = http.createServer((req, res) => void this.atender(req, res));
  private siguienteId = 1;

  constructor() {
    this.crearPagina(BASES.configuracion, {
      Nombre: { type: 'title', title: rich('Configuración del agente') },
      'Agente activo': { type: 'checkbox', checkbox: true },
    });
  }

  crearPagina(dataSourceId: string, properties: Propiedades, autor = ID_BOT): string {
    const id = `00000000-0000-4000-8000-${String(this.siguienteId++).padStart(12, '0')}`;
    this.paginas.set(id, { parent: dataSourceId, properties, hijos: [], editadaPor: autor, creadaPor: autor, enPapelera: false });
    return id;
  }

  /** Simula que el PM editó la página desde Notion. */
  editarComoPm(id: string, properties: Propiedades) {
    const p = this.paginas.get(id)!;
    Object.assign(p.properties, properties);
    p.editadaPor = ID_PERSONA_PM;
  }

  crearSolicitud(titulo: string, etapa: string | null, estado = 'Pendiente'): string {
    return this.crearPagina(BASES.solicitudes, {
      Solicitud: { type: 'title', title: rich(titulo) },
      Etapa: { type: 'select', select: etapa ? { name: etapa } : null },
      Estado: { type: 'status', status: { name: estado } },
      Opciones: { type: 'rich_text', rich_text: [] },
    });
  }

  filasDe(dataSourceId: string) {
    return [...this.paginas.entries()].filter(([, p]) => p.parent === dataSourceId && !p.enPapelera);
  }

  /** Escrituras (crear o modificar páginas) que llegaron a la API. */
  escrituras() {
    return this.peticiones.filter((p) => (p.metodo === 'POST' && p.ruta === '/v1/pages') || p.metodo === 'PATCH');
  }

  async iniciar(): Promise<string> {
    await new Promise<void>((ok) => this.servidor.listen(0, '127.0.0.1', ok));
    const { port } = this.servidor.address() as AddressInfo;
    return `http://127.0.0.1:${port}`;
  }

  async detener() {
    await new Promise((ok) => this.servidor.close(ok));
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

  private async atender(req: http.IncomingMessage, res: http.ServerResponse) {
    let datos = '';
    for await (const trozo of req) datos += trozo;
    const cuerpo = datos ? (JSON.parse(datos) as Record<string, unknown>) : undefined;
    const ruta = new URL(req.url ?? '/', 'http://x').pathname;
    const metodo = req.method ?? 'GET';
    this.peticiones.push({ metodo, ruta, cabeceras: req.headers, cuerpo });

    const responder = (estado: number, json: unknown) => {
      res.writeHead(estado, { 'content-type': 'application/json' });
      res.end(JSON.stringify(json));
    };
    const noExiste = () =>
      responder(404, { object: 'error', status: 404, code: 'object_not_found', message: 'No existe.' });

    let m: RegExpMatchArray | null;
    if ((m = ruta.match(/^\/v1\/data_sources\/([^/]+)\/query$/)) && metodo === 'POST') {
      const id = m[1]!;
      const filtro = cuerpo?.['filter'] as
        | { property: string; status?: { equals: string }; rich_text?: { equals: string } }
        | undefined;
      let filas = this.filasDe(id);
      if (filtro?.status) {
        filas = filas.filter(([, p]) => {
          const prop = p.properties[filtro.property] as { status?: { name: string } } | undefined;
          return prop?.status?.name === filtro.status!.equals;
        });
      }
      if (filtro?.rich_text) {
        filas = filas.filter(([, p]) => textoDe(p.properties[filtro.property]) === filtro.rich_text!.equals);
      }
      const max = Number(cuerpo?.['page_size'] ?? 100);
      return responder(200, {
        object: 'list',
        results: filas.slice(0, max).map(([pid]) => this.paginaApi(pid)),
        has_more: false,
        next_cursor: null,
      });
    }
    if ((m = ruta.match(/^\/v1\/data_sources\/([^/]+)$/)) && metodo === 'GET') {
      const clave = (Object.keys(BASES) as ClaveBase[]).find((c) => BASES[c] === m![1]);
      if (!clave || this.basesOcultas.has(m[1]!)) return noExiste();
      return responder(200, dataSourceApi(clave));
    }
    if (ruta === '/v1/users/me' && metodo === 'GET') {
      return responder(200, { object: 'user', id: ID_BOT, type: 'bot', bot: {} });
    }
    if ((m = ruta.match(/^\/v1\/pages\/([^/]+)$/)) && metodo === 'GET') {
      return this.paginas.has(m[1]!) ? responder(200, this.paginaApi(m[1]!)) : noExiste();
    }
    if (ruta === '/v1/pages' && metodo === 'POST') {
      const parent = cuerpo?.['parent'] as { data_source_id?: string } | undefined;
      if (!parent?.data_source_id) {
        return responder(400, { object: 'error', status: 400, code: 'validation_error', message: 'Falta parent.' });
      }
      const id = this.crearPagina(parent.data_source_id, cuerpo?.['properties'] as Propiedades);
      return responder(200, this.paginaApi(id));
    }
    if ((m = ruta.match(/^\/v1\/pages\/([^/]+)$/)) && metodo === 'PATCH') {
      const p = this.paginas.get(m[1]!);
      if (!p) return noExiste();
      Object.assign(p.properties, (cuerpo?.['properties'] as Propiedades | undefined) ?? {});
      if (cuerpo?.['in_trash'] === true) p.enPapelera = true;
      p.editadaPor = ID_BOT;
      return responder(200, this.paginaApi(m[1]!));
    }
    if ((m = ruta.match(/^\/v1\/blocks\/([^/]+)\/children$/)) && metodo === 'PATCH') {
      const p = this.paginas.get(m[1]!);
      if (!p) return noExiste();
      p.hijos.push(...((cuerpo?.['children'] as unknown[]) ?? []));
      return responder(200, { object: 'list', results: [] });
    }
    return noExiste();
  }
}

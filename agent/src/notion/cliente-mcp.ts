import { createRequire } from 'node:module';
import path from 'node:path';
import { setTimeout as esperar } from 'node:timers/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport, getDefaultEnvironment } from '@modelcontextprotocol/sdk/client/stdio.js';

/** Lo mínimo que el agente necesita de una conexión MCP: llamar herramientas. */
export interface LlamadorHerramientas {
  llamar(herramienta: string, args: Record<string, unknown>): Promise<unknown>;
}

/** Error devuelto por la API de Notion a través del servidor MCP. */
export class ErrorNotion extends Error {
  constructor(
    message: string,
    readonly codigo: string,
    readonly estadoHttp: number | undefined,
  ) {
    super(message);
    this.name = 'ErrorNotion';
  }
}

// Errores transitorios de Notion: vale la pena reintentar.
const CODIGOS_REINTENTABLES = new Set([
  'rate_limited',
  'internal_server_error',
  'service_unavailable',
  'gateway_timeout',
  'conflict_error',
]);

export interface OpcionesReintento {
  intentos: number;
  esperaInicialMs: number;
}

const REINTENTO_POR_DEFECTO: OpcionesReintento = { intentos: 3, esperaInicialMs: 1_000 };

/**
 * Interpreta el resultado de una herramienta del servidor MCP de Notion.
 * El servidor devuelve la respuesta de la API como JSON en un bloque de texto,
 * y los errores HTTP como JSON con `object: "error"` o `status: "error"`.
 */
export function interpretarResultado(herramienta: string, resultado: unknown): unknown {
  const r = resultado as { content?: Array<{ type: string; text?: string }>; isError?: boolean };
  const texto = r.content?.find((c) => c.type === 'text')?.text;
  if (texto === undefined) {
    throw new ErrorNotion(`${herramienta}: el servidor MCP no devolvió contenido`, 'respuesta_vacia', undefined);
  }
  let datos: unknown;
  try {
    datos = JSON.parse(texto);
  } catch {
    throw new ErrorNotion(`${herramienta}: ${texto.slice(0, 300)}`, r.isError ? 'error_mcp' : 'respuesta_no_json', undefined);
  }
  const d = datos as { object?: string; status?: unknown; code?: string; message?: string };
  if (r.isError || d.object === 'error' || d.status === 'error') {
    const estadoHttp = typeof d.status === 'number' ? d.status : undefined;
    throw new ErrorNotion(`${herramienta}: ${d.message ?? texto.slice(0, 300)}`, d.code ?? 'error_desconocido', estadoHttp);
  }
  return datos;
}

/** Envuelve un llamador con reintentos ante errores transitorios de Notion. */
export function conReintentos(
  llamador: LlamadorHerramientas,
  opciones: OpcionesReintento = REINTENTO_POR_DEFECTO,
): LlamadorHerramientas {
  return {
    async llamar(herramienta, args) {
      for (let intento = 1; ; intento++) {
        try {
          return await llamador.llamar(herramienta, args);
        } catch (e) {
          const reintentable = e instanceof ErrorNotion && CODIGOS_REINTENTABLES.has(e.codigo);
          if (!reintentable || intento >= opciones.intentos) throw e;
          await esperar(opciones.esperaInicialMs * 2 ** (intento - 1));
        }
      }
    },
  };
}

export interface ConexionMcp extends LlamadorHerramientas {
  cerrar(): Promise<void>;
}

/**
 * Levanta el servidor MCP oficial de Notion (@notionhq/notion-mcp-server) como
 * subproceso por stdio y se conecta con el SDK oficial de MCP.
 */
export async function conectarNotionMcp(opciones: { token: string; baseUrl?: string }): Promise<ConexionMcp> {
  const require = createRequire(import.meta.url);
  const paquete = require.resolve('@notionhq/notion-mcp-server/package.json');
  const cli = path.join(path.dirname(paquete), 'bin', 'cli.mjs');

  const transporte = new StdioClientTransport({
    command: process.execPath,
    args: [cli],
    env: {
      ...getDefaultEnvironment(),
      NOTION_TOKEN: opciones.token,
      ...(opciones.baseUrl ? { BASE_URL: opciones.baseUrl } : {}),
    },
    stderr: 'inherit',
  });
  const cliente = new Client({ name: 'user-persona-agente', version: '0.1.0' });
  await cliente.connect(transporte);

  return {
    async llamar(herramienta, args) {
      const resultado = await cliente.callTool({ name: herramienta, arguments: args });
      return interpretarResultado(herramienta, resultado);
    },
    async cerrar() {
      await cliente.close();
    },
  };
}

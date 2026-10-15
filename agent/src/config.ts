import { z } from 'zod';

/**
 * IDs de las bases (data sources) de la plantilla de Notion.
 * No son secretos: el detalle está en docs/notion-plantilla.md.
 */
export const BASES = {
  configuracion: 'de3cb0ff-3f04-40b4-9cad-9342b177b12e',
  equipo: 'a6565b62-6a72-42a3-8cb8-632a1b02314d',
  contexto: 'acf50bb3-01f8-4d02-b324-b6385022a556',
  solicitudes: '2e3c1c30-d51d-4d54-b04e-d8ca6219de6b',
  entrevistas: '2e12b4ac-b6c2-4335-a7d8-e23b15221f03',
  ejecuciones: '19c0b3fc-666b-41f5-8d7d-2ff602222281',
  personas: '66110292-329d-4c26-a9d6-ac47849964f3',
  evidencia: '0c57fc5f-aa53-4d5a-ae63-969c50f5dfe4',
  atributos: '10c0eff2-9f48-4a11-b773-4e361d1f2629',
  supuestos: '52dcc77d-24a1-4584-ad0d-c25fed833fc4',
} as const;

export type ClaveBase = keyof typeof BASES;

/** Tope de solicitudes atendidas por ejecución, para acotar el tiempo de cada corrida. */
export const MAX_SOLICITUDES_POR_EJECUCION = 10;

/** Zona horaria en la que se muestran las fechas de los títulos de Ejecuciones. */
export const ZONA_HORARIA = 'America/Argentina/Buenos_Aires';

const FALTA_TOKEN = 'Falta el secreto NOTION_TOKEN (ver docs/07-implementacion.md, T0.4).';

const esquemaEntorno = z.object({
  NOTION_TOKEN: z.string({ error: FALTA_TOKEN }).min(1, FALTA_TOKEN),
  // Solo para pruebas: apunta el servidor MCP a una API de Notion falsa.
  NOTION_BASE_URL: z.url().optional(),
});

export interface Entorno {
  notionToken: string;
  notionBaseUrl?: string;
}

export function leerEntorno(env: NodeJS.ProcessEnv): Entorno {
  const r = esquemaEntorno.safeParse(env);
  if (!r.success) {
    throw new Error(r.error.issues.map((i) => i.message).join(' '));
  }
  return {
    notionToken: r.data.NOTION_TOKEN,
    ...(r.data.NOTION_BASE_URL ? { notionBaseUrl: r.data.NOTION_BASE_URL } : {}),
  };
}

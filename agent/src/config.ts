import { z } from 'zod';

/**
 * IDs de las bases (data sources) de la plantilla de Notion.
 * No son secretos: el detalle está en docs/notion-plantilla.md.
 */
export const BASES_PRINCIPAL = {
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

export type ClaveBase = keyof typeof BASES_PRINCIPAL;

/**
 * Copia de la plantilla en la página «Evaluaciones» de Notion (H9). Solo la usa evals.yml:
 * el runner de evaluaciones manda a la papelera sus filas en cada corrida.
 */
export const BASES_EVALUACION: Readonly<Record<ClaveBase, string>> = {
  configuracion: '2b65c12d-6400-43ea-8049-05f68919de7f',
  equipo: '425f5e8c-4056-4dac-863f-f18832bb5efd',
  contexto: '64f03849-afb1-4322-afd1-d9e2ee571c73',
  solicitudes: 'c5abee68-1c42-44c3-b9e5-d6d6920165e5',
  entrevistas: '46010d33-58e2-4f7c-9b28-8d14750454a2',
  ejecuciones: '1fb7094b-c903-476e-a8c0-a7ed3685ce93',
  personas: '981330cd-367c-4c74-abfe-df72a8f90b4a',
  evidencia: '8a889fa4-71bc-40cb-812f-350d88aa47e0',
  atributos: '13500cab-4def-4513-934e-ca642a40f68e',
  supuestos: 'ccf23d55-ad76-45e6-b4a4-ac712898e9b2',
};

export type Espacio = 'principal' | 'evaluacion';

/** ESPACIO vacío o «principal»: el espacio del PM. «evaluacion»: el de las evaluaciones (solo evals.yml). */
export function leerEspacio(env: NodeJS.ProcessEnv): Espacio {
  const valor = env['ESPACIO']?.trim() ?? '';
  if (valor === '' || valor === 'principal') return 'principal';
  if (valor === 'evaluacion') return 'evaluacion';
  throw new Error(`ESPACIO="${valor}" no existe: usá «principal» o «evaluacion».`);
}

export const ESPACIO: Espacio = leerEspacio(process.env);

/** Las bases del espacio elegido con ESPACIO al arrancar el proceso. */
export const BASES: Readonly<Record<ClaveBase, string>> = ESPACIO === 'evaluacion' ? BASES_EVALUACION : BASES_PRINCIPAL;

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

/**
 * Modelos por defecto, si en Configuración «Modelo principal» o «Modelo de respaldo»
 * están vacíos (RNF-02). openrouter/free es el router de OpenRouter que elige entre
 * sus modelos gratuitos: no depende de que un modelo gratuito puntual siga existiendo.
 */
export const MODELO_PRINCIPAL_POR_DEFECTO = 'gemini-3.8-flash';
export const MODELO_RESPALDO_POR_DEFECTO = 'openrouter/free';

const falta = (secreto: string) => `Falta el secreto ${secreto} (ver docs/07-implementacion.md, T0.4).`;

const esquemaClavesModelos = z.object({
  GEMINI_API_KEY: z.string({ error: falta('GEMINI_API_KEY') }).min(1, falta('GEMINI_API_KEY')),
  OPENROUTER_API_KEY: z.string({ error: falta('OPENROUTER_API_KEY') }).min(1, falta('OPENROUTER_API_KEY')),
  // Opcional: sin ella, solo «Relevar la web» queda Incompleta. GitHub pasa "" si el secreto no existe.
  TAVILY_API_KEY: z.string().optional(),
  // Solo para pruebas: apuntan los adaptadores a APIs falsas.
  GEMINI_BASE_URL: z.url().optional(),
  OPENROUTER_BASE_URL: z.url().optional(),
  TAVILY_BASE_URL: z.url().optional(),
});

/** Motivo para Ejecuciones cuando falta la clave del buscador. */
export const FALTA_TAVILY = `${falta('TAVILY_API_KEY')} Sin ella no se puede buscar en la web.`;

export interface ClavesModelos {
  geminiApiKey: string;
  openrouterApiKey: string;
  /** Clave del buscador web (H6). Ausente si el secreto no está cargado. */
  tavilyApiKey?: string;
  geminiBaseUrl?: string;
  openrouterBaseUrl?: string;
  tavilyBaseUrl?: string;
}

/**
 * Lee las claves de los modelos. Va aparte de leerEntorno: el workflow agente.yml
 * no las recibe hasta que alguna etapa use un modelo (H4).
 */
export function leerClavesModelos(env: NodeJS.ProcessEnv): ClavesModelos {
  const r = esquemaClavesModelos.safeParse(env);
  if (!r.success) {
    throw new Error(r.error.issues.map((i) => i.message).join(' '));
  }
  return {
    geminiApiKey: r.data.GEMINI_API_KEY,
    openrouterApiKey: r.data.OPENROUTER_API_KEY,
    ...(r.data.TAVILY_API_KEY?.trim() ? { tavilyApiKey: r.data.TAVILY_API_KEY.trim() } : {}),
    ...(r.data.GEMINI_BASE_URL ? { geminiBaseUrl: r.data.GEMINI_BASE_URL } : {}),
    ...(r.data.OPENROUTER_BASE_URL ? { openrouterBaseUrl: r.data.OPENROUTER_BASE_URL } : {}),
    ...(r.data.TAVILY_BASE_URL ? { tavilyBaseUrl: r.data.TAVILY_BASE_URL } : {}),
  };
}

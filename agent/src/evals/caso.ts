import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { ROLES } from '../stages/2-repreguntar/formulario.js';

/**
 * Un caso de evaluación (H9): un producto con su contexto confirmado, las entrevistas
 * del equipo, la evidencia pública fija y lo que se espera encontrar en la síntesis.
 * Cada caso es una carpeta de evals/casos/.
 */

const rol = z.enum(ROLES);
const nombres = z.array(z.string().min(1)).min(1);

const esquemaEntrevistas = z.object({
  equipo: z.array(z.object({ nombre: z.string().min(1), rol })).min(1),
  entrevistas: z
    .array(
      z.object({
        miembro: z.string().min(1),
        rol,
        respuestas: z.record(z.string().regex(/^P\d\d$/), z.string()),
      }),
    )
    .min(1),
});

const esquemaEvidencia = z.array(
  z.object({ titulo: z.string().min(1), url: z.url(), extracto: z.string().min(1), fecha: z.iso.date() }),
);

const esquemaEsperado = z.object({
  divergencias: z.array(
    z.object({
      tema: z.string().min(1),
      preguntas: z.array(z.string().regex(/^P\d\d$/)).min(1),
      lados: z.tuple([nombres, nombres]),
    }),
  ),
  competidores: z.object({ tema: z.string().min(1), marcaEnPosturas: z.string().min(1) }).optional(),
  /** Palabras que solo tienen sentido en este caso: no deberían aparecer en la síntesis de otro. */
  terminosPropios: z.array(z.string().min(1)).min(1),
});

export type Esperado = z.infer<typeof esquemaEsperado>;
export type EntrevistaCaso = z.infer<typeof esquemaEntrevistas>['entrevistas'][number];

export interface Caso {
  nombre: string;
  /** Propiedades de texto del contexto confirmado (Nombre, Idioma, Problema…). */
  contexto: Record<string, string>;
  equipo: Array<{ nombre: string; rol: (typeof ROLES)[number] }>;
  entrevistas: EntrevistaCaso[];
  evidenciaPublica: z.infer<typeof esquemaEvidencia>;
  esperado: Esperado;
  /** Texto de spec.md, si el caso la trae: con ella se evalúa también «Armar contexto». */
  spec?: string;
}

async function leerJson(archivo: string): Promise<unknown> {
  return JSON.parse(await readFile(archivo, 'utf8')) as unknown;
}

function validar<T>(esquema: z.ZodType<T>, datos: unknown, archivo: string): T {
  const r = esquema.safeParse(datos);
  if (!r.success) throw new Error(`${archivo}: ${r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  return r.data;
}

export async function leerCaso(carpeta: string): Promise<Caso> {
  const nombre = path.basename(carpeta);
  const en = (archivo: string) => path.join(carpeta, archivo);
  const contexto = validar(z.record(z.string(), z.string()), await leerJson(en('contexto.json')), `${nombre}/contexto.json`);
  if (!contexto['Nombre']?.trim()) throw new Error(`${nombre}/contexto.json: falta «Nombre».`);
  const { equipo, entrevistas } = validar(esquemaEntrevistas, await leerJson(en('entrevistas.json')), `${nombre}/entrevistas.json`);
  const sinEquipo = entrevistas.filter((e) => !equipo.some((m) => m.nombre === e.miembro));
  if (sinEquipo.length) throw new Error(`${nombre}/entrevistas.json: ${sinEquipo.map((e) => e.miembro).join(', ')} no está en «equipo».`);
  const evidenciaPublica = validar(esquemaEvidencia, await leerJson(en('evidencia-publica.json')), `${nombre}/evidencia-publica.json`);
  const esperado = validar(esquemaEsperado, await leerJson(en('esperado.json')), `${nombre}/esperado.json`);
  const miembros = new Set(equipo.map((m) => m.nombre));
  for (const d of esperado.divergencias) {
    const ajenos = d.lados.flat().filter((n) => !miembros.has(n));
    if (ajenos.length) throw new Error(`${nombre}/esperado.json: «${d.tema}» nombra a ${ajenos.join(', ')}, que no está en el equipo.`);
  }
  let spec: string | undefined;
  try {
    spec = await readFile(en('spec.md'), 'utf8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
  }
  return { nombre, contexto, equipo, entrevistas, evidenciaPublica, esperado, ...(spec ? { spec } : {}) };
}

/** Términos propios de los otros casos de la carpeta, para el chequeo de agnosticismo. */
export async function terminosDeOtrosCasos(carpetaCasos: string, actual: string): Promise<string[]> {
  const terminos: string[] = [];
  for (const entrada of await readdir(carpetaCasos, { withFileTypes: true })) {
    if (!entrada.isDirectory() || entrada.name === actual) continue;
    const esperado = validar(esquemaEsperado, await leerJson(path.join(carpetaCasos, entrada.name, 'esperado.json')), `${entrada.name}/esperado.json`);
    terminos.push(...esperado.terminosPropios);
  }
  return terminos;
}

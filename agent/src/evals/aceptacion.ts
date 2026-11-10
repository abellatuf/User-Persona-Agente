import { appendFile } from 'node:fs/promises';
import path from 'node:path';
import { BASES_PRINCIPAL, leerEntorno, type ClaveBase } from '../config.js';
import { conReintentos, conRitmo, conectarNotionMcp, type LlamadorHerramientas } from '../notion/cliente-mcp.js';
import * as p from '../notion/propiedades.js';
import { resultadoConsulta, usuarioPropio, type Pagina } from '../schemas/notion.js';
import { MIN_PREGUNTAS } from '../stages/5-planificar-validacion/reglas.js';
import type { Chequeo } from './chequeos.js';
import { informe } from './informe.js';

/**
 * Métricas de aceptación (H9) sobre el espacio del PM. Solo lee: el llamador
 * rechaza cualquier herramienta que no sea de lectura.
 */

const LECTURAS = new Set(['API-query-data-source', 'API-get-self']);

export function soloLectura(mcp: LlamadorHerramientas): LlamadorHerramientas {
  return {
    llamar: (herramienta, args) => {
      if (!LECTURAS.has(herramienta)) return Promise.reject(new Error(`La medición de aceptación solo lee: se rechazó «${herramienta}».`));
      return mcp.llamar(herramienta, args);
    },
  };
}

export interface DatosAceptacion {
  idAgente: string;
  personas: Array<{ nombre: string; estado: string | null; aprobadaPor: string[] }>;
  atributos: Array<{ afirmacion: string; confianza: string | null; evidencias: number; editadoPorPm: boolean; supuestos: number }>;
  supuestos: Array<{ supuesto: string; metodo: string | null; perfil: string; preguntas: number }>;
}

const pct = (parte: number, total: number) => (total === 0 ? 'sin datos' : `${Math.round((parte / total) * 100)}% (${parte} de ${total})`);

/** Las cinco métricas. Trazabilidad y aprobación indebida son reglas: fallan con un solo caso. */
export function medirAceptacion(d: DatosAceptacion): Chequeo[] {
  const sinEvidencia = d.atributos.filter((a) => a.evidencias === 0);
  const aprobadas = d.personas.filter((x) => x.estado === 'Aprobada' || x.estado === 'Reemplazada');
  const indebidas = aprobadas.filter((x) => x.aprobadaPor.length === 0 || x.aprobadaPor.includes(d.idAgente));
  const revisadas = d.personas.filter((x) => x.estado === 'Aprobada' || x.estado === 'Reemplazada' || x.estado === 'Rechazada');
  const editados = d.atributos.filter((a) => a.editadoPorPm);
  const accionables = d.supuestos.filter((s) => s.metodo && s.perfil && s.preguntas >= MIN_PREGUNTAS);
  const bajas = d.atributos.filter((a) => a.confianza === 'Baja');
  const bajasConPlan = bajas.filter((a) => a.supuestos > 0);
  return [
    {
      nombre: 'Trazabilidad',
      ok: sinEvidencia.length === 0,
      detalle: sinEvidencia.length ? sinEvidencia.map((a) => `Sin evidencia: «${a.afirmacion}».`) : [`Atributos con evidencia: ${pct(d.atributos.length, d.atributos.length)}.`],
    },
    {
      nombre: 'Aprobación indebida',
      ok: indebidas.length === 0,
      detalle: indebidas.length
        ? indebidas.map((x) => `«${x.nombre}» está ${x.estado} sin «Aprobada por» de una persona del equipo.`)
        : [`Las ${aprobadas.length} persona(s) aprobadas tienen «Aprobada por» de una persona del equipo.`],
    },
    {
      nombre: 'Aceptación',
      ok: true,
      detalle: [`Personas aprobadas entre las revisadas por el PM: ${pct(aprobadas.length, revisadas.length)}.`],
    },
    {
      nombre: 'Retrabajo',
      ok: true,
      detalle: [`Atributos que el PM tuvo que editar: ${pct(editados.length, d.atributos.length)}.`],
    },
    {
      nombre: 'Accionabilidad',
      ok: true,
      detalle: [
        `Supuestos con método, perfil y al menos ${MIN_PREGUNTAS} preguntas: ${pct(accionables.length, d.supuestos.length)}.`,
        `Atributos de confianza Baja con un supuesto a validar: ${pct(bajasConPlan.length, bajas.length)}.`,
      ],
    },
  ];
}

async function filas(mcp: LlamadorHerramientas, base: ClaveBase): Promise<Pagina[]> {
  const todas: Pagina[] = [];
  let cursor: string | undefined;
  do {
    const r = resultadoConsulta.parse(
      await mcp.llamar('API-query-data-source', { data_source_id: BASES_PRINCIPAL[base], page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) }),
    );
    todas.push(...r.results.filter((f) => !f.in_trash));
    cursor = r.has_more && r.next_cursor ? r.next_cursor : undefined;
  } while (cursor);
  return todas;
}

/** «Aprobada por» es de tipo personas, que el esquema de lectura no valida campo por campo. */
function personasDe(f: Pagina, nombre: string): string[] {
  const valor = f.properties[nombre] as { people?: Array<{ id?: unknown }> } | undefined;
  return (valor?.people ?? []).flatMap((u) => (typeof u.id === 'string' ? [u.id] : []));
}

export async function leerDatosAceptacion(mcp: LlamadorHerramientas): Promise<DatosAceptacion> {
  const lector = soloLectura(mcp);
  const idAgente = usuarioPropio.parse(await lector.llamar('API-get-self', {})).id;
  const [personas, atributos, supuestos] = [await filas(lector, 'personas'), await filas(lector, 'atributos'), await filas(lector, 'supuestos')];
  return {
    idAgente,
    personas: personas.map((f) => ({ nombre: p.leerTexto(f, 'Nombre').trim(), estado: p.leerSeleccion(f, 'Estado'), aprobadaPor: personasDe(f, 'Aprobada por') })),
    atributos: atributos.map((f) => ({
      afirmacion: p.leerTexto(f, 'Afirmación').trim(),
      evidencias: p.leerRelacion(f, 'Evidencias').length,
      editadoPorPm: p.leerCasilla(f, 'Editado por el PM'),
      confianza: p.leerSeleccion(f, 'Confianza'),
      supuestos: p.leerRelacion(f, 'Supuesto a validar').length,
    })),
    supuestos: supuestos.map((f) => ({
      supuesto: p.leerTexto(f, 'Supuesto').trim(),
      metodo: p.leerSeleccion(f, 'Método'),
      perfil: p.leerTexto(f, 'Perfil a contactar').trim(),
      preguntas: p.leerTexto(f, 'Preguntas sugeridas').split('\n').filter((l) => l.trim()).length,
    })),
  };
}

async function main(): Promise<number> {
  const entorno = leerEntorno(process.env);
  const conexion = await conectarNotionMcp({ token: entorno.notionToken, ...(entorno.notionBaseUrl ? { baseUrl: entorno.notionBaseUrl } : {}) });
  try {
    const chequeos = medirAceptacion(await leerDatosAceptacion(conReintentos(conRitmo(conexion))));
    const texto = informe('Aceptación · espacio del PM', chequeos);
    console.log(texto);
    const resumen = process.env['GITHUB_STEP_SUMMARY'];
    if (resumen) await appendFile(resumen, `${texto}\n`);
    return chequeos.every((c) => c.ok) ? 0 : 1;
  } finally {
    await conexion.cerrar();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  main().then(
    (codigo) => {
      process.exitCode = codigo;
    },
    (e: unknown) => {
      console.error(`❌ La medición de aceptación no pudo terminar: ${e instanceof Error ? e.message : String(e)}`);
      process.exitCode = 1;
    },
  );
}

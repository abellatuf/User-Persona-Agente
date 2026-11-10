import { appendFile } from 'node:fs/promises';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { ejecutarAgente } from '../ciclo.js';
import { BASES, ESPACIO, leerClavesModelos, leerEntorno } from '../config.js';
import { crearModelos } from '../llm/index.js';
import { conReintentos, conRitmo, conectarNotionMcp, type LlamadorHerramientas } from '../notion/cliente-mcp.js';
import { EspacioNotionMcp, type EtapaSolicitable } from '../notion/espacio.js';
import { crearArmarContexto } from '../stages/1-armar-contexto/index.js';
import { ETAPAS } from '../stages/registro.js';
import { CargadorEvaluacion } from './cargar.js';
import { leerCaso, terminosDeOtrosCasos, type Caso } from './caso.js';
import { chequearContexto, chequearEtapas, chequearTodo, type Chequeo } from './chequeos.js';
import { sacarFoto } from './foto.js';
import { informe } from './informe.js';
import { esEspacioDeEvaluacion, vaciarEspacioDeEvaluacion } from './limpieza.js';

/**
 * Runner de evaluaciones (H9). Lo corre evals.yml con ESPACIO=evaluacion:
 * vacía el espacio de evaluación, carga el caso haciendo de PM, pide cada etapa
 * y mide lo que quedó escrito. Los datos quedan en Notion hasta la próxima corrida.
 */

const CARPETA_CASOS = path.resolve(import.meta.dirname, '../../../evals/casos');

/** Sirve la spec en 127.0.0.1 para que «Armar contexto» la lea como URL fuente. */
async function servirSpec(spec: string): Promise<{ url: string; cerrar: () => Promise<void> }> {
  const servidor = http.createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/markdown; charset=utf-8' });
    res.end(spec);
  });
  await new Promise<void>((ok) => servidor.listen(0, '127.0.0.1', ok));
  const { port } = servidor.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}/spec.md`, cerrar: () => new Promise((ok) => servidor.close(() => ok())) };
}

async function correrEtapa(mcp: LlamadorHerramientas, etapas: typeof ETAPAS, etapa: EtapaSolicitable, cargador: CargadorEvaluacion) {
  await cargador.pedir(etapa);
  const claves = leerClavesModelos(process.env);
  const r = await ejecutarAgente({
    espacio: new EspacioNotionMcp(mcp),
    etapas,
    modelos: (configuracion) => crearModelos(claves, configuracion),
    maxSolicitudes: 1,
    log: (m) => console.log(`  [${etapa}] ${m}`),
  });
  return { etapa, resultado: r.solicitudes[0]?.resultado ?? r.resultado };
}

export async function evaluarCaso(mcp: LlamadorHerramientas, caso: Caso, terminosAjenos: string[]): Promise<{ chequeos: Chequeo[]; notas: string[] }> {
  const cargador = new CargadorEvaluacion(mcp, BASES);
  const notas: string[] = [];
  const vaciadas = await vaciarEspacioDeEvaluacion(mcp, BASES);
  const total = Object.values(vaciadas).reduce((a, b) => a + (b ?? 0), 0);
  notas.push(`Limpieza: ${total} fila(s) de la corrida anterior a la papelera.`);

  await cargador.cargarEquipo(caso);
  await cargador.cargarEntrevistas(caso);
  await cargador.cargarEvidenciaPublica(caso);
  notas.push(`Cargado: ${caso.equipo.length} miembro(s), ${caso.entrevistas.length} entrevista(s), ${caso.evidenciaPublica.length} evidencia(s) pública(s).`);

  const chequeos: Chequeo[] = [];
  const resultados: Array<{ etapa: string; resultado: string }> = [];

  if (caso.spec) {
    const servidor = await servirSpec(caso.spec);
    try {
      const id = await cargador.cargarContextoParaArmar(caso, servidor.url);
      const etapas = { ...ETAPAS, 'Armar contexto': crearArmarContexto({ permitirLocal: true }) };
      resultados.push(await correrEtapa(mcp, etapas, 'Armar contexto', cargador));
      const armado = (await sacarFoto(mcp, BASES)).contexto.find((c) => c.id === id);
      chequeos.push(armado ? chequearContexto(armado.textos, caso) : { nombre: 'Armar contexto', ok: false, detalle: ['No se encontró la fila de contexto.'] });
      // Las etapas siguientes parten del contexto confirmado del caso, no del que armó el agente.
      await cargador.archivar(id);
    } finally {
      await servidor.cerrar();
    }
  } else {
    notas.push('El caso no trae spec.md: «Armar contexto» no se evalúa.');
  }
  await cargador.cargarContextoConfirmado(caso);

  resultados.push(await correrEtapa(mcp, ETAPAS, 'Repreguntar', cargador));
  notas.push(`Entrevistas pasadas a Completa sin responder las repreguntas: ${await cargador.completarEntrevistas()}.`);
  resultados.push(await correrEtapa(mcp, ETAPAS, 'Sintetizar', cargador));
  resultados.push(await correrEtapa(mcp, ETAPAS, 'Planificar validación', cargador));

  chequeos.unshift(chequearEtapas(resultados));
  chequeos.push(...chequearTodo(await sacarFoto(mcp, BASES), caso, terminosAjenos));
  return { chequeos, notas };
}

async function main(): Promise<number> {
  if (ESPACIO !== 'evaluacion' || !esEspacioDeEvaluacion(BASES)) {
    throw new Error('Las evaluaciones solo corren con ESPACIO=evaluacion (las corre evals.yml).');
  }
  const nombre = process.argv[2] ?? process.env['CASO'];
  if (!nombre) throw new Error('Falta el caso: pasá su carpeta de evals/casos como argumento o en CASO.');
  const caso = await leerCaso(path.join(CARPETA_CASOS, nombre));
  const terminosAjenos = await terminosDeOtrosCasos(CARPETA_CASOS, caso.nombre);

  const entorno = leerEntorno(process.env);
  const conexion = await conectarNotionMcp({ token: entorno.notionToken, ...(entorno.notionBaseUrl ? { baseUrl: entorno.notionBaseUrl } : {}) });
  try {
    const { chequeos, notas } = await evaluarCaso(conReintentos(conRitmo(conexion)), caso, terminosAjenos);
    const texto = informe(`Evaluación · ${caso.nombre}`, chequeos, notas);
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
      console.error(`❌ La evaluación no pudo terminar: ${e instanceof Error ? e.message : String(e)}`);
      process.exitCode = 1;
    },
  );
}

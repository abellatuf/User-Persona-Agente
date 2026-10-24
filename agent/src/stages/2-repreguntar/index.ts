import { z } from 'zod';
import { claves, normalizar } from '../../guards/claves.js';
import { ErrorGeneracion, notasDeGeneracion, type Generador } from '../../llm/index.js';
import type { EspacioNotion, FilaContexto, FilaEntrevista, FilaMiembro } from '../../notion/espacio.js';
import * as p from '../../notion/propiedades.js';
import { armarPrompt, type DatoDelPrompt } from '../../prompts/base.js';
import { CAMPOS } from '../1-armar-contexto/campos.js';
import type { ContextoEtapa, FuncionEtapa, ResultadoEtapa } from '../registro.js';
import { leerRepreguntas, parrafosDeRepreguntas, tieneRepreguntas } from './cuerpo.js';
import { MAX_REPREGUNTAS, PREGUNTAS, ROLES } from './formulario.js';
import { filtrarRepreguntas } from './reglas.js';

/**
 * Etapa 2: entrevistas y repreguntas (H5, HU-04 a HU-06).
 *
 * Por cada entrevista con el formulario base respondido: la vincula con su miembro de
 * Equipo, guarda cada respuesta como evidencia (supuesto del equipo) y escribe hasta
 * 5 repreguntas en el cuerpo de su página. Cuando el miembro la marca Completa, guarda
 * también sus respuestas a las repreguntas como evidencia.
 */

const SIN_MODELO = 'Ninguno';
const IDIOMA_POR_DEFECTO = 'el mismo idioma de las respuestas';
const ESTADOS_POR_PROCESAR = new Set(['Pendiente', 'Base respondida', null]);

const TAREA = [
  'Sos parte de una entrevista a un miembro del equipo de producto sobre los usuarios del producto.',
  'Leé las respuestas de este miembro al formulario base y escribí repreguntas para profundizar donde:',
  '- la respuesta es vaga, general o sin ejemplos concretos;',
  '- la respuesta es una opinión sin indicar en qué se basa;',
  '- la respuesta puede no coincidir con lo que respondieron otros miembros a la misma pregunta.',
  'Reglas para cada repregunta:',
  '- Es abierta: no se responde con sí o no.',
  '- No sugiere la respuesta ni presupone nada.',
  '- Pide situaciones reales, ejemplos concretos o en qué se basa.',
  '- No repite una pregunta del formulario.',
  '- Nunca menciona a otros miembros, sus roles ni lo que respondieron, y no dice que haya desacuerdo. Podés preguntar sobre el mismo tema, pero sin revelar la otra postura.',
  `Devolvé como máximo ${MAX_REPREGUNTAS} repreguntas, empezando por las más importantes. Si las respuestas ya son concretas y suficientes, devolvé una lista vacía y explicá por qué en "sinRepreguntas".`,
  'Para cada repregunta indicá:',
  '- "sobre": el código de la pregunta del formulario cuya respuesta la motiva (P01, P02…). Solo preguntas que este miembro respondió.',
  '- "texto": la repregunta, dirigida al miembro, en segunda persona.',
  '- "motivo": por qué hace falta, en una oración. Es para el registro interno, el miembro no lo ve.',
].join('\n');

export const esquemaRepreguntas = z.object({
  repreguntas: z.array(z.object({ sobre: z.string(), texto: z.string(), motivo: z.string() })),
  sinRepreguntas: z.string(),
});

const resultado = (
  r: ResultadoEtapa['resultado'],
  notas: string[],
  errores: string[] = [],
  proveedorModelo = SIN_MODELO,
): ResultadoEtapa => ({ resultado: r, notas, errores, proveedorModelo });

const tieneRespuestas = (e: FilaEntrevista) => Object.values(e.respuestas).some((r) => r.trim());
const rolDe = (e: FilaEntrevista) => (e.rolMiembro && (ROLES as readonly string[]).includes(e.rolMiembro) ? e.rolMiembro : 'Otro');
const quien = (e: FilaEntrevista) => `${e.nombreMiembro} (${rolDe(e)})`;

/** Busca el miembro por nombre (sin distinguir mayúsculas ni acentos) o lo crea en Equipo (decisión B). */
async function vincularMiembro(espacio: EspacioNotion, entrevista: FilaEntrevista, equipo: FilaMiembro[], notas: string[]) {
  if (entrevista.miembros.length > 0) return;
  const nombre = normalizar(entrevista.nombreMiembro);
  let miembro = equipo.find((m) => normalizar(m.nombre) === nombre);
  if (!miembro) {
    const { id } = await espacio.escritor.guardar('equipo', {
      Nombre: p.titulo(entrevista.nombreMiembro),
      Rol: p.seleccion(rolDe(entrevista)),
    });
    miembro = { id, nombre: entrevista.nombreMiembro, rol: rolDe(entrevista) };
    equipo.push(miembro);
    notas.push(`Equipo: se agregó a ${quien(entrevista)}.`);
  }
  const propiedades: Record<string, unknown> = { Miembro: p.relacion([miembro.id]) };
  if (!entrevista.titulo.trim()) propiedades['Entrevista'] = p.titulo(quien(entrevista));
  await espacio.escritor.actualizar('entrevistas', entrevista.id, propiedades);
  entrevista.miembros = [miembro.id];
}

/** Cada respuesta del formulario base es una evidencia del tipo «Supuesto del equipo» (T5.2). */
async function guardarEvidenciaBase(espacio: EspacioNotion, entrevista: FilaEntrevista): Promise<number> {
  let guardadas = 0;
  for (const pregunta of PREGUNTAS) {
    const respuesta = entrevista.respuestas[pregunta.codigo]?.trim();
    if (!respuesta) continue;
    await espacio.escritor.guardar(
      'evidencia',
      {
        'Título': p.titulo(`${pregunta.codigo} · ${quien(entrevista)}`),
        Extracto: p.texto(`${pregunta.texto}\n${respuesta}`),
        Tipo: p.seleccion('Supuesto del equipo'),
        Entrevista: p.relacion([entrevista.id]),
        'Etapa que la creó': p.seleccion('Repreguntar'),
      },
      { clave: claves.evidenciaDelEquipo(entrevista.id, pregunta.codigo) },
    );
    guardadas++;
  }
  return guardadas;
}

/** Respuestas a las repreguntas de una entrevista Completa, como evidencia vinculada a la respuesta original. */
async function guardarEvidenciaDeRepreguntas(espacio: EspacioNotion, entrevista: FilaEntrevista, notas: string[]): Promise<number> {
  const repreguntas = leerRepreguntas(await espacio.leerTextoDelCuerpo(entrevista.id));
  let guardadas = 0;
  for (const r of repreguntas) {
    if (!r.respuesta) {
      notas.push(`${quien(entrevista)}: la repregunta ${r.numero} quedó sin responder.`);
      continue;
    }
    await espacio.escritor.guardar(
      'evidencia',
      {
        'Título': p.titulo(`R${r.numero} (sobre ${r.sobre}) · ${quien(entrevista)}`),
        Extracto: p.texto(`${r.texto}\n${r.respuesta}`),
        Tipo: p.seleccion('Supuesto del equipo'),
        Entrevista: p.relacion([entrevista.id]),
        'Etapa que la creó': p.seleccion('Repreguntar'),
      },
      { clave: claves.evidenciaDelEquipo(entrevista.id, `R${r.numero}`) },
    );
    guardadas++;
  }
  return guardadas;
}

function datosDelPrompt(contexto: FilaContexto | undefined, entrevista: FilaEntrevista, otras: FilaEntrevista[]): DatoDelPrompt[] {
  const datos: DatoDelPrompt[] = [];
  if (contexto) {
    const campos = CAMPOS.map((c) => `${c.propiedad}: ${contexto.textos[c.propiedad]?.trim() || 'No encontrado'}`);
    datos.push({ fuente: 'Contexto del producto (confirmado por el PM)', contenido: [`Nombre: ${contexto.titulo}`, ...campos].join('\n') });
  }
  const propias = PREGUNTAS.filter((q) => entrevista.respuestas[q.codigo]?.trim()).map(
    (q) => `${q.codigo} · ${q.texto}\nRespuesta: ${entrevista.respuestas[q.codigo]}`,
  );
  datos.push({ fuente: `Respuestas de este miembro (rol: ${rolDe(entrevista)})`, contenido: propias.join('\n\n') });

  // Los demás miembros van sin nombre: el modelo los usa para detectar posibles contradicciones, nada más.
  const ajenas = PREGUNTAS.flatMap((q) => {
    const lineas = otras
      .map((o, i) => (o.respuestas[q.codigo]?.trim() ? `- Otro miembro ${i + 1}: ${o.respuestas[q.codigo]}` : null))
      .filter((l): l is string => l !== null);
    return lineas.length ? [`${q.codigo} · ${q.texto}\n${lineas.join('\n')}`] : [];
  });
  if (ajenas.length) {
    datos.push({ fuente: 'Respuestas de otros miembros a las mismas preguntas (no las menciones)', contenido: ajenas.join('\n\n') });
  }
  return datos;
}

interface Repreguntado {
  proveedorModelo: string;
  notasModelo: string[];
}

async function repreguntar(
  espacio: EspacioNotion,
  generar: Generador,
  contexto: FilaContexto | undefined,
  entrevista: FilaEntrevista,
  todas: FilaEntrevista[],
  notas: string[],
): Promise<Repreguntado> {
  const otras = todas.filter((e) => e.id !== entrevista.id && tieneRespuestas(e));
  const mensajes = armarPrompt({
    tarea: TAREA,
    datos: datosDelPrompt(contexto, entrevista, otras),
    idioma: contexto?.textos['Idioma']?.trim() || IDIOMA_POR_DEFECTO,
    esquema: esquemaRepreguntas,
  });
  const generado = await generar({ mensajes, esquema: esquemaRepreguntas });
  const nombresDeOtros = otras.map((o) => o.nombreMiembro);
  const { aceptadas, descartadas } = filtrarRepreguntas(generado.datos.repreguntas, entrevista.respuestas, nombresDeOtros);
  for (const d of descartadas) notas.push(`${quien(entrevista)}: repregunta descartada («${d.texto}»): ${d.motivo}`);

  if (aceptadas.length === 0) {
    if (generado.datos.repreguntas.length === 0) {
      // El modelo consideró que las respuestas alcanzan (HU-05): no hay nada que responder.
      await espacio.escritor.actualizar('entrevistas', entrevista.id, { Estado: p.estado('Completa') });
      notas.push(`${quien(entrevista)}: sin repreguntas («${generado.datos.sinRepreguntas.trim() || 'sin motivo'}»). La entrevista pasó a Completa.`);
    } else {
      notas.push(`${quien(entrevista)}: todas las repreguntas se descartaron. La entrevista queda en «Base respondida» para volver a intentarlo.`);
    }
  } else {
    const motivos = new Map(generado.datos.repreguntas.map((r) => [r.texto.trim(), r.motivo]));
    await espacio.escritor.agregarParrafos(
      entrevista.id,
      parrafosDeRepreguntas(aceptadas.map((a) => ({ ...a, respuestaOriginal: entrevista.respuestas[a.sobre] ?? '' }))),
    );
    await espacio.escritor.actualizar('entrevistas', entrevista.id, { Estado: p.estado('Repreguntas pendientes') });
    notas.push(`${quien(entrevista)}: ${aceptadas.length} repregunta(s) escritas en su página.`);
    aceptadas.forEach((a, i) => notas.push(`  ${i + 1}. Sobre ${a.sobre}: ${motivos.get(a.texto) ?? ''}`.trimEnd()));
  }
  return { proveedorModelo: generado.proveedorModelo, notasModelo: notasDeGeneracion(generado) };
}

export const repreguntarEtapa: FuncionEtapa = async ({ espacio, generar, sinModelo }: ContextoEtapa): Promise<ResultadoEtapa> => {
  const entrevistas = await espacio.leerEntrevistas();
  const conRespuestas = entrevistas.filter(tieneRespuestas);
  if (conRespuestas.length === 0) {
    return resultado('Error', [], ['No hay entrevistas con el formulario base respondido. Pedile al equipo que complete el formulario «Entrevista base».']);
  }

  const notas: string[] = [];
  const sinNombre = conRespuestas.filter((e) => !e.nombreMiembro);
  for (const e of sinNombre) notas.push(`Entrevista «${e.titulo || e.id}»: falta «Nombre del miembro», se saltea.`);
  const validas = conRespuestas.filter((e) => e.nombreMiembro);

  const porRepreguntar = validas.filter((e) => ESTADOS_POR_PROCESAR.has(e.estado));
  const completas = validas.filter((e) => e.estado === 'Completa');

  // Sin modelo no se escribe nada: las repreguntas son la parte principal de la etapa.
  if (porRepreguntar.length > 0 && !generar) {
    return resultado('Error', notas, [sinModelo ?? 'No hay un modelo de lenguaje disponible para esta ejecución.']);
  }

  const equipo = await espacio.leerEquipo();
  const contexto = (await espacio.leerContextos())[0];
  const proveedores = new Set<string>();
  const notasModelo: string[] = [];
  const errores: string[] = [];
  let evidenciaBase = 0;
  let evidenciaRepreguntas = 0;

  for (const entrevista of porRepreguntar) {
    await vincularMiembro(espacio, entrevista, equipo, notas);
    evidenciaBase += await guardarEvidenciaBase(espacio, entrevista);

    const cuerpo = await espacio.leerTextoDelCuerpo(entrevista.id);
    if (tieneRepreguntas(cuerpo)) {
      // Ya se escribieron en una corrida anterior (por ejemplo, si falló al cambiar el estado): no se duplican.
      await espacio.escritor.actualizar('entrevistas', entrevista.id, { Estado: p.estado('Repreguntas pendientes') });
      notas.push(`${quien(entrevista)}: ya tenía repreguntas en su página, no se generaron otras.`);
      continue;
    }
    if (entrevista.estado !== 'Base respondida') {
      await espacio.escritor.actualizar('entrevistas', entrevista.id, { Estado: p.estado('Base respondida') });
    }
    try {
      const r = await repreguntar(espacio, generar!, contexto, entrevista, validas, notas);
      proveedores.add(r.proveedorModelo);
      notasModelo.push(...r.notasModelo);
    } catch (e) {
      if (!(e instanceof ErrorGeneracion)) throw e;
      errores.push(`${quien(entrevista)}: ${e.message}`);
      notasModelo.push(...notasDeGeneracion(e));
    }
  }

  for (const entrevista of completas) {
    if (entrevista.miembros.length === 0) {
      await vincularMiembro(espacio, entrevista, equipo, notas);
      evidenciaBase += await guardarEvidenciaBase(espacio, entrevista);
    }
    evidenciaRepreguntas += await guardarEvidenciaDeRepreguntas(espacio, entrevista, notas);
  }

  const otras = validas.length - porRepreguntar.length - completas.length;
  notas.unshift(
    `Entrevistas con respuestas: ${validas.length}. Repreguntadas en esta corrida: ${porRepreguntar.length}. Completas: ${completas.length}. Esperando respuestas a las repreguntas: ${otras}.`,
    `Evidencia guardada: ${evidenciaBase} respuesta(s) del formulario base y ${evidenciaRepreguntas} respuesta(s) a repreguntas.`,
  );
  const proveedorModelo = proveedores.size ? [...proveedores].join(' / ') : SIN_MODELO;
  return resultado(errores.length ? 'Error' : 'Lista', [...notas, ...notasModelo], errores, proveedorModelo);
};

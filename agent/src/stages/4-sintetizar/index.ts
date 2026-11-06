import type { z } from 'zod';
import { claves, normalizar } from '../../guards/claves.js';
import { ErrorGeneracion, notasDeGeneracion, type Generador } from '../../llm/index.js';
import type { EspacioNotion, FilaAtributo, FilaContexto, FilaPersona } from '../../notion/espacio.js';
import * as p from '../../notion/propiedades.js';
import { armarPrompt, type DatoDelPrompt } from '../../prompts/base.js';
import { CAMPOS } from '../1-armar-contexto/campos.js';
import { guardarEvidenciaDeRepreguntas } from '../2-repreguntar/index.js';
import { entrevistasParaSintetizar } from '../2-repreguntar/reglas.js';
import type { ContextoEtapa, FuncionEtapa, ResultadoEtapa } from '../registro.js';
import {
  armarControles,
  armarResumen,
  camposConTexto,
  CATEGORIAS,
  esquemaPersona,
  esquemaSegmentos,
  MAX_ATRIBUTOS,
  MAX_PERSONAS,
  prepararEvidencias,
  validarAtributos,
  validarSegmentos,
  type AtributoValidado,
  type EvidenciaPreparada,
  type SegmentoValidado,
} from './reglas.js';

/**
 * Etapa 4: síntesis de personas (H7, HU-09 a HU-13).
 *
 * 1. Prepara la evidencia de las entrevistas incluidas, la pública y la propia, con referencias E1…
 * 2. Una llamada propone hasta 5 segmentos.
 * 3. Una llamada por segmento propone sus atributos; el código valida evidencia, divergencias y
 *    topes, y calcula la confianza.
 * 4. Escribe cada persona en Borrador con sus atributos, el resumen y los controles. Una persona
 *    Rechazada genera una versión nueva; una Aprobada, solo si hay evidencia nueva desde su
 *    última síntesis (H8). En revisión y Aprobada no se tocan.
 */

const SIN_MODELO = 'Ninguno';

const TAREA_SEGMENTOS = [
  'Vas a proponer segmentos de usuarios del producto del contexto, a partir de la evidencia.',
  `Proponé como máximo ${MAX_PERSONAS} segmentos. Si la evidencia no alcanza para distinguir segmentos, proponé menos y explicá qué información falta.`,
  'Un segmento es distinto de los demás si tiene objetivos, problemas, comportamientos o contexto de uso diferentes, según la evidencia. No inventes segmentos que la evidencia no respalda.',
  'Para cada segmento devolvé:',
  '- "nombre": un nombre corto y descriptivo, sin nombres propios de personas.',
  '- "porQueDistinto": por qué es un segmento distinto de los demás, en una o dos oraciones.',
  '- "evidencias": los identificadores (E1, E2…) de las evidencias que justifican el segmento.',
  '- "personaExistente": si el segmento corresponde a una de las personas existentes, su identificador (P1, P2…); si no, una cadena vacía.',
  'Si una persona existente está Rechazada, leé su motivo: el nombre y "porQueDistinto" tienen que responder a ese motivo. Si el motivo cuestiona el nombre o una palabra del nombre, cambialos.',
  'Si el motivo dice que esa persona no debería existir o que repite otra, no la propongas.',
  'No propongas un segmento que cubra a las mismas personas que otro segmento o que una persona existente. Si es el mismo, indicá esa persona en "personaExistente".',
  'En "informacionQueFalta" contá, en una o dos oraciones, qué información haría falta para distinguir mejor los segmentos.',
].join('\n');

const TAREA_PERSONA = [
  'Vas a describir una persona (un segmento de usuarios) con atributos que sirvan para decidir sobre el producto.',
  `Proponé como máximo ${MAX_ATRIBUTOS} atributos, empezando por los más importantes. No incluyas atributos decorativos que no ayuden a decidir.`,
  `Cada atributo tiene una "categoria": ${CATEGORIAS.join(', ')}.`,
  'Cada atributo cita en "evidencias" los identificadores (E1, E2…) de las evidencias que lo respaldan. Solo evidencias que digan eso de verdad.',
  'Si una evidencia pública y una del equipo dicen lo mismo, citá las dos.',
  'Citá evidencia pública solo si trata sobre los usuarios, el problema o el mercado del contexto. Si no, no la cites, aunque toque un tema parecido.',
  'Si la evidencia lo permite, incluí un atributo de categoría Comportamiento sobre cómo resuelve hoy el problema esta persona (herramientas, servicios, personas o procesos).',
  'En ese atributo, compará la evidencia con el campo Competidores del contexto. Si la evidencia pública muestra alternativas que ponen en duda lo que dice ese campo, es una divergencia: una postura con "campoDelContexto" igual a "Competidores" y otra con esas evidencias públicas. Si el campo dice "No encontrado", no hay desacuerdo.',
  'Divergencias: si hay posturas incompatibles sobre el mismo aspecto, entre miembros del equipo o entre el equipo y la evidencia pública o el contexto, escribí la afirmación de forma neutral (describí el aspecto, sin elegir una postura) y listá cada postura en "posturas", con sus evidencias. Si una postura sale del contexto del producto, poné en "campoDelContexto" el nombre exacto del campo; el texto de ese campo se copia tal cual. Si no, dejalo vacío. Si no hay desacuerdo, dejá "posturas" vacío.',
  'Si te paso atributos actuales con identificador (A1, A2…), poné en "atributoExistente" el identificador del atributo al que corresponde cada uno, aunque cambies la redacción. Si es nuevo, dejalo vacío.',
  'Si un atributo actual dice (con divergencia) y las evidencias de sus posturas siguen, mantené esa divergencia.',
  'Si hay un motivo de rechazo, aplicalo también a la redacción de los atributos.',
  'Nunca elijas una postura ni digas cuál es la correcta.',
  'En "informacionQueFalta" contá qué información falta para conocer mejor a esta persona.',
  'Si te paso evidencia nueva desde la versión aprobada, la versión nueva tiene que reflejar lo que cambia con esa evidencia y mantener lo que sigue valiendo. Citá la evidencia nueva en los atributos que cambia.',
  'En "cambiosRespectoDeLaAnterior" explicá qué cambiaste respecto de la versión anterior: cómo respondés al motivo de rechazo o qué cambia por la evidencia nueva. Si no hay versión anterior, dejalo vacío.',
].join('\n');

const resultado = (r: ResultadoEtapa['resultado'], notas: string[], errores: string[] = [], proveedorModelo = SIN_MODELO): ResultadoEtapa => ({
  resultado: r,
  notas,
  errores,
  proveedorModelo,
});

export function datoDelContexto(contexto: FilaContexto | undefined): DatoDelPrompt[] {
  if (!contexto) return [];
  const campos = CAMPOS.map((c) => `${c.propiedad}: ${contexto.textos[c.propiedad]?.trim() || 'No encontrado'}`);
  return [{ fuente: 'Contexto del producto (confirmado por el PM)', contenido: [`Nombre: ${contexto.titulo}`, ...campos].join('\n') }];
}

const datoDeEvidencias = (evidencias: EvidenciaPreparada[]): DatoDelPrompt => ({
  fuente: 'Evidencia (cada una con su identificador)',
  contenido: evidencias.map((e) => `${e.ref} · ${e.texto}`).join('\n\n'),
});

/**
 * Adónde va cada segmento: una persona nueva, una que se actualiza o una versión nueva, de una
 * rechazada (por el motivo) o de una aprobada con evidencia nueva (persona viva, H8).
 */
type Destino =
  | { tipo: 'nueva'; clave: string; version: number }
  | { tipo: 'actualizar'; persona: FilaPersona; clave: string; version: number }
  | { tipo: 'version'; anterior: FilaPersona; clave: string; version: number; nuevas: EvidenciaPreparada[] | null }
  | { tipo: 'saltear'; motivo: string };

const instante = (iso: string | null) => {
  const ms = iso ? Date.parse(iso) : NaN;
  return Number.isNaN(ms) ? null : ms;
};

/**
 * La evidencia creada después de la última síntesis de la persona («Sintetizada el» o, si nunca
 * se escribió, la creación de la persona). Notion redondea la creación al minuto.
 */
export function evidenciaNueva(persona: FilaPersona, evidencias: EvidenciaPreparada[]): EvidenciaPreparada[] {
  const desde = instante(persona.sintetizadaEl) ?? instante(persona.creada);
  if (desde === null) return [];
  return evidencias.filter((e) => (instante(e.creada) ?? -Infinity) > desde);
}

function versionSiguiente(existente: FilaPersona, personas: FilaPersona[]): { clave: string; version: number } | { motivo: string } {
  const version = (existente.version ?? 1) + 1;
  const clave = claves.persona(existente.clave || existente.nombre, version);
  const ocupada = personas.find((x) => x.clave === clave);
  return ocupada && ocupada.estado !== 'Borrador' ? { motivo: `la versión ${version} ya existe y está en «${ocupada.estado}»` } : { clave, version };
}

function decidirDestino(segmento: SegmentoValidado, refs: Map<string, FilaPersona>, personas: FilaPersona[], evidencias: EvidenciaPreparada[]): Destino {
  const existente = segmento.personaExistente ? refs.get(segmento.personaExistente) : undefined;
  if (!existente) {
    const clave = claves.persona(segmento.nombre, 1);
    const ocupada = personas.find((x) => x.clave === clave);
    if (ocupada && ocupada.estado !== 'Borrador') {
      return { tipo: 'saltear', motivo: `ya existe «${ocupada.nombre}» en «${ocupada.estado}» con la misma clave` };
    }
    return ocupada ? { tipo: 'actualizar', persona: ocupada, clave, version: ocupada.version ?? 1 } : { tipo: 'nueva', clave, version: 1 };
  }
  const version = existente.version ?? 1;
  switch (existente.estado) {
    case 'Borrador':
    case null:
      return { tipo: 'actualizar', persona: existente, clave: existente.clave || claves.persona(existente.nombre, version), version };
    case 'Rechazada': {
      const siguiente = versionSiguiente(existente, personas);
      return 'motivo' in siguiente ? { tipo: 'saltear', motivo: siguiente.motivo } : { tipo: 'version', anterior: existente, ...siguiente, nuevas: null };
    }
    case 'En revisión':
      return { tipo: 'saltear', motivo: 'el PM la está revisando (En revisión), así que no se toca' };
    case 'Aprobada': {
      // Persona viva (HU-15): la aprobada no se toca; con evidencia nueva se propone la versión siguiente.
      const nuevas = evidenciaNueva(existente, evidencias);
      if (nuevas.length === 0) return { tipo: 'saltear', motivo: 'está Aprobada y no hay evidencia nueva desde su última síntesis' };
      const siguiente = versionSiguiente(existente, personas);
      return 'motivo' in siguiente ? { tipo: 'saltear', motivo: siguiente.motivo } : { tipo: 'version', anterior: existente, ...siguiente, nuevas };
    }
    default:
      return { tipo: 'saltear', motivo: `está en «${existente.estado}»` };
  }
}

interface Contexto {
  espacio: EspacioNotion;
  generar: Generador;
  contexto: FilaContexto | undefined;
  idioma: string;
  evidencias: EvidenciaPreparada[];
  mapa: Map<string, EvidenciaPreparada>;
  atributosExistentes: FilaAtributo[];
  otrosSegmentos: string[];
  campos: ReturnType<typeof camposConTexto>;
  entrevistas: number;
  notaEntrevistas: string;
  hayPublica: boolean;
  hayPropia: boolean;
  /** Atributos que ya tienen un supuesto a validar (etapa 5), para los controles. */
  conSupuesto: Set<string>;
  /** Inicio de la síntesis, redondeado al minuto como la creación en Notion: va a «Sintetizada el». */
  inicio: Date;
  notas: string[];
}

async function sintetizarPersona(c: Contexto, segmento: SegmentoValidado, destino: Exclude<Destino, { tipo: 'saltear' }>) {
  const previa = destino.tipo === 'actualizar' ? destino.persona : destino.tipo === 'version' ? destino.anterior : undefined;
  const datos: DatoDelPrompt[] = [
    ...datoDelContexto(c.contexto),
    {
      fuente: 'Segmento a describir',
      contenido: `Nombre: ${segmento.nombre}\nPor qué es distinto: ${segmento.porQueDistinto}\nOtros segmentos de esta síntesis: ${c.otrosSegmentos.filter((n) => n !== segmento.nombre).join('; ') || 'ninguno'}`,
    },
  ];
  const actuales = previa ? c.atributosExistentes.filter((a) => a.personas.includes(previa.id)) : [];
  // Solo los atributos de la misma persona se actualizan: los de una rechazada son historial.
  const refs = new Map(destino.tipo === 'actualizar' ? actuales.map((a, i) => [`A${i + 1}`, a]) : []);
  if (actuales.length) {
    const linea = (a: FilaAtributo, i: number) =>
      `${destino.tipo === 'actualizar' ? `A${i + 1} ·` : '-'} [${a.categoria ?? 'Sin categoría'}] ${a.afirmacion}${a.divergencia ? ' (con divergencia)' : ''}`;
    const fuente =
      destino.tipo === 'actualizar'
        ? 'Atributos actuales de esta persona (mantené la redacción si siguen valiendo)'
        : destino.tipo === 'version' && destino.nuevas
          ? 'Atributos de la versión aprobada (mantené los que siguen valiendo)'
          : 'Atributos de la versión anterior (rechazada)';
    datos.push({ fuente, contenido: actuales.map(linea).join('\n') });
  }
  if (destino.tipo === 'version' && destino.nuevas) {
    datos.push({ fuente: 'Evidencia nueva desde la versión aprobada', contenido: destino.nuevas.map((e) => e.ref).join(', ') });
  } else if (destino.tipo === 'version') {
    datos.push({ fuente: 'Motivo de rechazo del PM', contenido: destino.anterior.motivoRechazo || 'El PM no indicó un motivo.' });
  }
  datos.push(datoDeEvidencias(c.evidencias));

  const mensajes = armarPrompt({ tarea: TAREA_PERSONA, datos, idioma: c.idioma, esquema: esquemaPersona });
  const generado = await c.generar({ mensajes, esquema: esquemaPersona });
  const atributos = validarAtributos(generado.datos.atributos, c.mapa, segmento.nombre, c.notas, c.campos);
  const modelo = { proveedorModelo: generado.proveedorModelo, notasModelo: notasDeGeneracion(generado) };
  // Una versión por evidencia nueva solo se escribe si algún atributo usa esa evidencia.
  if (destino.tipo === 'version' && destino.nuevas) {
    const nuevas = new Set(destino.nuevas.map((e) => e.id));
    if (!atributos.some((a) => a.evidencias.some((e) => nuevas.has(e.id)))) {
      c.notas.push(
        `Persona «${destino.anterior.nombre}» (Aprobada): hay ${nuevas.size} evidencia(s) nueva(s), pero ningún atributo propuesto la usa, así que no se crea la versión ${destino.version}.`,
      );
      return { id: null, atributos, ...modelo };
    }
  }
  const id = await escribirPersona(c, segmento, destino, atributos, generado.datos, refs);
  return { id, atributos, ...modelo };
}

/**
 * El atributo actual que corresponde a una propuesta: el que indicó el modelo o, si no indicó
 * ninguno, el que tiene el mismo texto. La clave no alcanza: sale del texto original, y el
 * modelo recibe el texto que dejó el PM (HU-12).
 */
function atributoActual(a: AtributoValidado, refs: Map<string, FilaAtributo>, usados: Set<string>, persona: string, notas: string[]): FilaAtributo | undefined {
  const ref = a.existente.trim().toUpperCase().replace(/[^A0-9]/g, '');
  if (ref) {
    const fila = refs.get(ref);
    if (fila && !usados.has(fila.id)) return fila;
    notas.push(`${persona} · «${a.afirmacion}»: se ignoró la referencia «${a.existente}», que no existe o ya se usó.`);
  }
  const texto = normalizar(a.afirmacion);
  return [...refs.values()].find((x) => !usados.has(x.id) && normalizar(x.afirmacion) === texto);
}

async function escribirPersona(
  c: Contexto,
  segmento: SegmentoValidado,
  destino: Exclude<Destino, { tipo: 'saltear' }>,
  atributos: AtributoValidado[],
  salida: z.infer<typeof esquemaPersona>,
  refs: Map<string, FilaAtributo>,
): Promise<string> {
  // Qué atributo actual corresponde a cada propuesta: hace falta antes, para los controles.
  const usados = new Set<string>();
  const correspondencias = atributos.map((a) => {
    const actual = atributoActual(a, refs, usados, segmento.nombre, c.notas);
    if (actual) usados.add(actual.id);
    return { a, actual };
  });
  const bajas = correspondencias.filter(({ a }) => a.confianza === 'Baja');
  const conPlan = bajas.filter(({ actual }) => actual && c.conSupuesto.has(actual.id)).length;

  const props: Record<string, unknown> = {
    'Por qué es un segmento distinto': p.texto(segmento.porQueDistinto),
    Resumen: p.texto(
      armarResumen({
        atributos,
        entrevistas: c.entrevistas,
        informacionQueFalta: salida.informacionQueFalta,
        hayPublica: c.hayPublica,
        hayPropia: c.hayPropia,
        notaEntrevistas: c.notaEntrevistas,
      }),
    ),
    Controles: p.texto(armarControles(atributos.length, { bajas: bajas.length, conPlan })),
    'Versión': p.numero(destino.version),
    'Sintetizada el': p.fecha(c.inicio),
  };
  // El nombre lo pone el agente al crear la persona; después es del PM.
  if (destino.tipo !== 'actualizar') {
    props['Nombre'] = p.titulo(segmento.nombre);
    props['Estado'] = p.estado('Borrador');
  }
  if (destino.tipo === 'version') {
    props['Versión anterior'] = p.relacion([destino.anterior.id]);
    const origen = destino.nuevas
      ? [
          `Versión ${destino.version}, creada a partir de la versión ${destino.version - 1} (Aprobada), por evidencia nueva:`,
          ...destino.nuevas.map((e) => `- ${e.fuente}`),
        ]
      : [
          `Versión ${destino.version}, creada a partir de la versión ${destino.version - 1}, que el PM rechazó.`,
          `Motivo de rechazo: «${destino.anterior.motivoRechazo || 'sin motivo'}».`,
        ];
    props['Registro de cambios'] = p.texto([...origen, `Cambios: ${salida.cambiosRespectoDeLaAnterior.trim() || 'No encontrado'}`].join('\n'));
  }
  // Una persona existente se actualiza por su id: puede no tener clave si se cargó a mano.
  const { id, accion } =
    destino.tipo === 'actualizar'
      ? await c.espacio.escritor.actualizar('personas', destino.persona.id, { ...props, Clave: p.texto(destino.clave) })
      : await c.espacio.escritor.guardar('personas', props, { clave: destino.clave });

  const escritas = new Set<string>();
  for (const { a, actual } of correspondencias) {
    const clave = claves.atributo(destino.clave, a.categoria, a.afirmacion);
    const propiedades = {
      'Afirmación': p.titulo(a.afirmacion),
      'Categoría': p.seleccion(a.categoria),
      Persona: p.relacion([id]),
      Evidencias: p.relacion(a.evidencias.map((e) => e.id)),
      Confianza: p.seleccion(a.confianza),
      Divergencia: { checkbox: a.divergencia },
      Posturas: p.texto(a.posturas),
    };
    // Un atributo actual se actualiza por su id y conserva su clave, aunque cambie la redacción.
    const { id: idAtributo } = actual
      ? await c.espacio.escritor.actualizar('atributos', actual.id, actual.clave ? propiedades : { ...propiedades, Clave: p.texto(clave) })
      : await c.espacio.escritor.guardar('atributos', propiedades, { clave });
    escritas.add(idAtributo);
  }

  // Lo que ya no se propone se archiva, salvo lo que editó el PM (se conserva y se avisa).
  if (destino.tipo === 'actualizar') {
    for (const viejo of c.atributosExistentes.filter((x) => x.personas.includes(id) && !escritas.has(x.id))) {
      const impedimento = await c.espacio.escritor.archivarSiSePuede('atributos', viejo.id, 'la nueva síntesis ya no lo propone.');
      if (impedimento) c.notas.push(`${segmento.nombre}: se conserva «${viejo.afirmacion}», que ya no se propone: ${impedimento}`);
      else if (viejo.divergencia) c.notas.push(`${segmento.nombre}: se archivó «${viejo.afirmacion}», que tenía una divergencia, porque el modelo ya no la propuso. Revisá si sigue vigente.`);
    }
  }

  const accionTexto =
    destino.tipo === 'version' ? `versión ${destino.version} creada${destino.nuevas ? ' por evidencia nueva' : ''}` :accion === 'creada' ? 'creada' : 'actualizada';
  const divergencias = atributos.filter((a) => a.divergencia).length;
  c.notas.push(`Persona «${segmento.nombre}» (${accionTexto}): ${atributos.length} atributo(s), ${divergencias} con divergencia.`);
  return id;
}

export const sintetizarEtapa: FuncionEtapa = async ({ solicitud, espacio, generar, sinModelo }: ContextoEtapa): Promise<ResultadoEtapa> => {
  if (!generar) return resultado('Error', [], [sinModelo ?? 'No hay un modelo de lenguaje disponible para esta ejecución.']);

  const entrevistas = (await espacio.leerEntrevistas()).filter((e) => e.nombreMiembro);
  const seleccion = entrevistasParaSintetizar(entrevistas, solicitud.opciones);
  if (!seleccion.ok) return resultado('Error', [], [seleccion.motivo]);

  const notas: string[] = [seleccion.nota];
  // Las respuestas a repreguntas que todavía no son evidencia, primero (decisión D del H5).
  for (const e of seleccion.incluidas) await guardarEvidenciaDeRepreguntas(espacio, e, notas);

  const inicio = new Date();
  inicio.setUTCSeconds(0, 0);
  const contexto = (await espacio.leerContextos())[0];
  const filas = await espacio.leerEvidencias();
  const excluidas = filas.filter((f) => f.excluida).length;
  if (excluidas) notas.push(`Quedaron afuera ${excluidas} evidencia(s) marcadas con «Excluir de la síntesis».`);
  const evidencias = prepararEvidencias(filas, seleccion.incluidas, entrevistas);
  if (evidencias.length === 0) return resultado('Error', notas, ['No hay evidencia para sintetizar.']);

  const personas = await espacio.leerPersonas();
  // Las versiones que ya tienen una siguiente quedan como historial.
  const vigentes = personas.filter((x) => x.versionSiguiente.length === 0 && x.estado !== 'Reemplazada');
  const refs = new Map(vigentes.map((x, i) => [`P${i + 1}`, x]));
  const idioma = contexto?.textos['Idioma']?.trim() || 'el idioma de la evidencia';
  const proveedores = new Set<string>();
  const notasModelo: string[] = [];

  let segmentos: SegmentoValidado[];
  let faltaGeneral: string;
  try {
    const datos: DatoDelPrompt[] = [...datoDelContexto(contexto)];
    if (refs.size) {
      datos.push({
        fuente: 'Personas existentes',
        contenido: [...refs.entries()]
          .map(([ref, x]) => `${ref} · ${x.nombre} · ${x.estado ?? 'Sin estado'} · versión ${x.version ?? 1}${x.porQue ? ` · ${x.porQue}` : ''}${x.estado === 'Rechazada' ? ` · motivo de rechazo: ${x.motivoRechazo || 'sin motivo'}` : ''}`)
          .join('\n'),
      });
    }
    datos.push(datoDeEvidencias(evidencias));
    const generado = await generar({ mensajes: armarPrompt({ tarea: TAREA_SEGMENTOS, datos, idioma, esquema: esquemaSegmentos }), esquema: esquemaSegmentos });
    proveedores.add(generado.proveedorModelo);
    notasModelo.push(...notasDeGeneracion(generado));
    segmentos = validarSegmentos(generado.datos.segmentos, new Set(refs.keys()), notas);
    faltaGeneral = generado.datos.informacionQueFalta.trim();
  } catch (e) {
    if (!(e instanceof ErrorGeneracion)) throw e;
    return resultado('Error', [...notas, ...notasDeGeneracion(e)], [`Segmentos: ${e.message}`]);
  }

  if (segmentos.length === 0) {
    notas.unshift(`La evidencia no alcanza para distinguir segmentos. Falta: ${faltaGeneral || 'No encontrado'}`);
    return resultado('Lista', [...notas, ...notasModelo], [], [...proveedores].join(' / ') || SIN_MODELO);
  }

  const c: Contexto = {
    espacio,
    generar,
    contexto,
    idioma,
    evidencias,
    mapa: new Map(evidencias.map((e) => [e.ref, e])),
    atributosExistentes: await espacio.leerAtributos(),
    otrosSegmentos: segmentos.map((s) => s.nombre),
    campos: camposConTexto(contexto),
    entrevistas: seleccion.incluidas.length,
    notaEntrevistas: seleccion.excluidas.length ? `Quedaron afuera ${seleccion.excluidas.length} entrevista(s) incompleta(s), a pedido del PM.` : '',
    hayPublica: evidencias.some((e) => e.tipo === 'Pública'),
    hayPropia: evidencias.some((e) => e.tipo === 'Investigación propia'),
    conSupuesto: new Set((await espacio.leerSupuestos()).flatMap((s) => s.atributos)),
    inicio,
    notas,
  };

  const errores: string[] = [];
  let escritas = 0;
  const asociadas = new Set<string>();
  for (const segmento of segmentos) {
    const destino = decidirDestino(segmento, refs, personas, evidencias);
    const existente = segmento.personaExistente ? refs.get(segmento.personaExistente) : undefined;
    if (existente) asociadas.add(existente.id);
    if (destino.tipo === 'saltear') {
      notas.push(`Segmento «${segmento.nombre}»: no se escribe, porque ${destino.motivo}.`);
      continue;
    }
    try {
      const r = await sintetizarPersona(c, segmento, destino);
      proveedores.add(r.proveedorModelo);
      notasModelo.push(...r.notasModelo);
      if (r.id) escritas++;
    } catch (e) {
      if (!(e instanceof ErrorGeneracion)) throw e;
      errores.push(`Persona «${segmento.nombre}»: ${e.message}`);
      notasModelo.push(...notasDeGeneracion(e));
    }
  }

  // Las personas que esperan una versión nueva y el modelo no asoció a ningún segmento (H8).
  for (const x of vigentes.filter((v) => !asociadas.has(v.id))) {
    if (x.estado === 'Rechazada') {
      notas.push(`Persona «${x.nombre}» (Rechazada): el modelo no la volvió a proponer, así que no hay versión nueva.`);
    } else if (x.estado === 'Aprobada' && evidenciaNueva(x, evidencias).length > 0) {
      notas.push(`Persona «${x.nombre}» (Aprobada): hay evidencia nueva, pero el modelo no la asoció a ningún segmento, así que no hay versión nueva.`);
    }
  }

  notas.unshift(
    `Evidencia usada: ${evidencias.length} filas (${seleccion.incluidas.length} entrevistas). Segmentos propuestos: ${segmentos.length}. Personas escritas: ${escritas}.`,
  );
  if (faltaGeneral) notas.push(`Para distinguir mejor los segmentos falta: ${faltaGeneral}`);
  return resultado(errores.length ? 'Incompleta' : 'Lista', [...notas, ...notasModelo], errores, [...proveedores].join(' / ') || SIN_MODELO);
};

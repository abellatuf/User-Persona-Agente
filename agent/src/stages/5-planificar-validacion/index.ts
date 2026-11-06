import { claves } from '../../guards/claves.js';
import { ErrorGeneracion, notasDeGeneracion, type Generador } from '../../llm/index.js';
import type { FilaAtributo, FilaEvidencia, FilaPersona, FilaSupuesto } from '../../notion/espacio.js';
import * as p from '../../notion/propiedades.js';
import { armarPrompt, type DatoDelPrompt } from '../../prompts/base.js';
import { datoDelContexto } from '../4-sintetizar/index.js';
import { armarControles } from '../4-sintetizar/reglas.js';
import type { ContextoEtapa, FuncionEtapa, ResultadoEtapa } from '../registro.js';
import { esquemaPlan, MAX_PREGUNTAS, MIN_PREGUNTAS, textoDePreguntas, validarPlanes, type PlanPropuesto, type PlanValidado } from './reglas.js';

/**
 * Etapa 5: plan de validación (H8, HU-14).
 *
 * 1. Archiva los supuestos Pendientes cuyo atributo ya no existe o ya no es de confianza Baja.
 * 2. Para cada persona en Borrador, una llamada propone un plan para cada atributo de confianza
 *    Baja que todavía no tiene supuesto: método, perfil a contactar y de 3 a 5 preguntas.
 * 3. El código valida cada plan y rechaza las preguntas sesgadas. Si hay problemas, pide una
 *    corrección una vez; lo que sigue mal se descarta y queda anotado.
 * 4. Solo crea supuestos: nunca modifica uno existente (puede tener ediciones del PM).
 */

const SIN_MODELO = 'Ninguno';
const MAX_CARACTERES_EVIDENCIA = 300;

const TAREA = [
  'Vas a proponer cómo validar con usuarios reales cada atributo de confianza baja de una persona (un segmento de usuarios).',
  'Cada atributo es un supuesto: todavía no hay evidencia suficiente de que sea cierto. El plan tiene que poder confirmarlo o refutarlo.',
  'Para cada atributo (A1, A2…) devolvé:',
  '- "atributo": su identificador.',
  '- "supuesto": el supuesto a validar, redactado como una hipótesis que se pueda refutar.',
  '- "metodo": Entrevista, Encuesta, Prueba o Analítica, el que mejor sirva para validarlo.',
  '- "perfil": a quién contactar (rol, situación, cantidad aproximada), sin nombres ni datos personales.',
  `- "preguntas": de ${MIN_PREGUNTAS} a ${MAX_PREGUNTAS} preguntas abiertas y no sesgadas.`,
  'Reglas para las preguntas:',
  '- Preguntá por lo que la persona hizo o hace, con casos concretos y recientes («¿Cómo cobraste las cuotas el mes pasado?»).',
  '- No preguntes por el futuro ni por hipótesis («¿Pagarías…?», «¿Usarías…?», «¿Estarías dispuesto…?», «Si existiera…»).',
  '- No empieces con «¿No…?» ni sugieras la respuesta.',
  '- No repitas la afirmación del atributo: la pregunta no tiene que delatar lo que se quiere confirmar.',
  '- No menciones el producto ni sus funciones.',
].join('\n');

const resultado = (r: ResultadoEtapa['resultado'], notas: string[], errores: string[] = [], proveedorModelo = SIN_MODELO): ResultadoEtapa => ({
  resultado: r,
  notas,
  errores,
  proveedorModelo,
});

/** Un supuesto vigente para un atributo: cualquiera que lo tenga vinculado. */
const atributosConSupuesto = (supuestos: FilaSupuesto[]) => new Set(supuestos.flatMap((s) => s.atributos));

async function archivarSupuestosQueSobran(c: { espacio: ContextoEtapa['espacio']; notas: string[] }, supuestos: FilaSupuesto[], atributos: FilaAtributo[]) {
  const porId = new Map(atributos.map((a) => [a.id, a]));
  const vigentes: FilaSupuesto[] = [];
  for (const s of supuestos) {
    const vinculados = s.atributos.map((id) => porId.get(id)).filter((a) => a !== undefined);
    const sigueBaja = vinculados.some((a) => a.confianza === 'Baja');
    if (sigueBaja || s.estado !== 'Pendiente') {
      vigentes.push(s);
      continue;
    }
    const motivo = vinculados.length === 0 ? 'su atributo ya no existe.' : 'su atributo ya no tiene confianza Baja.';
    const impedimento = await c.espacio.escritor.archivarSiSePuede('supuestos', s.id, motivo);
    if (impedimento) {
      c.notas.push(`Se conserva el supuesto «${s.supuesto}» (${motivo.replace(/\.$/, '')}): ${impedimento}`);
      vigentes.push(s);
    }
  }
  return vigentes;
}

function datosDeLaPersona(persona: FilaPersona, bajas: Array<[string, FilaAtributo]>, evidencias: Map<string, FilaEvidencia>): DatoDelPrompt[] {
  const linea = ([ref, a]: [string, FilaAtributo]) => {
    const respaldo = a.evidencias
      .map((id) => evidencias.get(id))
      .filter((e) => e !== undefined)
      .map((e) => `  - ${e.titulo}: ${p.recortar(e.extracto, MAX_CARACTERES_EVIDENCIA)}`);
    return [`${ref} · [${a.categoria ?? 'Sin categoría'}] ${a.afirmacion}`, ...respaldo].join('\n');
  };
  return [
    { fuente: 'Persona', contenido: `Nombre: ${persona.nombre}\nPor qué es un segmento distinto: ${persona.porQue || 'No encontrado'}` },
    { fuente: 'Atributos de confianza baja, con la evidencia que los respalda hoy', contenido: bajas.map(linea).join('\n\n') },
  ];
}

const pedidoDeCorreccion = (problemas: Map<string, string[]>) =>
  [
    '',
    '# Corrección',
    'Algunos planes no se pudieron usar. Devolvé de nuevo solo los planes de estos atributos, corregidos:',
    ...[...problemas.entries()].map(([ref, lista]) => `- ${ref}: ${lista.join('; ')}.`),
  ].join('\n');

async function planificarPersona(
  c: { generar: Generador; idioma: string; contexto: DatoDelPrompt[]; notas: string[]; notasModelo: string[]; proveedores: Set<string> },
  persona: FilaPersona,
  bajas: Array<[string, FilaAtributo]>,
  evidencias: Map<string, FilaEvidencia>,
): Promise<PlanValidado[]> {
  const refs = new Map(bajas.map(([ref, a]) => [ref, { afirmacion: a.afirmacion }]));
  const mensajes = armarPrompt({ tarea: TAREA, datos: [...c.contexto, ...datosDeLaPersona(persona, bajas, evidencias)], idioma: c.idioma, esquema: esquemaPlan });

  const pedir = async (usuario: string): Promise<PlanPropuesto[]> => {
    const r = await c.generar({ mensajes: { ...mensajes, usuario }, esquema: esquemaPlan });
    c.proveedores.add(r.proveedorModelo);
    c.notasModelo.push(...notasDeGeneracion(r));
    return r.datos.supuestos;
  };

  const primera = validarPlanes(await pedir(mensajes.usuario), refs);
  if (primera.problemas.size === 0) return primera.validos;

  const pendientes = new Map([...refs].filter(([ref]) => primera.problemas.has(ref)));
  let segunda;
  try {
    segunda = validarPlanes(await pedir(mensajes.usuario + pedidoDeCorreccion(primera.problemas)), pendientes);
  } catch (e) {
    if (!(e instanceof ErrorGeneracion)) throw e;
    c.notasModelo.push(...notasDeGeneracion(e));
    segunda = { validos: [], problemas: primera.problemas };
  }
  for (const [ref, lista] of segunda.problemas) {
    const atributo = bajas.find(([r]) => r === ref)?.[1];
    c.notas.push(`${persona.nombre} · «${atributo?.afirmacion ?? ref}»: plan descartado después de pedir una corrección (${lista.join('; ')}).`);
  }
  return [...primera.validos, ...segunda.validos];
}

export const planificarValidacion: FuncionEtapa = async ({ espacio, generar, sinModelo }: ContextoEtapa): Promise<ResultadoEtapa> => {
  const notas: string[] = [];
  const notasModelo: string[] = [];
  const proveedores = new Set<string>();

  const personas = await espacio.leerPersonas();
  const atributos = await espacio.leerAtributos();
  const supuestos = await archivarSupuestosQueSobran({ espacio, notas }, await espacio.leerSupuestos(), atributos);
  const conSupuesto = atributosConSupuesto(supuestos);
  // Un supuesto con la misma clave pero sin vínculo (por ejemplo, el PM lo desvinculó) tampoco se rehace.
  const clavesUsadas = new Set(supuestos.map((s) => s.clave).filter(Boolean));
  const borradores = personas.filter((x) => x.estado === 'Borrador' || x.estado === null);

  const aPlanificar = borradores.map((persona) => {
    const propios = atributos.filter((a) => a.personas.includes(persona.id));
    const bajas = propios.filter((a) => a.confianza === 'Baja');
    const sinPlan = bajas.filter((a) => !conSupuesto.has(a.id) && !clavesUsadas.has(claves.supuesto(a.clave || a.id)));
    return { persona, propios, bajas, sinPlan };
  });
  const hayQuePlanificar = aPlanificar.some((x) => x.sinPlan.length > 0);

  if (borradores.length === 0) notas.push('No hay personas en Borrador: no hay nada que planificar.');
  if (hayQuePlanificar && !generar) {
    return resultado('Error', notas, [sinModelo ?? 'No hay un modelo de lenguaje disponible para esta ejecución.']);
  }

  const contexto = (await espacio.leerContextos())[0];
  const idioma = contexto?.textos['Idioma']?.trim() || 'el idioma de la evidencia';
  const evidencias = hayQuePlanificar ? new Map((await espacio.leerEvidencias()).map((e) => [e.id, e])) : new Map<string, FilaEvidencia>();
  const errores: string[] = [];
  let creados = 0;

  for (const { persona, propios, bajas, sinPlan } of aPlanificar) {
    let conPlan = bajas.length - sinPlan.length;
    if (sinPlan.length > 0 && generar) {
      const refs = sinPlan.map((a, i) => [`A${i + 1}`, a] as [string, FilaAtributo]);
      try {
        const planes = await planificarPersona({ generar, idioma, contexto: datoDelContexto(contexto), notas, notasModelo, proveedores }, persona, refs, evidencias);
        for (const plan of planes) {
          const atributo = refs.find(([ref]) => ref === plan.ref)![1];
          const clave = claves.supuesto(atributo.clave || atributo.id);
          await espacio.escritor.guardar(
            'supuestos',
            {
              Supuesto: p.titulo(plan.supuesto),
              Atributo: p.relacion([atributo.id]),
              'Método': p.seleccion(plan.metodo),
              'Perfil a contactar': p.texto(plan.perfil),
              'Preguntas sugeridas': p.texto(textoDePreguntas(plan.preguntas)),
              Estado: p.estado('Pendiente'),
            },
            { clave },
          );
          conPlan++;
          creados++;
        }
        notas.push(`Persona «${persona.nombre}»: ${planes.length} supuesto(s) nuevo(s), de ${sinPlan.length} atributo(s) de confianza baja sin plan.`);
      } catch (e) {
        if (!(e instanceof ErrorGeneracion)) throw e;
        errores.push(`Persona «${persona.nombre}»: ${e.message}`);
        notasModelo.push(...notasDeGeneracion(e));
      }
    } else if (bajas.length > 0) {
      notas.push(`Persona «${persona.nombre}»: sus ${bajas.length} atributo(s) de confianza baja ya tienen plan.`);
    }
    await espacio.escritor.actualizar('personas', persona.id, {
      Controles: p.texto(armarControles(propios.length, { bajas: bajas.length, conPlan })),
    });
  }

  if (borradores.length > 0) notas.unshift(`Personas en Borrador: ${borradores.length}. Supuestos creados: ${creados}.`);
  return resultado(errores.length ? 'Incompleta' : 'Lista', [...notas, ...notasModelo], errores, [...proveedores].join(' / ') || SIN_MODELO);
};

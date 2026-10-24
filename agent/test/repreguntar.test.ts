import { describe, expect, it } from 'vitest';
import { ejecutarAgente } from '../src/ciclo.js';
import { BASES } from '../src/config.js';
import { evaluarEscritura } from '../src/guards/escritura.js';
import { crearGenerador } from '../src/llm/generar.js';
import type { FilaEntrevista } from '../src/notion/espacio.js';
import { ESQUEMA_ESPERADO } from '../src/stages/0-verificar-espacio/esquema-esperado.js';
import { leerRepreguntas, MARCA_RESPUESTA, parrafosDeRepreguntas, tieneRepreguntas } from '../src/stages/2-repreguntar/cuerpo.js';
import { MAX_REPREGUNTAS, PREGUNTAS, propiedadDe } from '../src/stages/2-repreguntar/formulario.js';
import { repreguntarEtapa } from '../src/stages/2-repreguntar/index.js';
import {
  entrevistasParaSintetizar,
  filtrarRepreguntas,
  mencionaAOtros,
  OPCION_AVANZAR_SIN_INCOMPLETAS,
} from '../src/stages/2-repreguntar/reglas.js';
import { ETAPAS } from '../src/stages/registro.js';
import { ProveedorFalso, respuesta } from './apoyo/api-modelo-falsa.js';
import { EspacioFalso } from './apoyo/espacio-falso.js';
import { textoDe } from './apoyo/formato.js';
import { ID_PM } from './apoyo/llamador-falso.js';

const silencio = () => {};
const sinEspera = async () => {};
const texto = (valor: string) => ({ rich_text: [{ type: 'text', text: { content: valor } }] });
const P = (codigo: string) => propiedadDe(PREGUNTAS.find((q) => q.codigo === codigo)!);

/** Siembra una entrevista como si la hubiera mandado un miembro con el formulario. */
function sembrarEntrevista(
  espacio: EspacioFalso,
  nombre: string,
  rol: string,
  respuestas: Record<string, string>,
  estado = 'Pendiente',
) {
  const props: Record<string, Record<string, unknown>> = {
    Entrevista: { title: [] },
    'Nombre del miembro': texto(nombre),
    'Rol del miembro': { select: { name: rol } },
    Estado: { status: { name: estado } },
  };
  for (const [codigo, valor] of Object.entries(respuestas)) props[P(codigo)] = texto(valor);
  return espacio.notion.sembrar(BASES.entrevistas, props, ID_PM);
}

const rep = (sobre: string, textoRep: string, motivo = 'Es vaga.') => ({ sobre, texto: textoRep, motivo });
const salida = (repreguntas: ReturnType<typeof rep>[], sinRepreguntas = '') => respuesta({ repreguntas, sinRepreguntas });

function preparar(pasos: ReturnType<typeof respuesta>[]) {
  const espacio = new EspacioFalso();
  const gemini = new ProveedorFalso('Gemini', 'gemini-x', pasos);
  const generar = crearGenerador({ principal: gemini, esperar: sinEspera });
  const correr = () => repreguntarEtapa({ solicitud: { id: 's', titulo: 's', etapa: 'Repreguntar', opciones: '' }, espacio, generar });
  const propiedades = (id: string) => espacio.notion.paginas.get(id)!.properties;
  const evidencia = () => espacio.notion.filasDe(BASES.evidencia).map(([, p]) => p.properties);
  return { espacio, gemini, correr, propiedades, evidencia };
}

describe('formulario base (T5.1)', () => {
  it('tiene 13 preguntas, dentro del tope de 15, con códigos únicos', () => {
    expect(PREGUNTAS).toHaveLength(13);
    expect(PREGUNTAS.length).toBeLessThanOrEqual(15);
    expect(new Set(PREGUNTAS.map((q) => q.codigo)).size).toBe(13);
    expect(PREGUNTAS[0]!.codigo).toBe('P01');
    expect(PREGUNTAS[12]!.codigo).toBe('P13');
  });

  it('la etapa 0 exige cada pregunta como propiedad de texto de Entrevistas', () => {
    const props = ESQUEMA_ESPERADO.entrevistas.propiedades;
    for (const q of PREGUNTAS) expect(props[propiedadDe(q)]).toEqual({ tipo: 'rich_text' });
    expect(props['Nombre del miembro']).toEqual({ tipo: 'rich_text' });
    expect(props['Rol del miembro']?.opciones).toContain('Ingeniería');
    expect(props['Respuestas del formulario base']).toBeUndefined();
  });
});

describe('repreguntas en el cuerpo de la página', () => {
  const escritas = parrafosDeRepreguntas([
    { sobre: 'P04', texto: '¿Podés contar la última vez que lo resolviste así?', respuestaOriginal: 'Con una planilla.' },
    { sobre: 'P10', texto: '¿Qué caso concreto viste de quién paga?', respuestaOriginal: 'El mismo que lo usa.' },
  ]);

  it('arma un encabezado, la repregunta y el renglón para responder', () => {
    expect(escritas[1]).toBe('❓ Repregunta 1 · sobre tu respuesta a P04 («Con una planilla.»)');
    expect(escritas[2]).toBe('¿Podés contar la última vez que lo resolviste así?');
    expect(escritas[3]).toBe(MARCA_RESPUESTA);
    expect(tieneRepreguntas(escritas)).toBe(true);
    expect(tieneRepreguntas(['Notas sueltas del PM'])).toBe(false);
  });

  it('lee las respuestas, en el mismo renglón o en varios, hasta la próxima repregunta', () => {
    const cuerpo = [...escritas];
    cuerpo.splice(4, 0, 'La semana pasada,', 'con dos clientes.');
    cuerpo[cuerpo.length - 1] = `${MARCA_RESPUESTA} Nunca lo vi.`;

    const leidas = leerRepreguntas(['Algo que escribió el PM antes', ...cuerpo]);

    expect(leidas).toEqual([
      { numero: 1, sobre: 'P04', texto: '¿Podés contar la última vez que lo resolviste así?', respuesta: 'La semana pasada,\ncon dos clientes.' },
      { numero: 2, sobre: 'P10', texto: '¿Qué caso concreto viste de quién paga?', respuesta: 'Nunca lo vi.' },
    ]);
  });

  it('una repregunta sin responder queda con la respuesta vacía', () => {
    expect(leerRepreguntas(escritas).map((r) => r.respuesta)).toEqual(['', '']);
  });
});

describe('reglas de las repreguntas (código, no modelo)', () => {
  const respuestas = { P01: 'Profesionales independientes', P04: 'Con una planilla', P10: 'El mismo que lo usa', P11: 'Que pagan a tiempo' };

  it(`acepta hasta ${MAX_REPREGUNTAS} y descarta las que no cumplen, con el motivo`, () => {
    const { aceptadas, descartadas } = filtrarRepreguntas(
      [
        { sobre: 'P04', texto: '¿Cuándo fue la última vez que usaste la planilla?' },
        { sobre: 'P99', texto: '¿Algo más?' },
        { sobre: 'P02', texto: '¿Cómo es un día típico?' },
        { sobre: 'P04', texto: PREGUNTAS[3]!.texto },
        { sobre: 'P10', texto: 'Otro miembro dice que paga otra persona: ¿qué opinás?' },
        { sobre: 'p10', texto: '¿Qué caso concreto viste de quién paga?' },
        { sobre: 'P04', texto: '¿Cuándo fue la última vez que usaste la planilla?' },
        { sobre: 'P01', texto: '¿Con cuántos hablaste en el último mes?' },
        { sobre: 'P01', texto: '¿Qué los hace distintos entre sí?' },
        { sobre: 'P11', texto: '¿Por qué creés que el resto del equipo lo da por sentado?' },
        { sobre: 'P01', texto: '¿Qué ejemplo real tenés?' },
      ],
      respuestas,
    );

    expect(aceptadas).toHaveLength(MAX_REPREGUNTAS);
    expect(aceptadas[1]).toEqual({ sobre: 'P10', texto: '¿Qué caso concreto viste de quién paga?' });
    // «El resto del equipo» es parte de P11: se puede repreguntar sobre eso.
    expect(aceptadas.map((a) => a.sobre)).toContain('P11');
    expect(descartadas.map((d) => d.motivo)).toEqual([
      'no está vinculada a una respuesta que exista («P99»).',
      'no está vinculada a una respuesta que exista («P02»).',
      'repite una pregunta del formulario.',
      'menciona a otros miembros o lo que respondieron.',
      'está repetida.',
      `supera el tope de ${MAX_REPREGUNTAS} repreguntas por miembro.`,
    ]);
  });

  it('detecta menciones a otros miembros, a sus nombres o a un desacuerdo', () => {
    expect(mencionaAOtros('Tus compañeros piensan distinto, ¿por qué?')).toBe(true);
    expect(mencionaAOtros('Según otra persona del equipo, no es así. ¿Qué te hace pensarlo?')).toBe(true);
    expect(mencionaAOtros('Hay un desacuerdo sobre esto: ¿en qué te basás?')).toBe(true);
    expect(mencionaAOtros('¿Qué le dirías a Martín sobre esto?', ['Martín'])).toBe(true);
    expect(mencionaAOtros('¿Hablaste con otras personas que lo usen?')).toBe(false);
    expect(mencionaAOtros('¿Qué caso concreto viste?', ['Martín'])).toBe(false);
  });
});

describe('entrevistas para sintetizar (T5.4, HU-06)', () => {
  const entrevista = (nombre: string, estado: string): FilaEntrevista => ({
    id: nombre,
    titulo: nombre,
    estado,
    nombreMiembro: nombre,
    rolMiembro: 'PM',
    miembros: [],
    respuestas: {},
  });
  const todas = [entrevista('Ana', 'Completa'), entrevista('Beto', 'Repreguntas pendientes'), entrevista('Caro', 'Completa')];

  it('con todas Completas, entran todas', () => {
    const r = entrevistasParaSintetizar([todas[0]!, todas[2]!], '');
    expect(r).toMatchObject({ ok: true, nota: 'Entrevistas usadas: 2, todas Completas.' });
  });

  it('si falta alguna, no arranca y explica cómo avanzar', () => {
    const r = entrevistasParaSintetizar(todas, '');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.motivo).toMatch(/Beto \(Repreguntas pendientes\).*avanzar sin las entrevistas incompletas/);
  });

  it('con la opción de avanzar sin las incompletas, sigue y registra cuáles quedaron afuera', () => {
    const r = entrevistasParaSintetizar(todas, `Por favor, ${OPCION_AVANZAR_SIN_INCOMPLETAS.toUpperCase()}`);
    expect(r).toMatchObject({ ok: true });
    expect(r.ok && r.incluidas.map((e) => e.id)).toEqual(['Ana', 'Caro']);
    expect(r.ok && r.nota).toMatch(/Quedaron afuera: Beto/);
  });

  it('sin ninguna Completa, no se puede sintetizar', () => {
    expect(entrevistasParaSintetizar([todas[1]!], OPCION_AVANZAR_SIN_INCOMPLETAS)).toMatchObject({ ok: false });
  });
});

describe('etapa 2: repreguntar (H5)', () => {
  it('vincula cada entrevista con su miembro, guarda la evidencia y escribe las repreguntas', async () => {
    const { espacio, correr, propiedades, evidencia } = preparar([
      salida([rep('P04', '¿Podés contar la última vez que lo resolviste así?'), rep('P10', '¿Qué caso concreto viste de quién paga?')]),
      salida([rep('P10', '¿Cómo llegaste a esa conclusión?')]),
    ]);
    const ana = sembrarEntrevista(espacio, 'Ana', 'PM', { P01: 'Profesionales independientes', P04: 'Con una planilla', P10: 'El mismo que lo usa' });
    const beto = sembrarEntrevista(espacio, 'Beto', 'Negocio', { P01: 'Estudios chicos', P10: 'Paga otra persona. Escribime a beto@ejemplo.com' });

    const r = await correr();

    expect(r.resultado).toBe('Lista');
    expect(r.proveedorModelo).toBe('Gemini · modelo-real');
    // Miembros creados en Equipo y vinculados.
    const equipo = espacio.notion.filasDe(BASES.equipo).map(([, p]) => p.properties);
    expect(equipo.map((m) => textoDe(m['Nombre']))).toEqual(['Ana', 'Beto']);
    expect(equipo[1]!['Rol']).toEqual({ select: { name: 'Negocio' } });
    expect(propiedades(ana)['Miembro']).toEqual({ relation: [{ id: espacio.notion.filasDe(BASES.equipo)[0]![0] }] });
    expect(textoDe(propiedades(ana)['Entrevista'])).toBe('Ana (PM)');
    // Una evidencia por respuesta, del tipo supuesto del equipo y vinculada a la entrevista.
    const ev = evidencia();
    expect(ev).toHaveLength(5);
    expect(textoDe(ev[0]!['Título'])).toBe('P01 · Ana (PM)');
    expect(ev[0]!['Tipo']).toEqual({ select: { name: 'Supuesto del equipo' } });
    expect(ev[0]!['Entrevista']).toEqual({ relation: [{ id: ana }] });
    // Las repreguntas, en el cuerpo de cada página, y el estado.
    expect(leerRepreguntas(espacio.notion.cuerpoDe(ana)).map((x) => x.sobre)).toEqual(['P04', 'P10']);
    expect(propiedades(ana)['Estado']).toEqual({ status: { name: 'Repreguntas pendientes' } });
    expect(propiedades(beto)['Estado']).toEqual({ status: { name: 'Repreguntas pendientes' } });
    expect(r.notas[0]).toMatch(/Repreguntadas en esta corrida: 2/);
    expect(r.notas[1]).toBe('Evidencia guardada: 5 respuesta(s) del formulario base y 0 respuesta(s) a repreguntas.');
  });

  it('el modelo ve las respuestas de los otros miembros sin sus nombres, y sin datos personales', async () => {
    const { espacio, gemini, correr } = preparar([salida([]), salida([])]);
    sembrarEntrevista(espacio, 'Ana', 'PM', { P10: 'El mismo que lo usa' });
    sembrarEntrevista(espacio, 'Beto', 'Negocio', { P10: 'Paga otra persona. Escribime a beto@ejemplo.com' });

    await correr();

    const paraAna = gemini.recibidas[0]!.usuario;
    expect(paraAna).toContain('Otro miembro 1: Paga otra persona. Escribime a [CORREO]');
    expect(paraAna).not.toContain('Beto');
    expect(paraAna).not.toContain('beto@ejemplo.com');
    expect(paraAna).toContain('Contexto del producto (confirmado por el PM)');
  });

  it('descarta las repreguntas que no cumplen las reglas y deja el motivo en las notas', async () => {
    const { espacio, correr } = preparar([
      salida([
        rep('P04', '¿Cuándo fue la última vez?'),
        rep('P04', 'Tus compañeros dicen otra cosa, ¿por qué?'),
        rep('P07', '¿Qué resultado esperás?'),
      ]),
    ]);
    const ana = sembrarEntrevista(espacio, 'Ana', 'PM', { P04: 'Con una planilla' });

    const r = await correr();

    expect(leerRepreguntas(espacio.notion.cuerpoDe(ana))).toHaveLength(1);
    expect(r.notas).toContain('Ana (PM): repregunta descartada («Tus compañeros dicen otra cosa, ¿por qué?»): menciona a otros miembros o lo que respondieron.');
    expect(r.notas.some((n) => n.includes('no está vinculada a una respuesta que exista («P07»)'))).toBe(true);
  });

  it('si el modelo no ve necesario repreguntar, la entrevista pasa a Completa y queda registrado', async () => {
    const { espacio, correr, propiedades } = preparar([salida([], 'Las respuestas tienen ejemplos concretos.')]);
    const ana = sembrarEntrevista(espacio, 'Ana', 'PM', { P04: 'Con una planilla, todos los lunes' });

    const r = await correr();

    expect(propiedades(ana)['Estado']).toEqual({ status: { name: 'Completa' } });
    expect(espacio.notion.cuerpoDe(ana)).toEqual([]);
    expect(r.notas).toContain('Ana (PM): sin repreguntas («Las respuestas tienen ejemplos concretos.»). La entrevista pasó a Completa.');
  });

  it('repetir la etapa no duplica miembros, evidencia ni repreguntas', async () => {
    const { espacio, gemini, correr, evidencia } = preparar([salida([rep('P04', '¿Cuándo fue la última vez?')])]);
    const ana = sembrarEntrevista(espacio, 'Ana', 'PM', { P01: 'Profesionales', P04: 'Con una planilla' });
    await correr();

    const r = await correr();

    expect(r.resultado).toBe('Lista');
    expect(gemini.recibidas).toHaveLength(1);
    expect(espacio.notion.filasDe(BASES.equipo)).toHaveLength(1);
    expect(evidencia()).toHaveLength(2);
    expect(leerRepreguntas(espacio.notion.cuerpoDe(ana))).toHaveLength(1);
  });

  it('si ya hay repreguntas en la página (una corrida que falló a mitad), no genera otras', async () => {
    const { espacio, gemini, correr, propiedades } = preparar([]);
    const ana = sembrarEntrevista(espacio, 'Ana', 'PM', { P04: 'Con una planilla' }, 'Base respondida');
    espacio.notion.escribirEnCuerpo(ana, ...parrafosDeRepreguntas([{ sobre: 'P04', texto: '¿Cuándo?', respuestaOriginal: 'Con una planilla' }]));

    await correr();

    expect(gemini.recibidas).toHaveLength(0);
    expect(propiedades(ana)['Estado']).toEqual({ status: { name: 'Repreguntas pendientes' } });
    expect(leerRepreguntas(espacio.notion.cuerpoDe(ana))).toHaveLength(1);
  });

  it('con la entrevista Completa, guarda las respuestas a las repreguntas como evidencia', async () => {
    const { espacio, gemini, correr, evidencia } = preparar([salida([rep('P04', '¿Cuándo fue la última vez?'), rep('P01', '¿Con cuántos hablaste?')])]);
    const ana = sembrarEntrevista(espacio, 'Ana', 'PM', { P01: 'Profesionales', P04: 'Con una planilla' });
    await correr();
    // Ana responde la primera repregunta y cierra su entrevista.
    const cuerpo = espacio.notion.bloques.get(ana)!;
    const marca = cuerpo.findIndex((b) => textoDe((b as { paragraph: unknown }).paragraph) === MARCA_RESPUESTA);
    cuerpo.splice(marca + 1, 0, { id: 'respuesta-ana', type: 'paragraph', paragraph: texto('El lunes, con tres clientes.') });
    espacio.notion.editarComoPm(ana, { Estado: { status: { name: 'Completa' } } });

    const r = await correr();

    expect(gemini.recibidas).toHaveLength(1);
    const ev = evidencia().filter((e) => textoDe(e['Título']).startsWith('R'));
    expect(ev).toHaveLength(1);
    expect(textoDe(ev[0]!['Título'])).toBe('R1 (sobre P04) · Ana (PM)');
    expect(textoDe(ev[0]!['Extracto'])).toBe('¿Cuándo fue la última vez?\nEl lunes, con tres clientes.');
    expect(r.notas).toContain('Ana (PM): la repregunta 2 quedó sin responder.');
    // Repetirla actualiza la misma fila de evidencia.
    await correr();
    expect(evidencia().filter((e) => textoDe(e['Título']).startsWith('R'))).toHaveLength(1);
  });

  it('si el miembro ya está en Equipo, lo vincula sin crear otro (sin distinguir mayúsculas ni acentos)', async () => {
    const { espacio, correr, propiedades } = preparar([salida([])]);
    const martin = espacio.notion.sembrar(BASES.equipo, { Nombre: { title: [{ type: 'text', text: { content: 'Martín' } }] } }, ID_PM);
    const e = sembrarEntrevista(espacio, 'martin', 'Ingeniería', { P01: 'Profesionales' });

    await correr();

    expect(espacio.notion.filasDe(BASES.equipo)).toHaveLength(1);
    expect(propiedades(e)['Miembro']).toEqual({ relation: [{ id: martin }] });
  });

  it('sin modelo disponible, no escribe nada', async () => {
    const espacio = new EspacioFalso();
    sembrarEntrevista(espacio, 'Ana', 'PM', { P01: 'Profesionales' });
    const antes = espacio.notion.escrituras().length;

    const r = await repreguntarEtapa({
      solicitud: { id: 's', titulo: 's', etapa: 'Repreguntar', opciones: '' },
      espacio,
      sinModelo: 'Falta el secreto GEMINI_API_KEY.',
    });

    expect(r).toMatchObject({ resultado: 'Error', errores: ['Falta el secreto GEMINI_API_KEY.'] });
    expect(espacio.notion.escrituras().length).toBe(antes);
  });

  it('sin entrevistas respondidas termina en Error, y una entrevista sin nombre se saltea', async () => {
    const { espacio, correr } = preparar([salida([])]);
    expect((await correr()).errores[0]).toMatch(/No hay entrevistas con el formulario base respondido/);

    sembrarEntrevista(espacio, '', 'PM', { P01: 'Profesionales' });
    sembrarEntrevista(espacio, 'Ana', 'PM', { P01: 'Profesionales' });
    const r = await correr();
    expect(r.notas.some((n) => n.includes('falta «Nombre del miembro», se saltea'))).toBe(true);
    expect(espacio.notion.filasDe(BASES.equipo)).toHaveLength(1);
  });

  it('dentro del bucle, Repreguntar ya no es un marcador', async () => {
    const espacio = new EspacioFalso();
    sembrarEntrevista(espacio, 'Ana', 'PM', { P01: 'Profesionales' });
    espacio.agregarSolicitud({ id: 's1', etapa: 'Repreguntar' });
    const gemini = new ProveedorFalso('Gemini', 'gemini-x', [salida([rep('P01', '¿Con cuántos hablaste el último mes?')])]);

    await ejecutarAgente({
      espacio,
      etapas: ETAPAS,
      modelos: () => ({ generar: crearGenerador({ principal: gemini, esperar: sinEspera }) }),
      log: silencio,
    });

    expect(espacio.estadoDe('s1')).toBe('Lista');
    expect(espacio.ejecuciones[0]?.cierre?.notas.some((n) => n.includes('1 repregunta(s) escritas en su página'))).toBe(true);
  });
});

describe('regla de escritura: una entrevista Completa no vuelve atrás', () => {
  const actual = { estado: 'Completa', editadoPorPm: false, ultimaEdicionDelAgente: false, creadaPorAgente: false, personaCongelada: false, deOtraBase: false };

  it('bloquea pasarla a otro estado, pero deja vincularla', () => {
    expect(
      evaluarEscritura({ accion: 'actualizar', base: 'entrevistas', propiedades: { Estado: { status: { name: 'Repreguntas pendientes' } } }, actual }),
    ).toMatch(/ya está Completa/);
    expect(evaluarEscritura({ accion: 'actualizar', base: 'entrevistas', propiedades: { Miembro: { relation: [{ id: 'm' }] } }, actual })).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { BASES } from '../src/config.js';
import { claves } from '../src/guards/claves.js';
import { crearGenerador } from '../src/llm/generar.js';
import { planificarValidacion } from '../src/stages/5-planificar-validacion/index.js';
import { sesgoDePregunta, validarPlanes } from '../src/stages/5-planificar-validacion/reglas.js';
import { ProveedorFalso, respuesta } from './apoyo/api-modelo-falsa.js';
import { EspacioFalso } from './apoyo/espacio-falso.js';
import { textoDe } from './apoyo/formato.js';
import { ID_PM } from './apoyo/llamador-falso.js';

const sinEspera = async () => {};
const texto = (valor: string) => ({ rich_text: [{ type: 'text', text: { content: valor } }] });
const titulo = (valor: string) => ({ title: [{ type: 'text', text: { content: valor } }] });

const AFIRMACION = 'Persigue a los morosos por WhatsApp todos los meses';
const BUENAS = [
  '¿Cómo cobraste las cuotas el mes pasado?',
  '¿Qué hiciste la última vez que un socio no pagó?',
  '¿Cuánto tiempo te llevó la cobranza en octubre?',
];

const plan = (atributo: string, preguntas = BUENAS, metodo = 'Entrevista') => ({
  atributo,
  supuesto: `Hipótesis de ${atributo}`,
  metodo,
  perfil: 'Tesoreros de clubes de barrio, 5',
  preguntas,
});

/** Persona en Borrador con un atributo Baja, uno Alta y un supuesto Pendiente del Alta (sobra). */
function espacioBase() {
  const espacio = new EspacioFalso({ contexto: { Nombre: titulo('Producto'), Estado: { status: { name: 'Confirmado' } } } });
  const n = espacio.notion;
  const evidencia = n.sembrar(BASES.evidencia, { 'Título': titulo('P05 · Ana (PM)'), Extracto: texto('Le cuesta perseguir a los morosos.') });
  const persona = n.sembrar(BASES.personas, { Nombre: titulo('Clubes de barrio'), Estado: { status: { name: 'Borrador' } }, Clave: texto('persona:clubes') });
  const atributo = (afirmacion: string, confianza: string, clave: string) =>
    n.sembrar(BASES.atributos, {
      'Afirmación': titulo(afirmacion),
      'Categoría': { select: { name: 'Comportamiento' } },
      Persona: { relation: [{ id: persona }] },
      Evidencias: { relation: [{ id: evidencia }] },
      Confianza: { select: { name: confianza } },
      Clave: texto(clave),
    });
  const baja = atributo(AFIRMACION, 'Baja', 'atributo:baja');
  const alta = atributo('Usa una planilla', 'Alta', 'atributo:alta');
  const sobrante = n.sembrar(BASES.supuestos, {
    Supuesto: titulo('Viejo'),
    Atributo: { relation: [{ id: alta }] },
    Estado: { status: { name: 'Pendiente' } },
    Clave: texto(claves.supuesto('atributo:alta')),
  });
  return { espacio, persona, baja, alta, sobrante };
}

function preparar(espacio: EspacioFalso, pasos: unknown[]) {
  const gemini = new ProveedorFalso('Gemini', 'gemini-x', pasos.map((x) => respuesta(x)));
  const generar = crearGenerador({ principal: gemini, esperar: sinEspera });
  const correr = () => planificarValidacion({ solicitud: { id: 's', titulo: 's', etapa: 'Planificar validación', opciones: '' }, espacio, generar });
  const filas = (base: keyof typeof BASES) => espacio.notion.filasDe(BASES[base]).map(([id, pagina]) => [id, pagina.properties] as const);
  return { gemini, correr, filas };
}

describe('etapa 5: planificar validación (H8)', () => {
  it('crea un supuesto Pendiente por atributo Baja, archiva el que sobra y actualiza los controles', async () => {
    const { espacio, persona, baja, sobrante } = espacioBase();
    const { correr, filas, gemini } = preparar(espacio, [{ supuestos: [plan('A1')] }]);

    const r = await correr();

    expect(r.resultado).toBe('Lista');
    expect(espacio.notion.paginas.get(sobrante)!.enPapelera).toBe(true);
    const supuestos = filas('supuestos').filter(([id]) => id !== sobrante);
    expect(supuestos).toHaveLength(1);
    const [, s] = supuestos[0]!;
    expect(s['Atributo']).toEqual({ relation: [{ id: baja }] });
    expect(s['Método']).toEqual({ select: { name: 'Entrevista' } });
    expect(s['Estado']).toEqual({ status: { name: 'Pendiente' } });
    expect(textoDe(s['Preguntas sugeridas'])).toBe(BUENAS.map((q, i) => `${i + 1}. ${q}`).join('\n'));
    expect(textoDe(s['Clave'])).toBe(claves.supuesto('atributo:baja'));
    const controles = textoDe(espacio.notion.paginas.get(persona)!.properties['Controles']);
    expect(controles).toContain('✅ 1 de 1 supuestos de confianza baja con plan');
    // Solo el atributo Baja va al modelo, con su evidencia.
    expect(gemini.recibidas).toHaveLength(1);
    expect(gemini.recibidas[0]!.usuario).toContain(`A1 · [Comportamiento] ${AFIRMACION}`);
    expect(gemini.recibidas[0]!.usuario).toContain('Le cuesta perseguir a los morosos.');
    expect(gemini.recibidas[0]!.usuario).not.toContain('Usa una planilla');
  });

  it('rechaza las preguntas sesgadas, pide una corrección y, si sigue mal, descarta el plan', async () => {
    const { espacio, persona } = espacioBase();
    const sesgado = plan('A1', ['¿Pagarías por un cobro automático?', ...BUENAS.slice(0, 2)]);
    const { correr, filas, gemini } = preparar(espacio, [{ supuestos: [sesgado] }, { supuestos: [sesgado] }]);

    const r = await correr();

    expect(gemini.recibidas).toHaveLength(2);
    expect(gemini.recibidas[1]!.usuario).toContain('# Corrección');
    expect(gemini.recibidas[1]!.usuario).toContain('pregunta por el futuro');
    expect(filas('supuestos').filter(([, s]) => textoDe(s['Supuesto']) !== 'Viejo')).toHaveLength(0);
    expect(r.notas.some((n) => n.includes('plan descartado después de pedir una corrección'))).toBe(true);
    expect(textoDe(espacio.notion.paginas.get(persona)!.properties['Controles'])).toContain('⏳ 0 de 1 supuestos de confianza baja con plan');
  });

  it('si la corrección viene bien, crea el supuesto', async () => {
    const { espacio } = espacioBase();
    const { correr, filas } = preparar(espacio, [{ supuestos: [plan('A1', BUENAS, 'Llamado')] }, { supuestos: [plan('A1')] }]);

    const r = await correr();

    expect(r.resultado).toBe('Lista');
    expect(filas('supuestos').filter(([, s]) => textoDe(s['Supuesto']) === 'Hipótesis de A1')).toHaveLength(1);
  });

  it('no rehace ni modifica un supuesto que ya existe, aunque el PM lo haya editado', async () => {
    const { espacio, baja } = espacioBase();
    const existente = espacio.notion.sembrar(
      BASES.supuestos,
      { Supuesto: titulo('Del PM'), Atributo: { relation: [{ id: baja }] }, Estado: { status: { name: 'En validación' } } },
      ID_PM,
    );
    const { correr, gemini } = preparar(espacio, []);

    const r = await correr();

    expect(r.resultado).toBe('Lista');
    expect(gemini.recibidas).toHaveLength(0);
    expect(textoDe(espacio.notion.paginas.get(existente)!.properties['Supuesto'])).toBe('Del PM');
    expect(r.notas.some((n) => n.includes('ya tienen plan'))).toBe(true);
  });

  it('el escritor bloquea cualquier modificación de un supuesto', async () => {
    const { espacio, sobrante } = espacioBase();
    await expect(espacio.escritor.actualizar('supuestos', sobrante, { Supuesto: titulo('Otro') })).rejects.toThrow(/no modifica supuestos/);
  });

  it('sin personas en Borrador no llama al modelo', async () => {
    const espacio = new EspacioFalso({ contexto: { Nombre: titulo('Producto'), Estado: { status: { name: 'Confirmado' } } } });
    const r = await planificarValidacion({ solicitud: { id: 's', titulo: 's', etapa: 'Planificar validación', opciones: '' }, espacio });

    expect(r.resultado).toBe('Lista');
    expect(r.notas).toContain('No hay personas en Borrador: no hay nada que planificar.');
  });
});

describe('reglas de las preguntas (H8)', () => {
  it('detecta las preguntas sesgadas', () => {
    expect(sesgoDePregunta('¿No te molesta cobrar a mano?', AFIRMACION)).toMatch(/¿No…\?/);
    expect(sesgoDePregunta('¿Usarías una app para cobrar?', AFIRMACION)).toMatch(/futuro/);
    expect(sesgoDePregunta('¿Estarías dispuesta a pagar?', AFIRMACION)).toMatch(/futuro/);
    expect(sesgoDePregunta('¿Persigues a los morosos por WhatsApp todos los meses?', AFIRMACION)).toMatch(/repite/);
    expect(sesgoDePregunta('Contame cómo cobrás', AFIRMACION)).toMatch(/no es una pregunta/);
    for (const q of BUENAS) expect(sesgoDePregunta(q, AFIRMACION)).toBeNull();
  });

  it('exige método válido, perfil y al menos 3 preguntas válidas, y avisa los atributos sin plan', () => {
    const atributos = new Map([
      ['A1', { afirmacion: AFIRMACION }],
      ['A2', { afirmacion: 'Otra cosa' }],
      ['A3', { afirmacion: 'Una más' }],
    ]);
    const { validos, problemas } = validarPlanes(
      [plan('A1', [...BUENAS, '¿Qué usaste en septiembre?', '¿Con quién lo hablaste?', '¿Qué te costó más?']), { ...plan('a2', BUENAS.slice(0, 2)), perfil: '' }],
      atributos,
    );

    expect(validos.map((v) => v.ref)).toEqual(['A1']);
    expect(validos[0]!.preguntas).toHaveLength(5);
    expect(problemas.get('A2')).toEqual(['falta el perfil a contactar', 'tiene 2 pregunta(s) válida(s) y hacen falta al menos 3']);
    expect(problemas.get('A3')).toEqual(['el modelo no propuso un plan para este atributo']);
  });
});

describe('preguntas que dan algo por supuesto (H9)', () => {
  it('el pedido al modelo prohíbe dar por hecho lo que la persona no dijo', async () => {
    const { espacio } = espacioBase();
    const { correr, gemini } = preparar(espacio, [{ supuestos: [plan('A1')] }]);
    await correr();
    const pedido = `${gemini.recibidas[0]!.sistema}\n${gemini.recibidas[0]!.usuario}`;
    expect(pedido).toContain('No des por hecho algo que la persona no dijo');
  });
});

describe('preguntas que mencionan el producto (H9)', () => {
  it('rechaza las que nombran «el producto», en singular o plural', () => {
    expect(sesgoDePregunta('¿Cuánto tiempo entrenaste antes de probar el producto?', AFIRMACION)).toMatch(/menciona el producto/);
    expect(sesgoDePregunta('¿Qué PRODUCTOS usaste el mes pasado?', AFIRMACION)).toMatch(/menciona el producto/);
  });

  it('deja pasar «aplicación» y palabras que solo empiezan igual', () => {
    expect(sesgoDePregunta('¿Por qué dejaste de usar alguna aplicación de entrenamiento?', AFIRMACION)).toBeNull();
    expect(sesgoDePregunta('¿Qué tan productiva fue tu última semana de cobranza?', AFIRMACION)).toBeNull();
  });
});

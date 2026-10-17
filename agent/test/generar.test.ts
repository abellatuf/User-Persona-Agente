import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { crearGenerador, ErrorGeneracion, extraerJson, notasDeGeneracion } from '../src/llm/generar.js';
import { ErrorModelo } from '../src/llm/tipos.js';
import { ProveedorFalso, respuesta } from './apoyo/api-modelo-falsa.js';

const esquema = z.object({ suma: z.number(), texto: z.string() });
const valido = { suma: 5, texto: 'hola' };
const mensajes = { sistema: 'Reglas', usuario: 'Calculá 2 + 3.' };

function generador(principal: ProveedorFalso, respaldo?: ProveedorFalso) {
  const esperas: number[] = [];
  const generar = crearGenerador({
    principal,
    ...(respaldo ? { respaldo } : {}),
    esperar: async (ms) => {
      esperas.push(ms);
    },
  });
  return { generar, esperas };
}

async function fallaDe(promesa: Promise<unknown>): Promise<ErrorGeneracion> {
  const e = await promesa.then(
    () => undefined,
    (x: unknown) => x,
  );
  expect(e).toBeInstanceOf(ErrorGeneracion);
  return e as ErrorGeneracion;
}

const limite = (esperaMs?: number) =>
  new ErrorModelo('429', 'limite', { estadoHttp: 429, ...(esperaMs !== undefined ? { esperaMs } : {}) });

describe('generar: respuesta validada (T3.1)', () => {
  it('devuelve los datos validados, quién respondió y los tokens', async () => {
    const gemini = new ProveedorFalso('Gemini', 'gemini-x', [respuesta(valido, 'gemini-x-001')]);
    const { generar } = generador(gemini);

    const r = await generar({ mensajes, esquema });

    expect(r.datos).toEqual(valido);
    expect(r.proveedorModelo).toBe('Gemini · gemini-x-001');
    expect(r.usoRespaldo).toBe(false);
    expect(r.tokens).toEqual({ entrada: 10, salida: 5, total: 15 });
    expect(r.intentos).toEqual([{ proveedor: 'Gemini', modelo: 'gemini-x-001', resultado: 'ok', tokens: r.tokens }]);
    // El esquema viaja como JSON Schema, sin la clave $schema.
    expect(gemini.recibidas[0]?.esquemaJson).toMatchObject({ type: 'object', required: ['suma', 'texto'] });
    expect(gemini.recibidas[0]?.esquemaJson).not.toHaveProperty('$schema');
  });

  it('acepta el JSON aunque venga dentro de un bloque de código', async () => {
    const gemini = new ProveedorFalso('Gemini', 'g', [respuesta('```json\n{"suma": 5, "texto": "hola"}\n```')]);
    expect((await generador(gemini).generar({ mensajes, esquema })).datos).toEqual(valido);
  });
});

describe('generar: datos personales (RNF-06)', () => {
  it('ningún correo, teléfono ni documento llega al proveedor', async () => {
    const gemini = new ProveedorFalso('Gemini', 'g', [respuesta(valido)]);
    const { generar } = generador(gemini);

    const r = await generar({
      mensajes: { sistema: 'Reglas', usuario: 'Contacto: ana@ejemplo.com, tel +54 9 11 4567-8901, DNI 30.123.456' },
      esquema,
    });

    const enviado = gemini.recibidas[0]!.usuario;
    expect(enviado).toBe('Contacto: [CORREO], tel [TELÉFONO], DNI [DOCUMENTO]');
    expect(r.datosPersonalesOcultos).toBe(3);
  });
});

describe('generar: reintentos y respaldo ante límites de uso (T3.3)', () => {
  it('ante un 429 reintenta con espera creciente y, si sigue, responde el respaldo', async () => {
    const gemini = new ProveedorFalso('Gemini', 'g', [limite(), limite(), limite()]);
    const openrouter = new ProveedorFalso('OpenRouter', 'openrouter/free', [respuesta(valido, 'algun/modelo:free')]);
    const { generar, esperas } = generador(gemini, openrouter);

    const r = await generar({ mensajes, esquema });

    expect(gemini.recibidas).toHaveLength(3);
    expect(esperas).toEqual([2000, 4000]);
    expect(r.usoRespaldo).toBe(true);
    expect(r.proveedorModelo).toBe('OpenRouter · algun/modelo:free (respaldo)');
    expect(r.intentos.map((i) => `${i.proveedor}: ${i.resultado}`)).toEqual([
      'Gemini: error: limite',
      'Gemini: error: limite',
      'Gemini: error: limite',
      'OpenRouter: ok',
    ]);
  });

  it('si el reintento funciona, no pasa al respaldo', async () => {
    const gemini = new ProveedorFalso('Gemini', 'g', [new ErrorModelo('503', 'transitorio'), respuesta(valido)]);
    const openrouter = new ProveedorFalso('OpenRouter', 'o');
    const r = await generador(gemini, openrouter).generar({ mensajes, esquema });

    expect(r.usoRespaldo).toBe(false);
    expect(openrouter.recibidas).toHaveLength(0);
  });

  it('respeta la espera que pide el proveedor, con un tope', async () => {
    const gemini = new ProveedorFalso('Gemini', 'g', [limite(7000), limite(60_000), respuesta(valido)]);
    const { generar, esperas } = generador(gemini);

    await generar({ mensajes, esquema });

    expect(esperas).toEqual([7000, 20_000]);
  });

  it('con una clave inválida o un modelo inexistente pasa directo al respaldo, sin esperar', async () => {
    for (const tipo of ['credencial', 'modelo', 'bloqueo'] as const) {
      const gemini = new ProveedorFalso('Gemini', 'g', [new ErrorModelo(tipo, tipo)]);
      const openrouter = new ProveedorFalso('OpenRouter', 'o', [respuesta(valido)]);
      const { generar, esperas } = generador(gemini, openrouter);

      const r = await generar({ mensajes, esquema });

      expect(gemini.recibidas).toHaveLength(1);
      expect(esperas).toEqual([]);
      expect(r.usoRespaldo).toBe(true);
    }
  });

  it('si fallan los dos, informa todos los intentos y no devuelve datos', async () => {
    const gemini = new ProveedorFalso('Gemini', 'g', [new ErrorModelo('clave', 'credencial')]);
    const openrouter = new ProveedorFalso('OpenRouter', 'o', [new ErrorModelo('sin crédito', 'credencial')]);

    const e = await fallaDe(generador(gemini, openrouter).generar({ mensajes, esquema }));

    expect(e.message).toMatch(/No se escribió nada/);
    expect(e.intentos.map((i) => i.proveedor)).toEqual(['Gemini', 'OpenRouter']);
  });
});

describe('generar: formato inválido (T3.4)', () => {
  it('reintenta una vez con el problema en el prompt y acepta la corrección', async () => {
    const gemini = new ProveedorFalso('Gemini', 'g', [respuesta({ suma: 'cinco' }), respuesta(valido)]);
    const { generar } = generador(gemini);

    const r = await generar({ mensajes, esquema });

    expect(r.datos).toEqual(valido);
    expect(gemini.recibidas[0]!.usuario).toBe('Calculá 2 + 3.');
    expect(gemini.recibidas[1]!.usuario).toContain('# Corrección');
    expect(gemini.recibidas[1]!.usuario).toContain('suma');
    expect(r.intentos.map((i) => i.resultado)).toEqual(['formato inválido', 'ok']);
    // Se cuentan los tokens de los dos intentos.
    expect(r.tokens.total).toBe(30);
  });

  it('si el formato sigue mal, prueba con el respaldo', async () => {
    const gemini = new ProveedorFalso('Gemini', 'g', [respuesta('no es json'), respuesta({ suma: 5 })]);
    const openrouter = new ProveedorFalso('OpenRouter', 'o', [respuesta(valido)]);

    const r = await generador(gemini, openrouter).generar({ mensajes, esquema });

    expect(gemini.recibidas).toHaveLength(2);
    expect(r.usoRespaldo).toBe(true);
    expect(r.datos).toEqual(valido);
    // El respaldo recibe el pedido original, sin la corrección pensada para el otro modelo.
    expect(openrouter.recibidas[0]!.usuario).toBe('Calculá 2 + 3.');
  });

  it('si ningún modelo devuelve un formato válido, no devuelve nada', async () => {
    const malo = () => respuesta({ otra: 'cosa' });
    const gemini = new ProveedorFalso('Gemini', 'g', [malo(), malo()]);
    const openrouter = new ProveedorFalso('OpenRouter', 'o', [malo(), malo()]);

    const e = await fallaDe(generador(gemini, openrouter).generar({ mensajes, esquema }));

    expect(e.intentos).toHaveLength(4);
    expect(e.intentos.every((i) => i.resultado === 'formato inválido')).toBe(true);
    expect(e.tokens.total).toBe(60);
  });
});

describe('extraerJson y notas', () => {
  it('saca el JSON de un texto con algo alrededor', () => {
    expect(extraerJson('Acá va: {"a": 1} listo')).toEqual({ a: 1 });
    expect(() => extraerJson('nada')).toThrow();
  });

  it('las notas para Ejecuciones muestran cada intento y los tokens', async () => {
    const gemini = new ProveedorFalso('Gemini', 'g', [limite()]);
    const openrouter = new ProveedorFalso('OpenRouter', 'o', [respuesta(valido, 'm:free')]);
    const generar = crearGenerador({ principal: gemini, respaldo: openrouter, reintentos: 0, esperar: async () => {} });

    const notas = notasDeGeneracion(await generar({ mensajes, esquema }));

    expect(notas).toEqual([
      'Intento 1: Gemini · g → error: limite (429)',
      'Intento 2: OpenRouter · m:free → ok · tokens: 10 de entrada, 5 de salida',
      'Tokens usados en total: 10 de entrada, 5 de salida, 15 en total.',
    ]);
  });
});

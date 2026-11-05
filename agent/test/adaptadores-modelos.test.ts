import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ProveedorGemini } from '../src/llm/gemini.js';
import { ProveedorOpenRouter } from '../src/llm/openrouter.js';
import { ErrorModelo, esperaDeCabecera, type PeticionProveedor } from '../src/llm/tipos.js';
import { ApiModeloFalsa } from './apoyo/api-modelo-falsa.js';

const peticion: PeticionProveedor = {
  sistema: 'Reglas de prueba',
  usuario: 'Tarea de prueba',
  esquemaJson: { type: 'object', properties: { ok: { type: 'boolean' } } },
};

async function errorDe(promesa: Promise<unknown>): Promise<ErrorModelo> {
  const e = await promesa.then(
    () => undefined,
    (x: unknown) => x,
  );
  expect(e).toBeInstanceOf(ErrorModelo);
  return e as ErrorModelo;
}

describe('adaptador de Gemini', () => {
  const api = new ApiModeloFalsa();
  let gemini: ProveedorGemini;

  beforeAll(async () => {
    gemini = new ProveedorGemini('clave-gemini', 'gemini-de-prueba', await api.iniciar());
  });
  afterAll(() => api.detener());
  beforeEach(() => {
    api.peticiones = [];
  });

  it('manda el pedido con la clave en la cabecera y salida JSON, y devuelve texto, modelo y tokens', async () => {
    api.responder({
      estado: 200,
      cuerpo: {
        candidates: [
          {
            content: { parts: [{ text: 'pensando…', thought: true }, { text: '{"ok":' }, { text: 'true}' }] },
            finishReason: 'STOP',
          },
        ],
        usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 8, thoughtsTokenCount: 30, totalTokenCount: 158 },
        modelVersion: 'gemini-de-prueba-001',
      },
    });

    const r = await gemini.completar(peticion);

    expect(r).toEqual({ texto: '{"ok":true}', modelo: 'gemini-de-prueba-001', tokens: { entrada: 120, salida: 38, total: 158 } });
    const p = api.peticiones[0]!;
    expect(p.ruta).toBe('/v1beta/models/gemini-de-prueba:generateContent');
    expect(p.cabeceras['x-goog-api-key']).toBe('clave-gemini');
    expect(p.cuerpo).toMatchObject({
      systemInstruction: { parts: [{ text: 'Reglas de prueba' }] },
      contents: [{ role: 'user', parts: [{ text: 'Tarea de prueba' }] }],
      generationConfig: { responseMimeType: 'application/json' },
    });
  });

  it('un 429 es un límite de uso y respeta la espera que pide Gemini', async () => {
    api.responder({
      estado: 429,
      cuerpo: {
        error: {
          code: 429,
          status: 'RESOURCE_EXHAUSTED',
          message: 'Quota exceeded',
          details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '7s' }],
        },
      },
    });

    const e = await errorDe(gemini.completar(peticion));

    expect(e.tipo).toBe('limite');
    expect(e.opciones).toEqual({ estadoHttp: 429, esperaMs: 7000 });
    expect(e.message).toContain('RESOURCE_EXHAUSTED');
  });

  it('un 429 dice qué cuota se superó y su límite, aunque el mensaje de Gemini sea largo', async () => {
    api.responder({
      estado: 429,
      cuerpo: {
        error: {
          code: 429,
          status: 'RESOURCE_EXHAUSTED',
          message: `You exceeded your current quota. ${'x'.repeat(600)}`,
          details: [
            {
              '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
              violations: [
                {
                  quotaMetric: 'generativelanguage.googleapis.com/search_grounding_request_count',
                  quotaId: 'SearchGroundingRequestsPerDayPerProjectPerModel-FreeTier',
                  quotaValue: '0',
                },
                { quotaMetric: 'generativelanguage.googleapis.com/generate_content_free_tier_requests' },
              ],
            },
          ],
        },
      },
    });

    const e = await errorDe(gemini.completar(peticion));

    expect(e.tipo).toBe('limite');
    expect(e.message).toMatch(
      /^Gemini respondió 429 \(RESOURCE_EXHAUSTED\) · cuota: SearchGroundingRequestsPerDayPerProjectPerModel-FreeTier, límite 0; generativelanguage\.googleapis\.com\/generate_content_free_tier_requests: You exceeded/,
    );
    expect(e.message.length).toBeLessThanOrEqual(500);
  });

  it('clasifica clave inválida, modelo inexistente y error del servidor', async () => {
    api.responder(
      { estado: 403, cuerpo: { error: { code: 403, message: 'API key not valid' } } },
      { estado: 404, cuerpo: { error: { code: 404, message: 'model not found' } } },
      { estado: 503, cuerpo: { error: { code: 503, message: 'overloaded' } } },
    );

    expect((await errorDe(gemini.completar(peticion))).tipo).toBe('credencial');
    expect((await errorDe(gemini.completar(peticion))).tipo).toBe('modelo');
    expect((await errorDe(gemini.completar(peticion))).tipo).toBe('transitorio');
  });

  it('una respuesta cortada por seguridad o un pedido bloqueado es un bloqueo', async () => {
    api.responder(
      { estado: 200, cuerpo: { candidates: [{ finishReason: 'SAFETY' }] } },
      { estado: 200, cuerpo: { promptFeedback: { blockReason: 'PROHIBITED_CONTENT' } } },
    );

    expect((await errorDe(gemini.completar(peticion))).tipo).toBe('bloqueo');
    expect((await errorDe(gemini.completar(peticion))).tipo).toBe('bloqueo');
  });

  it('si no se puede conectar, es un error transitorio', async () => {
    const caido = new ProveedorGemini('clave', 'modelo', 'http://127.0.0.1:1');
    expect((await errorDe(caido.completar(peticion))).tipo).toBe('transitorio');
  });
});

describe('adaptador de OpenRouter', () => {
  const api = new ApiModeloFalsa();
  let openrouter: ProveedorOpenRouter;

  beforeAll(async () => {
    openrouter = new ProveedorOpenRouter('clave-openrouter', 'openrouter/free', await api.iniciar());
  });
  afterAll(() => api.detener());
  beforeEach(() => {
    api.peticiones = [];
  });

  it('manda el pedido con el esquema JSON y devuelve el modelo que respondió de verdad', async () => {
    api.responder({
      estado: 200,
      cuerpo: {
        model: 'proveedor/modelo-gratuito:free',
        choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 100, completion_tokens: 6, total_tokens: 106 },
      },
    });

    const r = await openrouter.completar(peticion);

    expect(r).toEqual({ texto: '{"ok":true}', modelo: 'proveedor/modelo-gratuito:free', tokens: { entrada: 100, salida: 6, total: 106 } });
    const p = api.peticiones[0]!;
    expect(p.ruta).toBe('/chat/completions');
    expect(p.cabeceras['authorization']).toBe('Bearer clave-openrouter');
    expect(p.cuerpo).toMatchObject({
      model: 'openrouter/free',
      messages: [
        { role: 'system', content: 'Reglas de prueba' },
        { role: 'user', content: 'Tarea de prueba' },
      ],
      response_format: { type: 'json_schema', json_schema: { schema: peticion.esquemaJson } },
    });
  });

  it('un 429 respeta Retry-After, y un 402 (sin crédito) no se trata como algo que se resuelve esperando', async () => {
    api.responder(
      { estado: 429, cuerpo: { error: { code: 429, message: 'Rate limit exceeded' } }, cabeceras: { 'retry-after': '3' } },
      { estado: 402, cuerpo: { error: { code: 402, message: 'Insufficient credits' } } },
    );

    const limite = await errorDe(openrouter.completar(peticion));
    expect(limite.tipo).toBe('limite');
    expect(limite.opciones.esperaMs).toBe(3000);
    expect((await errorDe(openrouter.completar(peticion))).tipo).toBe('credencial');
  });

  it('un error del proveedor dentro de una respuesta 200 también es un error', async () => {
    api.responder({ estado: 200, cuerpo: { choices: [{ error: { code: 502, message: 'upstream down' } }] } });

    const e = await errorDe(openrouter.completar(peticion));
    expect(e.tipo).toBe('transitorio');
    expect(e.message).toContain('upstream down');
  });
});

describe('adaptador de OpenRouter: cuerpo inesperado', () => {
  const api = new ApiModeloFalsa();
  let openrouter: ProveedorOpenRouter;

  beforeAll(async () => {
    openrouter = new ProveedorOpenRouter('clave', 'openrouter/free', await api.iniciar());
  });
  afterAll(() => api.detener());

  it('se reintenta como transitorio y registra dónde está el problema, sin copiar el contenido', async () => {
    api.responder({ estado: 200, cuerpo: { model: 'm', choices: 'texto del prompt' } });

    const e = await errorDe(openrouter.completar(peticion));

    expect(e.tipo).toBe('transitorio');
    expect(e.message).toBe('OpenRouter devolvió una respuesta con un formato inesperado (choices: invalid_type).');
    expect(e.message).not.toContain('texto del prompt');
  });
});

describe('esperaDeCabecera', () => {
  it('acepta segundos o una fecha HTTP', () => {
    expect(esperaDeCabecera('5')).toBe(5000);
    expect(esperaDeCabecera('Thu, 01 Jan 2026 00:00:10 GMT', Date.parse('2026-01-01T00:00:00Z'))).toBe(10000);
    expect(esperaDeCabecera(null)).toBeUndefined();
    expect(esperaDeCabecera('cualquier cosa')).toBeUndefined();
  });
});

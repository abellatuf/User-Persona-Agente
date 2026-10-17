import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { conFallaSimulada, probarModelos } from '../src/diagnostico/probar-modelos.js';
import { crearGenerador, crearProveedores } from '../src/llm/index.js';
import { ApiModeloFalsa, ProveedorFalso, respuesta } from './apoyo/api-modelo-falsa.js';
import { EspacioFalso } from './apoyo/espacio-falso.js';

const reloj = () => new Date('2026-10-16T18:00:00Z');
const sinEspera = async () => {};

/** Responde como lo haría un modelo: copia lo que recibió como contacto. */
function eco(proveedor: ProveedorFalso) {
  return {
    nombre: proveedor.nombre,
    modelo: proveedor.modelo,
    async completar(p: Parameters<ProveedorFalso['completar']>[0]) {
      await proveedor.completar(p);
      const contacto = p.usuario.match(/Contacto: (\S+)/)?.[1] ?? '';
      return respuesta({ suma: 5, contacto, saludo: 'Hola, equipo' }, `${proveedor.modelo}-real`);
    },
  };
}

describe('prueba de modelos (demo del H3)', () => {
  it('responde el principal, la respuesta queda validada y el correo no sale del agente', async () => {
    const espacio = new EspacioFalso();
    const gemini = new ProveedorFalso('Gemini', 'gemini-x', [respuesta('{}')]);
    const generar = crearGenerador({ principal: eco(gemini), esperar: sinEspera });

    const r = await probarModelos({ espacio, generar, fallaForzada: false, reloj });

    expect(r.ok).toBe(true);
    expect(gemini.recibidas[0]!.usuario).not.toContain('ana.prueba@ejemplo.com');
    const fila = espacio.ejecuciones[0]!;
    expect(fila.apertura.titulo).toBe('2026-10-16 15:00 · Prueba de modelos');
    expect(fila.cierre).toMatchObject({ resultado: 'Lista', proveedorModelo: 'Gemini · gemini-x-real', errores: [] });
    expect(fila.cierre?.notas).toContain('El modelo recibió el contacto como «[CORREO]»: el correo no salió del agente.');
    expect(fila.cierre?.notas.some((n) => n.startsWith('Tokens usados en total'))).toBe(true);
  });

  it('con la falla forzada no llama al principal, responde el respaldo y queda registrado', async () => {
    const espacio = new EspacioFalso();
    const gemini = new ProveedorFalso('Gemini', 'gemini-x');
    const openrouter = new ProveedorFalso('OpenRouter', 'openrouter/free', [respuesta('{}')]);
    const generar = crearGenerador({ principal: conFallaSimulada(gemini), respaldo: eco(openrouter), esperar: sinEspera });

    const r = await probarModelos({ espacio, generar, fallaForzada: true, reloj });

    expect(r.ok).toBe(true);
    expect(gemini.recibidas).toHaveLength(0);
    const cierre = espacio.ejecuciones[0]!.cierre!;
    expect(espacio.ejecuciones[0]!.apertura.titulo).toContain('falla forzada');
    expect(cierre.proveedorModelo).toBe('OpenRouter · openrouter/free-real (respaldo)');
    expect(cierre.notas.filter((n) => n.includes('Gemini · gemini-x → error: limite'))).toHaveLength(3);
    expect(cierre.notas).toContain('Respondió el modelo de respaldo.');
  });

  it('si no responde ningún modelo, la fila queda en Error con los intentos', async () => {
    const espacio = new EspacioFalso();
    const generar = crearGenerador({
      principal: conFallaSimulada(new ProveedorFalso('Gemini', 'g')),
      reintentos: 0,
      esperar: sinEspera,
    });

    const r = await probarModelos({ espacio, generar, fallaForzada: true, reloj });

    expect(r.ok).toBe(false);
    expect(espacio.ejecuciones[0]!.cierre).toMatchObject({ resultado: 'Error', proveedorModelo: 'Ninguno: no respondió ningún modelo' });
    expect(espacio.ejecuciones[0]!.cierre!.errores[0]).toMatch(/Ningún modelo/);
  });
});

describe('prueba de modelos con los adaptadores reales y APIs falsas', () => {
  const apiGemini = new ApiModeloFalsa();
  const apiOpenRouter = new ApiModeloFalsa();
  let claves: Parameters<typeof crearProveedores>[0];

  beforeAll(async () => {
    claves = {
      geminiApiKey: 'clave-g',
      openrouterApiKey: 'clave-o',
      geminiBaseUrl: await apiGemini.iniciar(),
      openrouterBaseUrl: await apiOpenRouter.iniciar(),
    };
  });
  afterAll(async () => {
    await apiGemini.detener();
    await apiOpenRouter.detener();
  });

  it('Gemini sin cuota → reintentos → responde OpenRouter, con los modelos de Configuración', async () => {
    const sinCuota = { estado: 429, cuerpo: { error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded' } } };
    apiGemini.responder(sinCuota, sinCuota, sinCuota);
    apiOpenRouter.responder({
      estado: 200,
      cuerpo: {
        model: 'algun/modelo:free',
        choices: [{ message: { content: '{"suma":5,"contacto":"[CORREO]","saludo":"Hola"}' } }],
        usage: { prompt_tokens: 50, completion_tokens: 10, total_tokens: 60 },
      },
    });
    const espacio = new EspacioFalso();
    const { principal, respaldo } = crearProveedores(claves, { modeloPrincipal: 'gemini-elegido', modeloRespaldo: '' });
    const generar = crearGenerador({ principal, respaldo, esperar: sinEspera });

    const r = await probarModelos({ espacio, generar, fallaForzada: false, reloj });

    expect(r.ok).toBe(true);
    expect(apiGemini.peticiones).toHaveLength(3);
    expect(apiGemini.peticiones[0]!.ruta).toBe('/v1beta/models/gemini-elegido:generateContent');
    // Modelo de respaldo vacío en Configuración: se usa el valor por defecto.
    expect(apiOpenRouter.peticiones[0]!.cuerpo['model']).toBe('openrouter/free');
    expect(JSON.stringify(apiGemini.peticiones[0]!.cuerpo)).not.toContain('ana.prueba@ejemplo.com');
    expect(espacio.ejecuciones[0]!.cierre!.proveedorModelo).toBe('OpenRouter · algun/modelo:free (respaldo)');
  });
});

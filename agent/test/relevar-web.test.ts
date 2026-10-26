import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ejecutarAgente } from '../src/ciclo.js';
import { BASES, FALTA_TAVILY, leerClavesModelos } from '../src/config.js';
import { crearBuscador, ErrorBusqueda, type Buscador } from '../src/llm/buscar.js';
import { crearGenerador } from '../src/llm/generar.js';
import { crearModelos } from '../src/llm/index.js';
import { ProveedorTavily, RESULTADOS_POR_CONSULTA } from '../src/llm/tavily.js';
import { ErrorModelo, type FuenteEncontrada } from '../src/llm/tipos.js';
import { crearRelevarWeb, MAX_FUENTES, TEMAS } from '../src/stages/3-relevar-web/index.js';
import { ETAPAS } from '../src/stages/registro.js';
import { ApiModeloFalsa, ProveedorFalso, respuesta } from './apoyo/api-modelo-falsa.js';
import { EspacioFalso } from './apoyo/espacio-falso.js';
import { textoDe } from './apoyo/formato.js';
import { ServidorArchivos } from './apoyo/servidor-archivos.js';

const sinEspera = async () => {};
const silencio = () => {};
const reloj = () => new Date('2026-10-26T15:00:00Z');
const etapa = crearRelevarWeb({ permitirLocal: true, reloj });

const html = (titulo: string, cuerpo: string) => ({
  tipo: 'text/html; charset=utf-8',
  cuerpo: `<html><head><title>${titulo}</title></head><body><p>${cuerpo}</p></body></html>`,
});

const FRASE_A = 'Los profesionales independientes cobran sus abonos mensuales con planillas y recordatorios manuales por mensaje.';
const FRASE_C = 'Un tercio de los clubes de barrio declara atrasos en el cobro de la cuota social durante el último año.';

/** Buscador falso: devuelve, en orden, las fuentes o el error programados para cada búsqueda. */
function buscadorFalso(pasos: Array<FuenteEncontrada[] | ErrorBusqueda>) {
  const recibidas: string[] = [];
  const buscar: Buscador = async (consulta) => {
    recibidas.push(consulta);
    const paso = pasos.shift() ?? [];
    if (paso instanceof ErrorBusqueda) throw paso;
    return { fuentes: paso, proveedorModelo: 'Tavily', intentos: [{ proveedor: 'Tavily', modelo: 'búsqueda básica', resultado: 'ok' }] };
  };
  return { buscar, recibidas };
}

/** Respuesta del modelo con una consulta por tema. */
const consultasOk = { consultas: TEMAS.map((t) => ({ tema: t.nombre, consulta: `consulta ${t.clave}` })) };
const sinCuota = () => new ErrorBusqueda('La búsqueda web no está disponible: Tavily respondió 432: plan limit', 'limite', []);
const hallazgo = (fuente: string, cita: string, tema = 'Usuarios y problemas') => ({ fuente, hallazgo: 'Aporta algo concreto.', cita, tema });

describe('etapa 3: relevar la web (H6)', () => {
  const servidor = new ServidorArchivos();

  beforeAll(async () => {
    await servidor.iniciar();
    servidor.archivos.set('/a', html('Estudio A', FRASE_A));
    servidor.archivos.set('/redir', { estado: 302, cuerpo: '', cabeceras: { location: '/c' } });
    servidor.archivos.set('/c', html('Informe C', FRASE_C));
    servidor.archivos.set('/sin-cita', html('Página sin dato', 'Texto que no tiene nada que ver con el tema que se busca acá.'));
  });
  afterAll(() => servidor.detener());

  function preparar(busquedas: Array<FuenteEncontrada[] | ErrorBusqueda>, extracciones: unknown[] = [], consultas: unknown = consultasOk) {
    const espacio = new EspacioFalso();
    const { buscar, recibidas } = buscadorFalso(busquedas);
    const gemini = new ProveedorFalso('Gemini', 'gemini-x', [consultas, ...extracciones].map((e) => respuesta(e)));
    const generar = crearGenerador({ principal: gemini, esperar: sinEspera });
    const correr = () => etapa({ solicitud: { id: 's', titulo: 's', etapa: 'Relevar la web', opciones: '' }, espacio, generar, buscar });
    const evidencia = () => espacio.notion.filasDe(BASES.evidencia).map(([, p]) => p.properties);
    return { espacio, gemini, recibidas, correr, evidencia };
  }

  const fuente = (ruta: string, titulo = '') => ({ url: servidor.url(ruta), titulo });

  it('arma una consulta por tema, verifica cada URL y guarda la evidencia pública con su cita', async () => {
    const { correr, evidencia, recibidas, gemini } = preparar(
      [[fuente('/a', 'a.com'), fuente('/no-existe', 'roto.com')], [fuente('/redir', 'c.com')], [], []],
      [{ hallazgos: [hallazgo('F1', 'cobran sus abonos mensuales con planillas'), hallazgo('F2', 'declara atrasos en el cobro de la cuota social', 'Mercado')] }],
    );

    const r = await correr();

    expect(r.resultado).toBe('Lista');
    // El buscador recibe las consultas del modelo; las URL salen del buscador.
    expect(recibidas).toEqual(TEMAS.map((t) => `consulta ${t.clave}`));
    const pedidoConsultas = gemini.recibidas[0]!;
    expect(`${pedidoConsultas.sistema}\n${pedidoConsultas.usuario}`).toContain('Escribí una consulta de búsqueda para cada uno de estos temas');
    expect(r.notas).toContain('Búsqueda «Usuarios y problemas» («consulta usuarios»): 2 fuente(s).');
    expect(r.proveedorModelo).toBe('Gemini · modelo-real / Tavily');
    const ev = evidencia();
    expect(ev).toHaveLength(2);
    expect(textoDe(ev[0]!['Título'])).toBe('Estudio A');
    expect(ev[0]!['Tipo']).toEqual({ select: { name: 'Pública' } });
    expect(ev[0]!['Fecha de consulta']).toEqual({ date: { start: '2026-10-26' } });
    expect(ev[0]!['Etapa que la creó']).toEqual({ select: { name: 'Relevar la web' } });
    expect(textoDe(ev[0]!['Extracto'])).toBe('«cobran sus abonos mensuales con planillas»\n\nAporta algo concreto.');
    expect(textoDe(ev[0]!['Clave'])).toMatch(/^publica:/);
    // Se guarda la dirección final, después de la redirección.
    expect(ev[1]!['URL']).toEqual({ url: servidor.url('/c') });
    // La URL que no responde se descarta y queda anotada.
    expect(r.notas.some((n) => n.startsWith('URL descartada (roto.com): respondió 404'))).toBe(true);
    expect(r.notas[0]).toBe('Fuentes encontradas: 3. Páginas leídas: 2. Con cita verificada: 2. Evidencias guardadas: 2.');
  });

  it('una cita que no está en la página, o una fuente inventada, no se guardan', async () => {
    const { correr, evidencia } = preparar(
      [[fuente('/a'), fuente('/sin-cita')], [], [], []],
      [{ hallazgos: [hallazgo('F2', 'la mitad de los usuarios abandona la planilla'), hallazgo('F9', 'cobran sus abonos mensuales con planillas')] }],
    );

    const r = await correr();

    expect(evidencia()).toHaveLength(0);
    expect(r.notas.some((n) => n.includes('la cita no aparece en la página'))).toBe(true);
    expect(r.notas.some((n) => n.includes('una fuente que no existe («F9»)'))).toBe(true);
  });

  it('sin búsqueda disponible (por ejemplo, sin claves), queda Incompleta y no escribe nada', async () => {
    const espacio = new EspacioFalso();

    const r = await etapa({ solicitud: { id: 's', titulo: 's', etapa: 'Relevar la web', opciones: '' }, espacio, sinModelo: 'Falta el secreto GEMINI_API_KEY.' });

    expect(r).toMatchObject({ resultado: 'Incompleta', errores: ['Falta el secreto GEMINI_API_KEY.'] });
    expect(espacio.notion.escrituras()).toEqual([]);
  });

  it('sin la clave del buscador, queda Incompleta con el motivo y no llama al modelo', async () => {
    const espacio = new EspacioFalso();
    const gemini = new ProveedorFalso('Gemini', 'gemini-x', []);

    const r = await etapa({
      solicitud: { id: 's', titulo: 's', etapa: 'Relevar la web', opciones: '' },
      espacio,
      generar: crearGenerador({ principal: gemini, esperar: sinEspera }),
      sinBusqueda: FALTA_TAVILY,
    });

    expect(r).toMatchObject({ resultado: 'Incompleta', errores: [FALTA_TAVILY] });
    expect(gemini.recibidas).toHaveLength(0);
    expect(espacio.notion.escrituras()).toEqual([]);
  });

  it('si no se pueden armar las consultas, queda Incompleta y no busca nada', async () => {
    const { correr, recibidas, evidencia } = preparar([], [{ otra: 'cosa' }], { otra: 'cosa' });

    const r = await correr();

    expect(r.resultado).toBe('Incompleta');
    expect(recibidas).toHaveLength(0);
    expect(evidencia()).toHaveLength(0);
    expect(r.errores[0]).toMatch(/^Consultas de búsqueda: Ningún modelo/);
  });

  it('un tema sin consulta válida se saltea y la etapa queda Incompleta', async () => {
    const consultas = { consultas: [{ tema: 'Usuarios y problemas', consulta: 'cobro de cuotas en clubes de barrio Argentina' }, { tema: 'Mercado', consulta: '' }] };
    const { correr, recibidas } = preparar([[], []], [], consultas);

    const r = await correr();

    expect(recibidas).toEqual(['cobro de cuotas en clubes de barrio Argentina']);
    expect(r.resultado).toBe('Incompleta');
    expect(r.notas).toContain('Búsqueda «Mercado»: el modelo no devolvió una consulta válida, se saltea.');
  });

  it('sin créditos en el buscador, corta las búsquedas, queda Incompleta y no llama al modelo para extraer (T6.4)', async () => {
    const { correr, recibidas, gemini, evidencia } = preparar([sinCuota()]);

    const r = await correr();

    expect(r.resultado).toBe('Incompleta');
    expect(recibidas).toHaveLength(1);
    // Solo la llamada que arma las consultas.
    expect(gemini.recibidas).toHaveLength(1);
    expect(evidencia()).toHaveLength(0);
    expect(r.errores[0]).toMatch(/Búsqueda «Usuarios y problemas».*432/);
    expect(r.notas[0]).toMatch(/no se guardó evidencia pública/);
    expect(r.notas).toContain('Se cortaron las búsquedas que faltaban: el problema afecta a todas.');
  });

  it('si la cuota se agota a mitad de camino, guarda lo que encontró y queda Incompleta', async () => {
    const { correr, evidencia } = preparar([[fuente('/a')], sinCuota()], [{ hallazgos: [hallazgo('F1', 'cobran sus abonos mensuales con planillas')] }]);

    const r = await correr();

    expect(r.resultado).toBe('Incompleta');
    expect(evidencia()).toHaveLength(1);
    expect(r.notas[0]).toMatch(/se guardó lo que se pudo/);
  });

  it('si el modelo de extracción falla, no escribe esas fuentes y queda Incompleta', async () => {
    const { correr, evidencia } = preparar([[fuente('/a')], [], [], []], [{ otra: 'cosa' }, { otra: 'cosa' }]);

    const r = await correr();

    expect(r.resultado).toBe('Incompleta');
    expect(evidencia()).toHaveLength(0);
    expect(r.errores[0]).toMatch(/Extracción de 1 página/);
  });

  it('una URL ya guardada se saltea sin gastar cuota (decisión D)', async () => {
    const { espacio, correr, gemini } = preparar([[fuente('/a')], [], [], []]);
    espacio.notion.sembrar(BASES.evidencia, {
      'Título': { title: [{ type: 'text', text: { content: 'Estudio A' } }] },
      Tipo: { select: { name: 'Pública' } },
      URL: { url: servidor.url('/a') },
    });

    const r = await correr();

    expect(r.resultado).toBe('Lista');
    // Solo la llamada que arma las consultas: la página ya guardada no se manda a extraer.
    expect(gemini.recibidas).toHaveLength(1);
    expect(r.notas).toContain(`Ya estaba guardada, se saltea: ${servidor.url('/a')}`);
  });

  describe('tope de fuentes', () => {
    beforeEach(() => {
      for (let i = 1; i <= 20; i++) servidor.archivos.set(`/p${i}`, html(`Página ${i}`, `${FRASE_A} Número ${i}.`));
    });

    it(`guarda como máximo ${MAX_FUENTES} por corrida`, async () => {
      const rutas = Array.from({ length: 20 }, (_, i) => fuente(`/p${i + 1}`));
      const lote = (desde: number) => ({ hallazgos: Array.from({ length: 5 }, (_, j) => hallazgo(`F${desde + j}`, 'cobran sus abonos mensuales con planillas')) });
      const { correr, evidencia } = preparar([rutas, [], [], []], [lote(1), lote(6), lote(11), lote(16)]);

      const r = await correr();

      expect(evidencia()).toHaveLength(MAX_FUENTES);
      expect(r.notas.some((n) => n.includes(`se guardaron las primeras ${MAX_FUENTES}`))).toBe(true);
    });
  });

  it('dentro del bucle, una etapa Incompleta deja la solicitud en Lista y la ejecución en Incompleta', async () => {
    const espacio = new EspacioFalso();
    espacio.agregarSolicitud({ id: 's1', etapa: 'Relevar la web' });
    const { buscar } = buscadorFalso([sinCuota()]);

    await ejecutarAgente({
      espacio,
      etapas: { ...ETAPAS, 'Relevar la web': etapa },
      modelos: () => ({ generar: crearGenerador({ principal: new ProveedorFalso('Gemini', 'g', [respuesta(consultasOk)]), esperar: sinEspera }), buscar }),
      log: silencio,
    });

    expect(espacio.estadoDe('s1')).toBe('Lista');
    expect(espacio.ejecuciones[0]?.cierre?.resultado).toBe('Incompleta');
  });
});

describe('buscador de Tavily', () => {
  const api = new ApiModeloFalsa();
  let tavily: ProveedorTavily;

  beforeAll(async () => {
    tavily = new ProveedorTavily('tvly-prueba', await api.iniciar());
  });
  afterAll(() => api.detener());
  beforeEach(() => {
    api.peticiones = [];
  });

  it('manda la consulta con la clave en la cabecera y toma las URL de los resultados', async () => {
    api.responder({
      estado: 200,
      cuerpo: {
        query: 'cobro de cuotas',
        answer: 'Un resumen que menciona https://inventada.example',
        results: [
          { url: 'https://diario.example/nota', title: ' Nota del diario ', content: 'extracto', score: 0.9 },
          { url: 'https://foro.example/hilo', content: 'otro extracto', score: 0.5 },
        ],
      },
    });

    const fuentes = await tavily.buscar('cobro de cuotas');

    expect(fuentes).toEqual([
      { url: 'https://diario.example/nota', titulo: 'Nota del diario' },
      { url: 'https://foro.example/hilo', titulo: '' },
    ]);
    const p = api.peticiones[0]!;
    expect(p.ruta).toBe('/search');
    expect(p.cabeceras['authorization']).toBe('Bearer tvly-prueba');
    expect(p.cuerpo).toEqual({ query: 'cobro de cuotas', search_depth: 'basic', max_results: RESULTADOS_POR_CONSULTA, topic: 'general' });
  });

  it('clasifica clave inválida, créditos agotados y límite de pedidos', async () => {
    api.responder(
      { estado: 401, cuerpo: { detail: { error: 'Unauthorized: missing or invalid API key.' } } },
      { estado: 432, cuerpo: { detail: { error: 'This request exceeds your plan\'s set usage limit.' } } },
      { estado: 429, cuerpo: { detail: 'Too many requests' }, cabeceras: { 'retry-after': '4' } },
    );

    const credencial = await tavily.buscar('x').catch((e: unknown) => e as ErrorModelo);
    const creditos = await tavily.buscar('x').catch((e: unknown) => e as ErrorModelo);
    const limite = await tavily.buscar('x').catch((e: unknown) => e as ErrorModelo);

    expect(credencial).toMatchObject({ tipo: 'credencial', message: 'Tavily respondió 401: Unauthorized: missing or invalid API key.' });
    expect(creditos).toMatchObject({ tipo: 'limite', message: expect.stringMatching(/^Tavily respondió 432: This request exceeds/) });
    expect(limite).toMatchObject({ tipo: 'limite', opciones: { estadoHttp: 429, esperaMs: 4000 } });
  });

  it('el buscador reintenta ante un límite de uso, oculta los datos personales y, si sigue fallando, avisa el tipo de error', async () => {
    const recibidas: string[] = [];
    let llamadas = 0;
    const proveedor = {
      nombre: 'Tavily',
      modelo: 'búsqueda básica',
      buscar: async (consulta: string) => {
        recibidas.push(consulta);
        llamadas++;
        if (llamadas === 1) throw new ErrorModelo('429', 'limite');
        return [{ url: 'https://x.example', titulo: 'x' }];
      },
    };
    const buscar = crearBuscador({ proveedor, esperar: sinEspera });

    const r = await buscar('cobros de ana@ejemplo.com');

    expect(r.fuentes).toHaveLength(1);
    expect(r.proveedorModelo).toBe('Tavily');
    expect(r.intentos.map((i) => i.resultado)).toEqual(['error: limite', 'ok']);
    expect(recibidas[0]).toBe('cobros de [CORREO]');

    const sinClave = crearBuscador({
      proveedor: { ...proveedor, buscar: async () => Promise.reject(new ErrorModelo('401', 'credencial')) },
      esperar: sinEspera,
    });
    await expect(sinClave('u')).rejects.toMatchObject({ name: 'ErrorBusqueda', tipo: 'credencial' });
  });

  it('la clave de Tavily es opcional: sin ella, hay modelo pero no búsqueda, con el motivo', () => {
    const base = { NOTION_TOKEN: 'n', GEMINI_API_KEY: 'g', OPENROUTER_API_KEY: 'o' };
    expect(leerClavesModelos({ ...base, TAVILY_API_KEY: '' })).not.toHaveProperty('tavilyApiKey');
    expect(leerClavesModelos({ ...base, TAVILY_API_KEY: 'tvly-x' })).toMatchObject({ tavilyApiKey: 'tvly-x' });

    const sin = crearModelos({ geminiApiKey: 'g', openrouterApiKey: 'o' }, {});
    expect(sin).toMatchObject({ sinBusqueda: FALTA_TAVILY });
    expect(sin).not.toHaveProperty('buscar');
    const con = crearModelos({ geminiApiKey: 'g', openrouterApiKey: 'o', tavilyApiKey: 'tvly-x' }, {});
    expect(con).toHaveProperty('buscar');
  });
});

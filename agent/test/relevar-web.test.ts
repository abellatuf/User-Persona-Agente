import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ejecutarAgente } from '../src/ciclo.js';
import { BASES } from '../src/config.js';
import { crearBuscador, ErrorBusqueda, type Buscador } from '../src/llm/buscar.js';
import { ProveedorGemini } from '../src/llm/gemini.js';
import { crearGenerador } from '../src/llm/generar.js';
import { ErrorModelo, type FuenteEncontrada, type Mensajes } from '../src/llm/tipos.js';
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
  const recibidas: Mensajes[] = [];
  const buscar: Buscador = async (mensajes) => {
    recibidas.push(mensajes);
    const paso = pasos.shift() ?? [];
    if (paso instanceof ErrorBusqueda) throw paso;
    return {
      fuentes: paso,
      proveedorModelo: 'Gemini · gemini-x',
      intentos: [{ proveedor: 'Gemini', modelo: 'gemini-x', resultado: 'ok' }],
      tokens: { entrada: 10, salida: 5, total: 15 },
    };
  };
  return { buscar, recibidas };
}

const sinCuota = () => new ErrorBusqueda('La búsqueda web no está disponible: Gemini respondió 429', 'limite', [], { entrada: 0, salida: 0, total: 0 });
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

  function preparar(busquedas: Array<FuenteEncontrada[] | ErrorBusqueda>, extracciones: unknown[] = []) {
    const espacio = new EspacioFalso();
    const { buscar, recibidas } = buscadorFalso(busquedas);
    const gemini = new ProveedorFalso('Gemini', 'gemini-x', extracciones.map((e) => respuesta(e)));
    const generar = crearGenerador({ principal: gemini, esperar: sinEspera });
    const correr = () => etapa({ solicitud: { id: 's', titulo: 's', etapa: 'Relevar la web', opciones: '' }, espacio, generar, buscar });
    const evidencia = () => espacio.notion.filasDe(BASES.evidencia).map(([, p]) => p.properties);
    return { espacio, gemini, recibidas, correr, evidencia };
  }

  const fuente = (ruta: string, titulo = '') => ({ url: servidor.url(ruta), titulo });

  it('busca por tema, verifica cada URL y guarda la evidencia pública con su cita', async () => {
    const { correr, evidencia, recibidas } = preparar(
      [[fuente('/a', 'a.com'), fuente('/no-existe', 'roto.com')], [fuente('/redir', 'c.com')], [], []],
      [{ hallazgos: [hallazgo('F1', 'cobran sus abonos mensuales con planillas'), hallazgo('F2', 'declara atrasos en el cobro de la cuota social', 'Mercado')] }],
    );

    const r = await correr();

    expect(r.resultado).toBe('Lista');
    expect(recibidas).toHaveLength(TEMAS.length);
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

  it('con la cuota agotada, corta las búsquedas, queda Incompleta y no llama al modelo para extraer (T6.4)', async () => {
    const { correr, recibidas, gemini, evidencia } = preparar([sinCuota()]);

    const r = await correr();

    expect(r.resultado).toBe('Incompleta');
    expect(recibidas).toHaveLength(1);
    expect(gemini.recibidas).toHaveLength(0);
    expect(evidencia()).toHaveLength(0);
    expect(r.errores[0]).toMatch(/Búsqueda «Usuarios y problemas».*429/);
    expect(r.notas[0]).toMatch(/no se guardó evidencia pública/);
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
    expect(gemini.recibidas).toHaveLength(0);
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
      modelos: () => ({ generar: crearGenerador({ principal: new ProveedorFalso('Gemini', 'g', []), esperar: sinEspera }), buscar }),
      log: silencio,
    });

    expect(espacio.estadoDe('s1')).toBe('Lista');
    expect(espacio.ejecuciones[0]?.cierre?.resultado).toBe('Incompleta');
  });
});

describe('búsqueda con Gemini y Google Search', () => {
  const api = new ApiModeloFalsa();
  let gemini: ProveedorGemini;

  beforeAll(async () => {
    gemini = new ProveedorGemini('clave-gemini', 'gemini-de-prueba', await api.iniciar());
  });
  afterAll(() => api.detener());
  beforeEach(() => {
    api.peticiones = [];
  });

  it('pide la herramienta de búsqueda y toma las fuentes de los metadatos, no del texto', async () => {
    api.responder({
      estado: 200,
      cuerpo: {
        candidates: [
          {
            content: { parts: [{ text: 'Resumen que menciona https://inventada.example' }] },
            finishReason: 'STOP',
            groundingMetadata: { groundingChunks: [{ web: { uri: 'https://redireccion.example/1', title: 'diario.com' } }, { retrievedContext: {} }] },
          },
        ],
        usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 20, totalTokenCount: 70 },
        modelVersion: 'gemini-de-prueba-001',
      },
    });

    const r = await gemini.buscar({ sistema: 'reglas', usuario: 'tema' });

    expect(r).toEqual({ fuentes: [{ url: 'https://redireccion.example/1', titulo: 'diario.com' }], modelo: 'gemini-de-prueba-001', tokens: { entrada: 50, salida: 20, total: 70 } });
    const cuerpo = api.peticiones[0]!.cuerpo as Record<string, unknown>;
    expect(cuerpo['tools']).toEqual([{ google_search: {} }]);
    expect(cuerpo['generationConfig']).not.toHaveProperty('responseMimeType');
  });

  it('el buscador reintenta ante un límite de uso, oculta los datos personales y, si sigue fallando, avisa el tipo de error', async () => {
    const recibidos: Mensajes[] = [];
    let llamadas = 0;
    const proveedor = {
      nombre: 'Gemini' as const,
      modelo: 'g',
      buscar: async (m: Mensajes) => {
        recibidos.push(m);
        llamadas++;
        if (llamadas === 1) throw new ErrorModelo('429', 'limite');
        return { fuentes: [{ url: 'https://x.example', titulo: 'x' }], modelo: 'g-001', tokens: { entrada: 1, salida: 1, total: 2 } };
      },
    };
    const buscar = crearBuscador({ proveedor, esperar: sinEspera });

    const r = await buscar({ sistema: 's', usuario: 'Escribile a ana@ejemplo.com' });

    expect(r.fuentes).toHaveLength(1);
    expect(r.intentos.map((i) => i.resultado)).toEqual(['error: limite', 'ok']);
    expect(recibidos[0]!.usuario).toBe('Escribile a [CORREO]');

    const sinClave = crearBuscador({
      proveedor: { ...proveedor, buscar: async () => Promise.reject(new ErrorModelo('403', 'credencial')) },
      esperar: sinEspera,
    });
    await expect(sinClave({ sistema: 's', usuario: 'u' })).rejects.toMatchObject({ name: 'ErrorBusqueda', tipo: 'credencial' });
  });
});

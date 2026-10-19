import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ejecutarAgente } from '../src/ciclo.js';
import { BASES } from '../src/config.js';
import { crearGenerador } from '../src/llm/generar.js';
import { crearModelos, problemasDeModelos } from '../src/llm/index.js';
import { crearArmarContexto } from '../src/stages/1-armar-contexto/index.js';
import { normalizarParaCita, verificarCampo } from '../src/stages/1-armar-contexto/verificar.js';
import { ETAPAS } from '../src/stages/registro.js';
import { ProveedorFalso, respuesta } from './apoyo/api-modelo-falsa.js';
import { EspacioFalso } from './apoyo/espacio-falso.js';
import { textoDe } from './apoyo/formato.js';
import { ServidorArchivos } from './apoyo/servidor-archivos.js';

const SPEC = [
  '# Cobra Fácil',
  '',
  'Cobra Fácil ayuda a profesionales independientes a **cobrar abonos mensuales** sin perseguir a sus clientes.',
  '',
  'Nuestros usuarios son profesionales independientes y pequeños estudios en Argentina.',
  '',
  'Contacto: ana.prueba@ejemplo.com',
].join('\n');

const campo = (valor: string, fuente: string, cita: string) => ({ valor, fuente, cita });
const noEncontrado = campo('No encontrado', 'No encontrado', '');

/** Respuesta del modelo: algunos campos bien citados, uno con cita inventada y otro con fuente inventada. */
const RESPUESTA = {
  nombre: campo('Cobra Fácil', 'spec.md', 'Cobra Fácil ayuda a profesionales independientes'),
  idioma: 'español',
  campos: {
    problema: campo('Cobrar abonos sin perseguir a los clientes.', 'spec.md', 'cobrar abonos mensuales sin perseguir a sus clientes'),
    propuestaDeValor: noEncontrado,
    usuarios: campo('Profesionales independientes y estudios chicos.', 'SPEC.md', 'Nuestros usuarios son profesionales independientes y pequeños estudios'),
    mercado: campo('Argentina.', 'spec.md', 'pequeños estudios en Argentina'),
    modeloDeNegocio: campo('Suscripción mensual fija.', 'spec.md', 'cobramos una suscripción mensual fija a cada cliente'),
    competidores: campo('Las billeteras virtuales.', 'internet', 'compite con las billeteras virtuales del mercado'),
  },
};

const silencio = () => {};
const sinEspera = async () => {};
const etapa = crearArmarContexto({ permitirLocal: true });

const texto = (valor: string) => ({ rich_text: [{ type: 'text', text: { content: valor } }] });

describe('etapa 1: armar contexto (H4)', () => {
  const servidor = new ServidorArchivos();

  beforeAll(async () => {
    await servidor.iniciar();
    servidor.archivos.set('/spec.md', { tipo: 'text/markdown', cuerpo: SPEC });
  });
  afterAll(() => servidor.detener());

  const documentos = () => ({
    'Documentos fuente': { files: [{ name: 'spec.md', type: 'file', file: { url: servidor.url('/spec.md') } }] },
  });

  function preparar(extra: Record<string, Record<string, unknown>> = {}, pasos = [respuesta(RESPUESTA, 'gemini-x-001')]) {
    const espacio = new EspacioFalso({
      contexto: { Nombre: { title: [] }, Estado: { status: { name: 'Por confirmar' } }, ...documentos(), ...extra },
    });
    const gemini = new ProveedorFalso('Gemini', 'gemini-x', pasos);
    const generar = crearGenerador({ principal: gemini, esperar: sinEspera });
    const correr = () => etapa({ solicitud: { id: 's', titulo: 's', etapa: 'Armar contexto', opciones: '' }, espacio, generar });
    const fila = () => espacio.notion.paginas.get(espacio.contextoId!)!.properties;
    return { espacio, gemini, correr, fila };
  }

  it('completa los campos con su fuente y cita, y deja el contexto Por confirmar', async () => {
    const { correr, fila } = preparar();

    const r = await correr();

    expect(r.resultado).toBe('Lista');
    expect(r.proveedorModelo).toBe('Gemini · gemini-x-001');
    const f = fila();
    expect(f['Estado']).toEqual({ status: { name: 'Por confirmar' } });
    expect(textoDe(f['Nombre'])).toBe('Cobra Fácil');
    expect(textoDe(f['Idioma'])).toBe('español');
    expect(textoDe(f['Problema'])).toBe('Cobrar abonos sin perseguir a los clientes.');
    // La cita se verificó aunque en la fuente esté con formato Markdown.
    expect(textoDe(f['Problema · fuente'])).toBe('spec.md · «cobrar abonos mensuales sin perseguir a sus clientes»');
    // El nombre de la fuente se compara sin distinguir mayúsculas.
    expect(textoDe(f['Usuarios · fuente'])).toMatch(/^spec\.md · /);
    expect(textoDe(f['Mercado'])).toBe('Argentina.');
    expect(r.notas).toContain('Campos encontrados y verificados: 3 de 6.');
  });

  it('un campo que el modelo no encontró queda en «No encontrado»', async () => {
    const { correr, fila } = preparar();
    await correr();
    expect(textoDe(fila()['Propuesta de valor'])).toBe('No encontrado');
    expect(textoDe(fila()['Propuesta de valor · fuente'])).toBe('No encontrado');
  });

  it('una cita que no aparece en la fuente, o una fuente inventada, no se aceptan', async () => {
    const { correr, fila } = preparar();

    const r = await correr();

    expect(textoDe(fila()['Modelo de negocio'])).toBe('No encontrado');
    expect(textoDe(fila()['Competidores'])).toBe('No encontrado');
    expect(r.notas.find((n) => n.startsWith('Modelo de negocio:'))).toMatch(/la cita no aparece en «spec\.md»/);
    expect(r.notas.find((n) => n.startsWith('Competidores:'))).toMatch(/fuente que no existe \(«internet»\)/);
  });

  it('el correo de la fuente no llega al modelo', async () => {
    const { correr, gemini } = preparar();
    await correr();
    const enviado = gemini.recibidas[0]!.usuario;
    expect(enviado).not.toContain('ana.prueba@ejemplo.com');
    expect(enviado).toContain('Contacto: [CORREO]');
    expect(enviado).toContain('<datos fuente="spec.md">');
  });

  it('no pisa un campo que ya tiene valor: deja la propuesta en las notas', async () => {
    const { correr, fila } = preparar({ Problema: texto('Lo escribió el PM'), Mercado: texto('No encontrado'), Nombre: { title: [{ type: 'text', text: { content: 'Mi producto' } }] } });

    const r = await correr();

    expect(textoDe(fila()['Problema'])).toBe('Lo escribió el PM');
    expect(fila()['Problema · fuente']).toBeUndefined();
    expect(r.notas.find((n) => n.startsWith('Problema:'))).toMatch(/no se pisó.*Propuesta del agente: «Cobrar abonos/);
    // «No encontrado» sí se completa, y el título que puso el PM se respeta.
    expect(textoDe(fila()['Mercado'])).toBe('Argentina.');
    expect(textoDe(fila()['Nombre'])).toBe('Mi producto');
  });

  it('un contexto Confirmado no se toca y no se llama al modelo', async () => {
    const { espacio, correr, gemini } = preparar({ Estado: { status: { name: 'Confirmado' } } });

    const r = await correr();

    expect(r.resultado).toBe('Error');
    expect(r.errores[0]).toMatch(/ya está Confirmado.*«Por confirmar»/);
    expect(gemini.recibidas).toHaveLength(0);
    expect(espacio.notion.escrituras()).toEqual([]);
  });

  it('sin fuentes toma el contexto cargado a mano, sin llamar al modelo (HU-03b)', async () => {
    const espacio = new EspacioFalso({
      contexto: { Nombre: { title: [] }, Problema: texto('Cobrar sin perseguir'), Mercado: texto('') },
    });

    const r = await etapa({ solicitud: { id: 's', titulo: 's', etapa: 'Armar contexto', opciones: '' }, espacio });

    expect(r).toMatchObject({ resultado: 'Lista', proveedorModelo: 'Ninguno' });
    const f = espacio.notion.paginas.get(espacio.contextoId!)!.properties;
    expect(f['Estado']).toEqual({ status: { name: 'Por confirmar' } });
    expect(textoDe(f['Problema'])).toBe('Cobrar sin perseguir');
    expect(textoDe(f['Problema · fuente'])).toBe('Cargado por el PM');
    expect(textoDe(f['Mercado'])).toBe('No encontrado');
    expect(textoDe(f['Mercado · fuente'])).toBe('No encontrado');
  });

  it('sin ninguna fila de contexto, o con más de una, termina en Error', async () => {
    const vacio = new EspacioFalso({ contexto: null });
    const r1 = await etapa({ solicitud: { id: 's', titulo: 's', etapa: 'Armar contexto', opciones: '' }, espacio: vacio });
    expect(r1.errores[0]).toMatch(/no tiene ninguna fila/);

    const doble = new EspacioFalso();
    doble.notion.sembrar(BASES.contexto, { Nombre: { title: [] } });
    const r2 = await etapa({ solicitud: { id: 's', titulo: 's', etapa: 'Armar contexto', opciones: '' }, espacio: doble });
    expect(r2.errores[0]).toMatch(/tiene 2 filas/);
  });

  it('si no se puede leer ninguna fuente, termina en Error con el motivo', async () => {
    const { correr, gemini } = preparar({
      'Documentos fuente': { files: [{ name: 'otro.md', type: 'file', file: { url: servidor.url('/no-existe.md') } }] },
    });

    const r = await correr();

    expect(r.resultado).toBe('Error');
    expect(r.errores[0]).toMatch(/No se pudo leer ninguna/);
    expect(r.notas[0]).toMatch(/Fuente salteada: «otro\.md»: respondió 404/);
    expect(gemini.recibidas).toHaveLength(0);
  });

  it('sin modelo disponible, explica por qué', async () => {
    const espacio = new EspacioFalso({ contexto: { Estado: { status: { name: 'Por confirmar' } }, ...documentos() } });

    const r = await etapa({
      solicitud: { id: 's', titulo: 's', etapa: 'Armar contexto', opciones: '' },
      espacio,
      sinModelo: 'Falta el secreto GEMINI_API_KEY.',
    });

    expect(r).toMatchObject({ resultado: 'Error', errores: ['Falta el secreto GEMINI_API_KEY.'] });
  });

  it('si el modelo no devuelve un formato válido, no escribe nada', async () => {
    const { espacio, correr } = preparar({}, [respuesta({ otra: 'cosa' }), respuesta({ otra: 'cosa' })]);

    const r = await correr();

    expect(r.resultado).toBe('Error');
    expect(r.errores[0]).toMatch(/No se escribió nada/);
    expect(espacio.notion.escrituras()).toEqual([]);
  });

  it('dentro del bucle, la etapa recibe el modelo armado con la Configuración', async () => {
    const espacio = new EspacioFalso({ contexto: { Estado: { status: { name: 'Por confirmar' } }, ...documentos() } });
    espacio.agregarSolicitud({ id: 's1', etapa: 'Armar contexto' });
    const gemini = new ProveedorFalso('Gemini', 'gemini-x', [respuesta(RESPUESTA)]);

    await ejecutarAgente({
      espacio,
      etapas: { ...ETAPAS, 'Armar contexto': etapa },
      modelos: () => ({ generar: crearGenerador({ principal: gemini, esperar: sinEspera }) }),
      log: silencio,
    });

    expect(espacio.estadoDe('s1')).toBe('Lista');
    expect(espacio.ejecuciones[0]?.cierre?.proveedorModelo).toBe('Gemini · modelo-real');
  });
});

describe('bloqueo de las etapas 2 a 5 sin contexto confirmado (T4.4)', () => {
  it('pedir Repreguntar con el contexto Por confirmar termina en Error con el motivo', async () => {
    const espacio = new EspacioFalso({ contexto: { Estado: { status: { name: 'Por confirmar' } } } });
    espacio.agregarSolicitud({ id: 's1', etapa: 'Repreguntar' });

    await ejecutarAgente({ espacio, etapas: ETAPAS, log: silencio });

    expect(espacio.estadoDe('s1')).toBe('Error');
    expect(espacio.ejecuciones[0]?.cierre?.errores[0]).toMatch(/no está Confirmado.*antes de pedir «Repreguntar»/);
  });

  it('con el contexto Confirmado, la etapa sigue', async () => {
    const espacio = new EspacioFalso();
    espacio.agregarSolicitud({ id: 's1', etapa: 'Relevar la web' });

    await ejecutarAgente({ espacio, etapas: ETAPAS, log: silencio });

    expect(espacio.estadoDe('s1')).toBe('Lista');
  });
});

describe('verificación de citas y modelos', () => {
  const fuentes = [{ nombre: 'a.md', texto: '¿Quién paga? Los **clientes** pagan a fin de mes.', recortada: false }];

  it('normaliza acentos, signos y formato', () => {
    expect(normalizarParaCita('¿Quién  **paga**?')).toBe('quien paga');
  });

  it('pide una cita de al menos 4 palabras', () => {
    expect(verificarCampo({ valor: 'x', fuente: 'a.md', cita: 'clientes pagan' }, fuentes)).toMatchObject({ encontrado: false });
    expect(verificarCampo({ valor: 'x', fuente: 'a.md', cita: 'Los clientes pagan a fin' }, fuentes)).toMatchObject({ encontrado: true });
  });

  it('el texto de relleno de la plantilla no se usa como modelo (lección del H3)', () => {
    expect(problemasDeModelos({ modeloPrincipal: 'gemini-3.6-flash', modeloRespaldo: 'Por definir en H3 (OpenRouter, modelo gratuito)' })).toHaveLength(1);
    expect(problemasDeModelos({ modeloPrincipal: '', modeloRespaldo: 'openrouter/free' })).toEqual([]);
    const m = crearModelos({ geminiApiKey: 'g', openrouterApiKey: 'o' }, { modeloPrincipal: 'Por definir', modeloRespaldo: '' });
    expect(m).toEqual({ sinModelo: expect.stringMatching(/«Modelo principal» dice «Por definir»/) });
  });

  it('sin claves, el motivo llega a la etapa', () => {
    expect(crearModelos('Falta el secreto GEMINI_API_KEY.', {})).toEqual({ sinModelo: 'Falta el secreto GEMINI_API_KEY.' });
  });
});

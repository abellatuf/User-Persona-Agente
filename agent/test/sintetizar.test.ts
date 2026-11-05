import { describe, expect, it } from 'vitest';
import { ejecutarAgente } from '../src/ciclo.js';
import { BASES } from '../src/config.js';
import { claves } from '../src/guards/claves.js';
import { crearGenerador } from '../src/llm/generar.js';
import type { FilaEvidencia } from '../src/notion/espacio.js';
import { MARCA_RESPUESTA } from '../src/stages/2-repreguntar/cuerpo.js';
import { OPCION_AVANZAR_SIN_INCOMPLETAS } from '../src/stages/2-repreguntar/reglas.js';
import { sintetizarEtapa } from '../src/stages/4-sintetizar/index.js';
import { FUENTE_CONTEXTO, MAX_ATRIBUTOS, MAX_PERSONAS, tipoDe } from '../src/stages/4-sintetizar/reglas.js';
import { ETAPAS } from '../src/stages/registro.js';
import { ProveedorFalso, respuesta } from './apoyo/api-modelo-falsa.js';
import { EspacioFalso } from './apoyo/espacio-falso.js';
import { textoDe } from './apoyo/formato.js';
import { ID_PM } from './apoyo/llamador-falso.js';

const sinEspera = async () => {};
const silencio = () => {};
const texto = (valor: string) => ({ rich_text: [{ type: 'text', text: { content: valor } }] });
const titulo = (valor: string) => ({ title: [{ type: 'text', text: { content: valor } }] });

function sembrarEntrevista(espacio: EspacioFalso, nombre: string, rol: string, estado = 'Completa') {
  return espacio.notion.sembrar(
    BASES.entrevistas,
    {
      Entrevista: titulo(`${nombre} (${rol})`),
      'Nombre del miembro': texto(nombre),
      'Rol del miembro': { select: { name: rol } },
      Estado: { status: { name: estado } },
    },
    ID_PM,
  );
}

function sembrarEvidencia(espacio: EspacioFalso, props: { titulo: string; extracto: string; tipo?: string; entrevista?: string; metodo?: string }) {
  return espacio.notion.sembrar(BASES.evidencia, {
    'Título': titulo(props.titulo),
    Extracto: texto(props.extracto),
    ...(props.tipo ? { Tipo: { select: { name: props.tipo } } } : {}),
    ...(props.entrevista ? { Entrevista: { relation: [{ id: props.entrevista }] } } : {}),
    ...(props.metodo ? { 'Método de investigación': { select: { name: props.metodo } } } : {}),
  });
}

/**
 * Espacio con 2 miembros Completos y 4 evidencias, en este orden:
 * E1 Ana (PM), E2 Beto (Ingeniería), E3 pública, E4 Ana (PM).
 */
function espacioBase(camposDelContexto: Record<string, string> = {}) {
  const espacio = new EspacioFalso({
    contexto: {
      Nombre: titulo('Producto'),
      Estado: { status: { name: 'Confirmado' } },
      ...Object.fromEntries(Object.entries(camposDelContexto).map(([campo, valor]) => [campo, texto(valor)])),
    },
  });
  const ana = sembrarEntrevista(espacio, 'Ana', 'PM');
  const beto = sembrarEntrevista(espacio, 'Beto', 'Ingeniería');
  sembrarEvidencia(espacio, { titulo: 'P10 · Ana (PM)', extracto: 'Quien decide es la comisión.', tipo: 'Supuesto del equipo', entrevista: ana });
  sembrarEvidencia(espacio, { titulo: 'P10 · Beto (Ingeniería)', extracto: 'Decide, usa y paga la misma persona.', tipo: 'Supuesto del equipo', entrevista: beto });
  sembrarEvidencia(espacio, { titulo: 'Talo', extracto: 'La tarjeta recurrente falla entre 10 y 15 % por mes.', tipo: 'Pública' });
  sembrarEvidencia(espacio, { titulo: 'P05 · Ana (PM)', extracto: 'Le cuesta perseguir a los morosos.', tipo: 'Supuesto del equipo', entrevista: ana });
  return { espacio, ana, beto };
}

const segmentos = (...s: Array<{ nombre: string; personaExistente?: string }>) => ({
  segmentos: s.map((x) => ({ nombre: x.nombre, porQueDistinto: `Distinto: ${x.nombre}.`, evidencias: ['E1'], personaExistente: x.personaExistente ?? '' })),
  informacionQueFalta: 'Datos de uso real.',
});
const atributo = (afirmacion: string, evidencias: string[], extra: Partial<{ categoria: string; posturas: Array<{ postura: string; evidencias: string[]; campoDelContexto?: string }>; atributoExistente: string }> = {}) => ({
  afirmacion,
  categoria: extra.categoria ?? 'Problema',
  evidencias,
  posturas: extra.posturas ?? [],
  atributoExistente: extra.atributoExistente ?? '',
});
const persona = (atributos: ReturnType<typeof atributo>[], cambios = '') => ({ atributos, informacionQueFalta: 'Falta hablar con pagadores.', cambiosRespectoDeLaAnterior: cambios });

function preparar(espacio: EspacioFalso, pasos: unknown[], opciones = '') {
  const gemini = new ProveedorFalso('Gemini', 'gemini-x', pasos.map((x) => respuesta(x)));
  const generar = crearGenerador({ principal: gemini, esperar: sinEspera });
  const correr = () => sintetizarEtapa({ solicitud: { id: 's', titulo: 's', etapa: 'Sintetizar', opciones }, espacio, generar });
  const filas = (base: keyof typeof BASES) => espacio.notion.filasDe(BASES[base]).map(([id, pagina]) => [id, pagina.properties] as const);
  return { gemini, correr, filas };
}

describe('etapa 4: sintetizar (H7)', () => {
  it('crea personas en Borrador con atributos trazables, confianza del código, divergencias con autor, resumen y controles', async () => {
    const { espacio } = espacioBase();
    const { correr, filas, gemini } = preparar(espacio, [
      segmentos({ nombre: 'Organizaciones chicas' }),
      persona([
        atributo('Quién decide, usa y paga', [], {
          categoria: 'Contexto',
          posturas: [
            { postura: 'Decide la comisión', evidencias: ['E1'] },
            { postura: 'Es la misma persona', evidencias: ['E2'] },
          ],
        }),
        atributo('Pierde plata por cobros que fallan', ['E3', 'E4']),
        atributo('Usa una planilla', ['E99']),
        atributo('Algo decorativo', ['E4'], { categoria: 'Hobby' }),
      ]),
    ]);

    const r = await correr();

    expect(r.resultado).toBe('Lista');
    const [personaFila] = filas('personas');
    const [idPersona, props] = personaFila!;
    expect(props['Estado']).toEqual({ status: { name: 'Borrador' } });
    expect(textoDe(props['Nombre'])).toBe('Organizaciones chicas');
    expect(props['Versión']).toEqual({ number: 1 });
    expect(textoDe(props['Clave'])).toBe(claves.persona('Organizaciones chicas', 1));
    expect(textoDe(props['Controles'])).toContain('✅ 2 de 2 atributos con evidencia (100 %)');
    const resumen = textoDe(props['Resumen']);
    expect(resumen).toContain('Fuentes usadas: 3 evidencias del equipo (de 2 entrevistas), 1 públicas y 0 de investigación propia.');
    expect(resumen).toContain('Atributos: 2 (Alta 0 · Media 1 · Baja 1).');
    expect(resumen).toContain('Divergencias: 1 — «Quién decide, usa y paga».');
    expect(resumen).toContain('Falta: Falta hablar con pagadores.');
    expect(resumen).toContain('Todavía no hay investigación propia');

    const atributos = filas('atributos').map(([, a]) => a);
    expect(atributos).toHaveLength(2);
    const [divergente, otro] = atributos;
    expect(divergente!['Divergencia']).toEqual({ checkbox: true });
    // El autor y el rol los pone el código, a partir de la entrevista vinculada.
    expect(textoDe(divergente!['Posturas'])).toBe('• Decide la comisión — Ana (PM)\n• Es la misma persona — Beto (Ingeniería)');
    expect(divergente!['Persona']).toEqual({ relation: [{ id: idPersona }] });
    // Con divergencia, la confianza queda en Media como máximo; aquí son dos supuestos del equipo: Baja.
    expect(divergente!['Confianza']).toEqual({ select: { name: 'Baja' } });
    // Una pública que coincide con un supuesto del equipo da Media (regla de la Fase 3).
    expect(otro!['Confianza']).toEqual({ select: { name: 'Media' } });
    expect((otro!['Evidencias'] as { relation: unknown[] }).relation).toHaveLength(2);

    expect(r.notas.some((n) => n.includes('se descartó la referencia «E99»'))).toBe(true);
    expect(r.notas.some((n) => n.includes('no cita ninguna evidencia válida'))).toBe(true);
    expect(r.notas.some((n) => n.includes('la categoría «Hobby»'))).toBe(true);
    // El modelo recibe la evidencia con su identificador y su autor.
    expect(gemini.recibidas[0]!.usuario).toContain('E2 · Supuesto del equipo · Beto (Ingeniería)');
    expect(espacio.contadores().bloqueos).toBe(0);
  });

  it('una misma fuente en dos posturas no es divergencia; el equipo contra el contexto, sí', async () => {
    const { espacio } = espacioBase({ Competidores: 'Hay otras aplicaciones, pero no podemos nombrar competidores directos.' });
    const { correr, filas } = preparar(espacio, [
      segmentos({ nombre: 'Emisores' }),
      persona([
        atributo('Cómo cobran hoy', [], {
          posturas: [
            { postura: 'Con planilla', evidencias: ['E1'] },
            { postura: 'Con recordatorios', evidencias: ['E4'] },
          ],
        }),
        atributo('Si hay competidores directos', [], {
          categoria: 'Contexto',
          posturas: [
            { postura: 'No hay competidores directos', evidencias: [], campoDelContexto: 'Competidores' },
            { postura: 'Hay alternativas que cobran recurrente', evidencias: ['E3'] },
          ],
        }),
      ]),
    ]);

    const r = await correr();

    const [mismoMiembro, conContexto] = filas('atributos').map(([, a]) => a);
    expect(mismoMiembro!['Divergencia']).toEqual({ checkbox: false });
    expect(r.notas.some((n) => n.includes('una misma fuente aparece en más de una postura'))).toBe(true);
    expect(conContexto!['Divergencia']).toEqual({ checkbox: true });
    expect(textoDe(conContexto!['Posturas'])).toContain(`Campo Competidores: «Hay otras aplicaciones, pero no podemos nombrar competidores directos.» — ${FUENTE_CONTEXTO}`);
    expect(textoDe(conContexto!['Posturas'])).not.toContain('No hay competidores directos');
    expect(textoDe(conContexto!['Posturas'])).toContain('Hay alternativas que cobran recurrente — Pública: Talo');
  });

  it('pide contrastar cómo lo resuelve hoy con Competidores y no citar evidencia pública ajena (ajuste del H7)', async () => {
    const espacio = new EspacioFalso({
      contexto: {
        Nombre: titulo('Producto'),
        Estado: { status: { name: 'Confirmado' } },
        Competidores: texto('No podemos nombrar competidores directos.'),
      },
    });
    const ana = sembrarEntrevista(espacio, 'Ana', 'PM');
    sembrarEvidencia(espacio, { titulo: 'P04 · Ana (PM)', extracto: 'Cobra con una planilla.', tipo: 'Supuesto del equipo', entrevista: ana });
    const { correr, gemini } = preparar(espacio, [segmentos({ nombre: 'Emisores' }), persona([atributo('Algo', ['E1'])])]);

    await correr();

    const enviado = gemini.recibidas[1]!.usuario;
    expect(enviado).toContain('Competidores: No podemos nombrar competidores directos.');
    expect(enviado).toContain('incluí un atributo de categoría Comportamiento sobre cómo resuelve hoy el problema');
    expect(enviado).toContain('alternativas que ponen en duda lo que dice ese campo');
    expect(enviado).toContain('Si el campo dice "No encontrado", no hay desacuerdo.');
    expect(enviado).toContain('Citá evidencia pública solo si trata sobre los usuarios, el problema o el mercado del contexto.');
  });

  it('el contexto contra varias evidencias públicas es divergencia, y solo con públicas la confianza queda Baja', async () => {
    const { espacio } = espacioBase({ Competidores: 'No podemos nombrar competidores directos.' });
    sembrarEvidencia(espacio, { titulo: 'Qobra', extracto: 'Orquesta el cobro de cuotas.', tipo: 'Pública' });
    const { correr, filas } = preparar(espacio, [
      segmentos({ nombre: 'Emisores' }),
      persona([
        atributo('Cómo resuelve hoy el cobro', [], {
          categoria: 'Comportamiento',
          posturas: [
            { postura: 'No existen competidores', evidencias: [], campoDelContexto: 'Competidores' },
            { postura: 'Hay servicios que ya lo resuelven', evidencias: ['E3', 'E5'] },
          ],
        }),
      ]),
    ]);

    await correr();

    const [a] = filas('atributos').map(([, x]) => x);
    expect(a!['Categoría']).toEqual({ select: { name: 'Comportamiento' } });
    expect(a!['Divergencia']).toEqual({ checkbox: true });
    expect(textoDe(a!['Posturas'])).toBe(`• Campo Competidores: «No podemos nombrar competidores directos.» — ${FUENTE_CONTEXTO}\n• Hay servicios que ya lo resuelven — Pública: Talo; Pública: Qobra`);
    expect((a!['Evidencias'] as { relation: unknown[] }).relation).toHaveLength(2);
    expect(a!['Confianza']).toEqual({ select: { name: 'Baja' } });
  });

  it('una postura con un campo que no existe o está vacío no cuenta como contexto; con evidencia, conserva su texto y suma el del campo', async () => {
    const { espacio } = espacioBase({ 'Propuesta de valor': 'Conciliación manual.', Competidores: 'No encontrado' });
    const { correr, filas } = preparar(espacio, [
      segmentos({ nombre: 'Emisores' }),
      persona([
        atributo('Sin campo válido', [], {
          posturas: [
            { postura: 'Inventado', evidencias: [], campoDelContexto: 'Competidores' },
            { postura: 'Con planilla', evidencias: ['E1'] },
          ],
        }),
        atributo('Quién verifica', [], {
          posturas: [
            { postura: 'Verifica el emisor', evidencias: ['E1'], campoDelContexto: 'propuesta de valor' },
            { postura: 'Lo automatiza', evidencias: ['E2'] },
          ],
        }),
      ]),
    ]);

    const r = await correr();

    const [sinCampo, conCampo] = filas('atributos').map(([, a]) => a);
    expect(sinCampo!['Divergencia']).toEqual({ checkbox: false });
    expect(r.notas.some((n) => n.includes('se descartó la fuente de contexto «Competidores»'))).toBe(true);
    expect(textoDe(conCampo!['Posturas'])).toBe(`• Verifica el emisor · Campo Propuesta de valor: «Conciliación manual.» — Ana (PM); ${FUENTE_CONTEXTO}\n• Lo automatiza — Beto (Ingeniería)`);
  });

  it('dos investigaciones propias dan confianza Alta; una cargada con el formulario sin «Tipo» también cuenta', async () => {
    const { espacio } = espacioBase();
    sembrarEvidencia(espacio, { titulo: 'Encuesta a 30 clubes', extracto: 'El 40 % cobra por transferencia.', tipo: 'Investigación propia' });
    sembrarEvidencia(espacio, { titulo: 'Entrevistas a tesoreros', extracto: 'Persiguen a los morosos por WhatsApp.', metodo: 'Entrevista' });
    const { correr, filas } = preparar(espacio, [segmentos({ nombre: 'Clubes' }), persona([atributo('Cobra por transferencia y persigue morosos', ['E5', 'E6'])])]);

    await correr();

    const [a] = filas('atributos').map(([, x]) => x);
    expect(a!['Confianza']).toEqual({ select: { name: 'Alta' } });
    const sinTipo: FilaEvidencia = { id: 'x', titulo: 't', tipo: null, extracto: 'e', entrevistas: [], url: null, etapa: 'Formulario de investigación', metodo: null, muestra: '' };
    expect(tipoDe(sinTipo)).toBe('Investigación propia');
  });

  it(`respeta los topes: hasta ${MAX_PERSONAS} personas y ${MAX_ATRIBUTOS} atributos por persona`, async () => {
    const { espacio } = espacioBase();
    const muchos = Array.from({ length: MAX_ATRIBUTOS + 2 }, (_, i) => atributo(`Atributo ${i + 1}`, ['E1']));
    const seis = Array.from({ length: MAX_PERSONAS + 1 }, (_, i) => ({ nombre: `Segmento ${i + 1}` }));
    const { correr, filas } = preparar(espacio, [segmentos(...seis), persona(muchos), ...Array.from({ length: MAX_PERSONAS - 1 }, () => persona([atributo('Uno', ['E2'])]))]);

    const r = await correr();

    expect(filas('personas')).toHaveLength(MAX_PERSONAS);
    expect(filas('atributos')).toHaveLength(MAX_ATRIBUTOS + MAX_PERSONAS - 1);
    expect(r.notas.some((n) => n.includes('tope por síntesis'))).toBe(true);
    expect(r.notas.some((n) => n.includes('tope por persona'))).toBe(true);
  });

  it('con una entrevista incompleta no sintetiza, salvo que el PM pida avanzar sin ella', async () => {
    const { espacio } = espacioBase();
    const caro = sembrarEntrevista(espacio, 'Caro', 'Negocio', 'Repreguntas pendientes');
    sembrarEvidencia(espacio, { titulo: 'P01 · Caro (Negocio)', extracto: 'Hay dos tipos de emisor.', tipo: 'Supuesto del equipo', entrevista: caro });

    const sinOpcion = preparar(espacio, []);
    const r1 = await sinOpcion.correr();
    expect(r1.resultado).toBe('Error');
    expect(sinOpcion.gemini.recibidas).toHaveLength(0);

    const conOpcion = preparar(espacio, [segmentos({ nombre: 'Emisores' }), persona([atributo('Algo', ['E1'])])], OPCION_AVANZAR_SIN_INCOMPLETAS);
    const r2 = await conOpcion.correr();
    expect(r2.resultado).toBe('Lista');
    // La evidencia de la entrevista que quedó afuera no llega al modelo.
    expect(conOpcion.gemini.recibidas[0]!.usuario).not.toContain('Caro');
    expect(r2.notas.some((n) => n.includes('Quedaron afuera'))).toBe(true);
  });

  it('antes de sintetizar, guarda como evidencia las respuestas a las repreguntas', async () => {
    const { espacio, ana } = espacioBase();
    espacio.notion.escribirEnCuerpo(ana, '❓ Repregunta 1 · sobre tu respuesta a P10 («…»)', '¿Quién decidió la última vez?', `${MARCA_RESPUESTA} La comisión, en asamblea.`);
    const { correr, gemini } = preparar(espacio, [segmentos({ nombre: 'Emisores' }), persona([atributo('Algo', ['E1'])])]);

    await correr();

    const titulos = espacio.notion.filasDe(BASES.evidencia).map(([, x]) => textoDe(x.properties['Título']));
    expect(titulos).toContain('R1 (sobre P10) · Ana (PM)');
    expect(gemini.recibidas[0]!.usuario).toContain('La comisión, en asamblea.');
  });

  it('volver a sintetizar actualiza la persona, no pisa al PM y archiva lo que ya no se propone', async () => {
    const { espacio } = espacioBase();
    const primera = preparar(espacio, [
      segmentos({ nombre: 'Emisores' }),
      persona([atributo('Pierde plata por morosos', ['E4']), atributo('Usa planillas', ['E1']), atributo('Le preocupa la seguridad', ['E2'])]),
    ]);
    await primera.correr();
    const idPersona = primera.filas('personas')[0]![0];
    const porAfirmacion = (af: string) => primera.filas('atributos').find(([, a]) => textoDe(a['Afirmación']) === af)![0];
    espacio.notion.editarComoPm(porAfirmacion('Pierde plata por morosos'), { 'Afirmación': titulo('Pierde plata por morosos (corregido por el PM)') });
    espacio.notion.editarComoPm(porAfirmacion('Le preocupa la seguridad'), { Confianza: { select: { name: 'Baja' } } });

    const segunda = preparar(espacio, [segmentos({ nombre: 'Emisores', personaExistente: 'P1' }), persona([atributo('Pierde plata por morosos', ['E4', 'E3'])])]);
    const r = await segunda.correr();

    expect(segunda.filas('personas')).toHaveLength(1);
    expect(segunda.filas('personas')[0]![0]).toBe(idPersona);
    const atributos = segunda.filas('atributos').map(([, a]) => a);
    const editado = atributos.find((a) => textoDe(a['Afirmación']).includes('corregido por el PM'))!;
    expect(textoDe(editado['Sugerencia del agente'])).toContain('Propuesta del agente');
    // «Usa planillas» se archiva; «Le preocupa la seguridad» tiene ediciones del PM y se conserva.
    expect(atributos.some((a) => textoDe(a['Afirmación']) === 'Usa planillas')).toBe(false);
    expect(atributos.some((a) => textoDe(a['Afirmación']) === 'Le preocupa la seguridad')).toBe(true);
    expect(r.notas.some((n) => n.includes('se conserva «Le preocupa la seguridad»'))).toBe(true);
    expect(espacio.contadores().bloqueos).toBe(0);
  });

  it('HU-12: si el modelo repite el texto que editó el PM, no se duplica el atributo', async () => {
    const { espacio } = espacioBase();
    const primera = preparar(espacio, [segmentos({ nombre: 'Emisores' }), persona([atributo('Pierde plata por morosos', ['E4'])])]);
    await primera.correr();
    const [idAtributo] = primera.filas('atributos')[0]!;
    espacio.notion.editarComoPm(idAtributo, { 'Afirmación': titulo('Pierde plata porque los socios se olvidan') });

    // Lo que hace un modelo real: recibe el texto editado y lo mantiene, como le pide el prompt.
    const segunda = preparar(espacio, [segmentos({ nombre: 'Emisores', personaExistente: 'P1' }), persona([atributo('Pierde plata porque los socios se olvidan', ['E4', 'E3'])])]);
    await segunda.correr();

    expect(segunda.gemini.recibidas[1]!.usuario).toContain('Pierde plata porque los socios se olvidan');
    expect(segunda.filas('atributos')).toHaveLength(1);
    expect(textoDe(segunda.filas('atributos')[0]![1]['Sugerencia del agente'])).toContain('Propuesta del agente');
  });

  it('HU-12: con la referencia, una redacción nueva va a «Sugerencia del agente» y el texto del PM queda igual', async () => {
    const { espacio } = espacioBase();
    const primera = preparar(espacio, [segmentos({ nombre: 'Emisores' }), persona([atributo('Pierde plata por morosos', ['E4'])])]);
    await primera.correr();
    const [idAtributo] = primera.filas('atributos')[0]!;
    espacio.notion.editarComoPm(idAtributo, { 'Afirmación': titulo('Texto del PM') });

    const segunda = preparar(espacio, [segmentos({ nombre: 'Emisores', personaExistente: 'P1' }), persona([atributo('Otra redacción', ['E4'], { atributoExistente: 'A1' })])]);
    await segunda.correr();

    expect(segunda.gemini.recibidas[1]!.usuario).toContain('A1 · [Problema] Texto del PM');
    const [fila, ...resto] = segunda.filas('atributos');
    expect(resto).toHaveLength(0);
    expect(textoDe(fila![1]['Afirmación'])).toBe('Texto del PM');
    expect(fila![1]['Editado por el PM']).toEqual({ checkbox: true });
    expect(textoDe(fila![1]['Sugerencia del agente'])).toContain('Otra redacción');
  });

  it('una redacción nueva de un atributo sin editar actualiza la misma fila, sin archivarla ni cambiar su clave', async () => {
    const { espacio } = espacioBase();
    const primera = preparar(espacio, [segmentos({ nombre: 'Emisores' }), persona([atributo('Primera redacción', ['E4'])])]);
    await primera.correr();
    const [idAtributo, antes] = primera.filas('atributos')[0]!;
    const clave = textoDe(antes['Clave']);

    const segunda = preparar(espacio, [segmentos({ nombre: 'Emisores', personaExistente: 'P1' }), persona([atributo('Segunda redacción', ['E4'], { atributoExistente: ' a1 ' })])]);
    const r = await segunda.correr();

    const filasNuevas = segunda.filas('atributos');
    expect(filasNuevas).toHaveLength(1);
    expect(filasNuevas[0]![0]).toBe(idAtributo);
    expect(textoDe(filasNuevas[0]![1]['Afirmación'])).toBe('Segunda redacción');
    expect(textoDe(filasNuevas[0]![1]['Clave'])).toBe(clave);
    expect(r.notas.some((n) => n.includes('Archivada'))).toBe(false);
  });

  it('una referencia que no existe o se repite se ignora y queda anotada', async () => {
    const { espacio } = espacioBase();
    const primera = preparar(espacio, [segmentos({ nombre: 'Emisores' }), persona([atributo('Uno', ['E4'])])]);
    await primera.correr();

    const segunda = preparar(espacio, [
      segmentos({ nombre: 'Emisores', personaExistente: 'P1' }),
      persona([atributo('Uno bis', ['E4'], { atributoExistente: 'A1' }), atributo('Dos', ['E1'], { atributoExistente: 'A1' }), atributo('Tres', ['E2'], { atributoExistente: 'A9' })]),
    ]);
    const r = await segunda.correr();

    expect(segunda.filas('atributos').map(([, a]) => textoDe(a['Afirmación']))).toEqual(['Uno bis', 'Dos', 'Tres']);
    expect(r.notas.filter((n) => n.includes('se ignoró la referencia'))).toHaveLength(2);
  });

  it('avisa qué atributos tienen divergencia y deja una nota si una se archiva', async () => {
    const { espacio } = espacioBase();
    const posturas = [
      { postura: 'Decide la comisión', evidencias: ['E1'] },
      { postura: 'Es la misma persona', evidencias: ['E2'] },
    ];
    const primera = preparar(espacio, [segmentos({ nombre: 'Emisores' }), persona([atributo('Quién decide', [], { posturas })])]);
    await primera.correr();

    const segunda = preparar(espacio, [segmentos({ nombre: 'Emisores', personaExistente: 'P1' }), persona([atributo('Otra cosa', ['E4'])])]);
    const r = await segunda.correr();

    const enviado = segunda.gemini.recibidas[1]!.usuario;
    expect(enviado).toContain('A1 · [Problema] Quién decide (con divergencia)');
    expect(enviado).toContain('mantené esa divergencia');
    expect(r.notas.some((n) => n.includes('se archivó «Quién decide», que tenía una divergencia'))).toBe(true);
  });

  it('una persona Rechazada genera la versión 2, con el motivo en el prompt y el registro de cambios (T7.6)', async () => {
    const { espacio } = espacioBase();
    const v1 = espacio.notion.sembrar(BASES.personas, {
      Nombre: titulo('Emisores'),
      Estado: { status: { name: 'Rechazada' } },
      'Versión': { number: 1 },
      Clave: texto(claves.persona('Emisores', 1)),
      'Motivo de rechazo': texto('Mezcla profesionales con clubes.'),
    });
    const { correr, filas, gemini } = preparar(espacio, [
      segmentos({ nombre: 'Clubes de barrio', personaExistente: 'P1' }),
      persona([atributo('Cobra cuotas sociales', ['E1'])], 'Separé los clubes de los profesionales.'),
    ]);

    const r = await correr();

    expect(r.resultado).toBe('Lista');
    const v2 = filas('personas').find(([id]) => id !== v1)![1];
    expect(v2['Versión']).toEqual({ number: 2 });
    expect(v2['Versión anterior']).toEqual({ relation: [{ id: v1 }] });
    expect(v2['Estado']).toEqual({ status: { name: 'Borrador' } });
    expect(textoDe(v2['Registro de cambios'])).toContain('Motivo de rechazo: «Mezcla profesionales con clubes.»');
    expect(textoDe(v2['Registro de cambios'])).toContain('Separé los clubes de los profesionales.');
    expect(gemini.recibidas[1]!.usuario).toContain('Mezcla profesionales con clubes.');
    // El prompt de segmentos pide responder al motivo y no repetir personas.
    expect(gemini.recibidas[0]!.usuario).toContain('tienen que responder a ese motivo');
    expect(gemini.recibidas[0]!.usuario).toContain('No propongas un segmento que cubra a las mismas personas');
    // La versión rechazada no se toca.    expect(espacio.notion.paginas.get(v1)!.properties['Estado']).toEqual({ status: { name: 'Rechazada' } });
  });

  it('no toca las personas En revisión ni las Aprobadas', async () => {
    const { espacio } = espacioBase();
    espacio.notion.sembrar(BASES.personas, { Nombre: titulo('A'), Estado: { status: { name: 'En revisión' } }, Clave: texto('persona:a') });
    espacio.notion.sembrar(BASES.personas, { Nombre: titulo('B'), Estado: { status: { name: 'Aprobada' } }, Clave: texto('persona:b') });
    const { correr, filas } = preparar(espacio, [segmentos({ nombre: 'A', personaExistente: 'P1' }, { nombre: 'B', personaExistente: 'P2' })]);

    const r = await correr();

    expect(r.resultado).toBe('Lista');
    expect(filas('personas')).toHaveLength(2);
    expect(filas('atributos')).toHaveLength(0);
    expect(r.notas.some((n) => n.includes('En revisión'))).toBe(true);
    expect(r.notas.some((n) => n.includes('(H8)'))).toBe(true);
    expect(espacio.contadores().bloqueos).toBe(0);
  });

  it('si fallan los segmentos no escribe nada; si falla una persona, guarda las otras y queda Incompleta', async () => {
    const malo = { otra: 'cosa' };
    const uno = espacioBase();
    const r1 = await preparar(uno.espacio, [malo, malo]).correr();
    expect(r1.resultado).toBe('Error');
    expect(uno.espacio.notion.filasDe(BASES.personas)).toHaveLength(0);

    const dos = espacioBase();
    const r2 = await preparar(dos.espacio, [segmentos({ nombre: 'A' }, { nombre: 'B' }), malo, malo, persona([atributo('Algo', ['E1'])])]).correr();
    expect(r2.resultado).toBe('Incompleta');
    expect(dos.espacio.notion.filasDe(BASES.personas)).toHaveLength(1);
    expect(r2.errores[0]).toMatch(/^Persona «A»/);
  });

  it('sin segmentos explica qué falta; sin modelo termina en Error sin escribir', async () => {
    const { espacio } = espacioBase();
    const r = await preparar(espacio, [{ segmentos: [], informacionQueFalta: 'Entrevistas con pagadores.' }]).correr();
    expect(r.resultado).toBe('Lista');
    expect(r.notas[0]).toBe('La evidencia no alcanza para distinguir segmentos. Falta: Entrevistas con pagadores.');

    const sinModelo = await sintetizarEtapa({ solicitud: { id: 's', titulo: 's', etapa: 'Sintetizar', opciones: '' }, espacio, sinModelo: 'Falta el secreto GEMINI_API_KEY.' });
    expect(sinModelo).toMatchObject({ resultado: 'Error', errores: ['Falta el secreto GEMINI_API_KEY.'] });
  });

  it('por el bucle, Sintetizar pide el contexto confirmado y deja la solicitud en Lista', async () => {
    const { espacio } = espacioBase();
    espacio.agregarSolicitud({ id: 's1', etapa: 'Sintetizar' });
    const gemini = new ProveedorFalso('Gemini', 'g', [respuesta(segmentos({ nombre: 'A' })), respuesta(persona([atributo('Algo', ['E1'])]))]);

    await ejecutarAgente({ espacio, etapas: ETAPAS, modelos: () => ({ generar: crearGenerador({ principal: gemini, esperar: sinEspera }) }), log: silencio });

    expect(espacio.estadoDe('s1')).toBe('Lista');
    expect(espacio.ejecuciones[0]?.cierre?.resultado).toBe('Lista');
  });
});

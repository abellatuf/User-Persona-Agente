import { beforeEach, describe, expect, it } from 'vitest';
import { BASES } from '../src/config.js';
import { claves } from '../src/guards/claves.js';
import { Contador } from '../src/notion/contador.js';
import { EscritorNotion, EscrituraBloqueada } from '../src/notion/escritor.js';
import { estado, relacion, texto, titulo } from '../src/notion/propiedades.js';
import { textoDe } from './apoyo/formato.js';
import { ID_PM, LlamadorFalso } from './apoyo/llamador-falso.js';

let notion: LlamadorFalso;
let contador: Contador;
let escritor: EscritorNotion;

beforeEach(() => {
  notion = new LlamadorFalso();
  contador = new Contador();
  escritor = new EscritorNotion(notion, contador);
});

const atributo = (afirmacion: string, evidencias = ['e1']) => ({
  'Afirmación': titulo(afirmacion),
  Evidencias: relacion(evidencias),
});

describe('Escritor: estados prohibidos', () => {
  it('un intento de crear una persona Aprobada no llega a Notion y queda contado', async () => {
    await expect(
      escritor.guardar('personas', { Nombre: titulo('Ana'), Estado: estado('Aprobada') }, { clave: 'persona:1' }),
    ).rejects.toThrow(EscrituraBloqueada);

    expect(notion.escrituras()).toEqual([]);
    expect(contador.bloqueos).toBe(1);
  });

  it('un intento de aprobar una persona existente tampoco llega a Notion', async () => {
    const id = notion.sembrar(BASES.personas, { Nombre: titulo('Ana'), Estado: estado('Borrador'), Clave: texto('persona:1') });

    await expect(escritor.actualizar('personas', id, { Estado: estado('Aprobada') })).rejects.toThrow(/solo lo puede poner el PM/);
    expect(notion.escrituras()).toEqual([]);
  });
});

describe('Escritor: idempotencia', () => {
  it('guardar dos veces con la misma clave crea una sola fila y la actualiza', async () => {
    const clave = claves.atributo('persona:1', 'Problema', 'Paga tarde');
    const primera = await escritor.guardar('atributos', atributo('Paga tarde'), { clave });
    const segunda = await escritor.guardar('atributos', { ...atributo('Paga tarde', ['e1', 'e2']) }, { clave });

    expect(primera.accion).toBe('creada');
    expect(segunda).toEqual({ id: primera.id, accion: 'actualizada' });
    expect(notion.filasDe(BASES.atributos)).toHaveLength(1);
    expect(notion.paginas.get(primera.id)?.properties['Evidencias']).toEqual(relacion(['e1', 'e2']));
    expect(textoDe(notion.paginas.get(primera.id)?.properties['Clave'])).toBe(clave);
  });

  it('sin clave, en una base que la necesita, se bloquea', async () => {
    await expect(escritor.guardar('atributos', atributo('Paga tarde'))).rejects.toThrow(/necesitan una clave/);
  });

  it('en Ejecuciones, sin clave, siempre crea una fila nueva', async () => {
    await escritor.guardar('ejecuciones', { 'Ejecución': titulo('a') });
    await escritor.guardar('ejecuciones', { 'Ejecución': titulo('a') });
    expect(notion.filasDe(BASES.ejecuciones)).toHaveLength(2);
  });
});

describe('Escritor: no pisar al PM', () => {
  it('si el PM editó el atributo, deja la propuesta como sugerencia y marca la casilla', async () => {
    const clave = 'atributo:pm';
    const { id } = await escritor.guardar('atributos', atributo('Paga tarde'), { clave });
    notion.editarComoPm(id, { 'Afirmación': titulo('Paga tarde cuando cobra el aguinaldo') });

    const r = await escritor.guardar('atributos', atributo('Paga con atraso'), { clave });

    expect(r.accion).toBe('sugerencia');
    const pagina = notion.paginas.get(id)!;
    expect(textoDe(pagina.properties['Afirmación'])).toBe('Paga tarde cuando cobra el aguinaldo');
    expect(textoDe(pagina.properties['Sugerencia del agente'])).toContain('«Paga con atraso»');
    expect(pagina.properties['Editado por el PM']).toEqual({ checkbox: true });
    expect(contador.avisosDesde(0)[0]).toBe('Atributo «Paga tarde cuando cobra el aguinaldo»: el PM lo editó, así que la propuesta quedó en «Sugerencia del agente».');
  });

  it('una vez marcado, sigue protegido aunque el agente haya sido el último en escribir', async () => {
    const { id } = await escritor.guardar('atributos', atributo('Paga tarde'), { clave: 'atributo:x' });
    notion.editarComoPm(id, { 'Afirmación': titulo('Editado') });
    await escritor.guardar('atributos', atributo('Uno'), { clave: 'atributo:x' });
    const r = await escritor.guardar('atributos', atributo('Dos'), { clave: 'atributo:x' });

    expect(r.accion).toBe('sugerencia');
    expect(textoDe(notion.paginas.get(id)!.properties['Afirmación'])).toBe('Editado');
  });

  it('no modifica atributos de una persona que ya no está en Borrador', async () => {
    const persona = notion.sembrar(BASES.personas, { Estado: estado('Aprobada') });
    const id = notion.sembrar(BASES.atributos, { ...atributo('A'), Persona: relacion([persona]), Clave: texto('atributo:a') });

    await expect(escritor.actualizar('atributos', id, { Posturas: texto('x') })).rejects.toThrow(/ya no está en Borrador/);
  });
});

describe('Escritor: archivar', () => {
  it('archiva un atributo del agente y deja el motivo como aviso', async () => {
    const { id } = await escritor.guardar('atributos', atributo('Viejo'), { clave: 'atributo:v' });

    await escritor.archivar('atributos', id, 'ya no surge de la evidencia');

    expect(notion.filasDe(BASES.atributos)).toHaveLength(0);
    expect(notion.paginas.get(id)?.enPapelera).toBe(true);
    expect(contador.avisosDesde(0)[0]).toMatch(/ya no surge de la evidencia/);
  });

  it('no archiva evidencia cargada por el PM', async () => {
    const id = notion.sembrar(BASES.evidencia, { 'Título': titulo('Entrevistas propias') }, ID_PM);

    await expect(escritor.archivar('evidencia', id, 'x')).rejects.toThrow(/solo archiva filas que creó/);
    expect(notion.paginas.get(id)?.enPapelera).toBe(false);
  });

  it('no archiva solicitudes', async () => {
    const id = notion.sembrar(BASES.solicitudes, {});
    await expect(escritor.archivar('solicitudes', id, 'x')).rejects.toThrow(/no archiva filas/);
  });
});

describe('Escritor: otras bases', () => {
  it('bloquea modificar como atributo una página de otra base', async () => {
    const id = notion.sembrar(BASES.evidencia, { 'Título': titulo('x') });
    await expect(escritor.actualizar('atributos', id, { Posturas: texto('x') })).rejects.toThrow(/no pertenece/);
  });

  it('bloquea modificar una página que no existe en una base con lectura previa', async () => {
    await expect(escritor.actualizar('atributos', 'no-existe', { Posturas: texto('x') })).rejects.toThrow(/no se encontró/);
  });
});

import { describe, expect, it } from 'vitest';
import {
  describirPropuesta,
  evaluarEscritura,
  respetarEdicionesDelPm,
  type EstadoActual,
  type OperacionEscritura,
} from '../src/guards/escritura.js';
import { estado, numero, relacion, texto, titulo } from '../src/notion/propiedades.js';

const actual = (cambios: Partial<EstadoActual> = {}): EstadoActual => ({
  estado: null,
  editadoPorPm: false,
  ultimaEdicionDelAgente: true,
  creadaPorAgente: true,
  personaCongelada: false,
  deOtraBase: false,
  ...cambios,
});

const op = (o: Partial<OperacionEscritura> & Pick<OperacionEscritura, 'base'>): OperacionEscritura => ({
  accion: 'actualizar',
  propiedades: {},
  ...o,
});

describe('estados prohibidos (HU-13, RNF-07)', () => {
  it.each(['En revisión', 'Aprobada', 'Rechazada'])('bloquea poner una persona en «%s»', (e) => {
    expect(evaluarEscritura(op({ base: 'personas', propiedades: { Estado: estado(e) }, actual: actual({ estado: 'Borrador' }) })))
      .toMatch(/solo lo puede poner el PM/);
    expect(evaluarEscritura(op({ accion: 'crear', base: 'personas', propiedades: { Estado: estado(e), Clave: texto('k') } })))
      .toMatch(/solo lo puede poner el PM/);
  });

  it('permite crear una persona en Borrador', () => {
    expect(evaluarEscritura(op({ accion: 'crear', base: 'personas', propiedades: { Estado: estado('Borrador'), Clave: texto('k') } })))
      .toBeNull();
  });

  it('bloquea marcar el contexto como Confirmado', () => {
    expect(evaluarEscritura(op({ base: 'contexto', propiedades: { Estado: estado('Confirmado') }, actual: actual({ estado: 'Por confirmar' }) })))
      .toMatch(/solo lo puede poner el PM/);
  });

  it('bloquea modificar un contexto ya Confirmado', () => {
    expect(evaluarEscritura(op({ base: 'contexto', propiedades: { Problema: texto('x') }, actual: actual({ estado: 'Confirmado' }) })))
      .toMatch(/ya está Confirmado/);
  });
});

describe('personas fuera de Borrador', () => {
  it.each(['En revisión', 'Aprobada', 'Rechazada', 'Reemplazada'])('no modifica una persona en «%s»', (e) => {
    expect(evaluarEscritura(op({ base: 'personas', propiedades: { Resumen: texto('nuevo') }, actual: actual({ estado: e }) })))
      .toMatch(/solo modifica personas en Borrador/);
  });

  it('solo permite pasar una persona Aprobada a Reemplazada, sin tocar nada más', () => {
    const aprobada = actual({ estado: 'Aprobada' });
    expect(evaluarEscritura(op({ base: 'personas', propiedades: { Estado: estado('Reemplazada') }, actual: aprobada }))).toBeNull();
    expect(
      evaluarEscritura(op({ base: 'personas', propiedades: { Estado: estado('Reemplazada'), Resumen: texto('x') }, actual: aprobada })),
    ).toMatch(/solo modifica personas en Borrador/);
  });

  it('no modifica atributos de una persona congelada', () => {
    expect(evaluarEscritura(op({ base: 'atributos', propiedades: { Posturas: texto('x') }, actual: actual({ personaCongelada: true }) })))
      .toMatch(/ya no está en Borrador/);
  });
});

describe('trazabilidad (HU-09)', () => {
  const nuevo = { 'Afirmación': titulo('Paga a fin de mes'), Clave: texto('atributo:1') };

  it('bloquea crear un atributo sin evidencia', () => {
    expect(evaluarEscritura(op({ accion: 'crear', base: 'atributos', propiedades: nuevo }))).toMatch(/sin evidencia/);
    expect(evaluarEscritura(op({ accion: 'crear', base: 'atributos', propiedades: { ...nuevo, Evidencias: relacion([]) } })))
      .toMatch(/sin evidencia/);
  });

  it('permite crear un atributo con evidencia', () => {
    expect(evaluarEscritura(op({ accion: 'crear', base: 'atributos', propiedades: { ...nuevo, Evidencias: relacion(['e1']) } })))
      .toBeNull();
  });

  it('bloquea dejar un atributo sin evidencia, pero permite actualizar sin tocar la relación', () => {
    expect(evaluarEscritura(op({ base: 'atributos', propiedades: { Evidencias: relacion([]) }, actual: actual() }))).toMatch(/quedar sin/);
    expect(evaluarEscritura(op({ base: 'atributos', propiedades: { Posturas: texto('x') }, actual: actual() }))).toBeNull();
  });
});

describe('clave obligatoria (RNF-04)', () => {
  it.each(['evidencia', 'atributos', 'personas', 'supuestos'] as const)('bloquea crear en «%s» sin clave', (base) => {
    const propiedades = base === 'atributos' ? { Evidencias: relacion(['e1']) } : {};
    expect(evaluarEscritura(op({ accion: 'crear', base, propiedades }))).toMatch(/necesitan una clave/);
  });

  it('no exige clave en Ejecuciones', () => {
    expect(evaluarEscritura(op({ accion: 'crear', base: 'ejecuciones', propiedades: { 'Ejecución': titulo('x') } }))).toBeNull();
  });
});

describe('archivar', () => {
  const archivar = (base: OperacionEscritura['base'], a?: EstadoActual) =>
    evaluarEscritura({ accion: 'archivar', base, propiedades: {}, ...(a ? { actual: a } : {}) });

  it('permite archivar atributos, supuestos y evidencia creados por el agente', () => {
    expect(archivar('atributos', actual())).toBeNull();
    expect(archivar('supuestos', actual({ estado: 'Pendiente' }))).toBeNull();
    expect(archivar('evidencia', actual())).toBeNull();
  });

  it.each(['solicitudes', 'ejecuciones', 'contexto', 'equipo', 'entrevistas', 'personas', 'configuracion'] as const)(
    'nunca archiva en «%s»',
    (base) => expect(archivar(base, actual())).toMatch(/no archiva filas/),
  );

  it('no archiva lo que no creó el agente', () => {
    expect(archivar('evidencia', actual({ creadaPorAgente: false }))).toMatch(/solo archiva filas que creó/);
  });

  it('no archiva un atributo editado por el PM ni uno de una persona congelada', () => {
    expect(archivar('atributos', actual({ editadoPorPm: true }))).toMatch(/ediciones del PM/);
    expect(archivar('atributos', actual({ ultimaEdicionDelAgente: false }))).toMatch(/ediciones del PM/);
    expect(archivar('atributos', actual({ personaCongelada: true }))).toMatch(/ya no está en Borrador/);
  });

  it('no archiva un supuesto que el PM ya está validando', () => {
    expect(archivar('supuestos', actual({ estado: 'En validación' }))).toMatch(/no se archiva/);
  });

  it('no archiva si no pudo leer la página', () => {
    expect(archivar('atributos')).toMatch(/no se pudo leer/);
  });
});

describe('otras bases', () => {
  it('bloquea escribir en una página de otra base', () => {
    expect(evaluarEscritura(op({ base: 'atributos', propiedades: {}, actual: actual({ deOtraBase: true }) }))).toMatch(/no pertenece/);
  });
});

describe('no pisar al PM (HU-12)', () => {
  const propuesta = { 'Afirmación': titulo('Nueva versión'), Confianza: { select: { name: 'Media' } }, Evidencias: relacion(['a', 'b']) };

  it('si el PM editó el atributo, la escritura se convierte en sugerencia', () => {
    const { op: final, redirigida } = respetarEdicionesDelPm(
      op({ base: 'atributos', propiedades: propuesta, actual: actual({ ultimaEdicionDelAgente: false }) }),
    );
    expect(redirigida).toBe(true);
    expect(Object.keys(final.propiedades)).toEqual(['Sugerencia del agente', 'Editado por el PM']);
    expect(final.propiedades['Editado por el PM']).toEqual({ checkbox: true });
  });

  it('si ya está marcado «Editado por el PM», también queda como sugerencia', () => {
    expect(respetarEdicionesDelPm(op({ base: 'atributos', propiedades: propuesta, actual: actual({ editadoPorPm: true }) })).redirigida)
      .toBe(true);
  });

  it('si la última edición fue del agente, escribe normalmente', () => {
    const o = op({ base: 'atributos', propiedades: propuesta, actual: actual() });
    expect(respetarEdicionesDelPm(o)).toEqual({ op: o, redirigida: false });
  });

  it('la sugerencia describe cada cambio propuesto', () => {
    expect(describirPropuesta({ ...propuesta, Clave: texto('x'), Lecturas: numero(3) })).toBe(
      'Propuesta del agente: Afirmación: «Nueva versión» · Confianza: Media · Evidencias: 2 vínculo(s) · Lecturas: 3',
    );
  });
});

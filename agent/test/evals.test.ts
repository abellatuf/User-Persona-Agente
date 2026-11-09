import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { BASES_EVALUACION, BASES_PRINCIPAL } from '../src/config.js';
import { CargadorEvaluacion } from '../src/evals/cargar.js';
import { leerCaso, terminosDeOtrosCasos, type Caso } from '../src/evals/caso.js';
import {
  chequearAgnostico,
  chequearContexto,
  chequearDivergencias,
  chequearFormato,
  chequearTopes,
  chequearTrazabilidad,
} from '../src/evals/chequeos.js';
import type { Foto } from '../src/evals/foto.js';
import { informe } from '../src/evals/informe.js';
import { LlamadorFalso } from './apoyo/llamador-falso.js';

const CASOS = path.resolve(import.meta.dirname, '../../evals/casos');

describe('casos de evaluación', () => {
  it('los dos casos del repositorio son válidos', async () => {
    const cobros = await leerCaso(path.join(CASOS, 'cobros-recurrentes'));
    const rutina = await leerCaso(path.join(CASOS, 'rutina-app'));
    expect(cobros.entrevistas).toHaveLength(3);
    expect(cobros.evidenciaPublica).toHaveLength(20);
    expect(cobros.esperado.competidores).toBeDefined();
    expect(rutina.spec).toContain('Carga');
    expect(rutina.esperado.divergencias).toHaveLength(2);
  });

  it('cada caso conoce los términos propios de los otros', async () => {
    expect(await terminosDeOtrosCasos(CASOS, 'rutina-app')).toContain('pagador');
    expect(await terminosDeOtrosCasos(CASOS, 'cobros-recurrentes')).toContain('rutina');
  });
});

describe('cargador de casos', () => {
  it('no escribe en el espacio del PM', () => {
    expect(() => new CargadorEvaluacion(new LlamadorFalso(), BASES_PRINCIPAL)).toThrow(/solo escribe en el espacio de evaluación/);
  });

  it('carga las entrevistas en Base respondida, sin las preguntas vacías', async () => {
    const notion = new LlamadorFalso();
    const caso = await leerCaso(path.join(CASOS, 'cobros-recurrentes'));
    await new CargadorEvaluacion(notion, BASES_EVALUACION).cargarEntrevistas(caso);
    const filas = notion.filasDe(BASES_EVALUACION.entrevistas).map(([, f]) => f.properties);
    expect(filas).toHaveLength(3);
    expect(filas[0]!['Estado']).toEqual({ status: { name: 'Base respondida' } });
    expect(Object.keys(filas[1]!).some((k) => k.startsWith('P04 · '))).toBe(false);
  });
});

const casoBase: Caso = {
  nombre: 'prueba',
  contexto: { Nombre: 'X', Problema: 'p', 'Problema · fuente': 'spec.md · «el problema es real»', Competidores: 'c', 'Competidores · fuente': 'Cargado por el PM' },
  equipo: [
    { nombre: 'Ana', rol: 'PM' },
    { nombre: 'Beto', rol: 'Ingeniería' },
  ],
  entrevistas: [],
  evidenciaPublica: [],
  esperado: {
    divergencias: [{ tema: 'Quién es el usuario', preguntas: ['P01'], lados: [['Ana'], ['Beto']] }],
    competidores: { tema: 'Competidores', marcaEnPosturas: 'Campo Competidores' },
    terminosPropios: ['algo'],
  },
  spec: 'Intro. El problema es real.',
};

function foto(cambios: Partial<Foto> = {}): Foto {
  return {
    contexto: [],
    entrevistas: [
      { id: 'e-ana', miembro: 'Ana', repreguntas: 5 },
      { id: 'e-beto', miembro: 'Beto', repreguntas: 2 },
    ],
    evidencias: [
      { id: 'ev1', titulo: 'P01 · Ana (PM)', tipo: 'Supuesto del equipo', url: null, entrevistas: ['e-ana'], excluida: false },
      { id: 'ev2', titulo: 'P01 · Beto (Ingeniería)', tipo: 'Supuesto del equipo', url: null, entrevistas: ['e-beto'], excluida: false },
      { id: 'ev3', titulo: 'Un artículo', tipo: 'Pública', url: 'https://ejemplo.com/a', entrevistas: [], excluida: true },
    ],
    personas: [{ id: 'per1', nombre: 'Emisor chico', resumen: 'r', porQue: 'porque sí', estado: 'Borrador' }],
    atributos: [
      {
        id: 'a1',
        afirmacion: 'Hay uno o dos tipos de usuario',
        categoria: 'Contexto',
        confianza: 'Baja',
        personas: ['per1'],
        evidencias: ['ev1', 'ev2'],
        divergencia: true,
        posturas: '• Ana dice dos • Beto dice uno • Campo Competidores: «no hay»',
      },
    ],
    supuestos: [{ id: 's1', supuesto: 'Hay dos tipos', atributos: ['a1'], metodo: 'Entrevista', perfil: 'Un emisor', preguntas: '¿…?' }],
    ...cambios,
  };
}

describe('chequeos', () => {
  it('una síntesis correcta pasa todos', () => {
    const f = foto();
    expect(chequearFormato(f).ok).toBe(true);
    expect(chequearTrazabilidad(f).ok).toBe(true);
    expect(chequearTopes(f).ok).toBe(true);
    expect(chequearDivergencias(f, casoBase).map((c) => c.ok)).toEqual([true, true]);
    expect(chequearAgnostico(f, ['rutina']).ok).toBe(true);
  });

  it('una divergencia que cita a un solo lado no cuenta', () => {
    const f = foto({ atributos: [{ ...foto().atributos[0]!, evidencias: ['ev1'] }] });
    const [divergencias] = chequearDivergencias(f, casoBase);
    expect(divergencias!.ok).toBe(false);
  });

  it('competidores va aparte: sin la marca en posturas falla solo ese chequeo', () => {
    const f = foto({ atributos: [{ ...foto().atributos[0]!, posturas: '• Ana dice dos • Beto dice uno' }] });
    expect(chequearDivergencias(f, casoBase).map((c) => [c.nombre, c.ok])).toEqual([
      ['Divergencias', true],
      ['Competidores', false],
    ]);
  });

  it('trazabilidad: falla si un atributo cita evidencia excluida o inexistente', () => {
    const a = foto().atributos[0]!;
    const r = chequearTrazabilidad(foto({ atributos: [{ ...a, evidencias: ['ev3', 'no-existe'] }] }));
    expect(r.ok).toBe(false);
    expect(r.detalle).toHaveLength(2);
  });

  it('formato: falla si la persona no quedó en Borrador o el atributo no tiene categoría válida', () => {
    const f = foto({
      personas: [{ ...foto().personas[0]!, estado: 'Aprobada' }],
      atributos: [{ ...foto().atributos[0]!, categoria: 'Otra' }],
    });
    expect(chequearFormato(f).detalle).toHaveLength(2);
  });

  it('agnóstico: detecta términos de otro caso, también en plural, y no subcadenas', () => {
    const f = foto({ personas: [{ ...foto().personas[0]!, resumen: 'Cobra cuotas y usa rutinas' }] });
    expect(chequearAgnostico(f, ['cuota', 'rutina', 'cobro']).detalle).toEqual([
      'Aparece «cuota», que es de otro caso.',
      'Aparece «rutina», que es de otro caso.',
    ]);
  });

  it('contexto: las citas tienen que estar en la spec y lo que dice la spec se tiene que encontrar', () => {
    expect(chequearContexto({ Problema: 'p', 'Problema · fuente': 'spec · «El problema es real»' }, casoBase).ok).toBe(true);
    const mal = chequearContexto({ Problema: 'No encontrado', Competidores: 'c', 'Competidores · fuente': 'spec · «inventado»' }, casoBase);
    expect(mal.detalle).toEqual(['Problema: la spec lo dice y quedó «No encontrado».', 'Competidores: la cita «inventado» no está en la spec.']);
  });

  it('el informe resume cuántos pasan', () => {
    const texto = informe('Evaluación · prueba', [chequearTopes(foto()), { nombre: 'X', ok: false, detalle: ['mal'] }]);
    expect(texto).toContain('**1 de 2 chequeos pasan.**');
    expect(texto).toContain('### ❌ X');
  });
});

describe('chequeos agregados con la propuesta del H9', () => {
  it('topes: más de 5 repreguntas para un miembro falla', () => {
    const f = foto({ entrevistas: [{ id: 'e-ana', miembro: 'Ana', repreguntas: 6 }] });
    expect(chequearTopes(f).detalle).toEqual(['Ana: 6 repreguntas, el tope es 5.']);
  });

  it('trazabilidad: una evidencia pública citada sin URL válida falla', () => {
    const base = foto();
    const f = foto({
      evidencias: [...base.evidencias, { id: 'ev4', titulo: 'Sin link', tipo: 'Pública', url: null, entrevistas: [], excluida: false }],
      atributos: [{ ...base.atributos[0]!, evidencias: ['ev1', 'ev4'] }],
    });
    expect(chequearTrazabilidad(f).detalle).toEqual(['«Hay uno o dos tipos de usuario»: cita «Sin link», que no tiene una URL válida.']);
  });
});

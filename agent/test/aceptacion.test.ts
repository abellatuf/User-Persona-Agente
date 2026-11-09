import { describe, expect, it } from 'vitest';
import { medirAceptacion, soloLectura, type DatosAceptacion } from '../src/evals/aceptacion.js';
import { LlamadorFalso } from './apoyo/llamador-falso.js';

const datos = (cambios: Partial<DatosAceptacion> = {}): DatosAceptacion => ({
  idAgente: 'bot',
  personas: [
    { nombre: 'A', estado: 'Aprobada', aprobadaPor: ['pm'] },
    { nombre: 'B', estado: 'Rechazada', aprobadaPor: [] },
    { nombre: 'C', estado: 'Borrador', aprobadaPor: [] },
  ],
  atributos: [
    { afirmacion: 'x', confianza: 'Baja', evidencias: 2, editadoPorPm: true, supuestos: 1 },
    { afirmacion: 'y', confianza: 'Baja', evidencias: 1, editadoPorPm: false, supuestos: 0 },
  ],
  supuestos: [
    { supuesto: 's1', metodo: 'Entrevista', perfil: 'p', preguntas: 3 },
    { supuesto: 's2', metodo: null, perfil: 'p', preguntas: 3 },
  ],
  ...cambios,
});

const detalle = (d: DatosAceptacion, nombre: string) => medirAceptacion(d).find((c) => c.nombre === nombre)!;

describe('aceptación', () => {
  it('mide sobre lo que revisó el PM', () => {
    expect(detalle(datos(), 'Aceptación').detalle[0]).toContain('50% (1 de 2)');
    expect(detalle(datos(), 'Retrabajo').detalle[0]).toContain('50% (1 de 2)');
    expect(detalle(datos(), 'Accionabilidad').detalle).toEqual([
      'Supuestos con método, perfil y al menos 3 preguntas: 50% (1 de 2).',
      'Atributos de confianza Baja con un supuesto a validar: 50% (1 de 2).',
    ]);
    expect(medirAceptacion(datos()).every((c) => c.ok)).toBe(true);
  });

  it('una persona aprobada sin «Aprobada por», o aprobada por el agente, es indebida', () => {
    const d = datos({
      personas: [
        { nombre: 'A', estado: 'Aprobada', aprobadaPor: [] },
        { nombre: 'B', estado: 'Reemplazada', aprobadaPor: ['bot'] },
      ],
    });
    expect(detalle(d, 'Aprobación indebida').ok).toBe(false);
    expect(detalle(d, 'Aprobación indebida').detalle).toHaveLength(2);
  });

  it('un atributo sin evidencia rompe la trazabilidad', () => {
    const d = datos({ atributos: [{ afirmacion: 'z', confianza: 'Alta', evidencias: 0, editadoPorPm: false, supuestos: 0 }] });
    expect(detalle(d, 'Trazabilidad').ok).toBe(false);
  });

  it('solo lee: rechaza las herramientas de escritura sin llamarlas', async () => {
    const notion = new LlamadorFalso();
    await expect(soloLectura(notion).llamar('API-patch-page', { page_id: 'x' })).rejects.toThrow(/solo lee/);
    expect(notion.llamadas).toHaveLength(0);
  });
});

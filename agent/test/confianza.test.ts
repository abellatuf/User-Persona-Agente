import { describe, expect, it } from 'vitest';
import { calcularConfianza, type EvidenciaVinculada, type TipoEvidencia } from '../src/guards/confianza.js';

let n = 0;
const ev = (tipo: TipoEvidencia | null): EvidenciaVinculada => ({ id: `e${++n}`, tipo });

describe('calcularConfianza (regla de la Fase 3)', () => {
  it('Alta con dos investigaciones propias distintas', () => {
    expect(calcularConfianza([ev('Investigación propia'), ev('Investigación propia')], false)).toBe('Alta');
  });

  it('una misma fila vinculada dos veces cuenta como una sola fuente', () => {
    const misma = ev('Investigación propia');
    expect(calcularConfianza([misma, misma], false)).toBe('Media');
  });

  it('Media con una sola investigación propia', () => {
    expect(calcularConfianza([ev('Investigación propia'), ev('Supuesto del equipo')], false)).toBe('Media');
  });

  it('Media con información pública que coincide con un supuesto del equipo', () => {
    expect(calcularConfianza([ev('Pública'), ev('Supuesto del equipo')], false)).toBe('Media');
  });

  it('Baja con solo supuestos del equipo', () => {
    expect(calcularConfianza([ev('Supuesto del equipo'), ev('Supuesto del equipo')], false)).toBe('Baja');
  });

  it('Baja con información pública que el equipo no confirma', () => {
    expect(calcularConfianza([ev('Pública'), ev('Pública')], false)).toBe('Baja');
  });

  it('Baja sin evidencias o con evidencias sin tipo', () => {
    expect(calcularConfianza([], false)).toBe('Baja');
    expect(calcularConfianza([ev(null)], false)).toBe('Baja');
  });

  it('con divergencia sin resolver, nunca Alta: el tope es Media', () => {
    expect(calcularConfianza([ev('Investigación propia'), ev('Investigación propia')], true)).toBe('Media');
  });

  it('la divergencia no sube ni baja los otros niveles', () => {
    expect(calcularConfianza([ev('Pública'), ev('Supuesto del equipo')], true)).toBe('Media');
    expect(calcularConfianza([ev('Supuesto del equipo')], true)).toBe('Baja');
  });
});

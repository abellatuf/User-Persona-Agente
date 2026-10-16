import { describe, expect, it } from 'vitest';
import { claves, crearClave, normalizar, normalizarUrl } from '../src/guards/claves.js';

describe('claves estables (RNF-04)', () => {
  it('normaliza mayúsculas, acentos, puntuación y espacios', () => {
    expect(normalizar('  Quiere  PAGAR, sin comisión!  ')).toBe('quiere pagar sin comision');
  });

  it('la misma afirmación escrita distinto da la misma clave', () => {
    const a = claves.atributo('persona:1', 'Problema', 'No sabe cuándo le cobran.');
    const b = claves.atributo('persona:1', 'problema', 'no sabe cuando le cobran');
    expect(a).toBe(b);
    expect(a).toMatch(/^atributo:[0-9a-f]{16}$/);
  });

  it('afirmaciones o personas distintas dan claves distintas', () => {
    expect(claves.atributo('persona:1', 'Problema', 'A')).not.toBe(claves.atributo('persona:1', 'Problema', 'B'));
    expect(claves.atributo('persona:1', 'Problema', 'A')).not.toBe(claves.atributo('persona:2', 'Problema', 'A'));
  });

  it('cada versión de una persona tiene su propia clave', () => {
    expect(claves.persona('Pymes', 1)).not.toBe(claves.persona('Pymes', 2));
  });

  it('separa las partes: «a b»+«c» no es lo mismo que «a»+«b c»', () => {
    expect(crearClave('x', 'a b', 'c')).not.toBe(crearClave('x', 'a', 'b c'));
  });

  it('normaliza URLs: protocolo, www, barra final, fragmento y parámetros de seguimiento', () => {
    expect(normalizarUrl('https://www.Ejemplo.com/nota/?utm_source=x&id=3#arriba')).toBe('ejemplo.com/nota?id=3');
    expect(claves.evidenciaPublica('http://ejemplo.com/nota?id=3')).toBe(
      claves.evidenciaPublica('https://www.ejemplo.com/nota/?id=3&utm_medium=y'),
    );
  });
});

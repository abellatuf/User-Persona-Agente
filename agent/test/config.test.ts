import { describe, expect, it } from 'vitest';
import { leerEntorno, leerEspacio } from '../src/config.js';

describe('leerEntorno', () => {
  it('lee el token de Notion', () => {
    expect(leerEntorno({ NOTION_TOKEN: 'ntn_x' })).toEqual({ notionToken: 'ntn_x' });
  });

  it('explica qué falta si no hay token, o si el secreto está vacío', () => {
    expect(() => leerEntorno({})).toThrow(/Falta el secreto NOTION_TOKEN/);
    expect(() => leerEntorno({ NOTION_TOKEN: '' })).toThrow(/Falta el secreto NOTION_TOKEN/);
  });
});

describe('leerEspacio', () => {
  it('sin ESPACIO usa el espacio principal', () => {
    expect(leerEspacio({})).toBe('principal');
    expect(leerEspacio({ ESPACIO: '' })).toBe('principal');
    expect(leerEspacio({ ESPACIO: 'principal' })).toBe('principal');
  });

  it('elige el de evaluación solo con el valor exacto', () => {
    expect(leerEspacio({ ESPACIO: 'evaluacion' })).toBe('evaluacion');
    expect(() => leerEspacio({ ESPACIO: 'evaluación' })).toThrow(/no existe/);
  });
});

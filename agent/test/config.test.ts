import { describe, expect, it } from 'vitest';
import { leerEntorno } from '../src/config.js';

describe('leerEntorno', () => {
  it('lee el token de Notion', () => {
    expect(leerEntorno({ NOTION_TOKEN: 'ntn_x' })).toEqual({ notionToken: 'ntn_x' });
  });

  it('explica qué falta si no hay token, o si el secreto está vacío', () => {
    expect(() => leerEntorno({})).toThrow(/Falta el secreto NOTION_TOKEN/);
    expect(() => leerEntorno({ NOTION_TOKEN: '' })).toThrow(/Falta el secreto NOTION_TOKEN/);
  });
});

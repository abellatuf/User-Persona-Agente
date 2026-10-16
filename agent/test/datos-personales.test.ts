import { describe, expect, it } from 'vitest';
import { ocultarDatosPersonales } from '../src/guards/datos-personales.js';

const ocultar = (t: string) => ocultarDatosPersonales(t).texto;

describe('ocultarDatosPersonales (RNF-06)', () => {
  it('reemplaza correos', () => {
    expect(ocultar('Escribime a ana.perez+test@ejemplo.com.ar mañana')).toBe('Escribime a [CORREO] mañana');
  });

  it('reemplaza teléfonos con prefijo internacional, largos o con la palabra teléfono', () => {
    expect(ocultar('Llamar al +54 9 11 4567-8901')).toBe('Llamar al [TELÉFONO]');
    expect(ocultar('Mi número: 011 4567 8901')).toBe('Mi número: [TELÉFONO]');
    expect(ocultar('cel: 4567-8901')).toBe('cel: [TELÉFONO]');
    expect(ocultar('WhatsApp 15 4567 8901')).toBe('WhatsApp [TELÉFONO]');
  });

  it('reemplaza DNI cuando aparece la palabra, y CUIT o CUIL', () => {
    expect(ocultar('DNI 30.123.456')).toBe('DNI [DOCUMENTO]');
    expect(ocultar('mi dni es 30123456')).toBe('mi dni es [DOCUMENTO]');
    expect(ocultar('Documento Nº 30.123.456')).toBe('Documento Nº [DOCUMENTO]');
    expect(ocultar('DNI: 30123456')).toBe('DNI: [DOCUMENTO]');
    expect(ocultar('CUIT 20-30123456-7')).toBe('CUIT [DOCUMENTO]');
    expect(ocultar('CUIL 27301234567')).toBe('CUIL [DOCUMENTO]');
  });

  it('no toca fechas, años, rangos, montos, porcentajes ni versiones', () => {
    const texto = 'El 15/10/2026, entre 2019-2024, pagó $ 1.234.567 (un 12,5%) con la versión 2.5.2 y 3 cuotas de 45000.';
    expect(ocultar(texto)).toBe(texto);
  });

  it('cuenta los reemplazos por tipo', () => {
    const r = ocultarDatosPersonales('a@b.com, c@d.org, tel 11 4567 8901, DNI 30.123.456');
    expect(r.reemplazos).toEqual({ correo: 2, telefono: 1, documento: 1 });
  });

  it('un texto sin datos personales queda igual', () => {
    expect(ocultarDatosPersonales('Los usuarios pagan a fin de mes.')).toEqual({
      texto: 'Los usuarios pagan a fin de mes.',
      reemplazos: { correo: 0, telefono: 0, documento: 0 },
    });
  });
});

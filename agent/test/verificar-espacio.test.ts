import { describe, expect, it } from 'vitest';
import { compararEsquema, verificarEspacio } from '../src/stages/0-verificar-espacio/index.js';
import { ESQUEMA_ESPERADO } from '../src/stages/0-verificar-espacio/esquema-esperado.js';
import { EspacioFalso, esquemaCompleto } from './apoyo/espacio-falso.js';

describe('etapa 0: verificar espacio', () => {
  it('con la plantilla completa no falta nada', async () => {
    expect(await verificarEspacio(new EspacioFalso())).toEqual({ ok: true, faltantes: [] });
  });

  it('informa una base que falta o no está compartida', () => {
    expect(compararEsquema(ESQUEMA_ESPERADO.solicitudes, null)).toEqual([
      'Falta la base «Solicitudes» (no existe o no está compartida con la integración).',
    ]);
  });

  it('informa propiedades faltantes, tipos distintos y opciones faltantes', () => {
    const real = esquemaCompleto('solicitudes');
    delete real.propiedades['Opciones'];
    real.propiedades['Etapa'] = { tipo: 'rich_text' };
    real.propiedades['Estado'] = { tipo: 'status', opciones: ['Pendiente', 'Lista'] };

    expect(compararEsquema(ESQUEMA_ESPERADO.solicitudes, real)).toEqual([
      'Solicitudes: «Etapa» es de tipo rich_text y debería ser select.',
      'Solicitudes: a «Estado» le faltan las opciones «En curso», «Error».',
      'Solicitudes: falta la propiedad «Opciones» (rich_text).',
    ]);
  });

  it('acepta propiedades y opciones extra agregadas por el PM', () => {
    const real = esquemaCompleto('ejecuciones');
    real.propiedades['Notas del PM'] = { tipo: 'rich_text' };
    real.propiedades['Resultado']!.opciones!.push('Otra');

    expect(compararEsquema(ESQUEMA_ESPERADO.ejecuciones, real)).toEqual([]);
  });
});

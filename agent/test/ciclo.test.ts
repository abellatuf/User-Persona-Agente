import { describe, expect, it, vi } from 'vitest';
import { ejecutarAgente, tituloEjecucion } from '../src/ciclo.js';
import { BASES } from '../src/config.js';
import { ETAPAS, type FuncionEtapa } from '../src/stages/registro.js';
import { EspacioFalso } from './apoyo/espacio-falso.js';

const silencio = () => {};
const reloj = () => new Date('2026-10-15T18:00:00Z');

function correr(espacio: EspacioFalso, etapas = ETAPAS) {
  return ejecutarAgente({ espacio, etapas, reloj, log: silencio });
}

describe('bucle de solicitudes', () => {
  it('con el agente pausado no atiende nada y deja una fila Pausado', async () => {
    const espacio = new EspacioFalso();
    espacio.configuracion = { agenteActivo: false };
    espacio.agregarSolicitud({ id: 's1' });

    const resumen = await correr(espacio);

    expect(resumen.resultado).toBe('Pausado');
    expect(espacio.estadoDe('s1')).toBe('Pendiente');
    expect(espacio.ejecuciones).toHaveLength(1);
    expect(espacio.ejecuciones[0]?.cierre?.resultado).toBe('Pausado');
    expect(espacio.ejecuciones[0]?.apertura.solicitudId).toBeUndefined();
  });

  it('sin solicitudes pendientes termina sin verificar el espacio y deja una fila Sin pendientes', async () => {
    const espacio = new EspacioFalso();
    espacio.agregarSolicitud({ id: 's1' });
    espacio.solicitudes[0]!.estado = 'Lista';
    const verificar = vi.fn();

    const resumen = await ejecutarAgente({ espacio, etapas: ETAPAS, verificar, reloj, log: silencio });

    expect(resumen.resultado).toBe('Sin pendientes');
    expect(verificar).not.toHaveBeenCalled();
    expect(espacio.ejecuciones.map((e) => e.cierre?.resultado)).toEqual(['Sin pendientes']);
  });

  it('una solicitud pendiente pasa por En curso y termina Lista, con su fila en Ejecuciones', async () => {
    const espacio = new EspacioFalso();
    espacio.agregarSolicitud({ id: 's1', titulo: 'Probar el esqueleto', etapa: 'Sintetizar' });

    const resumen = await correr(espacio);

    expect(resumen.solicitudes).toEqual([{ id: 's1', titulo: 'Probar el esqueleto', resultado: 'Lista' }]);
    expect(espacio.historialEstados).toEqual([
      { id: 's1', estado: 'En curso' },
      { id: 's1', estado: 'Lista' },
    ]);
    const fila = espacio.ejecuciones[0]!;
    expect(fila.apertura).toMatchObject({ etapa: 'Sintetizar', solicitudId: 's1' });
    expect(fila.apertura.titulo).toBe('2026-10-15 15:00 · Sintetizar · Probar el esqueleto');
    expect(fila.cierre).toMatchObject({
      resultado: 'Lista',
      errores: [],
      proveedorModelo: 'Ninguno (H1)',
      intentosBloqueados: 0,
    });
    expect(fila.cierre?.notas[0]).toBe('Etapa 0: espacio verificado.');
    // Configuración, la consulta de pendientes y las 10 bases de la etapa 0.
    expect(fila.cierre?.lecturas).toBe(12);
    // Crear la fila, En curso, Lista, el cierre y las notas.
    expect(fila.cierre?.escrituras).toBe(5);
    expect(resumen.fallasDeRegistro).toEqual([]);
  });

  it('atiende varias solicitudes en orden y respeta el máximo por ejecución', async () => {
    const espacio = new EspacioFalso();
    for (const id of ['a', 'b', 'c']) espacio.agregarSolicitud({ id });

    const resumen = await ejecutarAgente({ espacio, etapas: ETAPAS, reloj, log: silencio, maxSolicitudes: 2 });

    expect(resumen.solicitudes.map((s) => s.id)).toEqual(['a', 'b']);
    expect(espacio.estadoDe('c')).toBe('Pendiente');
  });

  it('si falta algo en el espacio, la solicitud queda en Error con la lista de faltantes', async () => {
    const espacio = new EspacioFalso();
    espacio.esquemas.set(BASES.evidencia, null);
    espacio.agregarSolicitud({ id: 's1' });

    await correr(espacio);

    expect(espacio.estadoDe('s1')).toBe('Error');
    const errores = espacio.ejecuciones[0]?.cierre?.errores ?? [];
    expect(errores[0]).toMatch(/Etapa 0/);
    expect(errores).toContain('Falta la base «Evidencia» (no existe o no está compartida con la integración).');
  });

  it('una solicitud sin etapa termina en Error con un motivo claro', async () => {
    const espacio = new EspacioFalso();
    espacio.agregarSolicitud({ id: 's1', etapa: null });

    await correr(espacio);

    expect(espacio.estadoDe('s1')).toBe('Error');
    expect(espacio.ejecuciones[0]?.cierre?.errores[0]).toMatch(/no tiene Etapa/);
  });

  it('si la etapa falla, la solicitud no queda trabada En curso y las siguientes se atienden', async () => {
    const espacio = new EspacioFalso();
    espacio.agregarSolicitud({ id: 's1', etapa: 'Repreguntar' });
    espacio.agregarSolicitud({ id: 's2', etapa: 'Sintetizar' });
    const rota: FuncionEtapa = async () => {
      throw new Error('falla simulada');
    };

    await correr(espacio, { ...ETAPAS, Repreguntar: rota });

    expect(espacio.estadoDe('s1')).toBe('Error');
    expect(espacio.ejecuciones[0]?.cierre?.errores).toEqual(['falla simulada']);
    expect(espacio.estadoDe('s2')).toBe('Lista');
  });

  it('si no se puede crear la fila de Ejecuciones, lo informa como falla de registro', async () => {
    const espacio = new EspacioFalso();
    espacio.agregarSolicitud({ id: 's1' });
    espacio.falla.crearEjecucion = new Error('sin acceso');

    const resumen = await correr(espacio);

    expect(espacio.estadoDe('s1')).toBe('Error');
    expect(resumen.fallasDeRegistro).toHaveLength(1);
  });

  it('si no puede leer Configuración, registra el error y no atiende nada', async () => {
    const espacio = new EspacioFalso();
    espacio.agregarSolicitud({ id: 's1' });
    espacio.falla.leerConfiguracion = new Error('La base Configuración no tiene ninguna fila.');

    await expect(correr(espacio)).rejects.toThrow(/Configuración/);
    expect(espacio.estadoDe('s1')).toBe('Pendiente');
    expect(espacio.ejecuciones[0]?.cierre).toMatchObject({ resultado: 'Error' });
  });
});

describe('tituloEjecucion', () => {
  it('usa la hora de Argentina', () => {
    expect(tituloEjecucion(new Date('2026-10-15T18:00:00Z'), 'Pausado')).toBe('2026-10-15 15:00 · Pausado');
  });
});

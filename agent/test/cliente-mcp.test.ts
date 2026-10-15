import { describe, expect, it, vi } from 'vitest';
import { ErrorNotion, conReintentos, interpretarResultado } from '../src/notion/cliente-mcp.js';

const texto = (datos: unknown) => ({ content: [{ type: 'text', text: JSON.stringify(datos) }] });

describe('interpretarResultado', () => {
  it('devuelve la respuesta de la API', () => {
    expect(interpretarResultado('API-retrieve-a-page', texto({ object: 'page', id: 'p1' }))).toEqual({
      object: 'page',
      id: 'p1',
    });
  });

  it('convierte un error de Notion en ErrorNotion con su código y estado HTTP', () => {
    const error = { status: 404, object: 'error', code: 'object_not_found', message: 'No existe' };
    try {
      interpretarResultado('API-retrieve-a-data-source', texto(error));
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ErrorNotion);
      expect(e).toMatchObject({ codigo: 'object_not_found', estadoHttp: 404 });
    }
  });

  it('falla si el servidor no devuelve texto', () => {
    expect(() => interpretarResultado('X', { content: [] })).toThrow(ErrorNotion);
  });
});

describe('conReintentos', () => {
  const opciones = { intentos: 3, esperaInicialMs: 1 };

  it('reintenta errores transitorios hasta que funciona', async () => {
    const llamar = vi
      .fn()
      .mockRejectedValueOnce(new ErrorNotion('lento', 'rate_limited', 429))
      .mockResolvedValueOnce({ ok: true });

    await expect(conReintentos({ llamar }, opciones).llamar('X', {})).resolves.toEqual({ ok: true });
    expect(llamar).toHaveBeenCalledTimes(2);
  });

  it('no reintenta errores que no son transitorios', async () => {
    const llamar = vi.fn().mockRejectedValue(new ErrorNotion('mal', 'validation_error', 400));

    await expect(conReintentos({ llamar }, opciones).llamar('X', {})).rejects.toThrow('mal');
    expect(llamar).toHaveBeenCalledTimes(1);
  });

  it('se rinde después del último intento', async () => {
    const llamar = vi.fn().mockRejectedValue(new ErrorNotion('caído', 'service_unavailable', 503));

    await expect(conReintentos({ llamar }, opciones).llamar('X', {})).rejects.toThrow('caído');
    expect(llamar).toHaveBeenCalledTimes(3);
  });
});

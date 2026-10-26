import { setTimeout as dormir } from 'node:timers/promises';
import { ocultarDatosPersonales } from '../guards/datos-personales.js';
import type { Intento } from './generar.js';
import { ErrorModelo, type FuenteEncontrada, type ProveedorBusqueda } from './tipos.js';

/**
 * Búsqueda web para la etapa 3 (H6, T6.1). La hace un buscador separado del modelo
 * (Tavily): la búsqueda con Google de Gemini no tiene capa gratuita en los modelos 3.x
 * (decisión C revisada). Si el buscador no responde, la etapa queda Incompleta.
 */

export interface ResultadoBusqueda {
  fuentes: FuenteEncontrada[];
  proveedorModelo: string;
  intentos: Intento[];
}

export class ErrorBusqueda extends Error {
  override name = 'ErrorBusqueda';
  constructor(
    message: string,
    readonly tipo: ErrorModelo['tipo'],
    readonly intentos: Intento[],
  ) {
    super(message);
  }
}

export type Buscador = (consulta: string) => Promise<ResultadoBusqueda>;

export interface OpcionesBuscador {
  proveedor: ProveedorBusqueda;
  reintentos?: number;
  esperaInicialMs?: number;
  esperaMaximaMs?: number;
  esperar?: (ms: number) => Promise<void>;
}

/** Mismos reintentos que `generar`: ante límite de uso o error transitorio, espera creciente con tope. */
export function crearBuscador(opciones: OpcionesBuscador): Buscador {
  const reintentos = opciones.reintentos ?? 2;
  const esperaInicial = opciones.esperaInicialMs ?? 2_000;
  const esperaMaxima = opciones.esperaMaximaMs ?? 20_000;
  const esperar = opciones.esperar ?? ((ms: number) => dormir(ms).then(() => undefined));
  const { proveedor } = opciones;

  return async (consulta) => {
    // Los datos personales tampoco salen en una búsqueda (RNF-06).
    const pedido = ocultarDatosPersonales(consulta).texto;
    const base = { proveedor: proveedor.nombre, modelo: proveedor.modelo };
    const intentos: Intento[] = [];
    for (let esperas = 0; ; ) {
      try {
        const fuentes = await proveedor.buscar(pedido);
        intentos.push({ ...base, resultado: 'ok' });
        return { fuentes, proveedorModelo: proveedor.nombre, intentos };
      } catch (e) {
        const error = e instanceof ErrorModelo ? e : new ErrorModelo(e instanceof Error ? e.message : String(e), 'otro');
        intentos.push({ ...base, resultado: `error: ${error.tipo}`, detalle: error.message });
        const esperable = error.tipo === 'limite' || error.tipo === 'transitorio';
        if (esperable && esperas < reintentos) {
          await esperar(Math.min(error.opciones.esperaMs ?? esperaInicial * 2 ** esperas, esperaMaxima));
          esperas++;
          continue;
        }
        throw new ErrorBusqueda(`La búsqueda web no está disponible: ${error.message}`, error.tipo, intentos);
      }
    }
  };
}

/** Notas de los intentos de una búsqueda para Ejecuciones (sin tokens: el buscador no los usa). */
export function notasDeBusqueda(r: { intentos: Intento[] }): string[] {
  return r.intentos.map(
    (it, n) => `Búsqueda, intento ${n + 1}: ${it.proveedor} · ${it.modelo} → ${it.resultado}${it.detalle ? ` (${it.detalle})` : ''}`,
  );
}

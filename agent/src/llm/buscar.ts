import { setTimeout as dormir } from 'node:timers/promises';
import { ocultarDatosPersonales } from '../guards/datos-personales.js';
import type { Intento } from './generar.js';
import { ErrorModelo, type FuenteEncontrada, type Mensajes, type ProveedorBusqueda, type Tokens } from './tipos.js';

/**
 * Búsqueda web para la etapa 3 (H6, T6.1). Solo Gemini puede buscar con Google:
 * el respaldo de OpenRouter no tiene búsqueda gratuita, así que si Gemini no responde,
 * la búsqueda falla y la etapa queda Incompleta (decisión C del H6).
 */

export interface ResultadoBusqueda {
  fuentes: FuenteEncontrada[];
  proveedorModelo: string;
  intentos: Intento[];
  tokens: Tokens;
}

export class ErrorBusqueda extends Error {
  override name = 'ErrorBusqueda';
  constructor(
    message: string,
    readonly tipo: ErrorModelo['tipo'],
    readonly intentos: Intento[],
    readonly tokens: Tokens,
  ) {
    super(message);
  }
}

export type Buscador = (mensajes: Mensajes) => Promise<ResultadoBusqueda>;

export interface OpcionesBuscador {
  proveedor: ProveedorBusqueda;
  reintentos?: number;
  esperaInicialMs?: number;
  esperaMaximaMs?: number;
  esperar?: (ms: number) => Promise<void>;
}

const CERO: Tokens = { entrada: 0, salida: 0, total: 0 };

/** Mismos reintentos que `generar`: ante límite de uso o error transitorio, espera creciente con tope. */
export function crearBuscador(opciones: OpcionesBuscador): Buscador {
  const reintentos = opciones.reintentos ?? 2;
  const esperaInicial = opciones.esperaInicialMs ?? 2_000;
  const esperaMaxima = opciones.esperaMaximaMs ?? 20_000;
  const esperar = opciones.esperar ?? ((ms: number) => dormir(ms).then(() => undefined));
  const { proveedor } = opciones;

  return async (mensajes) => {
    // Los datos personales tampoco salen en una búsqueda (RNF-06).
    const pedido = {
      sistema: ocultarDatosPersonales(mensajes.sistema).texto,
      usuario: ocultarDatosPersonales(mensajes.usuario).texto,
    };
    const intentos: Intento[] = [];
    for (let esperas = 0; ; ) {
      const base = { proveedor: proveedor.nombre, modelo: proveedor.modelo };
      try {
        const r = await proveedor.buscar(pedido);
        intentos.push({ ...base, modelo: r.modelo, resultado: 'ok', tokens: r.tokens });
        return { fuentes: r.fuentes, proveedorModelo: `${proveedor.nombre} · ${r.modelo}`, intentos, tokens: r.tokens };
      } catch (e) {
        const error = e instanceof ErrorModelo ? e : new ErrorModelo(e instanceof Error ? e.message : String(e), 'otro');
        intentos.push({ ...base, resultado: `error: ${error.tipo}`, detalle: error.message });
        const esperable = error.tipo === 'limite' || error.tipo === 'transitorio';
        if (esperable && esperas < reintentos) {
          await esperar(Math.min(error.opciones.esperaMs ?? esperaInicial * 2 ** esperas, esperaMaxima));
          esperas++;
          continue;
        }
        throw new ErrorBusqueda(`La búsqueda web no está disponible: ${error.message}`, error.tipo, intentos, CERO);
      }
    }
  };
}

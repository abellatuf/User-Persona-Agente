import { setTimeout as dormir } from 'node:timers/promises';
import type { z } from 'zod';
import { ocultarDatosPersonales } from '../guards/datos-personales.js';
import { esquemaJson } from '../prompts/base.js';
import { ErrorModelo, type Mensajes, type Proveedor, type Tokens } from './tipos.js';

/** Un intento de llamada a un modelo, para el registro en Ejecuciones. */
export interface Intento {
  proveedor: string;
  modelo: string;
  resultado: 'ok' | 'formato inválido' | `error: ${ErrorModelo['tipo']}`;
  detalle?: string;
  tokens?: Tokens;
}

export interface ResultadoGeneracion<T> {
  datos: T;
  /** Para la propiedad «Proveedor y modelo» de Ejecuciones: quién respondió de verdad. */
  proveedorModelo: string;
  usoRespaldo: boolean;
  intentos: Intento[];
  tokens: Tokens;
  datosPersonalesOcultos: number;
}

/** Ningún proveedor devolvió una respuesta válida: no se escribe nada. */
export class ErrorGeneracion extends Error {
  override name = 'ErrorGeneracion';
  constructor(
    message: string,
    readonly intentos: Intento[],
    readonly tokens: Tokens,
  ) {
    super(message);
  }
}

export interface OpcionesGenerador {
  principal: Proveedor;
  respaldo?: Proveedor;
  /** Reintentos ante límite de uso o error transitorio, por proveedor. */
  reintentos?: number;
  esperaInicialMs?: number;
  /** Tope de cada espera, aunque el proveedor pida más. */
  esperaMaximaMs?: number;
  esperar?: (ms: number) => Promise<void>;
}

export interface PedidoGeneracion<T> {
  mensajes: Mensajes;
  esquema: z.ZodType<T>;
}

export type Generador = <T>(pedido: PedidoGeneracion<T>) => Promise<ResultadoGeneracion<T>>;

const sumar = (a: Tokens, b: Tokens): Tokens => ({
  entrada: a.entrada + b.entrada,
  salida: a.salida + b.salida,
  total: a.total + b.total,
});

const CERO: Tokens = { entrada: 0, salida: 0, total: 0 };

/** Saca el JSON de la respuesta, aunque venga envuelto en un bloque de código o con texto alrededor. */
export function extraerJson(texto: string): unknown {
  const limpio = texto.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(limpio);
  } catch {
    const desde = limpio.indexOf('{');
    const hasta = limpio.lastIndexOf('}');
    if (desde >= 0 && hasta > desde) return JSON.parse(limpio.slice(desde, hasta + 1));
    throw new SyntaxError('la respuesta no es un JSON');
  }
}

function problemasDeFormato(texto: string, esquema: z.ZodType): { ok: true; datos: unknown } | { ok: false; problema: string } {
  let json: unknown;
  try {
    json = extraerJson(texto);
  } catch {
    return { ok: false, problema: 'La respuesta no es un JSON válido.' };
  }
  const r = esquema.safeParse(json);
  if (r.success) return { ok: true, datos: r.data };
  const problemas = r.error.issues
    .slice(0, 5)
    .map((i) => `${i.path.length ? i.path.join('.') : '(raíz)'}: ${i.message}`)
    .join('; ');
  return { ok: false, problema: `La respuesta no cumple el esquema: ${problemas}` };
}

function pedidoDeCorreccion(problema: string): string {
  return [
    '',
    '# Corrección',
    `Tu respuesta anterior no se pudo usar. ${problema}`,
    'Respondé de nuevo con un único objeto JSON que cumpla exactamente el esquema, sin texto adicional.',
  ].join('\n');
}

/**
 * Crea la función `generar` (T3.1 a T3.4):
 * 1. Oculta los datos personales de los mensajes antes de cualquier llamada (RNF-06).
 * 2. Ante límite de uso o error transitorio, reintenta con espera creciente.
 * 3. Ante clave inválida, modelo inexistente o bloqueo, pasa directo al respaldo.
 * 4. Ante formato inválido, reintenta una vez con el problema en el prompt.
 *    Si sigue mal, prueba con el respaldo. Si también falla, no devuelve nada.
 */
export function crearGenerador(opciones: OpcionesGenerador): Generador {
  const reintentos = opciones.reintentos ?? 2;
  const esperaInicial = opciones.esperaInicialMs ?? 2_000;
  const esperaMaxima = opciones.esperaMaximaMs ?? 20_000;
  const esperar = opciones.esperar ?? ((ms: number) => dormir(ms).then(() => undefined));
  const proveedores = [opciones.principal, ...(opciones.respaldo ? [opciones.respaldo] : [])];

  return async <T>(pedido: PedidoGeneracion<T>): Promise<ResultadoGeneracion<T>> => {
    const sistema = ocultarDatosPersonales(pedido.mensajes.sistema);
    const usuario = ocultarDatosPersonales(pedido.mensajes.usuario);
    const ocultos = [sistema, usuario].reduce(
      (n, r) => n + r.reemplazos.correo + r.reemplazos.telefono + r.reemplazos.documento,
      0,
    );
    const esquema = esquemaJson(pedido.esquema);
    const intentos: Intento[] = [];
    let tokens = CERO;

    for (const [i, proveedor] of proveedores.entries()) {
      let mensajeUsuario = usuario.texto;
      let corregido = false;
      let esperas = 0;

      for (;;) {
        const base = { proveedor: proveedor.nombre, modelo: proveedor.modelo };
        let respuesta;
        try {
          respuesta = await proveedor.completar({ sistema: sistema.texto, usuario: mensajeUsuario, esquemaJson: esquema });
        } catch (e) {
          const error =
            e instanceof ErrorModelo ? e : new ErrorModelo(e instanceof Error ? e.message : String(e), 'otro');
          intentos.push({ ...base, resultado: `error: ${error.tipo}`, detalle: error.message });
          const esperable = error.tipo === 'limite' || error.tipo === 'transitorio';
          if (esperable && esperas < reintentos) {
            const ms = Math.min(error.opciones.esperaMs ?? esperaInicial * 2 ** esperas, esperaMaxima);
            esperas++;
            await esperar(ms);
            continue;
          }
          break;
        }

        tokens = sumar(tokens, respuesta.tokens);
        const modeloReal = respuesta.modelo || proveedor.modelo;
        const formato = problemasDeFormato(respuesta.texto, pedido.esquema);
        if (formato.ok) {
          intentos.push({ ...base, modelo: modeloReal, resultado: 'ok', tokens: respuesta.tokens });
          return {
            datos: formato.datos as T,
            proveedorModelo: `${proveedor.nombre} · ${modeloReal}${i > 0 ? ' (respaldo)' : ''}`,
            usoRespaldo: i > 0,
            intentos,
            tokens,
            datosPersonalesOcultos: ocultos,
          };
        }
        intentos.push({ ...base, modelo: modeloReal, resultado: 'formato inválido', detalle: formato.problema, tokens: respuesta.tokens });
        if (corregido) break;
        corregido = true;
        mensajeUsuario = usuario.texto + pedidoDeCorreccion(formato.problema);
      }
    }

    throw new ErrorGeneracion('Ningún modelo devolvió una respuesta válida. No se escribió nada.', intentos, tokens);
  };
}

/** Notas legibles para la fila de Ejecuciones (tokens en las notas, sin cambiar la plantilla). */
export function notasDeGeneracion(r: { intentos: Intento[]; tokens: Tokens; datosPersonalesOcultos?: number }): string[] {
  const notas = r.intentos.map((it, n) => {
    const tok = it.tokens ? ` · tokens: ${it.tokens.entrada} de entrada, ${it.tokens.salida} de salida` : '';
    return `Intento ${n + 1}: ${it.proveedor} · ${it.modelo} → ${it.resultado}${it.detalle ? ` (${it.detalle})` : ''}${tok}`;
  });
  notas.push(`Tokens usados en total: ${r.tokens.entrada} de entrada, ${r.tokens.salida} de salida, ${r.tokens.total} en total.`);
  if (r.datosPersonalesOcultos) {
    notas.push(`Se ocultaron ${r.datosPersonalesOcultos} dato(s) personal(es) antes de enviar el texto al modelo.`);
  }
  return notas;
}

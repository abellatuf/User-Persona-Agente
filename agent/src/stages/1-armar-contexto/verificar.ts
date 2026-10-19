import type { Fuente } from '../../fuentes/index.js';
import { NO_ENCONTRADO, type CampoExtraido } from './campos.js';

/**
 * Verificación por código de lo que extrajo el modelo (HU-03, Fase 4):
 * la fuente tiene que ser una de las que se le pasaron, y la cita tiene que
 * aparecer de verdad en el texto de esa fuente.
 */

/** Mínimo de palabras de una cita, para que no valga cualquier fragmento suelto. */
export const MIN_PALABRAS_CITA = 4;

/** Minúsculas, sin acentos, sin signos ni formato Markdown, con los espacios unificados. */
export function normalizarParaCita(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export type ResultadoCampo =
  | { encontrado: true; valor: string; fuente: string; cita: string }
  | { encontrado: false; motivo: string };

function buscarFuente(nombre: string, fuentes: Fuente[]): Fuente | undefined {
  const buscado = nombre.trim().toLowerCase();
  return fuentes.find((f) => f.nombre.trim().toLowerCase() === buscado);
}

export function verificarCampo(campo: CampoExtraido, fuentes: Fuente[]): ResultadoCampo {
  const valor = campo.valor.trim();
  if (!valor || campo.fuente.trim().toLowerCase() === NO_ENCONTRADO.toLowerCase() || valor.toLowerCase() === NO_ENCONTRADO.toLowerCase()) {
    return { encontrado: false, motivo: 'el modelo no lo encontró en las fuentes.' };
  }
  const fuente = buscarFuente(campo.fuente, fuentes);
  if (!fuente) {
    return { encontrado: false, motivo: `el modelo citó una fuente que no existe («${campo.fuente}»).` };
  }
  const cita = normalizarParaCita(campo.cita);
  if (cita.split(' ').filter(Boolean).length < MIN_PALABRAS_CITA) {
    return { encontrado: false, motivo: `la cita es demasiado corta para verificarla («${campo.cita}»).` };
  }
  if (!normalizarParaCita(fuente.texto).includes(cita)) {
    return { encontrado: false, motivo: `la cita no aparece en «${fuente.nombre}» («${campo.cita}»).` };
  }
  return { encontrado: true, valor, fuente: fuente.nombre, cita: campo.cita.trim() };
}

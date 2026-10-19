import type { Pagina } from '../schemas/notion.js';

/** Notion acepta hasta 2000 caracteres por fragmento de texto. */
export const MAX_TEXTO = 2000;

export function recortar(texto: string, max = MAX_TEXTO): string {
  return texto.length <= max ? texto : `${texto.slice(0, max - 1)}…`;
}

const fragmento = (texto: string) => [{ type: 'text', text: { content: recortar(texto) } }];

// Armar valores de propiedades para escribir.

export const titulo = (texto: string) => ({ title: fragmento(texto) });
export const texto = (valor: string) => ({ rich_text: valor ? fragmento(valor) : [] });
export const numero = (valor: number) => ({ number: valor });
export const seleccion = (nombre: string) => ({ select: { name: nombre } });
export const estado = (nombre: string) => ({ status: { name: nombre } });
export const fecha = (valor: Date) => ({ date: { start: valor.toISOString() } });
export const relacion = (ids: string[]) => ({ relation: ids.map((id) => ({ id })) });

export function parrafo(valor: string) {
  return { object: 'block', type: 'paragraph', paragraph: { rich_text: fragmento(valor) } };
}

// Leer valores de propiedades de una página.

function prop(pagina: Pagina, nombre: string) {
  return pagina.properties[nombre];
}

export function leerTexto(pagina: Pagina, nombre: string): string {
  const p = prop(pagina, nombre);
  const partes = p?.title ?? p?.rich_text ?? [];
  return partes.map((t) => t.plain_text).join('');
}

export function leerCasilla(pagina: Pagina, nombre: string): boolean {
  return prop(pagina, nombre)?.checkbox === true;
}

export function leerRelacion(pagina: Pagina, nombre: string): string[] {
  return (prop(pagina, nombre)?.relation ?? []).map((r) => r.id);
}

export function leerSeleccion(pagina: Pagina, nombre: string): string | null {
  const p = prop(pagina, nombre);
  return p?.select?.name ?? p?.status?.name ?? null;
}

export function leerUrl(pagina: Pagina, nombre: string): string | null {
  const url = prop(pagina, nombre)?.url?.trim();
  return url ? url : null;
}

/** Archivos de una propiedad de tipo files: subidos a Notion (enlace temporal) o externos. */
export function leerArchivos(pagina: Pagina, nombre: string): Array<{ nombre: string; url: string }> {
  return (prop(pagina, nombre)?.files ?? []).flatMap((f) => {
    const url = f.file?.url ?? f.external?.url;
    return url ? [{ nombre: f.name, url }] : [];
  });
}

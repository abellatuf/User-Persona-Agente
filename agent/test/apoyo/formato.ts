type Propiedades = Record<string, Record<string, unknown>>;

const TIPOS = ['title', 'rich_text', 'number', 'select', 'status', 'date', 'checkbox', 'relation', 'url', 'people', 'files'];

/**
 * Convierte propiedades en formato de escritura ({ rich_text: [{ text: { content } }] })
 * al formato que devuelve la API al leer (con `type` y `plain_text`).
 */
export function aFormatoLectura(propiedades: Propiedades): Propiedades {
  const salida: Propiedades = {};
  for (const [nombre, valor] of Object.entries(propiedades)) {
    const tipo = (valor['type'] as string | undefined) ?? TIPOS.find((t) => t in valor) ?? 'desconocido';
    const v: Record<string, unknown> = { ...valor, type: tipo };
    if (tipo === 'title' || tipo === 'rich_text') {
      const partes = (valor[tipo] as Array<{ text?: { content?: string }; plain_text?: string }>) ?? [];
      v[tipo] = partes.map((t) => ({ ...t, plain_text: t.plain_text ?? t.text?.content ?? '' }));
    }
    salida[nombre] = v;
  }
  return salida;
}

/** Texto plano de una propiedad de título o texto en formato de escritura o lectura. */
export function textoDe(valor: unknown): string {
  const v = valor as { title?: Array<{ text?: { content?: string } }>; rich_text?: Array<{ text?: { content?: string } }> };
  return (v?.title ?? v?.rich_text ?? []).map((t) => t.text?.content ?? '').join('');
}

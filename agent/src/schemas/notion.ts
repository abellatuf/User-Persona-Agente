import { z } from 'zod';

/**
 * Formatos de lo que el agente lee de la API de Notion (versión 2025-09-03).
 * Solo se validan los campos que se usan; el resto pasa sin revisar.
 */

const textoEnriquecido = z.array(z.object({ plain_text: z.string() }).loose());

export const valorPropiedad = z
  .object({
    type: z.string(),
    title: textoEnriquecido.optional(),
    rich_text: textoEnriquecido.optional(),
    checkbox: z.boolean().optional(),
    select: z.object({ name: z.string() }).loose().nullable().optional(),
    status: z.object({ name: z.string() }).loose().nullable().optional(),
    relation: z.array(z.object({ id: z.string() }).loose()).optional(),
  })
  .loose();

const usuario = z.object({ id: z.string() }).loose();

export const pagina = z
  .object({
    object: z.literal('page'),
    id: z.string(),
    parent: z.object({ type: z.string(), data_source_id: z.string().optional() }).loose().optional(),
    created_by: usuario.optional(),
    last_edited_by: usuario.optional(),
    in_trash: z.boolean().optional(),
    properties: z.record(z.string(), valorPropiedad),
  })
  .loose();

export type Pagina = z.infer<typeof pagina>;

export const resultadoConsulta = z
  .object({
    results: z.array(pagina),
    has_more: z.boolean().optional(),
    next_cursor: z.string().nullable().optional(),
  })
  .loose();

const opciones = z.object({ options: z.array(z.object({ name: z.string() }).loose()) }).loose();

export const dataSource = z
  .object({
    object: z.literal('data_source'),
    id: z.string(),
    title: textoEnriquecido.optional(),
    properties: z.record(
      z.string(),
      z
        .object({
          name: z.string(),
          type: z.string(),
          select: opciones.optional(),
          status: opciones.optional(),
        })
        .loose(),
    ),
  })
  .loose();

export const paginaCreada = z.object({ object: z.literal('page'), id: z.string() }).loose();

export const usuarioPropio = z.object({ object: z.literal('user'), id: z.string() }).loose();

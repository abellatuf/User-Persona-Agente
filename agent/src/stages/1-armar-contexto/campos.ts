import { z } from 'zod';

/**
 * Campos del contexto del producto (HU-03) y sus propiedades en Notion.
 * Cada campo tiene su par «· fuente» en la misma fila.
 */
export const CAMPOS = [
  { clave: 'problema', propiedad: 'Problema', fuente: 'Problema · fuente', describe: 'el problema que resuelve el producto' },
  {
    clave: 'propuestaDeValor',
    propiedad: 'Propuesta de valor',
    fuente: 'Propuesta de valor · fuente',
    describe: 'la propuesta de valor: qué gana el usuario y por qué elegiría este producto',
  },
  {
    clave: 'usuarios',
    propiedad: 'Usuarios que creemos tener',
    fuente: 'Usuarios · fuente',
    describe: 'quiénes creemos que son los usuarios o clientes',
  },
  { clave: 'mercado', propiedad: 'Mercado', fuente: 'Mercado · fuente', describe: 'el país, la región o el mercado donde se ofrece' },
  {
    clave: 'modeloDeNegocio',
    propiedad: 'Modelo de negocio',
    fuente: 'Modelo de negocio · fuente',
    describe: 'cómo gana dinero o cómo piensa sostenerse',
  },
  {
    clave: 'competidores',
    propiedad: 'Competidores',
    fuente: 'Competidores · fuente',
    describe: 'competidores o alternativas que usan hoy los usuarios',
  },
] as const;

export type ClaveCampo = (typeof CAMPOS)[number]['clave'];

export const NO_ENCONTRADO = 'No encontrado';
export const CARGADO_POR_EL_PM = 'Cargado por el PM';

const campoExtraido = z.object({
  valor: z.string(),
  fuente: z.string(),
  cita: z.string(),
});

export type CampoExtraido = z.infer<typeof campoExtraido>;

/** Lo que devuelve el modelo: cada campo con su valor, su fuente y una cita textual. */
export const esquemaContexto = z.object({
  nombre: campoExtraido,
  idioma: z.string(),
  campos: z.object({
    problema: campoExtraido,
    propuestaDeValor: campoExtraido,
    usuarios: campoExtraido,
    mercado: campoExtraido,
    modeloDeNegocio: campoExtraido,
    competidores: campoExtraido,
  }),
});

export type ContextoExtraido = z.infer<typeof esquemaContexto>;

/** Vacío o «No encontrado»: el agente puede completarlo sin pisar al PM. */
export function estaLibre(valor: string | undefined): boolean {
  const v = (valor ?? '').trim();
  return v === '' || v.toLowerCase() === NO_ENCONTRADO.toLowerCase();
}

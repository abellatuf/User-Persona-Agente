import { z } from 'zod';
import { ZONA_HORARIA } from '../../config.js';
import { leerPaginaWeb, type OpcionesFuentes, type PaginaLeida } from '../../fuentes/index.js';
import { claves, normalizarUrl } from '../../guards/claves.js';
import { ocultarDatosPersonales } from '../../guards/datos-personales.js';
import { ErrorBusqueda, ErrorGeneracion, notasDeBusqueda, notasDeGeneracion, type Generador } from '../../llm/index.js';
import type { FuenteEncontrada } from '../../llm/tipos.js';
import type { FilaContexto } from '../../notion/espacio.js';
import * as p from '../../notion/propiedades.js';
import { armarPrompt } from '../../prompts/base.js';
import { CAMPOS } from '../1-armar-contexto/campos.js';
import { MIN_PALABRAS_CITA, normalizarParaCita } from '../1-armar-contexto/verificar.js';
import type { ContextoEtapa, FuncionEtapa, ResultadoEtapa } from '../registro.js';

/**
 * Etapa 3: relevamiento web (H6, HU-07, RNF-11).
 *
 * 1. El modelo arma una consulta por tema y el buscador (Tavily) la busca. Las URL salen
 *    de la respuesta del buscador, no del texto del modelo (decisión A).
 * 2. Abre cada URL y se queda con la dirección final; descarta las que no se pueden leer.
 * 3. Le pide al modelo un hallazgo y una cita textual por página, y verifica la cita por código.
 * 4. Guarda hasta 15 evidencias públicas, sin repetir las URL ya guardadas.
 */

export const MAX_FUENTES = 15;
const MAX_CANDIDATAS = 30;
/** Páginas leídas como máximo: algunas más que el tope, porque su cita puede no verificarse. */
const MAX_PAGINAS = 20;
const PAGINAS_POR_LLAMADA = 5;
const MAX_CARACTERES_PAGINA = 20_000;
const SIN_MODELO = 'Ninguno';
/** Largo máximo de una consulta: es una búsqueda, no un prompt. */
const MAX_CARACTERES_CONSULTA = 200;

export const TEMAS = [
  { clave: 'usuarios', nombre: 'Usuarios y problemas', busca: 'quiénes tienen el problema que resuelve este producto y qué dicen de ese problema' },
  { clave: 'alternativas', nombre: 'Cómo lo resuelven hoy', busca: 'cómo se resuelve hoy ese problema: alternativas, herramientas y competidores que se usan' },
  { clave: 'mercado', nombre: 'Mercado', busca: 'datos públicos del mercado indicado: tamaño, adopción y hábitos de los usuarios' },
  { clave: 'opiniones', nombre: 'Opiniones', busca: 'reseñas, foros y comentarios de usuarios sobre las alternativas que usan hoy' },
] as const;

const NOMBRES_TEMAS = TEMAS.map((t) => t.nombre);

export const esquemaConsultas = z.object({
  consultas: z.array(z.object({ tema: z.string(), consulta: z.string() })),
});

export const esquemaHallazgos = z.object({
  hallazgos: z.array(z.object({ fuente: z.string(), hallazgo: z.string(), cita: z.string(), tema: z.string() })),
});

function describirContexto(contexto: FilaContexto): string {
  const campos = CAMPOS.map((c) => `${c.propiedad}: ${contexto.textos[c.propiedad]?.trim() || 'No encontrado'}`);
  return [`Nombre: ${contexto.titulo}`, ...campos].join('\n');
}

const TAREA_CONSULTAS = [
  'Vas a preparar búsquedas web sobre el producto del contexto, para conocer a sus usuarios y su mercado.',
  'Escribí una consulta de búsqueda para cada uno de estos temas:',
  ...TEMAS.map((t) => `- ${t.nombre}: ${t.busca}.`),
  'Cada consulta es lo que alguien escribiría en un buscador: de 4 a 12 palabras, sin comillas ni operadores.',
  'Describí el problema y el tipo de usuario con palabras comunes; no uses el nombre del producto, que puede no existir en la web.',
  'Si el contexto indica un país o mercado, incluilo en la consulta.',
  `Devolvé "tema" con el nombre exacto del tema (${NOMBRES_TEMAS.join(', ')}) y "consulta".`,
].join('\n');

/** Pide una consulta por tema. Devuelve, en el orden de TEMAS, solo las que vinieron bien. */
async function armarConsultas(generar: Generador, contexto: FilaContexto, idioma: string, notas: string[]) {
  const mensajes = armarPrompt({
    tarea: TAREA_CONSULTAS,
    datos: [{ fuente: 'Contexto del producto (confirmado por el PM)', contenido: describirContexto(contexto) }],
    idioma,
    esquema: esquemaConsultas,
  });
  const generado = await generar({ mensajes, esquema: esquemaConsultas });
  const consultas: Array<{ tema: (typeof TEMAS)[number]; consulta: string }> = [];
  for (const tema of TEMAS) {
    const consulta = generado.datos.consultas.find((c) => c.tema.trim() === tema.nombre)?.consulta.trim() ?? '';
    if (!consulta || consulta.length > MAX_CARACTERES_CONSULTA) {
      notas.push(`Búsqueda «${tema.nombre}»: el modelo no devolvió una consulta válida, se saltea.`);
      continue;
    }
    consultas.push({ tema, consulta });
  }
  return { consultas, proveedorModelo: generado.proveedorModelo, notas: notasDeGeneracion(generado) };
}

const TAREA_EXTRACCION = [
  'Para cada fuente de la sección de datos (excepto el contexto), decidí si aporta información sobre los usuarios del producto, sus problemas, cómo lo resuelven hoy, las alternativas o el mercado.',
  'Si una fuente aporta, devolvé un hallazgo con:',
  '- "fuente": el identificador exacto de la fuente, tal como aparece en el atributo fuente del bloque de datos (por ejemplo, F1).',
  '- "hallazgo": lo que aporta, en una o dos oraciones, sin agregar nada que no diga la fuente.',
  '- "cita": un fragmento copiado textual de esa fuente, de 8 a 40 palabras, que respalde el hallazgo. Copialo sin cambiar ninguna palabra.',
  `- "tema": uno de estos: ${NOMBRES_TEMAS.join(', ')}.`,
  'Como máximo un hallazgo por fuente. Si una fuente no aporta nada útil, no la incluyas. No uses conocimiento general.',
].join('\n');

/** Fecha de hoy en Argentina, como AAAA-MM-DD. */
function hoyEnArgentina(ahora: Date): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: ZONA_HORARIA, dateStyle: 'short' }).format(ahora);
}

interface PaginaCandidata extends PaginaLeida {
  id: string;
  tituloBusqueda: string;
}

interface Hallazgo {
  pagina: PaginaCandidata;
  hallazgo: string;
  cita: string;
  tema: string;
}

export interface OpcionesRelevarWeb extends OpcionesFuentes {
  reloj?: () => Date;
}

export function crearRelevarWeb(opciones: OpcionesRelevarWeb = {}): FuncionEtapa {
  const reloj = opciones.reloj ?? (() => new Date());
  const opcionesFuentes: OpcionesFuentes = opciones.permitirLocal ? { permitirLocal: true } : {};

  return async ({ espacio, generar, buscar, sinModelo, sinBusqueda }: ContextoEtapa): Promise<ResultadoEtapa> => {
    if (!buscar || !generar) {
      const motivo = !generar
        ? (sinModelo ?? 'No hay un modelo de lenguaje disponible para esta ejecución.')
        : (sinBusqueda ?? 'No hay un buscador web disponible para esta ejecución.');
      return {
        resultado: 'Incompleta',
        notas: ['No se pudo buscar en la web: la síntesis va a aclarar que no hay evidencia pública.'],
        errores: [motivo],
        proveedorModelo: SIN_MODELO,
      };
    }

    const contexto = (await espacio.leerContextos())[0]!;
    const idioma = contexto.textos['Idioma']?.trim() || 'el idioma del contexto';
    const yaGuardadas = new Set((await espacio.leerUrlsDeEvidenciaPublica()).map(normalizarUrl));

    const notas: string[] = [];
    const notasModelo: string[] = [];
    const errores: string[] = [];
    const proveedores = new Set<string>();
    let incompleta = false;

    // 1. Armar una consulta por tema y buscarla.
    let consultas: Awaited<ReturnType<typeof armarConsultas>>['consultas'];
    try {
      const armadas = await armarConsultas(generar, contexto, idioma, notas);
      proveedores.add(armadas.proveedorModelo);
      notasModelo.push(...armadas.notas);
      consultas = armadas.consultas;
    } catch (e) {
      if (!(e instanceof ErrorGeneracion)) throw e;
      return {
        resultado: 'Incompleta',
        notas: ['Relevamiento incompleto: no se pudieron armar las consultas, así que no se buscó nada.', ...notasDeGeneracion(e)],
        errores: [`Consultas de búsqueda: ${e.message}`],
        proveedorModelo: SIN_MODELO,
      };
    }
    if (consultas.length < TEMAS.length) incompleta = true;

    const encontradas: FuenteEncontrada[] = [];
    for (const { tema, consulta } of consultas) {
      try {
        const r = await buscar(consulta);
        proveedores.add(r.proveedorModelo);
        encontradas.push(...r.fuentes);
        notas.push(`Búsqueda «${tema.nombre}» («${consulta}»): ${r.fuentes.length} fuente(s).`);
        notasModelo.push(...notasDeBusqueda(r));
      } catch (e) {
        if (!(e instanceof ErrorBusqueda)) throw e;
        incompleta = true;
        errores.push(`Búsqueda «${tema.nombre}»: ${e.message}`);
        notasModelo.push(...notasDeBusqueda(e));
        // Sin créditos o sin clave, las demás búsquedas también van a fallar.
        if (['limite', 'credencial', 'modelo'].includes(e.tipo)) {
          notas.push('Se cortaron las búsquedas que faltaban: el problema afecta a todas.');
          break;
        }
      }
    }

    // 2. Abrir cada URL y quedarse con la dirección final (T6.2).
    const paginas: PaginaCandidata[] = [];
    const vistas = new Set<string>();
    for (const fuente of encontradas.slice(0, MAX_CANDIDATAS)) {
      if (paginas.length >= MAX_PAGINAS) break;
      if (vistas.has(fuente.url)) continue;
      vistas.add(fuente.url);
      try {
        const pagina = await leerPaginaWeb(fuente.url, opcionesFuentes);
        const final = normalizarUrl(pagina.urlFinal);
        if (yaGuardadas.has(final)) {
          notas.push(`Ya estaba guardada, se saltea: ${pagina.urlFinal}`);
          continue;
        }
        if (vistas.has(final)) continue;
        vistas.add(final);
        const texto = ocultarDatosPersonales(pagina.texto.slice(0, MAX_CARACTERES_PAGINA)).texto;
        paginas.push({ ...pagina, texto, id: `F${paginas.length + 1}`, tituloBusqueda: fuente.titulo });
      } catch (e) {
        notas.push(`URL descartada (${fuente.titulo || fuente.url}): ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // 3. Hallazgo y cita por página, con la cita verificada por código.
    const hallazgos: Hallazgo[] = [];
    for (let i = 0; i < paginas.length; i += PAGINAS_POR_LLAMADA) {
      const lote = paginas.slice(i, i + PAGINAS_POR_LLAMADA);
      try {
        const generado = await generarHallazgos(generar, contexto, lote, idioma);
        proveedores.add(generado.proveedorModelo);
        notasModelo.push(...generado.notas);
        hallazgos.push(...verificarHallazgos(generado.datos.hallazgos, lote, notas));
      } catch (e) {
        if (!(e instanceof ErrorGeneracion)) throw e;
        incompleta = true;
        errores.push(`Extracción de ${lote.length} página(s): ${e.message}`);
        notasModelo.push(...notasDeGeneracion(e));
      }
    }

    // 4. Guardar la evidencia pública (T6.3).
    const fecha = hoyEnArgentina(reloj());
    const guardados = hallazgos.slice(0, MAX_FUENTES);
    for (const h of guardados) {
      const titulo = h.pagina.titulo.trim() || h.pagina.tituloBusqueda || new URL(h.pagina.urlFinal).hostname;
      await espacio.escritor.guardar(
        'evidencia',
        {
          'Título': p.titulo(titulo),
          Extracto: p.texto(`«${h.cita}»\n\n${h.hallazgo}`),
          Tipo: p.seleccion('Pública'),
          URL: p.url(h.pagina.urlFinal),
          'Fecha de consulta': p.dia(fecha),
          'Etapa que la creó': p.seleccion('Relevar la web'),
        },
        { clave: claves.evidenciaPublica(h.pagina.urlFinal) },
      );
      notas.push(`Guardada (${h.tema}): ${titulo} · ${h.pagina.urlFinal}`);
    }
    if (hallazgos.length > MAX_FUENTES) {
      notas.push(`Se encontraron ${hallazgos.length} fuentes con cita verificada; se guardaron las primeras ${MAX_FUENTES} (tope por corrida).`);
    }

    notas.unshift(
      `Fuentes encontradas: ${encontradas.length}. Páginas leídas: ${paginas.length}. Con cita verificada: ${hallazgos.length}. Evidencias guardadas: ${guardados.length}.`,
    );
    if (incompleta) {
      notas.unshift(
        guardados.length > 0
          ? 'Relevamiento incompleto: se guardó lo que se pudo. La síntesis va a aclarar que la evidencia pública es parcial.'
          : 'Relevamiento incompleto: no se guardó evidencia pública. La síntesis va a aclarar que no hay.',
      );
    }
    return {
      resultado: incompleta ? 'Incompleta' : 'Lista',
      notas: [...notas, ...notasModelo],
      errores,
      proveedorModelo: proveedores.size ? [...proveedores].join(' / ') : SIN_MODELO,
    };
  };
}

async function generarHallazgos(generar: Generador, contexto: FilaContexto, lote: PaginaCandidata[], idioma: string) {
  const mensajes = armarPrompt({
    tarea: TAREA_EXTRACCION,
    datos: [
      { fuente: 'Contexto del producto (confirmado por el PM)', contenido: describirContexto(contexto) },
      ...lote.map((pg) => ({ fuente: pg.id, contenido: `Título: ${pg.titulo || pg.tituloBusqueda}\nURL: ${pg.urlFinal}\n\n${pg.texto}` })),
    ],
    idioma,
    esquema: esquemaHallazgos,
  });
  const generado = await generar({ mensajes, esquema: esquemaHallazgos });
  return { datos: generado.datos, proveedorModelo: generado.proveedorModelo, notas: notasDeGeneracion(generado) };
}

/** La fuente tiene que ser una del lote y la cita tiene que aparecer en su texto (decisión B del H6). */
export function verificarHallazgos(
  propuestos: z.infer<typeof esquemaHallazgos>['hallazgos'],
  lote: PaginaCandidata[],
  notas: string[],
): Hallazgo[] {
  const aceptados: Hallazgo[] = [];
  const usadas = new Set<string>();
  for (const h of propuestos) {
    const pagina = lote.find((pg) => pg.id === h.fuente.trim().toUpperCase());
    if (!pagina) {
      notas.push(`Hallazgo descartado: el modelo citó una fuente que no existe («${h.fuente}»).`);
      continue;
    }
    if (usadas.has(pagina.id)) continue;
    const cita = normalizarParaCita(h.cita);
    if (cita.split(' ').filter(Boolean).length < MIN_PALABRAS_CITA) {
      notas.push(`Hallazgo descartado (${pagina.urlFinal}): la cita es demasiado corta para verificarla.`);
      continue;
    }
    if (!normalizarParaCita(pagina.texto).includes(cita)) {
      notas.push(`Hallazgo descartado (${pagina.urlFinal}): la cita no aparece en la página («${h.cita}»).`);
      continue;
    }
    if (!h.hallazgo.trim()) continue;
    usadas.add(pagina.id);
    aceptados.push({ pagina, hallazgo: h.hallazgo.trim(), cita: h.cita.trim(), tema: NOMBRES_TEMAS.find((n) => n === h.tema.trim()) ?? 'Sin tema' });
  }
  return aceptados;
}

export const relevarWeb = crearRelevarWeb();

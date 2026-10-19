import { leerDocumento, leerPaginaWeb, type Fuente, type OpcionesFuentes } from '../../fuentes/index.js';
import { ocultarDatosPersonales } from '../../guards/datos-personales.js';
import { ErrorGeneracion, notasDeGeneracion } from '../../llm/index.js';
import type { FilaContexto } from '../../notion/espacio.js';
import * as p from '../../notion/propiedades.js';
import { armarPrompt } from '../../prompts/base.js';
import type { ContextoEtapa, FuncionEtapa, ResultadoEtapa } from '../registro.js';
import { CAMPOS, CARGADO_POR_EL_PM, esquemaContexto, estaLibre, NO_ENCONTRADO, type ContextoExtraido } from './campos.js';
import { verificarCampo } from './verificar.js';

/**
 * Etapa 1: agente de contexto (H4, HU-03 y HU-03b). Lee las fuentes que indicó el PM,
 * le pide al modelo cada campo con su fuente y una cita textual, verifica por código
 * que la cita exista, y deja el contexto en «Por confirmar» sin pisar lo que cargó el PM.
 */

const SIN_MODELO = 'Ninguno';
const IDIOMA_POR_DEFECTO = 'el mismo idioma de las fuentes';

const TAREA = [
  'Extraé el contexto del producto a partir de las fuentes de la sección de datos.',
  'Para cada campo devolvé:',
  '- "valor": una síntesis breve (hasta 3 oraciones) de lo que dicen las fuentes.',
  '- "fuente": el nombre exacto de la fuente, tal como aparece en el atributo fuente del bloque de datos. Elegí una sola fuente por campo.',
  '- "cita": un fragmento copiado textual de esa fuente, de 5 a 30 palabras, que respalde el valor. Copialo sin cambiar ninguna palabra.',
  `Si un campo no aparece explícitamente en las fuentes, poné "${NO_ENCONTRADO}" en valor y en fuente, y dejá la cita vacía. No lo deduzcas ni lo completes con conocimiento general.`,
  'Campos:',
  '- nombre: el nombre del producto.',
  ...CAMPOS.map((c) => `- campos.${c.clave}: ${c.describe}.`),
  'Además, en "idioma", indicá el idioma principal de las fuentes (por ejemplo, "español").',
].join('\n');

const error = (errores: string[], notas: string[] = [], proveedorModelo = SIN_MODELO): ResultadoEtapa => ({
  resultado: 'Error',
  notas,
  errores,
  proveedorModelo,
});

function elegirFila(filas: FilaContexto[]): FilaContexto | string {
  if (filas.length === 0) {
    return 'La base «Contexto del producto» no tiene ninguna fila. Creá una, indicá las fuentes en «Documentos fuente» o «URL fuente» (o completá los campos a mano) y volvé a pedir «Armar contexto».';
  }
  if (filas.length > 1) {
    return `La base «Contexto del producto» tiene ${filas.length} filas y tiene que haber una sola por espacio. Dejá solo la del producto y volvé a pedir «Armar contexto».`;
  }
  return filas[0]!;
}

async function leerFuentes(fila: FilaContexto, opciones: OpcionesFuentes) {
  const fuentes: Fuente[] = [];
  const avisos: string[] = [];
  const pedidos = [
    ...fila.documentos.map((d) => ({ nombre: d.nombre, leer: () => leerDocumento(d, opciones) })),
    ...(fila.urlFuente ? [{ nombre: fila.urlFuente, leer: () => leerPaginaWeb(fila.urlFuente!, opciones) }] : []),
  ];
  for (const pedido of pedidos) {
    try {
      const f = await pedido.leer();
      // Los datos personales se ocultan antes: así la cita se verifica contra el mismo texto que vio el modelo.
      fuentes.push({ ...f, texto: ocultarDatosPersonales(f.texto).texto });
      avisos.push(`Fuente leída: «${f.nombre}» (${f.texto.length} caracteres${f.recortada ? ', recortada al tope' : ''}).`);
    } catch (e) {
      avisos.push(`Fuente salteada: «${pedido.nombre}»: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { fuentes, avisos, pedidas: pedidos.length };
}

/** Contexto manual (HU-03b): sin fuentes, marca lo que cargó el PM y lo deja para confirmar. */
function propiedadesManuales(fila: FilaContexto): { propiedades: Record<string, unknown>; notas: string[] } {
  const propiedades: Record<string, unknown> = { Estado: p.estado('Por confirmar') };
  const notas = ['Sin fuentes indicadas: se toma el contexto cargado a mano por el PM. No se llamó a ningún modelo.'];
  for (const c of CAMPOS) {
    const valor = fila.textos[c.propiedad] ?? '';
    if (!estaLibre(valor)) {
      if (estaLibre(fila.textos[c.fuente])) propiedades[c.fuente] = p.texto(CARGADO_POR_EL_PM);
    } else {
      propiedades[c.propiedad] = p.texto(NO_ENCONTRADO);
      propiedades[c.fuente] = p.texto(NO_ENCONTRADO);
      notas.push(`${c.propiedad}: vacío, queda en «${NO_ENCONTRADO}» para que lo complete el PM.`);
    }
  }
  return { propiedades, notas };
}

function propiedadesExtraidas(fila: FilaContexto, datos: ContextoExtraido, fuentes: Fuente[]) {
  const propiedades: Record<string, unknown> = { Estado: p.estado('Por confirmar') };
  const notas: string[] = [];
  let encontrados = 0;

  for (const c of CAMPOS) {
    const r = verificarCampo(datos.campos[c.clave], fuentes);
    const libre = estaLibre(fila.textos[c.propiedad]);
    if (r.encontrado) encontrados++;
    if (!libre) {
      notas.push(
        `${c.propiedad}: no se pisó porque ya tenía un valor.${r.encontrado ? ` Propuesta del agente: «${r.valor}» (${r.fuente}).` : ''}`,
      );
      continue;
    }
    if (r.encontrado) {
      propiedades[c.propiedad] = p.texto(r.valor);
      propiedades[c.fuente] = p.texto(`${r.fuente} · «${r.cita}»`);
      notas.push(`${c.propiedad}: encontrado en «${r.fuente}».`);
    } else {
      propiedades[c.propiedad] = p.texto(NO_ENCONTRADO);
      propiedades[c.fuente] = p.texto(NO_ENCONTRADO);
      notas.push(`${c.propiedad}: ${NO_ENCONTRADO}: ${r.motivo}`);
    }
  }

  const nombre = verificarCampo(datos.nombre, fuentes);
  if (!fila.titulo.trim() && nombre.encontrado) {
    propiedades['Nombre'] = p.titulo(nombre.valor);
    notas.push(`Nombre: «${nombre.valor}», encontrado en «${nombre.fuente}».`);
  }
  const idioma = datos.idioma.trim();
  if (estaLibre(fila.textos['Idioma']) && idioma) propiedades['Idioma'] = p.texto(idioma);

  notas.unshift(`Campos encontrados y verificados: ${encontrados} de ${CAMPOS.length}.`);
  return { propiedades, notas };
}

export function crearArmarContexto(opciones: OpcionesFuentes = {}): FuncionEtapa {
  return async ({ espacio, generar, sinModelo }: ContextoEtapa): Promise<ResultadoEtapa> => {
    const fila = elegirFila(await espacio.leerContextos());
    if (typeof fila === 'string') return error([fila]);
    if (fila.estado === 'Confirmado') {
      return error([
        'El contexto ya está Confirmado y el agente no lo modifica. Si querés rehacerlo, pasalo a «Por confirmar» y volvé a pedir «Armar contexto».',
      ]);
    }

    if (fila.documentos.length === 0 && !fila.urlFuente) {
      const { propiedades, notas } = propiedadesManuales(fila);
      await espacio.escritor.actualizar('contexto', fila.id, propiedades);
      return { resultado: 'Lista', notas: [...notas, 'El contexto quedó en «Por confirmar».'], errores: [], proveedorModelo: SIN_MODELO };
    }

    const { fuentes, avisos, pedidas } = await leerFuentes(fila, opciones);
    if (fuentes.length === 0) {
      return error([`No se pudo leer ninguna de las ${pedidas} fuente(s) indicadas.`], avisos);
    }
    if (!generar) {
      return error([sinModelo ?? 'No hay un modelo de lenguaje disponible para esta ejecución.'], avisos);
    }

    const mensajes = armarPrompt({
      tarea: TAREA,
      datos: fuentes.map((f) => ({ fuente: f.nombre, contenido: f.texto })),
      idioma: fila.textos['Idioma']?.trim() || IDIOMA_POR_DEFECTO,
      esquema: esquemaContexto,
    });
    let generado;
    try {
      generado = await generar({ mensajes, esquema: esquemaContexto });
    } catch (e) {
      if (e instanceof ErrorGeneracion) return error([e.message], [...avisos, ...notasDeGeneracion(e)]);
      throw e;
    }

    const { propiedades, notas } = propiedadesExtraidas(fila, generado.datos, fuentes);
    await espacio.escritor.actualizar('contexto', fila.id, propiedades);
    return {
      resultado: 'Lista',
      notas: [...avisos, ...notas, 'El contexto quedó en «Por confirmar»: revisalo, completá lo que falte y marcalo como Confirmado.', ...notasDeGeneracion(generado)],
      errores: [],
      proveedorModelo: generado.proveedorModelo,
    };
  };
}

export const armarContexto = crearArmarContexto();

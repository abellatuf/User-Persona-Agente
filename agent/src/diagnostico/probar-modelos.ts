import { z } from 'zod';
import { tituloEjecucion } from '../ciclo.js';
import { ErrorGeneracion, ErrorModelo, notasDeGeneracion, type Generador, type Proveedor } from '../llm/index.js';
import type { EspacioNotion } from '../notion/espacio.js';
import { armarPrompt } from '../prompts/base.js';

/**
 * Diagnóstico de la capa de modelos (demo del H3). Hace una llamada de prueba,
 * valida la respuesta y deja una fila en Ejecuciones con el proveedor, los intentos
 * y los tokens. No toca ninguna otra base.
 */

export const CONTACTO_DE_PRUEBA = 'ana.prueba@ejemplo.com';

export const esquemaPrueba = z.object({
  suma: z.number(),
  contacto: z.string(),
  saludo: z.string().min(1),
});

export const PROMPT_DE_PRUEBA = armarPrompt({
  tarea: [
    'Esta es una llamada de prueba del agente.',
    '1. En "suma", poné el resultado de 2 + 3.',
    '2. En "contacto", copiá textual el contacto que aparece en los datos.',
    '3. En "saludo", escribí un saludo breve para el equipo.',
  ].join('\n'),
  datos: [{ fuente: 'Dato de prueba', contenido: `Contacto: ${CONTACTO_DE_PRUEBA}` }],
  idioma: 'español',
  esquema: esquemaPrueba,
});

/** Reemplaza al proveedor por uno que siempre falla con un límite de uso, sin llamar a la API. */
export function conFallaSimulada(proveedor: Proveedor): Proveedor {
  return {
    nombre: proveedor.nombre,
    modelo: proveedor.modelo,
    async completar() {
      throw new ErrorModelo(`Falla simulada para la demo: límite de uso (429). No se llamó a ${proveedor.nombre}.`, 'limite', {
        estadoHttp: 429,
        esperaMs: 1_000,
      });
    },
  };
}

export interface ResultadoPrueba {
  ok: boolean;
  proveedorModelo: string;
  notas: string[];
  errores: string[];
}

export async function probarModelos(deps: {
  espacio: EspacioNotion;
  generar: Generador;
  fallaForzada: boolean;
  reloj?: () => Date;
}): Promise<ResultadoPrueba> {
  const reloj = deps.reloj ?? (() => new Date());
  const { espacio } = deps;
  const inicio = reloj();
  const base = espacio.contadores();
  const id = await espacio.crearEjecucion({
    titulo: tituloEjecucion(inicio, `Prueba de modelos${deps.fallaForzada ? ' · falla forzada' : ''}`),
    inicio,
  });

  const notas: string[] = [
    deps.fallaForzada
      ? 'Prueba de modelos con falla forzada: se simula un límite de uso en el principal, sin llamarlo.'
      : 'Prueba de modelos: una llamada de prueba con salida validada.',
  ];
  const errores: string[] = [];
  let proveedorModelo = 'Ninguno: no respondió ningún modelo';

  try {
    const r = await deps.generar({ mensajes: PROMPT_DE_PRUEBA, esquema: esquemaPrueba });
    proveedorModelo = r.proveedorModelo;
    notas.push(...notasDeGeneracion(r));
    notas.push(`Respuesta validada: ${JSON.stringify(r.datos)}`);
    if (r.datos.suma !== 5) errores.push(`La suma debería ser 5 y el modelo respondió ${r.datos.suma}.`);
    if (r.datos.contacto.includes(CONTACTO_DE_PRUEBA)) {
      errores.push('El correo de prueba llegó al modelo: no se ocultaron los datos personales.');
    } else {
      notas.push(`El modelo recibió el contacto como «${r.datos.contacto}»: el correo no salió del agente.`);
    }
    if (r.usoRespaldo) notas.push('Respondió el modelo de respaldo.');
  } catch (e) {
    if (e instanceof ErrorGeneracion) {
      notas.push(...notasDeGeneracion(e));
      errores.push(e.message);
    } else {
      errores.push(e instanceof Error ? e.message : String(e));
    }
  }

  const ahora = espacio.contadores();
  const conNotas = notas.length > 0 ? 1 : 0;
  await espacio.cerrarEjecucion(id, {
    fin: reloj(),
    resultado: errores.length === 0 ? 'Lista' : 'Error',
    errores,
    notas,
    lecturas: ahora.lecturas - base.lecturas,
    // Se suman el cierre y las notas.
    escrituras: ahora.escrituras - base.escrituras + 1 + conNotas,
    intentosBloqueados: ahora.bloqueos - base.bloqueos,
    proveedorModelo,
  });
  return { ok: errores.length === 0, proveedorModelo, notas, errores };
}

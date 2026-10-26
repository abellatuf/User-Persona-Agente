import { MODELO_PRINCIPAL_POR_DEFECTO, MODELO_RESPALDO_POR_DEFECTO, type ClavesModelos } from '../config.js';
import type { Configuracion } from '../notion/espacio.js';
import { crearBuscador, type Buscador } from './buscar.js';
import { crearGenerador, type Generador } from './generar.js';
import { GEMINI_BASE_URL, ProveedorGemini } from './gemini.js';
import { OPENROUTER_BASE_URL, ProveedorOpenRouter } from './openrouter.js';
import type { Proveedor } from './tipos.js';

export { crearGenerador, ErrorGeneracion, notasDeGeneracion, type Generador, type ResultadoGeneracion } from './generar.js';
export { crearBuscador, ErrorBusqueda, type Buscador, type ResultadoBusqueda } from './buscar.js';
export { ErrorModelo, type Proveedor } from './tipos.js';

/** Gemini como principal y OpenRouter como respaldo, con los modelos de Configuración. */
export function crearProveedores(
  claves: ClavesModelos,
  configuracion: Pick<Configuracion, 'modeloPrincipal' | 'modeloRespaldo'>,
): { principal: ProveedorGemini; respaldo: Proveedor } {
  return {
    principal: new ProveedorGemini(
      claves.geminiApiKey,
      configuracion.modeloPrincipal || MODELO_PRINCIPAL_POR_DEFECTO,
      claves.geminiBaseUrl ?? GEMINI_BASE_URL,
    ),
    respaldo: new ProveedorOpenRouter(
      claves.openrouterApiKey,
      configuracion.modeloRespaldo || MODELO_RESPALDO_POR_DEFECTO,
      claves.openrouterBaseUrl ?? OPENROUTER_BASE_URL,
    ),
  };
}

// Un nombre de modelo es una sola palabra: letras, números, puntos, guiones, dos puntos y barras.
const NOMBRE_DE_MODELO = /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/;

/**
 * Revisa los nombres de modelo de Configuración (lección del H3): un texto con espacios,
 * como el de relleno de la plantilla, no es un modelo y no se llama.
 */
export function problemasDeModelos(configuracion: Pick<Configuracion, 'modeloPrincipal' | 'modeloRespaldo'>): string[] {
  const problemas: string[] = [];
  for (const [propiedad, valor] of [
    ['Modelo principal', configuracion.modeloPrincipal],
    ['Modelo de respaldo', configuracion.modeloRespaldo],
  ] as const) {
    if (valor && !NOMBRE_DE_MODELO.test(valor)) {
      problemas.push(
        `En Configuración, «${propiedad}» dice «${valor}», que no parece un nombre de modelo. Escribí el nombre (por ejemplo, gemini-3.6-flash u openrouter/free) o dejalo vacío para usar el valor por defecto.`,
      );
    }
  }
  return problemas;
}

/**
 * Acceso a los modelos para una ejecución. Recibe las claves o, si faltan, el motivo.
 * Armar el generador no llama a ningún modelo: solo se gasta cuota si una etapa lo usa.
 */
export function crearModelos(
  claves: ClavesModelos | string,
  configuracion: Pick<Configuracion, 'modeloPrincipal' | 'modeloRespaldo'>,
): { generar: Generador; buscar: Buscador } | { sinModelo: string } {
  if (typeof claves === 'string') return { sinModelo: claves };
  const problemas = problemasDeModelos(configuracion);
  if (problemas.length > 0) return { sinModelo: problemas.join(' ') };
  const proveedores = crearProveedores(claves, configuracion);
  return {
    generar: crearGenerador(proveedores),
    // Solo el principal busca: el respaldo de OpenRouter no tiene búsqueda web gratuita.
    buscar: crearBuscador({ proveedor: proveedores.principal }),
  };
}

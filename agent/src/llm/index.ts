import { MODELO_PRINCIPAL_POR_DEFECTO, MODELO_RESPALDO_POR_DEFECTO, type ClavesModelos } from '../config.js';
import type { Configuracion } from '../notion/espacio.js';
import { GEMINI_BASE_URL, ProveedorGemini } from './gemini.js';
import { OPENROUTER_BASE_URL, ProveedorOpenRouter } from './openrouter.js';
import type { Proveedor } from './tipos.js';

export { crearGenerador, ErrorGeneracion, notasDeGeneracion, type Generador, type ResultadoGeneracion } from './generar.js';
export { ErrorModelo, type Proveedor } from './tipos.js';

/** Gemini como principal y OpenRouter como respaldo, con los modelos de Configuración. */
export function crearProveedores(
  claves: ClavesModelos,
  configuracion: Pick<Configuracion, 'modeloPrincipal' | 'modeloRespaldo'>,
): { principal: Proveedor; respaldo: Proveedor } {
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

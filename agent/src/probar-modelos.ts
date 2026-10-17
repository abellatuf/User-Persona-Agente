import { leerClavesModelos, leerEntorno } from './config.js';
import { conFallaSimulada, probarModelos } from './diagnostico/probar-modelos.js';
import { crearGenerador, crearProveedores } from './llm/index.js';
import { conReintentos, conectarNotionMcp } from './notion/cliente-mcp.js';
import { EspacioNotionMcp } from './notion/espacio.js';

/** Punto de entrada del workflow probar-modelos.yml (demo del H3). */
async function main(): Promise<number> {
  const entorno = leerEntorno(process.env);
  const claves = leerClavesModelos(process.env);
  const fallaForzada = process.env['FORZAR_FALLA_GEMINI'] === 'true';

  const conexion = await conectarNotionMcp({
    token: entorno.notionToken,
    ...(entorno.notionBaseUrl ? { baseUrl: entorno.notionBaseUrl } : {}),
  });
  try {
    const espacio = new EspacioNotionMcp(conReintentos(conexion));
    const configuracion = await espacio.leerConfiguracion();
    const { principal, respaldo } = crearProveedores(claves, configuracion);
    console.log(`Principal: ${principal.nombre} · ${principal.modelo}. Respaldo: ${respaldo.nombre} · ${respaldo.modelo}.`);

    const generar = crearGenerador({ principal: fallaForzada ? conFallaSimulada(principal) : principal, respaldo });
    const r = await probarModelos({ espacio, generar, fallaForzada });

    for (const nota of r.notas) console.log(nota);
    for (const error of r.errores) console.error(`❌ ${error}`);
    console.log(r.ok ? `✅ Respondió ${r.proveedorModelo}.` : '❌ La prueba de modelos falló. El detalle quedó en Ejecuciones.');
    return r.ok ? 0 : 1;
  } finally {
    await conexion.cerrar();
  }
}

main().then(
  (codigo) => {
    process.exitCode = codigo;
  },
  (e: unknown) => {
    console.error(`❌ No se pudo completar la prueba de modelos: ${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 1;
  },
);

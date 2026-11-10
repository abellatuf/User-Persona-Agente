import { ejecutarAgente } from './ciclo.js';
import { leerClavesModelos, leerEntorno, type ClavesModelos } from './config.js';
import { crearModelos } from './llm/index.js';
import { conReintentos, conRitmo, conectarNotionMcp } from './notion/cliente-mcp.js';
import { EspacioNotionMcp } from './notion/espacio.js';
import { ETAPAS } from './stages/registro.js';

/** Las claves de los modelos, o el motivo por el que faltan (las etapas que no usan modelo siguen igual). */
function clavesDeModelos(): ClavesModelos | string {
  try {
    return leerClavesModelos(process.env);
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

/** Punto de entrada: lo ejecuta el workflow agente.yml. */
async function main(): Promise<number> {
  const entorno = leerEntorno(process.env);
  const claves = clavesDeModelos();
  const conexion = await conectarNotionMcp({
    token: entorno.notionToken,
    ...(entorno.notionBaseUrl ? { baseUrl: entorno.notionBaseUrl } : {}),
  });
  try {
    const espacio = new EspacioNotionMcp(conReintentos(conRitmo(conexion)));
    const resumen = await ejecutarAgente({
      espacio,
      etapas: ETAPAS,
      modelos: (configuracion) => crearModelos(claves, configuracion),
    });
    const { lecturas, escrituras } = espacio.contadores();
    console.log(`Resultado: ${resumen.resultado}. Lecturas: ${lecturas}. Escrituras: ${escrituras}.`);
    for (const falla of resumen.fallasDeRegistro) console.error(`❌ ${falla}`);
    return resumen.fallasDeRegistro.length > 0 ? 1 : 0;
  } finally {
    await conexion.cerrar();
  }
}

main().then(
  (codigo) => {
    process.exitCode = codigo;
  },
  (e: unknown) => {
    console.error(`❌ El agente no pudo completar la ejecución: ${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 1;
  },
);

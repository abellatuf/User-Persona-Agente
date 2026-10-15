import { ejecutarAgente } from './ciclo.js';
import { leerEntorno } from './config.js';
import { conReintentos, conectarNotionMcp } from './notion/cliente-mcp.js';
import { EspacioNotionMcp } from './notion/espacio.js';
import { ETAPAS } from './stages/registro.js';

/** Punto de entrada: lo ejecuta el workflow agente.yml. */
async function main(): Promise<number> {
  const entorno = leerEntorno(process.env);
  const conexion = await conectarNotionMcp({
    token: entorno.notionToken,
    ...(entorno.notionBaseUrl ? { baseUrl: entorno.notionBaseUrl } : {}),
  });
  try {
    const espacio = new EspacioNotionMcp(conReintentos(conexion));
    const resumen = await ejecutarAgente({ espacio, etapas: ETAPAS });
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

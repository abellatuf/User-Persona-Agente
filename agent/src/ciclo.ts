import { MAX_SOLICITUDES_POR_EJECUCION, ZONA_HORARIA } from './config.js';
import {
  ETAPAS_SOLICITABLES,
  type CierreEjecucion,
  type Contadores,
  type EspacioNotion,
  type EstadoSolicitud,
  type EtapaSolicitable,
  type Solicitud,
} from './notion/espacio.js';
import { verificarEspacio, type ResultadoVerificacion } from './stages/0-verificar-espacio/index.js';
import type { FuncionEtapa, ResultadoEtapa } from './stages/registro.js';

export interface Dependencias {
  espacio: EspacioNotion;
  etapas: Record<EtapaSolicitable, FuncionEtapa>;
  verificar?: (espacio: EspacioNotion) => Promise<ResultadoVerificacion>;
  reloj?: () => Date;
  log?: (mensaje: string) => void;
  maxSolicitudes?: number;
}

export interface ResumenEjecucion {
  resultado: 'Pausado' | 'Sin pendientes' | 'Atendidas';
  solicitudes: Array<{ id: string; titulo: string; resultado: ResultadoEtapa['resultado'] }>;
  /** Escrituras en Notion que fallaron: el workflow debería terminar en rojo. */
  fallasDeRegistro: string[];
}

const SIN_MODELO = 'Ninguno (H1)';

export function tituloEjecucion(fecha: Date, detalle: string): string {
  const cuando = new Intl.DateTimeFormat('sv-SE', {
    timeZone: ZONA_HORARIA,
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(fecha);
  return `${cuando} · ${detalle}`;
}

function mensajeDe(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function esEtapaSolicitable(valor: string | null): valor is EtapaSolicitable {
  return valor !== null && (ETAPAS_SOLICITABLES as readonly string[]).includes(valor);
}

/**
 * Bucle de solicitudes (T1.5): lee Configuración, sale si está pausado o no hay
 * pendientes, y atiende cada solicitud dejando su fila en Ejecuciones (T1.6).
 */
export async function ejecutarAgente(deps: Dependencias): Promise<ResumenEjecucion> {
  const { espacio, etapas } = deps;
  const verificar = deps.verificar ?? verificarEspacio;
  const reloj = deps.reloj ?? (() => new Date());
  const log = deps.log ?? console.log;
  const maximo = deps.maxSolicitudes ?? MAX_SOLICITUDES_POR_EJECUCION;
  const fallasDeRegistro: string[] = [];
  // Las lecturas compartidas (Configuración, pendientes, etapa 0) se cuentan en la primera fila.
  let corte = espacio.contadores();

  const registrarSinSolicitudes = async (
    resultado: 'Pausado' | 'Sin pendientes' | 'Error',
    nota: string,
    errores: string[] = [],
  ) => {
    const base = espacio.contadores();
    const inicio = reloj();
    const id = await espacio.crearEjecucion({ titulo: tituloEjecucion(inicio, resultado), inicio });
    const ahora = espacio.contadores();
    await espacio.cerrarEjecucion(id, {
      fin: reloj(),
      resultado,
      errores,
      notas: [nota],
      lecturas: ahora.lecturas - corte.lecturas,
      // Se suman el cierre y las notas.
      escrituras: ahora.escrituras - base.escrituras + 2,
      intentosBloqueados: 0,
      proveedorModelo: SIN_MODELO,
    });
  };

  let configuracion;
  try {
    configuracion = await espacio.leerConfiguracion();
  } catch (e) {
    // Sin Configuración no se sabe si el agente está activo: no se atiende nada.
    try {
      await registrarSinSolicitudes('Error', 'No se pudo leer la base Configuración.', [mensajeDe(e)]);
    } catch {
      // Si tampoco se puede escribir en Ejecuciones, el error queda solo en el log del workflow.
    }
    throw e;
  }
  if (!configuracion.agenteActivo) {
    log('Agente pausado desde Configuración: termina sin hacer nada.');
    await registrarSinSolicitudes('Pausado', 'El agente está pausado (casilla «Agente activo» desmarcada).');
    return { resultado: 'Pausado', solicitudes: [], fallasDeRegistro };
  }

  const pendientes = await espacio.solicitudesPendientes(maximo);
  if (pendientes.length === 0) {
    log('No hay solicitudes pendientes: termina sin llamar a ningún modelo.');
    await registrarSinSolicitudes('Sin pendientes', 'No había solicitudes en Pendiente.');
    return { resultado: 'Sin pendientes', solicitudes: [], fallasDeRegistro };
  }

  log(`Solicitudes pendientes: ${pendientes.length}. Etapa 0: verificando el espacio…`);
  let verificacion: ResultadoVerificacion;
  try {
    verificacion = await verificar(espacio);
  } catch (e) {
    verificacion = { ok: false, faltantes: [`No se pudo verificar el espacio: ${mensajeDe(e)}`] };
  }
  log(verificacion.ok ? 'Etapa 0: espacio OK.' : `Etapa 0: faltan ${verificacion.faltantes.length} elementos.`);

  const solicitudes: ResumenEjecucion['solicitudes'] = [];
  for (const solicitud of pendientes) {
    const r = await atenderSolicitud(solicitud, verificacion, corte, { espacio, etapas, reloj, log, fallasDeRegistro });
    corte = espacio.contadores();
    solicitudes.push({ id: solicitud.id, titulo: solicitud.titulo, resultado: r });
  }
  return { resultado: 'Atendidas', solicitudes, fallasDeRegistro };
}

async function atenderSolicitud(
  solicitud: Solicitud,
  verificacion: ResultadoVerificacion,
  base: Contadores,
  deps: {
    espacio: EspacioNotion;
    etapas: Record<EtapaSolicitable, FuncionEtapa>;
    reloj: () => Date;
    log: (m: string) => void;
    fallasDeRegistro: string[];
  },
): Promise<ResultadoEtapa['resultado']> {
  const { espacio, etapas, reloj, log, fallasDeRegistro } = deps;
  const inicio = reloj();
  const etapa = esEtapaSolicitable(solicitud.etapa) ? solicitud.etapa : undefined;
  const nombre = solicitud.titulo || '(sin título)';
  log(`→ «${nombre}» (${solicitud.etapa ?? 'sin etapa'})`);

  let ejecucionId: string | undefined;
  let r: ResultadoEtapa = {
    resultado: 'Error',
    notas: [],
    errores: [],
    proveedorModelo: SIN_MODELO,
  };

  try {
    ejecucionId = await espacio.crearEjecucion({
      titulo: tituloEjecucion(inicio, `${etapa ?? 'Sin etapa'} · ${nombre}`),
      inicio,
      solicitudId: solicitud.id,
      ...(etapa ? { etapa } : {}),
    });
    await espacio.marcarSolicitud(solicitud.id, 'En curso');

    if (!verificacion.ok) {
      r.errores = ['Etapa 0: el espacio de Notion no tiene la estructura esperada.', ...verificacion.faltantes];
    } else if (!etapa) {
      r.errores = [
        solicitud.etapa
          ? `La etapa «${solicitud.etapa}» no existe.`
          : 'La solicitud no tiene Etapa: elegí una y volvé a dejarla en Pendiente.',
      ];
    } else {
      r = await etapas[etapa]({ solicitud, espacio });
      r.notas = ['Etapa 0: espacio verificado.', ...r.notas];
    }
  } catch (e) {
    r = { ...r, resultado: 'Error', errores: [...r.errores, mensajeDe(e)] };
  } finally {
    const estadoFinal: EstadoSolicitud = r.resultado === 'Lista' ? 'Lista' : 'Error';
    try {
      await espacio.marcarSolicitud(solicitud.id, estadoFinal);
    } catch (e) {
      fallasDeRegistro.push(`No se pudo marcar «${nombre}» como ${estadoFinal}: ${mensajeDe(e)}`);
    }
    if (ejecucionId) {
      const ahora = espacio.contadores();
      const notas = [...r.notas, ...espacio.avisosDesde(base.avisos)];
      const cierre: CierreEjecucion = {
        fin: reloj(),
        resultado: r.resultado,
        errores: r.errores,
        notas,
        lecturas: ahora.lecturas - base.lecturas,
        // Se suman el propio cierre y, si hay notas, la escritura de las notas.
        escrituras: ahora.escrituras - base.escrituras + 1 + (notas.length > 0 ? 1 : 0),
        intentosBloqueados: ahora.bloqueos - base.bloqueos,
        proveedorModelo: r.proveedorModelo,
      };
      try {
        await espacio.cerrarEjecucion(ejecucionId, cierre);
      } catch (e) {
        fallasDeRegistro.push(`No se pudo cerrar la ejecución de «${nombre}»: ${mensajeDe(e)}`);
      }
    } else {
      fallasDeRegistro.push(`No se pudo crear la fila de Ejecuciones de «${nombre}».`);
    }
  }
  log(`  ${r.resultado}${r.errores.length ? `: ${r.errores.join(' | ')}` : ''}`);
  return r.resultado;
}

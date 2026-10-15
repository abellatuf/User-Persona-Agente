import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ejecutarAgente } from '../src/ciclo.js';
import { BASES } from '../src/config.js';
import { conectarNotionMcp, type ConexionMcp } from '../src/notion/cliente-mcp.js';
import { EspacioNotionMcp } from '../src/notion/espacio.js';
import { ETAPAS } from '../src/stages/registro.js';
import { NotionFalso } from './apoyo/notion-falso.js';

/**
 * Prueba de punta a punta del H1 sin red ni token real: el agente levanta el
 * servidor MCP oficial de Notion, que habla con una API de Notion falsa local.
 */
describe('integración con el servidor MCP de Notion', () => {
  let notion: NotionFalso;
  let conexion: ConexionMcp;

  beforeAll(async () => {
    notion = new NotionFalso();
    const baseUrl = await notion.iniciar();
    conexion = await conectarNotionMcp({ token: 'token-de-prueba', baseUrl });
  });

  afterAll(async () => {
    await conexion?.cerrar();
    await notion?.detener();
  });

  it('atiende una solicitud: En curso → Lista, con su fila en Ejecuciones', async () => {
    const solicitud = notion.crearSolicitud('Demo H1', 'Armar contexto');
    const espacio = new EspacioNotionMcp(conexion);

    const resumen = await ejecutarAgente({ espacio, etapas: ETAPAS, log: () => {} });

    expect(resumen.solicitudes).toEqual([{ id: solicitud, titulo: 'Demo H1', resultado: 'Lista' }]);
    expect(resumen.fallasDeRegistro).toEqual([]);
    expect(notion.paginas.get(solicitud)?.properties['Estado']).toEqual({ status: { name: 'Lista' } });

    const ejecuciones = notion.filasDe(BASES.ejecuciones);
    expect(ejecuciones).toHaveLength(1);
    const [, fila] = ejecuciones[0]!;
    expect(fila.properties).toMatchObject({
      Etapa: { select: { name: 'Armar contexto' } },
      Solicitud: { relation: [{ id: solicitud }] },
      Resultado: { select: { name: 'Lista' } },
      Lecturas: { number: 12 },
      Escrituras: { number: 5 },
      'Intentos bloqueados': { number: 0 },
    });
    expect(fila.hijos).toHaveLength(2);

    // El token viaja en la cabecera y se usa la versión de la API con data sources.
    const peticion = notion.peticiones[0]!;
    expect(peticion.cabeceras['authorization']).toBe('Bearer token-de-prueba');
    expect(peticion.cabeceras['notion-version']).toBe('2025-09-03');
    // Las solicitudes se piden en orden de creación.
    const consulta = notion.peticiones.find((p) => p.ruta === `/v1/data_sources/${BASES.solicitudes}/query`);
    expect(consulta?.cuerpo).toMatchObject({
      filter: { property: 'Estado', status: { equals: 'Pendiente' } },
      sorts: [{ timestamp: 'created_time', direction: 'ascending' }],
    });
  });

  it('sin pendientes, la segunda ejecución deja una fila Sin pendientes', async () => {
    const antes = notion.filasDe(BASES.ejecuciones).length;

    const resumen = await ejecutarAgente({ espacio: new EspacioNotionMcp(conexion), etapas: ETAPAS, log: () => {} });

    expect(resumen.resultado).toBe('Sin pendientes');
    const filas = notion.filasDe(BASES.ejecuciones);
    expect(filas).toHaveLength(antes + 1);
    expect(filas.at(-1)?.[1].properties['Resultado']).toEqual({ select: { name: 'Sin pendientes' } });
  });

  it('una base no compartida deja la solicitud en Error con lo que falta', async () => {
    notion.basesOcultas.add(BASES.supuestos);
    const solicitud = notion.crearSolicitud('Sin espacio completo', 'Sintetizar');

    await ejecutarAgente({ espacio: new EspacioNotionMcp(conexion), etapas: ETAPAS, log: () => {} });
    notion.basesOcultas.clear();

    expect(notion.paginas.get(solicitud)?.properties['Estado']).toEqual({ status: { name: 'Error' } });
    const fila = notion.filasDe(BASES.ejecuciones).at(-1)![1];
    const errores = (fila.properties['Errores'] as { rich_text: Array<{ text: { content: string } }> }).rich_text[0]!
      .text.content;
    expect(errores).toContain('Falta la base «Supuestos a validar»');
  });
});

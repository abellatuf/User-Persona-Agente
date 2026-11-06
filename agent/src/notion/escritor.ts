import { BASES, type ClaveBase } from '../config.js';
import {
  BASES_CON_LECTURA_PREVIA,
  evaluarEscritura,
  respetarEdicionesDelPm,
  type EstadoActual,
  type OperacionEscritura,
  type Propiedades,
} from '../guards/escritura.js';
import { pagina as esquemaPagina, paginaCreada, resultadoConsulta, usuarioPropio, type Pagina } from '../schemas/notion.js';
import { ESQUEMA_ESPERADO } from '../stages/0-verificar-espacio/esquema-esperado.js';
import { ErrorNotion, type LlamadorHerramientas } from './cliente-mcp.js';
import type { Contador } from './contador.js';
import * as p from './propiedades.js';

/** La escritura violaba una regla: no se hizo y quedó registrada. */
export class EscrituraBloqueada extends Error {
  override name = 'EscrituraBloqueada';
  constructor(
    readonly base: ClaveBase,
    readonly motivo: string,
  ) {
    super(`Escritura bloqueada en «${ESQUEMA_ESPERADO[base].nombre}»: ${motivo}`);
  }
}

export interface ResultadoEscritura {
  id: string;
  accion: 'creada' | 'actualizada' | 'sugerencia';
}

/**
 * Único punto de escritura en Notion. Toda escritura pasa por las reglas de
 * src/guards/escritura.ts antes de llegar a la API.
 */
export interface Escritor {
  /** Con clave: actualiza la fila que tenga esa clave o la crea. Sin clave: siempre crea. */
  guardar(base: ClaveBase, propiedades: Propiedades, opciones?: { clave?: string }): Promise<ResultadoEscritura>;
  /** Modifica una página conocida por su id. */
  actualizar(base: ClaveBase, id: string, propiedades: Propiedades): Promise<ResultadoEscritura>;
  /** Manda la página a la papelera de Notion (se puede recuperar) y registra el motivo. */
  archivar(base: ClaveBase, id: string, motivo: string): Promise<void>;
  /**
   * Como archivar, pero si las reglas no lo permiten (por ejemplo, el PM editó la fila)
   * no la toca y devuelve el motivo, sin contarlo como intento bloqueado.
   */
  archivarSiSePuede(base: ClaveBase, id: string, motivo: string): Promise<string | null>;
  /** Agrega párrafos al cuerpo de una página. */
  agregarParrafos(id: string, parrafos: string[]): Promise<void>;
}

const HERRAMIENTAS_DE_LECTURA = new Set(['API-query-data-source', 'API-retrieve-a-page', 'API-retrieve-a-data-source', 'API-get-self']);

export class EscritorNotion implements Escritor {
  private idAgente: Promise<string> | undefined;

  constructor(
    private readonly mcp: LlamadorHerramientas,
    private readonly contador: Contador,
  ) {}

  private async llamar(herramienta: string, args: Record<string, unknown>) {
    if (HERRAMIENTAS_DE_LECTURA.has(herramienta)) this.contador.lecturas++;
    else this.contador.escrituras++;
    return this.mcp.llamar(herramienta, args);
  }

  /** Id del usuario de la integración, para saber qué ediciones hizo el agente. */
  private obtenerIdAgente(): Promise<string> {
    this.idAgente ??= this.llamar('API-get-self', {}).then((r) => usuarioPropio.parse(r).id);
    return this.idAgente;
  }

  private bloquear(base: ClaveBase, motivo: string): never {
    this.contador.bloqueos++;
    throw new EscrituraBloqueada(base, motivo);
  }

  private verificar(op: OperacionEscritura): void {
    const motivo = evaluarEscritura(op);
    if (motivo) this.bloquear(op.base, motivo);
  }

  private async leerPagina(id: string): Promise<Pagina | null> {
    try {
      return esquemaPagina.parse(await this.llamar('API-retrieve-a-page', { page_id: id }));
    } catch (e) {
      if (e instanceof ErrorNotion && (e.codigo === 'object_not_found' || e.estadoHttp === 404)) return null;
      throw e;
    }
  }

  private async estadoActual(base: ClaveBase, pagina: Pagina): Promise<EstadoActual> {
    const idAgente = await this.obtenerIdAgente();
    let personaCongelada = false;
    if (base === 'atributos') {
      for (const personaId of p.leerRelacion(pagina, 'Persona')) {
        const persona = await this.leerPagina(personaId);
        const estado = persona ? p.leerSeleccion(persona, 'Estado') : null;
        if (estado !== null && estado !== 'Borrador') personaCongelada = true;
      }
    }
    return {
      estado: p.leerSeleccion(pagina, 'Estado'),
      editadoPorPm: p.leerCasilla(pagina, 'Editado por el PM'),
      ultimaEdicionDelAgente: pagina.last_edited_by?.id === idAgente,
      creadaPorAgente: pagina.created_by?.id === idAgente,
      personaCongelada,
      deOtraBase: pagina.parent?.data_source_id !== BASES[base],
    };
  }

  private async buscarPorClave(base: ClaveBase, clave: string): Promise<Pagina | null> {
    const r = resultadoConsulta.parse(
      await this.llamar('API-query-data-source', {
        data_source_id: BASES[base],
        filter: { property: 'Clave', rich_text: { equals: clave } },
        page_size: 1,
      }),
    );
    return r.results[0] ?? null;
  }

  private async aplicarActualizacion(
    base: ClaveBase,
    id: string,
    propiedades: Propiedades,
    pagina: Pagina | null,
  ): Promise<ResultadoEscritura> {
    const actual = pagina ? await this.estadoActual(base, pagina) : undefined;
    if (BASES_CON_LECTURA_PREVIA.includes(base) && !actual) {
      this.bloquear(base, 'no se encontró la página a modificar.');
    }
    const { op, redirigida } = respetarEdicionesDelPm({
      accion: 'actualizar',
      base,
      propiedades,
      ...(actual ? { actual } : {}),
    });
    this.verificar(op);
    paginaCreada.parse(await this.llamar('API-patch-page', { page_id: id, properties: op.propiedades }));
    if (redirigida) {
      // El texto del atributo, no su id: el PM lo tiene que poder encontrar (H8).
      const afirmacion = pagina ? p.leerTexto(pagina, 'Afirmación') : '';
      this.contador.avisar(`Atributo «${afirmacion || id}»: el PM lo editó, así que la propuesta quedó en «Sugerencia del agente».`);
    }
    return { id, accion: redirigida ? 'sugerencia' : 'actualizada' };
  }

  async guardar(base: ClaveBase, propiedades: Propiedades, opciones: { clave?: string } = {}): Promise<ResultadoEscritura> {
    const conClave = opciones.clave ? { ...propiedades, Clave: p.texto(opciones.clave) } : propiedades;
    if (opciones.clave) {
      const existente = await this.buscarPorClave(base, opciones.clave);
      if (existente) return this.aplicarActualizacion(base, existente.id, conClave, existente);
    }
    this.verificar({ accion: 'crear', base, propiedades: conClave });
    const creada = paginaCreada.parse(
      await this.llamar('API-post-page', {
        parent: { type: 'data_source_id', data_source_id: BASES[base] },
        properties: conClave,
      }),
    );
    return { id: creada.id, accion: 'creada' };
  }

  async actualizar(base: ClaveBase, id: string, propiedades: Propiedades): Promise<ResultadoEscritura> {
    const pagina = BASES_CON_LECTURA_PREVIA.includes(base) ? await this.leerPagina(id) : null;
    return this.aplicarActualizacion(base, id, propiedades, pagina);
  }

  async archivar(base: ClaveBase, id: string, motivo: string): Promise<void> {
    const pagina = await this.leerPagina(id);
    const actual = pagina ? await this.estadoActual(base, pagina) : undefined;
    this.verificar({ accion: 'archivar', base, propiedades: {}, ...(actual ? { actual } : {}) });
    await this.mandarAPapelera(base, id, motivo);
  }

  async archivarSiSePuede(base: ClaveBase, id: string, motivo: string): Promise<string | null> {
    const pagina = await this.leerPagina(id);
    const actual = pagina ? await this.estadoActual(base, pagina) : undefined;
    const impedimento = evaluarEscritura({ accion: 'archivar', base, propiedades: {}, ...(actual ? { actual } : {}) });
    if (impedimento) return impedimento;
    await this.mandarAPapelera(base, id, motivo);
    return null;
  }

  private async mandarAPapelera(base: ClaveBase, id: string, motivo: string) {
    paginaCreada.parse(await this.llamar('API-patch-page', { page_id: id, in_trash: true }));
    this.contador.avisar(`Archivada una fila de «${ESQUEMA_ESPERADO[base].nombre}» (${id}): ${motivo}`);
  }

  async agregarParrafos(id: string, parrafos: string[]): Promise<void> {
    if (parrafos.length === 0) return;
    await this.llamar('API-patch-block-children', { block_id: id, children: parrafos.map((t) => p.parrafo(t)) });
  }
}

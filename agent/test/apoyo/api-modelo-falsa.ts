import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { PeticionProveedor, Proveedor, RespuestaProveedor } from '../../src/llm/tipos.js';

export interface RespuestaProgramada {
  estado: number;
  cuerpo: unknown;
  cabeceras?: Record<string, string>;
}

export interface PeticionRecibida {
  metodo: string;
  ruta: string;
  cabeceras: http.IncomingHttpHeaders;
  cuerpo: Record<string, unknown>;
}

/** API HTTP falsa para los adaptadores de modelos: responde lo que se le programa, en orden. */
export class ApiModeloFalsa {
  peticiones: PeticionRecibida[] = [];
  private cola: RespuestaProgramada[] = [];
  private servidor = http.createServer((req, res) => void this.atender(req, res));

  responder(...respuestas: RespuestaProgramada[]) {
    this.cola.push(...respuestas);
  }

  async iniciar(): Promise<string> {
    await new Promise<void>((ok) => this.servidor.listen(0, '127.0.0.1', ok));
    const { port } = this.servidor.address() as AddressInfo;
    return `http://127.0.0.1:${port}`;
  }

  async detener() {
    await new Promise((ok) => this.servidor.close(ok));
  }

  private async atender(req: http.IncomingMessage, res: http.ServerResponse) {
    let datos = '';
    for await (const trozo of req) datos += trozo;
    this.peticiones.push({
      metodo: req.method ?? 'GET',
      ruta: new URL(req.url ?? '/', 'http://x').pathname,
      cabeceras: req.headers,
      cuerpo: datos ? (JSON.parse(datos) as Record<string, unknown>) : {},
    });
    const r = this.cola.shift() ?? { estado: 500, cuerpo: { error: { message: 'sin respuesta programada' } } };
    res.writeHead(r.estado, { 'content-type': 'application/json', ...r.cabeceras });
    res.end(JSON.stringify(r.cuerpo));
  }
}

type Paso = RespuestaProveedor | Error;

/** Proveedor en memoria: devuelve o lanza lo que se le programa, y guarda lo que recibió. */
export class ProveedorFalso implements Proveedor {
  recibidas: PeticionProveedor[] = [];
  constructor(
    readonly nombre: 'Gemini' | 'OpenRouter',
    readonly modelo: string,
    private readonly pasos: Paso[] = [],
  ) {}

  async completar(peticion: PeticionProveedor): Promise<RespuestaProveedor> {
    this.recibidas.push(peticion);
    const paso = this.pasos.shift();
    if (!paso) throw new Error(`${this.nombre}: no hay más respuestas programadas`);
    if (paso instanceof Error) throw paso;
    return paso;
  }
}

/** Respuesta de proveedor con un texto y tokens fijos. */
export const respuesta = (texto: unknown, modelo = 'modelo-real'): RespuestaProveedor => ({
  texto: typeof texto === 'string' ? texto : JSON.stringify(texto),
  modelo,
  tokens: { entrada: 10, salida: 5, total: 15 },
});

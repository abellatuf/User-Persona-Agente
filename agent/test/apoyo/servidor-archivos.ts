import http from 'node:http';
import type { AddressInfo } from 'node:net';

export interface Archivo {
  estado?: number;
  tipo?: string;
  cuerpo: string | Buffer;
  cabeceras?: Record<string, string>;
}

/** Servidor HTTP local que sirve archivos y páginas fijas, para probar la lectura de fuentes sin red. */
export class ServidorArchivos {
  archivos = new Map<string, Archivo>();
  pedidos: string[] = [];
  base = '';
  private servidor = http.createServer((req, res) => {
    const ruta = new URL(req.url ?? '/', 'http://x').pathname;
    this.pedidos.push(ruta);
    const a = this.archivos.get(ruta);
    if (!a) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('no existe');
      return;
    }
    res.writeHead(a.estado ?? 200, { ...(a.tipo ? { 'content-type': a.tipo } : {}), ...a.cabeceras });
    res.end(a.cuerpo);
  });

  async iniciar(): Promise<string> {
    await new Promise<void>((ok) => this.servidor.listen(0, '127.0.0.1', ok));
    const { port } = this.servidor.address() as AddressInfo;
    this.base = `http://127.0.0.1:${port}`;
    return this.base;
  }

  async detener() {
    await new Promise((ok) => this.servidor.close(ok));
  }

  url(ruta: string) {
    return `${this.base}${ruta}`;
  }
}

/** PDF mínimo válido, de una página, con una línea de texto. */
export function pdfConTexto(texto: string): Buffer {
  const contenido = `BT /F1 12 Tf 72 720 Td (${texto.replace(/[()\\]/g, '\\$&')}) Tj ET`;
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const posiciones: number[] = [];
  objetos.forEach((o, i) => {
    posiciones.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  for (const p of posiciones) pdf += `${String(p).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ErrorFuente, leerDocumento, leerPaginaWeb, MAX_CARACTERES_FUENTE } from '../src/fuentes/index.js';
import { decodificarEntidades, htmlATexto } from '../src/fuentes/html.js';
import { descargar, esDireccionPrivada } from '../src/fuentes/red.js';
import { pdfConTexto, ServidorArchivos } from './apoyo/servidor-archivos.js';

const local = { permitirLocal: true };

async function errorDe(promesa: Promise<unknown>): Promise<ErrorFuente> {
  const e = await promesa.then(
    () => undefined,
    (x: unknown) => x,
  );
  expect(e).toBeInstanceOf(ErrorFuente);
  return e as ErrorFuente;
}

describe('lectura de fuentes (T4.1 y T4.2)', () => {
  const servidor = new ServidorArchivos();

  beforeAll(async () => {
    await servidor.iniciar();
    servidor.archivos.set('/spec.md', { tipo: 'text/markdown', cuerpo: '﻿# Producto\r\n\r\nLos usuarios **olvidan** pagar.' });
    servidor.archivos.set('/spec.pdf', { tipo: 'application/pdf', cuerpo: pdfConTexto('Los usuarios olvidan pagar a tiempo') });
    servidor.archivos.set('/largo.txt', { tipo: 'text/plain', cuerpo: 'a'.repeat(MAX_CARACTERES_FUENTE + 10) });
    servidor.archivos.set('/pagina', {
      tipo: 'text/html; charset=utf-8',
      cuerpo:
        '<html><head><title>Mi producto</title><style>p{}</style></head><body><script>alert(1)</script><h1>Cobrá&nbsp;fácil</h1><p>Para pymes &amp; profesionales.</p></body></html>',
    });
    servidor.archivos.set('/imagen', { tipo: 'image/png', cuerpo: Buffer.from([1, 2, 3]) });
    servidor.archivos.set('/vuelta', { estado: 302, cuerpo: '', cabeceras: { location: '/pagina' } });
    servidor.archivos.set('/bucle', { estado: 302, cuerpo: '', cabeceras: { location: '/bucle' } });
  });
  afterAll(() => servidor.detener());

  it('lee un .md como texto, sin BOM y con saltos de línea unificados', async () => {
    const f = await leerDocumento({ nombre: 'spec.md', url: servidor.url('/spec.md') }, local);
    expect(f).toEqual({ nombre: 'spec.md', texto: '# Producto\n\nLos usuarios **olvidan** pagar.', recortada: false });
  });

  it('lee el texto de un PDF', async () => {
    const f = await leerDocumento({ nombre: 'Spec.PDF', url: servidor.url('/spec.pdf') }, local);
    expect(f.texto).toContain('Los usuarios olvidan pagar a tiempo');
  });

  it('recorta una fuente que supera el tope', async () => {
    const f = await leerDocumento({ nombre: 'largo.txt', url: servidor.url('/largo.txt') }, local);
    expect(f.recortada).toBe(true);
    expect(f.texto).toHaveLength(MAX_CARACTERES_FUENTE);
  });

  it('no lee formatos que todavía no soporta, sin descargar nada', async () => {
    const antes = servidor.pedidos.length;
    const e = await errorDe(leerDocumento({ nombre: 'spec.docx', url: servidor.url('/spec.docx') }, local));
    expect(e.message).toMatch(/\.docx no se lee/);
    expect(servidor.pedidos).toHaveLength(antes);
  });

  it('lee una página web: título y texto, sin scripts ni estilos', async () => {
    const f = await leerPaginaWeb(servidor.url('/pagina'), local);
    expect(f.nombre).toBe(servidor.url('/pagina'));
    expect(f.texto).toBe('Mi producto\n\nCobrá fácil\nPara pymes & profesionales.');
  });

  it('sigue redirecciones, pero no infinitas', async () => {
    expect((await leerPaginaWeb(servidor.url('/vuelta'), local)).texto).toContain('Cobrá fácil');
    expect((await errorDe(leerPaginaWeb(servidor.url('/bucle'), local))).message).toMatch(/redirecciones/);
  });

  it('rechaza contenido que no es texto y páginas que no existen', async () => {
    expect((await errorDe(leerPaginaWeb(servidor.url('/imagen'), local))).message).toMatch(/image\/png/);
    expect((await errorDe(leerPaginaWeb(servidor.url('/no-existe'), local))).message).toMatch(/404/);
  });

  it('respeta el tamaño máximo', async () => {
    const e = await errorDe(descargar(servidor.url('/largo.txt'), { maxBytes: 100, ...local }));
    expect(e.message).toMatch(/tamaño máximo/);
  });

  it('sin el permiso de pruebas, no lee el propio equipo ni la red privada', async () => {
    const antes = servidor.pedidos.length;
    for (const url of [servidor.url('/pagina'), 'http://localhost/x', 'http://10.0.0.5/', 'http://192.168.1.1/', 'http://[::1]/']) {
      expect((await errorDe(leerPaginaWeb(url))).message).toMatch(/locales/);
    }
    expect(servidor.pedidos).toHaveLength(antes);
    expect((await errorDe(leerPaginaWeb('ftp://ejemplo.com/a'))).message).toMatch(/http o https/);
    expect((await errorDe(leerPaginaWeb('no es una url'))).message).toMatch(/no es válida/);
  });
});

describe('direcciones privadas', () => {
  it('reconoce las privadas, locales y reservadas', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.0.10', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1']) {
      expect(esDireccionPrivada(ip), ip).toBe(true);
    }
  });

  it('acepta las públicas', () => {
    for (const ip of ['8.8.8.8', '172.32.0.1', '200.45.12.3', '2001:4860:4860::8888']) {
      expect(esDireccionPrivada(ip), ip).toBe(false);
    }
  });
});

describe('extractor de HTML', () => {
  it('decodifica entidades con nombre y numéricas', () => {
    expect(decodificarEntidades('a&amp;b &#241; &#x00e9; &raro;')).toBe('a&b ñ é &raro;');
  });

  it('saca comentarios y respeta los bloques', () => {
    expect(htmlATexto('<div>uno</div><!-- oculto --><ul><li>dos</li><li>tres</li></ul>').texto).toBe('uno\ndos\ntres');
  });
});

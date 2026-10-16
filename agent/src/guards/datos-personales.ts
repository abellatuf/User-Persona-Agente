/**
 * Oculta datos personales evidentes antes de enviar texto a un modelo (RNF-06, T2.5).
 * Es conservadora con los números: solo reemplaza lo que tiene forma clara de
 * teléfono o documento, para no romper fechas, años, montos ni versiones.
 */
export interface ResultadoOcultamiento {
  texto: string;
  reemplazos: { correo: number; telefono: number; documento: number };
}

const CORREO = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
// CUIT / CUIL: prefijo, 8 dígitos y verificador, con o sin guiones.
const CUIT = /\b(?:20|23|24|27|30|33|34)-?\d{8}-?\d\b/g;
// DNI: solo si aparece la palabra, para no confundirlo con un monto como 1.234.567.
const DNI = /\b(D\.?N\.?I\.?|documento|doc\.?)(\s*(?:es\s+|n[°º]\s*|nro\.?\s*|número\s+)?:?\s*)(\d{1,2}\.?\d{3}\.?\d{3})\b/gi;
// Candidatos a teléfono: dígitos con espacios, guiones o paréntesis, opcionalmente con +.
const CANDIDATO_TELEFONO = /(?<![\w./])\+?\(?\d[\d\s()-]{6,}\d(?![\w./])/g;
const PALABRA_TELEFONO = /(tel(?:éfono|efono)?|cel(?:ular)?|whats\s?app|wsp|m[oó]vil)\W{0,3}$/i;

export function ocultarDatosPersonales(texto: string): ResultadoOcultamiento {
  const reemplazos = { correo: 0, telefono: 0, documento: 0 };

  let r = texto.replace(CORREO, () => {
    reemplazos.correo++;
    return '[CORREO]';
  });
  r = r.replace(CUIT, () => {
    reemplazos.documento++;
    return '[DOCUMENTO]';
  });
  r = r.replace(DNI, (_m, palabra: string, separador: string) => {
    reemplazos.documento++;
    return `${palabra}${separador}[DOCUMENTO]`;
  });
  r = r.replace(CANDIDATO_TELEFONO, (candidato: string, desde: number, todo: string) => {
    const digitos = candidato.replace(/\D/g, '').length;
    const conPalabra = PALABRA_TELEFONO.test(todo.slice(Math.max(0, desde - 20), desde));
    const esTelefono =
      digitos >= 8 && digitos <= 15 && (candidato.startsWith('+') || digitos >= 10 || conPalabra);
    if (!esTelefono) return candidato;
    reemplazos.telefono++;
    return '[TELÉFONO]';
  });

  return { texto: r, reemplazos };
}

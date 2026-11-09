import { normalizar } from '../guards/claves.js';
import { CAMPOS, CARGADO_POR_EL_PM, NO_ENCONTRADO } from '../stages/1-armar-contexto/campos.js';
import { MAX_REPREGUNTAS } from '../stages/2-repreguntar/formulario.js';
import { CATEGORIAS, MAX_ATRIBUTOS, MAX_PERSONAS } from '../stages/4-sintetizar/reglas.js';
import type { Caso } from './caso.js';
import type { Foto } from './foto.js';

/** Resultado de un chequeo: pasa o no, con el detalle para el informe. */
export interface Chequeo {
  nombre: string;
  ok: boolean;
  detalle: string[];
}

const CONFIANZAS = ['Alta', 'Media', 'Baja'];
const CODIGO = /^(P\d\d)\b/;

const chequeo = (nombre: string, problemas: string[], bien: string[] = []): Chequeo => ({
  nombre,
  ok: problemas.length === 0,
  detalle: problemas.length ? problemas : bien,
});

/** «Armar contexto» leyendo la spec: cada cita tiene que estar en la spec y lo que la spec dice se tiene que encontrar. */
export function chequearContexto(textos: Record<string, string>, caso: Caso): Chequeo {
  const spec = normalizar(caso.spec ?? '');
  const problemas: string[] = [];
  let encontrados = 0;
  for (const c of CAMPOS) {
    const valor = textos[c.propiedad]?.trim() ?? '';
    const fuente = textos[c.fuente]?.trim() ?? '';
    const esperadoEnSpec = !!caso.contexto[c.fuente] && caso.contexto[c.fuente] !== CARGADO_POR_EL_PM;
    if (!valor || valor === NO_ENCONTRADO) {
      if (esperadoEnSpec) problemas.push(`${c.propiedad}: la spec lo dice y quedó «${NO_ENCONTRADO}».`);
      continue;
    }
    encontrados++;
    const citas = [...fuente.matchAll(/«([^»]+)»/g)].map((m) => m[1]!);
    if (citas.length === 0) problemas.push(`${c.propiedad}: tiene valor pero la fuente no trae una cita («${fuente}»).`);
    for (const cita of citas) {
      if (!spec.includes(normalizar(cita))) problemas.push(`${c.propiedad}: la cita «${cita}» no está en la spec.`);
    }
  }
  return chequeo('Armar contexto', problemas, [`${encontrados} de ${CAMPOS.length} campos encontrados, con citas que están en la spec.`]);
}

/** Cada etapa pedida terminó Lista (o Incompleta, que guarda lo que pudo). */
export function chequearEtapas(resultados: Array<{ etapa: string; resultado: string }>): Chequeo {
  const problemas = resultados.filter((r) => r.resultado !== 'Lista' && r.resultado !== 'Incompleta').map((r) => `${r.etapa}: ${r.resultado}.`);
  return chequeo('Etapas', problemas, resultados.map((r) => `${r.etapa}: ${r.resultado}.`));
}

/** Formato: lo que escribió el agente tiene los campos y valores que espera el modelo de datos. */
export function chequearFormato(foto: Foto): Chequeo {
  const problemas: string[] = [];
  if (foto.personas.length === 0) problemas.push('No quedó ninguna User Persona.');
  for (const persona of foto.personas) {
    if (!persona.nombre) problemas.push(`Persona ${persona.id}: sin nombre.`);
    if (!persona.porQue) problemas.push(`«${persona.nombre}»: sin «Por qué es un segmento distinto».`);
    if (persona.estado !== 'Borrador') problemas.push(`«${persona.nombre}»: quedó en «${persona.estado ?? 'sin estado'}», no en Borrador.`);
  }
  for (const a of foto.atributos) {
    if (!a.categoria || !(CATEGORIAS as readonly string[]).includes(a.categoria)) problemas.push(`«${a.afirmacion}»: categoría «${a.categoria ?? 'vacía'}».`);
    if (!a.confianza || !CONFIANZAS.includes(a.confianza)) problemas.push(`«${a.afirmacion}»: confianza «${a.confianza ?? 'vacía'}».`);
    if (a.personas.length === 0) problemas.push(`«${a.afirmacion}»: no está vinculado a ninguna persona.`);
    if (a.divergencia && !a.posturas) problemas.push(`«${a.afirmacion}»: marcado como divergencia y sin posturas.`);
  }
  for (const s of foto.supuestos) {
    if (!s.metodo || !s.perfil || !s.preguntas) problemas.push(`Supuesto «${s.supuesto}»: le falta método, perfil o preguntas.`);
  }
  return chequeo('Formato', problemas, [
    `${foto.personas.length} persona(s), ${foto.atributos.length} atributo(s) y ${foto.supuestos.length} supuesto(s) con el formato esperado.`,
  ]);
}

/** Trazabilidad: cada atributo cita evidencia que existe y no está excluida; cada supuesto, un atributo que existe. */
export function chequearTrazabilidad(foto: Foto): Chequeo {
  const evidencias = new Map(foto.evidencias.map((e) => [e.id, e]));
  const atributos = new Set(foto.atributos.map((a) => a.id));
  const problemas: string[] = [];
  for (const a of foto.atributos) {
    if (a.evidencias.length === 0) problemas.push(`«${a.afirmacion}»: sin evidencia.`);
    for (const id of a.evidencias) {
      const e = evidencias.get(id);
      if (!e) problemas.push(`«${a.afirmacion}»: cita una evidencia que no existe (${id}).`);
      else if (e.excluida) problemas.push(`«${a.afirmacion}»: cita «${e.titulo}», que está excluida de la síntesis.`);
      else if (e.tipo === 'Pública' && !/^https?:\/\/\S+$/.test(e.url ?? '')) problemas.push(`«${a.afirmacion}»: cita «${e.titulo}», que no tiene una URL válida.`);
    }
  }
  for (const s of foto.supuestos) {
    if (s.atributos.length === 0 || s.atributos.some((id) => !atributos.has(id))) {
      problemas.push(`Supuesto «${s.supuesto}»: no apunta a un atributo que exista.`);
    }
  }
  return chequeo('Trazabilidad', problemas, ['Todos los atributos citan evidencia vigente (la pública, con URL) y todos los supuestos, un atributo.']);
}

/**
 * Topes del diseño: repreguntas por miembro, personas por síntesis y atributos por persona.
 * El de 15 fuentes es de «Relevar la web», que no corre en la evaluación.
 */
export function chequearTopes(foto: Foto): Chequeo {
  const problemas: string[] = [];
  for (const e of foto.entrevistas) {
    if (e.repreguntas > MAX_REPREGUNTAS) problemas.push(`${e.miembro}: ${e.repreguntas} repreguntas, el tope es ${MAX_REPREGUNTAS}.`);
  }
  if (foto.personas.length > MAX_PERSONAS) problemas.push(`${foto.personas.length} personas: el tope es ${MAX_PERSONAS}.`);
  for (const persona of foto.personas) {
    const n = foto.atributos.filter((a) => a.personas.includes(persona.id)).length;
    if (n > MAX_ATRIBUTOS) problemas.push(`«${persona.nombre}»: ${n} atributos, el tope es ${MAX_ATRIBUTOS}.`);
  }
  const repreguntas = foto.entrevistas.map((e) => `${e.miembro}: ${e.repreguntas}`).join(', ');
  return chequeo('Topes', problemas, [
    `Repreguntas por miembro (tope ${MAX_REPREGUNTAS}): ${repreguntas || 'sin entrevistas'}.`,
    `${foto.personas.length} persona(s) (tope ${MAX_PERSONAS}) y hasta ${MAX_ATRIBUTOS} atributos por persona.`,
  ]);
}

/** Quién respondió cada evidencia del equipo y a qué pregunta del formulario base. */
function origenes(foto: Foto): Map<string, { miembro: string; pregunta: string }> {
  const miembroDe = new Map(foto.entrevistas.map((e) => [e.id, e.miembro]));
  const r = new Map<string, { miembro: string; pregunta: string }>();
  for (const e of foto.evidencias) {
    const pregunta = CODIGO.exec(e.titulo)?.[1];
    const miembro = e.entrevistas.map((id) => miembroDe.get(id)).find(Boolean);
    if (e.tipo === 'Supuesto del equipo' && pregunta && miembro) r.set(e.id, { miembro, pregunta });
  }
  return r;
}

/**
 * Divergencias sembradas: un atributo marcado como divergencia tiene que citar respuestas a esas
 * preguntas de al menos un miembro de cada lado. Competidores va aparte y no cuenta acá.
 */
export function chequearDivergencias(foto: Foto, caso: Caso): Chequeo[] {
  const origen = origenes(foto);
  const divergentes = foto.atributos.filter((a) => a.divergencia);
  const detalle: string[] = [];
  const problemas: string[] = [];
  for (const d of caso.esperado.divergencias) {
    const encontrada = divergentes.find((a) => {
      const citas = a.evidencias.flatMap((id) => origen.get(id) ?? []).filter((o) => d.preguntas.includes(o.pregunta));
      return d.lados.every((lado) => citas.some((o) => lado.includes(o.miembro)));
    });
    if (encontrada) detalle.push(`✓ ${d.tema}: «${encontrada.afirmacion}».`);
    else problemas.push(`✗ ${d.tema} (${d.preguntas.join(', ')}): ningún atributo divergente cita a los dos lados.`);
  }
  const resultados = [
    { nombre: 'Divergencias', ok: problemas.length === 0, detalle: [...detalle, ...problemas] },
  ];
  const competidores = caso.esperado.competidores;
  if (competidores) {
    const marca = normalizar(competidores.marcaEnPosturas);
    const a = divergentes.find((x) => normalizar(x.posturas).includes(marca));
    resultados.push({
      nombre: 'Competidores',
      ok: !!a,
      detalle: [a ? `✓ ${competidores.tema}: «${a.afirmacion}».` : `✗ ${competidores.tema}: ningún atributo divergente lo menciona en sus posturas.`],
    });
  }
  return resultados;
}

/** Agnosticismo: en lo que escribió el agente no aparecen términos que solo tienen sentido en otros casos. */
export function chequearAgnostico(foto: Foto, terminosAjenos: string[]): Chequeo {
  const textos = [
    ...foto.personas.flatMap((x) => [x.nombre, x.resumen, x.porQue]),
    ...foto.atributos.map((x) => x.afirmacion),
    ...foto.supuestos.flatMap((x) => [x.supuesto, x.perfil, x.preguntas]),
  ];
  const texto = ` ${normalizar(textos.join(' '))} `;
  // Palabra entera o su plural: «cuota» y «cuotas» cuentan, «cuotaparte» no.
  const presentes = terminosAjenos.filter((t) => {
    const n = normalizar(t);
    return [n, `${n}s`, `${n}es`].some((forma) => texto.includes(` ${forma} `));
  });
  return chequeo(
    'Agnóstico',
    presentes.map((t) => `Aparece «${t}», que es de otro caso.`),
    [`Ninguno de los ${terminosAjenos.length} términos de otros casos aparece en la síntesis.`],
  );
}

export function chequearTodo(foto: Foto, caso: Caso, terminosAjenos: string[]): Chequeo[] {
  return [
    chequearFormato(foto),
    chequearTrazabilidad(foto),
    ...chequearDivergencias(foto, caso),
    chequearTopes(foto),
    chequearAgnostico(foto, terminosAjenos),
  ];
}

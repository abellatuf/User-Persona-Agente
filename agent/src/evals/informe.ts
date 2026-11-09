import type { Chequeo } from './chequeos.js';

/** Informe en Markdown para el resumen de la corrida en GitHub Actions. */
export function informe(titulo: string, chequeos: Chequeo[], notas: string[] = []): string {
  const pasan = chequeos.filter((c) => c.ok).length;
  const lineas = [
    `## ${titulo}`,
    '',
    `**${pasan} de ${chequeos.length} chequeos pasan.**`,
    '',
    '| Chequeo | Resultado |',
    '| --- | --- |',
    ...chequeos.map((c) => `| ${c.nombre} | ${c.ok ? '✅' : '❌'} |`),
    '',
  ];
  for (const c of chequeos) {
    lineas.push(`### ${c.ok ? '✅' : '❌'} ${c.nombre}`, '', ...c.detalle.map((d) => `- ${d}`), '');
  }
  if (notas.length) lineas.push('### Notas', '', ...notas.map((n) => `- ${n}`), '');
  return lineas.join('\n');
}

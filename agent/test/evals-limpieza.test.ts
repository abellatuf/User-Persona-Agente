import { describe, expect, it } from 'vitest';
import { BASES_EVALUACION, BASES_PRINCIPAL } from '../src/config.js';
import { esEspacioDeEvaluacion, vaciarEspacioDeEvaluacion } from '../src/evals/limpieza.js';
import { LlamadorFalso } from './apoyo/llamador-falso.js';

describe('limpieza del espacio de evaluación', () => {
  it('reconoce solo las bases de evaluación', () => {
    expect(esEspacioDeEvaluacion(BASES_EVALUACION)).toBe(true);
    expect(esEspacioDeEvaluacion(BASES_PRINCIPAL)).toBe(false);
    expect(esEspacioDeEvaluacion({ ...BASES_EVALUACION, atributos: BASES_PRINCIPAL.atributos })).toBe(false);
  });

  it('se niega a vaciar el espacio del PM sin tocar nada', async () => {
    const notion = new LlamadorFalso();
    notion.sembrar(BASES_PRINCIPAL.personas, {});
    await expect(vaciarEspacioDeEvaluacion(notion, BASES_PRINCIPAL)).rejects.toThrow(/solo corre sobre el espacio de evaluación/);
    expect(notion.llamadas).toHaveLength(0);
  });

  it('archiva todas las filas salvo Configuración', async () => {
    const notion = new LlamadorFalso();
    const config = notion.sembrar(BASES_EVALUACION.configuracion, {});
    notion.sembrar(BASES_EVALUACION.personas, {});
    notion.sembrar(BASES_EVALUACION.atributos, {});
    notion.sembrar(BASES_EVALUACION.atributos, {});
    const r = await vaciarEspacioDeEvaluacion(notion, BASES_EVALUACION);
    expect(r.atributos).toBe(2);
    expect(r.personas).toBe(1);
    expect(notion.filasDe(BASES_EVALUACION.atributos)).toHaveLength(0);
    expect(notion.paginas.get(config)!.enPapelera).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { BASES } from '../src/config.js';
import { crearGenerador } from '../src/llm/generar.js';
import { PREGUNTAS, propiedadDe } from '../src/stages/2-repreguntar/formulario.js';
import { repreguntarEtapa } from '../src/stages/2-repreguntar/index.js';
import { ProveedorFalso, respuesta } from './apoyo/api-modelo-falsa.js';
import { EspacioFalso } from './apoyo/espacio-falso.js';
import { ID_PM } from './apoyo/llamador-falso.js';

const texto = (valor: string) => ({ rich_text: [{ type: 'text', text: { content: valor } }] });

describe('prompt de repreguntas', () => {
  it('pide no introducir distinciones ni alternativas que el miembro no mencionó (ajuste del 2026-10-25)', async () => {
    const espacio = new EspacioFalso();
    espacio.notion.sembrar(
      BASES.entrevistas,
      {
        Entrevista: { title: [] },
        'Nombre del miembro': texto('Ana'),
        'Rol del miembro': { select: { name: 'PM' } },
        Estado: { status: { name: 'Pendiente' } },
        [propiedadDe(PREGUNTAS[0]!)]: texto('Dos tipos de usuario'),
      },
      ID_PM,
    );
    const gemini = new ProveedorFalso('Gemini', 'gemini-x', [respuesta({ repreguntas: [], sinRepreguntas: 'Alcanza.' })]);

    await repreguntarEtapa({
      solicitud: { id: 's', titulo: 's', etapa: 'Repreguntar', opciones: '' },
      espacio,
      generar: crearGenerador({ principal: gemini, esperar: async () => {} }),
    });

    const enviado = gemini.recibidas[0]!.usuario;
    expect(enviado).toContain('No introduce distinciones, tipos, casos ni alternativas que el miembro no mencionó.');
    expect(enviado).toContain('sin revelar la otra postura');
  });
});

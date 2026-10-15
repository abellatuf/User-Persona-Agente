# Workflows de GitHub Actions

Workflows del agente, definidos en la [Fase 5](../../docs/05-diseno-tecnico.md):

| Archivo | Para qué |
|---------|----------|
| `agente.yml` | Ejecuta el agente todos los días a las 15 h de Argentina (18:00 UTC) y también a mano. |
| `evals.yml` | Ejecuta las evaluaciones, solo a mano, para cuidar la cuota. |
| `verificar-accesos.yml` | Prueba los secretos de Notion, Gemini y OpenRouter sin mostrarlos. Solo a mano (hito H0). |

`agente.yml` y `evals.yml` se agregan durante la Fase 7.

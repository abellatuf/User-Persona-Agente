# Agente (código)

Agente en TypeScript que atiende las **Solicitudes** de Notion. Corre en GitHub Actions con el workflow [`agente.yml`](../.github/workflows/agente.yml). El diseño está en [docs/05-diseno-tecnico.md](../docs/05-diseno-tecnico.md) y el avance, en [docs/07-implementacion.md](../docs/07-implementacion.md).

## Cómo se conecta a Notion

El agente levanta el **servidor MCP oficial de Notion** ([`@notionhq/notion-mcp-server`](https://github.com/makenotion/notion-mcp-server), versión fija `2.5.2`) como subproceso y le habla por stdio con el SDK oficial de MCP. El servidor usa el token de la integración (`NOTION_TOKEN`) y la API de Notion `2025-09-03`, la que trabaja con *data sources*.

## Cómo usa los modelos

Las etapas piden una generación con `generar` (`src/llm/`) y reciben datos ya validados por Zod. **Gemini** es el principal y **OpenRouter**, el respaldo, con los modelos de la página Configuración de Notion. Antes de cada llamada se ocultan los datos personales. Ante límites de uso o errores del servidor hay reintentos, y ante un formato inválido, un reintento con corrección. Si nada funciona, la etapa no escribe nada. El detalle está en el [H3 de la Fase 7](../docs/07-implementacion.md#h3-capa-de-modelos).

## Estructura

| Carpeta | Qué hay |
|---------|---------|
| `src/main.ts` | Punto de entrada: conecta con Notion y corre el bucle |
| `src/probar-modelos.ts` | Punto de entrada de la prueba de modelos (workflow `probar-modelos.yml`) |
| `src/ciclo.ts` | Bucle de solicitudes y registro en Ejecuciones |
| `src/config.ts` | IDs de las bases, modelos por defecto y lectura del entorno |
| `src/notion/` | Cliente MCP (con reintentos), `EspacioNotion` (lecturas) y `Escritor`, el único punto de escritura: `guardar`, `actualizar` y `archivar` |
| `src/llm/` | Interfaz común de modelos, adaptadores de Gemini y OpenRouter, y `generar` con reintentos, respaldo y validación |
| `src/prompts/` | Plantilla base de prompts: rol, reglas comunes, tarea, datos delimitados, formato e idioma |
| `src/guards/` | Reglas en código: confianza, estados prohibidos, trazabilidad, ediciones del PM, datos personales y claves |
| `src/stages/` | Etapa 0 (verificar espacio) y el registro de etapas |
| `src/diagnostico/` | Prueba de modelos (demo del H3) |
| `src/schemas/` | Formatos de lo que se lee de Notion (Zod) |
| `test/` | Pruebas con Vitest, incluida una de integración con el servidor MCP real y APIs falsas de Notion, Gemini y OpenRouter |

## Comandos

```bash
npm ci                  # instalar dependencias
npm test                # pruebas (no usan red ni secretos)
npm run lint            # lint
npm run build           # compilar a dist/
npm start               # ejecutar el agente (requiere NOTION_TOKEN)
npm run probar-modelos  # prueba de modelos (requiere NOTION_TOKEN, GEMINI_API_KEY y OPENROUTER_API_KEY)
```

> El `package-lock.json` fija todas las versiones. Se sube reducido, sin los campos `resolved`, `integrity`, `license`, `funding` ni `engines`, porque se transcribe con el conector de GitHub y así es más chico. `npm ci` funciona igual. Si alguien corre `npm install`, npm los vuelve a agregar, y no pasa nada.

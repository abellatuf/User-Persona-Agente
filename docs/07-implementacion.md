# Fase 7: Implementación y validación

Se sigue el plan de la [Fase 6](06-plan-de-tareas.md), hito por hito. Cada hito cierra con una demo y la aprobación de Abel.

## Avance

| Hito | Estado |
|------|--------|
| H0. Preparación de cuentas y accesos | ✅ Cerrado |
| H1. Esqueleto sin modelo | 🔜 Próximo |
| H2. Reglas en código | ⚪ Pendiente |
| H3. Capa de modelos | ⚪ Pendiente |
| H4. Agente de contexto | ⚪ Pendiente |
| H5. Entrevistas | ⚪ Pendiente |
| H6. Web | ⚪ Pendiente |
| H7. Síntesis | ⚪ Pendiente |
| H8. Validación y persona viva | ⚪ Pendiente |
| H9. Evaluaciones y aceptación | ⚪ Pendiente |

---

## H0. Preparación de cuentas y accesos

> 🔒 **Las claves nunca se pegan en el chat ni en el repositorio.** Solo se cargan como secretos de GitHub (T0.4).

| Tarea | Quién | Estado |
|-------|-------|--------|
| T0.1 Integración de Notion | 👤 | ✅ |
| T0.2 Compartir la página raíz con la integración | 👤 | ✅ |
| T0.3 Claves de Gemini y OpenRouter | 👤 | ✅ |
| T0.4 Secretos en GitHub | 👤 | ✅ |
| T0.5 Método de trabajo | 👤 🤖 | ✅ Código en la carpeta de la sesión del asistente + conector + CI |
| Verificación de accesos (workflow) | 🤖 + 👤 | ✅ Notion, Gemini y OpenRouter OK |

### T0.1 · Crear la integración de Notion

1. Entrá a **[notion.so/profile/integrations](https://www.notion.so/profile/integrations)** con tu cuenta (`abellatuf@gmail.com`).
2. Hacé clic en **New integration** (*Nueva integración*).
3. Completá:
   - **Nombre:** `User-Persona Agente`
   - **Espacio de trabajo:** *Espacio de Abel Latuf*
   - **Tipo:** *Internal* (interna)
4. Guardá. En la pestaña **Capabilities** (*Capacidades*), dejá marcadas **Read content**, **Update content** e **Insert content**. En *User information*, elegí **No user information**: el agente no necesita datos de usuarios.
5. En la pestaña **Configuration**, copiá el **Internal Integration Secret**. Ese es el `NOTION_TOKEN`. Guardalo solo hasta cargarlo en GitHub (T0.4).

### T0.2 · Compartir la página raíz con la integración

1. Abrí la página **[User-Persona Agente](https://app.notion.com/p/3fa245a35f2b81f2afcec088c81678a4)** en Notion.
2. Hacé clic en **⋯** (arriba a la derecha) → **Connections** (*Conexiones*) → buscá **User-Persona Agente** → **Confirm**.
3. Listo: la integración ve esa página y sus 10 bases, **y nada más** de tu Notion (RNF-10).

### T0.3 · Obtener las claves de los modelos

**Gemini (capa gratuita):**
1. Entrá a **[aistudio.google.com](https://aistudio.google.com)** con tu cuenta de Google.
2. Hacé clic en **Get API key** → **Create API key**.
3. Copiá la clave. Esa es la `GEMINI_API_KEY`.

**OpenRouter:**
1. Entrá a **[openrouter.ai](https://openrouter.ai)** y creá una cuenta o iniciá sesión.
2. Abrí **Keys** → **Create Key**, con el nombre `User-Persona Agente`.
3. Copiá la clave. Esa es la `OPENROUTER_API_KEY`.
4. **No cargues crédito:** así solo funcionan los modelos gratuitos y no hay riesgo de gastar plata (RNF-01).

### T0.4 · Cargar los secretos en GitHub

1. Entrá a **[github.com/abellatuf/User-Persona-Agente](https://github.com/abellatuf/User-Persona-Agente)** → **Settings** → **Secrets and variables** → **Actions**.
2. En la pestaña **Secrets**, hacé clic en **New repository secret** y creá estos tres, con estos nombres exactos:

| Nombre | Valor |
|--------|-------|
| `NOTION_TOKEN` | El secreto de la integración de Notion (T0.1) |
| `GEMINI_API_KEY` | La clave de Gemini (T0.3) |
| `OPENROUTER_API_KEY` | La clave de OpenRouter (T0.3) |

3. Después de cargarlos, podés borrar las claves de donde las hayas anotado. GitHub no las vuelve a mostrar, y si alguna vez hace falta, se genera una nueva.

### Verificación de accesos

El workflow **Verificar accesos** (`.github/workflows/verificar-accesos.yml`) prueba los tres secretos **sin mostrarlos**. Solo responde OK o FALLA para cada uno:

- **Notion:** que el token pueda leer la página raíz. Si falla, revisá T0.2.
- **Gemini:** que la clave sea válida (lista los modelos disponibles, sin generar texto ni gastar cuota de generación).
- **OpenRouter:** que la clave sea válida.

Para ejecutarlo:
1. Abrí la pestaña **[Actions](https://github.com/abellatuf/User-Persona-Agente/actions)** del repo.
2. Elegí **Verificar accesos** en la lista de la izquierda.
3. Hacé clic en **Run workflow** → **Run workflow**.
4. Al minuto, el resultado aparece con ✅ o ❌. Si algo falla, abrí la ejecución y fijate cuál de los tres dio FALLA.

**Demo de cierre del H0:** la ejecución de *Verificar accesos* en verde ✅. **Cumplida el 2026-10-15.**

> **Lección aprendida:** la primera verificación dio **404 en Notion**. La página raíz tenía la conexión de Claude (la que usó el asistente para crear la plantilla), pero no la de la integración *User-Persona Agente*. Son conexiones distintas. Para la API de Notion, una página que no está compartida con la integración "no existe", por eso devuelve 404 y no 403.

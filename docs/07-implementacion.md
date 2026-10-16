# Fase 7: Implementación y validación

Se sigue el plan de la [Fase 6](06-plan-de-tareas.md), hito por hito. Cada hito cierra con una demo y la aprobación de Abel.

## Avance

| Hito | Estado |
|------|--------|
| H0. Preparación de cuentas y accesos | ✅ Cerrado |
| H1. Esqueleto sin modelo | ✅ Cerrado |
| H2. Reglas en código | 🔜 Próximo |
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

---

## H1. Esqueleto de punta a punta, sin modelo de lenguaje

El agente ya atiende las Solicitudes de Notion de punta a punta, **sin llamar a ningún modelo**. Las etapas 1 a 5 todavía son marcadores: terminan en *Lista* y lo explican en la fila de Ejecuciones.

| Tarea | Quién | Estado |
|-------|-------|--------|
| T1.1 Proyecto TypeScript en `agent/` | 🤖 | ✅ Node 24, TypeScript, Zod, Vitest y ESLint. `npm test` en verde |
| T1.2 Plantilla de Notion | 🤖 + 👤 | ✅ Ver [notion-plantilla.md](notion-plantilla.md) |
| T1.3 Cliente MCP hacia el servidor MCP de Notion | 🤖 | ✅ Probado con el servidor real, una API de Notion falsa y el token real (demo) |
| T1.4 Etapa 0: verificar espacio | 🤖 | ✅ |
| T1.5 Bucle de solicitudes | 🤖 | ✅ |
| T1.6 Registro en Ejecuciones | 🤖 | ✅ |
| T1.7 Workflow `agente.yml` | 🤖 | ✅ Ejecución manual OK (demo) |
| Demo | 👤 | ✅ Cumplida el 2026-10-16 |

### Decisiones de diseño (aprobadas por Abel)

- **Servidor MCP:** el oficial de Notion, [`@notionhq/notion-mcp-server`](https://github.com/makenotion/notion-mcp-server), fijado en la versión `2.5.2`. Acepta el token de integración por `NOTION_TOKEN` y usa la API `2025-09-03`, la de *data sources*. Se instala como dependencia del proyecto y el agente lo levanta como subproceso por stdio, con el SDK oficial de MCP (`@modelcontextprotocol/sdk` 1.32.1). Se descartaron el MCP alojado de Notion, que pide OAuth con una persona, y los servidores de la comunidad.
- **Interfaz `EspacioNotion`:** el bucle y las etapas dependen de esta interfaz y no de MCP, así se prueban con un espacio falso en memoria. Ahí se van a enchufar las guardias del H2.
- **Una fila en Ejecuciones por cada corrida**, también cuando no hay nada que hacer: *Pausado* si *Agente activo* está desmarcado y *Sin pendientes* si no hay solicitudes. Con el programado diario, aparece una fila por día.
- **Hasta 10 solicitudes por ejecución**, de la más vieja a la más nueva.
- **Cero tokens garantizado:** `agente.yml` recibe solo `NOTION_TOKEN`. Sin las claves de Gemini y OpenRouter, el agente no puede llamar a un modelo.

### Cómo funciona una ejecución

1. Lee **Configuración**. Si *Agente activo* está desmarcado, deja una fila *Pausado* y termina.
2. Busca las solicitudes en **Pendiente**. Si no hay ninguna, deja una fila *Sin pendientes* y termina.
3. **Etapa 0:** revisa que estén las 10 bases con sus propiedades, tipos y opciones. Si falta algo, cada solicitud pasa a *Error* y la lista de faltantes queda en *Errores* de su fila de Ejecuciones.
4. Por cada solicitud: crea su fila en Ejecuciones (Etapa, Solicitud, Inicio), la pasa a **En curso**, ejecuta la etapa y la marca **Lista** o **Error**. Después cierra la fila con Fin, Resultado, Errores, Lecturas, Escrituras, Intentos bloqueados y *Proveedor y modelo*, y deja las notas en el cuerpo de la página.
5. Si algo falla a mitad de camino, la solicitud pasa a *Error* con el motivo. **Nunca queda trabada en *En curso*.**

> Las lecturas compartidas de la corrida (Configuración, la búsqueda de pendientes y la etapa 0) se cuentan en la fila de la primera solicitud.

### Pruebas

`npm test` corre 25 pruebas, sin red ni secretos. El workflow [CI](../.github/workflows/ci.yml) las corre en cada cambio de `agent/`.

- **Bucle y etapa 0**, con un espacio de Notion falso en memoria: pausado, sin pendientes, solicitud *Lista*, varias solicitudes y el tope, espacio incompleto, solicitud sin etapa, etapa que falla, y fallas al leer Configuración o al escribir en Ejecuciones.
- **Integración:** el agente levanta el **servidor MCP real**, que habla con una **API de Notion falsa** local. Así se verifica que las llamadas lleguen bien a la API: rutas, cuerpos, cabecera de autorización y versión `2025-09-03`.

### Demo de cierre del H1 (la hace Abel)

0. En la pestaña **[Actions](https://github.com/abellatuf/User-Persona-Agente/actions)**, revisá que el workflow **CI** del último commit esté en ✅. El asistente no puede verlo, porque el conector de GitHub no tiene acceso a Actions. El primer commit del H1 puede aparecer en ❌: se subió sin el `package-lock.json`, que llegó en el commit siguiente.
1. En Notion, abrí **Configuración** y **marcá** la casilla **Agente activo**.
2. En **Solicitudes**, creá una fila nueva. Por ejemplo, *Solicitud* = "Prueba del H1" y *Etapa* = *Armar contexto*. Dejá *Estado* en **Pendiente**.
3. En GitHub, abrí la pestaña **[Actions](https://github.com/abellatuf/User-Persona-Agente/actions)** → **Agente** → **Run workflow** → **Run workflow**.
4. Al minuto, la ejecución termina en ✅. En Notion:
   - La solicitud está en **Lista**.
   - En **Ejecuciones** hay una fila nueva vinculada a la solicitud, con Resultado *Lista*, *Proveedor y modelo* = "Ninguno (H1)" y la nota "Etapa no implementada todavía".
5. **Opcional:** volvé a ejecutar el workflow sin solicitudes pendientes. Aparece una fila *Sin pendientes*. Si desmarcás *Agente activo*, aparece una fila *Pausado*.

> Si algo falla, abrí la ejecución en Actions: el paso **Ejecutar el agente** muestra qué pasó con cada solicitud. El token nunca aparece en el log.

**Demo de cierre del H1:** CI en verde ✅, la solicitud de prueba pasó a *Lista* y apareció su fila en Ejecuciones, sin gastar tokens de IA. **Cumplida el 2026-10-16.** *Agente activo* queda marcado: desde ahora el programado diario deja una fila por día en Ejecuciones.

> **Lecciones aprendidas:**
> - El conector de GitHub no ve Actions, así que el resultado del CI lo confirma Abel.
> - El primer commit se subió sin el `package-lock.json`. Antes de cada push, conviene listar los archivos y comparar los SHA de los blobs con los locales.
> - El servidor MCP de Notion acepta `BASE_URL`. Eso permitió probarlo de punta a punta contra una API falsa, y la primera ejecución real funcionó sin ajustes.

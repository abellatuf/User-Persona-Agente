# Fase 7: Implementación y validación

Se sigue el plan de la [Fase 6](06-plan-de-tareas.md), hito por hito. Cada hito cierra con una demo y la aprobación de Abel.

## Avance

| Hito | Estado |
|------|--------|
| H0. Preparación de cuentas y accesos | ✅ Cerrado |
| H1. Esqueleto sin modelo | ✅ Cerrado |
| H2. Reglas en código | ✅ Cerrado |
| H3. Capa de modelos | ✅ Cerrado |
| H4. Agente de contexto | ✅ Cerrado |
| H5. Entrevistas | ✅ Cerrado |
| H6. Web | ✅ Cerrado |
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

---

## H2. Reglas en código (sin modelo)

Las reglas que no pueden depender de que el modelo "se porte bien" ya están en el código y probadas. Todavía ninguna etapa las usa con datos reales: las van a usar las etapas 1 a 5, a partir del H4.

| Tarea | Quién | Estado |
|-------|-------|--------|
| T2.1 Cálculo de confianza | 🤖 | ✅ `calcularConfianza` |
| T2.2 Guardia de estados prohibidos | 🤖 | ✅ |
| T2.3 Guardia de trazabilidad | 🤖 | ✅ |
| T2.4 No pisar al PM | 🤖 | ✅ |
| T2.5 Ocultar datos personales | 🤖 | ✅ `ocultarDatosPersonales`, conectado a los modelos en el H3 |
| T2.6 Idempotencia | 🤖 | ✅ Propiedad *Clave* |
| Demo | 👤 | ✅ Cumplida el 2026-10-16 |

### Decisiones de diseño (aprobadas por Abel)

- **Un único punto de escritura:** el `Escritor` (`agent/src/notion/escritor.ts`). Ninguna etapa escribe en Notion por otro camino, y toda escritura pasa por las reglas de `agent/src/guards/escritura.ts` antes de llegar a la API. Tiene tres operaciones:
  - **`guardar`:** con clave, busca la fila por *Clave* y la actualiza, o la crea si no existe. Sin clave, siempre crea, y eso solo se permite en Ejecuciones.
  - **`actualizar`:** modifica una página conocida por su id, como el estado de una Solicitud o el cierre de una fila de Ejecuciones.
  - **`archivar`:** manda la página a la papelera de Notion, de donde se puede recuperar durante 30 días, y deja el motivo en Ejecuciones. Se agregó a pedido de Abel, para que una re-síntesis pueda sacar atributos que ya no corresponden. **Nunca se elimina nada definitivamente.**
- **Un intento bloqueado deja la solicitud en *Error*** con el motivo, y se cuenta en *Intentos bloqueados* de su fila de Ejecuciones. Un bloqueo es un bug o una manipulación, así que es más seguro frenar.
- **Fuentes independientes:** dos filas distintas de Evidencia de tipo *Investigación propia* cuentan como fuentes independientes. Cuidar de no cargar el mismo estudio dos veces queda del lado del PM.
- **Vincular es respaldar:** una evidencia vinculada a un atributo significa que lo respalda. La evidencia que lo contradice no se vincula: pasa a ser una divergencia. Así, "la información pública coincide con el equipo" se decide por código.
- **Cambios en la plantilla:** *Clave* en Evidencia, Atributos, User Personas y Supuestos a validar, y *Editado por el PM* en Atributos. La etapa 0 ahora las exige.

### Qué bloquea el código

| Regla | Qué hace |
|-------|----------|
| Estados del PM | Bloquea escribir *En revisión*, *Aprobada* o *Rechazada* en una persona, y *Confirmado* en el contexto. |
| Personas fuera de Borrador | Solo se modifican personas en *Borrador*. La única excepción es pasar una persona *Aprobada* a *Reemplazada*, sin tocar nada más. Tampoco se modifican los atributos de una persona que ya no está en Borrador. |
| Contexto confirmado | No se modifica un contexto que el PM ya confirmó. |
| Trazabilidad | No se crea un atributo sin evidencia, ni se lo deja sin evidencia. |
| Clave obligatoria | No se crean filas sin clave en Evidencia, Atributos, User Personas ni Supuestos. |
| Archivar | Solo en Atributos, Supuestos y Evidencia, y solo filas que creó el agente. No se archiva un atributo editado por el PM, ni un supuesto que el PM ya está validando. |
| Otras bases | No se modifica una página que no pertenece a la base indicada. |

**No pisar al PM.** Antes de actualizar un atributo, el agente mira quién lo editó por última vez. Si no fue él, o si *Editado por el PM* está marcada, no toca los campos: escribe lo que habría cambiado en *Sugerencia del agente* y marca *Editado por el PM*. Desde ese momento el atributo queda protegido.

> **Ajuste respecto de la propuesta:** había propuesto que el PM pudiera **desmarcar** *Editado por el PM* para que el agente vuelva a actualizar. No funciona: al desmarcarla, el PM pasa a ser el último en editar, y el agente vuelve a protegerlo. Para eso haría falta guardar una "huella" de lo que escribió el agente, en una propiedad más. Por ahora la casilla queda fija y el PM incorpora las sugerencias a mano. Si más adelante hace falta, se agrega la huella.

**Datos personales.** `ocultarDatosPersonales` reemplaza correos por `[CORREO]`, teléfonos por `[TELÉFONO]`, y DNI (solo si aparece la palabra) o CUIT/CUIL por `[DOCUMENTO]`. No toca fechas, años, rangos, montos, porcentajes ni versiones.

### Pruebas

`npm test` corre **101 pruebas**, sin red ni secretos:

- **Confianza:** Alta, Media y Baja; la misma fila vinculada dos veces cuenta una sola vez; y el tope por divergencia.
- **Reglas de escritura:** cada estado prohibido, las personas fuera de Borrador, la trazabilidad, la clave obligatoria, archivar y la sugerencia ante una edición del PM.
- **Escritor**, con un Notion falso en memoria: un intento de aprobar no llega a Notion y queda contado; guardar dos veces con la misma clave deja una sola fila; una edición del PM queda protegida; y se archiva solo lo permitido.
- **Datos personales y claves**, incluidos los casos que no se deben tocar.
- **Integración con el servidor MCP real:** un intento de aprobar una persona no llega a la API y deja *Intentos bloqueados* = 1; repetir una escritura no duplica la fila; y una edición del PM no se pisa.

Para confirmar que las pruebas detectan fallas, se sacó a propósito la regla de estados prohibidos: fallaron 6 pruebas. Con la regla restaurada, vuelven a pasar todas.

### Demo de cierre del H2 (la hace Abel)

1. Abrí la pestaña **[Actions](https://github.com/abellatuf/User-Persona-Agente/actions)** y revisá que el workflow **CI** del último commit esté en ✅.
2. **Opcional:** abrí la ejecución → paso **Pruebas** para ver el listado. Las pruebas de estados prohibidos están en `reglas-escritura.test.ts`, `escritor.test.ts` e `integracion-mcp.test.ts`.
3. **Opcional:** ejecutá el workflow **Agente** con una Solicitud nueva. Tiene que seguir funcionando igual que en el H1, ahora verificando también las propiedades nuevas de la plantilla.

**Demo de cierre del H2:** CI en verde ✅ con las 101 pruebas. **Cumplida el 2026-10-16.**

---

## H3. Capa de modelos

El agente ya sabe pedirle algo a un modelo y recibir una respuesta **validada**, con reintentos, respaldo y datos personales ocultos. Todavía ninguna etapa la usa: la primera va a ser el agente de contexto, en el H4. El programado diario **sigue sin las claves de los modelos**, así que no gasta cuota.

| Tarea | Quién | Estado |
|-------|-------|--------|
| T3.1 Interfaz común + adaptador de Gemini | 🤖 | ✅ `generar` (`agent/src/llm/`) y `ProveedorGemini` |
| T3.2 Adaptador de OpenRouter | 🤖 | ✅ `ProveedorOpenRouter` |
| T3.3 Reintentos y respaldo ante límites de uso | 🤖 | ✅ |
| T3.4 Reintento por formato inválido | 🤖 | ✅ |
| T3.5 Plantilla base de prompts | 🤖 | ✅ `armarPrompt` (`agent/src/prompts/base.ts`) |
| Demo | 👤 | ✅ Cumplida el 2026-10-17 |

### Decisiones de diseño (aprobadas por Abel)

- **Una sola función para las etapas:** `generar({ mensajes, esquema })` devuelve los datos ya validados por Zod, quién respondió, los intentos y los tokens. Las etapas no conocen a Gemini ni a OpenRouter.
- **Sin SDK nuevos:** los dos adaptadores usan `fetch` y aceptan una URL base configurable. Así se prueban contra APIs falsas locales, igual que Notion.
- **Datos personales dentro de `generar`:** `ocultarDatosPersonales` se aplica a todo el texto antes de cada llamada. Ninguna etapa se lo puede olvidar.
- **Formato inválido:** un reintento con el mismo proveedor, con el error de Zod en el prompt. Si sigue mal, se prueba con el respaldo. Si también falla, **no se escribe nada**.
- **Workflow de prueba aparte:** la demo usa `probar-modelos.yml`, solo manual. `agente.yml` sigue recibiendo **solo `NOTION_TOKEN`** hasta el H4, para que el programado no pueda gastar tokens.
- **Tokens en las notas de Ejecuciones:** sin cambiar la plantilla.

### Decisiones tomadas al implementar (aprobadas por Abel el 2026-10-17)

- **Modelos por defecto:** `gemini-3.8-flash`, el Flash estable vigente según la documentación de Google al 2026-10-16, y `openrouter/free`, el router de OpenRouter que elige entre sus modelos gratuitos. Con el router no dependemos de que un modelo `:free` puntual siga existiendo. Los dos se cambian desde *Modelo principal* y *Modelo de respaldo* en **Configuración**, sin tocar código. Vacíos, se usan los valores por defecto. Abel eligió `gemini-3.6-flash` como principal en Configuración.
- **Cómo se pide el JSON:** a Gemini se le pide salida JSON (`responseMimeType`) con el esquema escrito en el prompt. No se usa el campo de esquema de la API de Gemini porque no pude confirmar en la documentación cuál acepta un JSON Schema completo, y un campo equivocado daría error 400 en todas las llamadas. A OpenRouter se le manda el esquema con `response_format: json_schema`. En los dos casos, **Zod valida igual**.
- **La falla forzada es simulada:** con la casilla marcada, el agente no llama a Gemini y simula un límite de uso (429). Así se ven los reintentos y el paso al respaldo sin gastar cuota. Un error real de Gemini (clave, modelo inexistente o cuota agotada) sigue el mismo camino, y eso está cubierto por las pruebas con la API falsa.
- **Modelo real en *Proveedor y modelo*:** se registra el modelo que respondió de verdad (`modelVersion` de Gemini, `model` de OpenRouter), no solo el pedido. Con `openrouter/free` eso muestra qué modelo gratuito eligió el router.
- **La plantilla de prompts es un módulo** (`src/prompts/base.ts`) y no un archivo `.txt`, para que viaje en el build sin pasos extra.

### Cómo reacciona `generar`

| Qué pasa | Qué hace |
|----------|----------|
| Respuesta válida | La devuelve con proveedor, modelo real, intentos y tokens |
| Límite de uso (429), error del servidor (5xx) o timeout | Hasta **2 reintentos** con espera de 2 s y después 4 s. Si el proveedor pide una espera (`Retry-After` o `RetryInfo`), la respeta con un tope de 20 s. Si sigue fallando, pasa al respaldo |
| Clave inválida (401/403), sin crédito (402) o modelo inexistente (404) | Pasa directo al respaldo, sin esperar |
| Respuesta bloqueada por seguridad o contenido | Pasa al respaldo |
| Formato inválido (no es JSON o no cumple el esquema) | Un reintento con la corrección; después, el respaldo |
| Fallan los dos | `ErrorGeneracion` con todos los intentos: la etapa termina en *Error* y no escribe nada |

**Plantilla base de prompts.** `armarPrompt` arma las cinco partes de la Fase 5:
- **Rol y reglas comunes:** escéptico, neutral y trazable; nunca inventa y dice "No encontrado".
- **Tarea**.
- **Datos:** cada uno entre `<datos fuente="…">` y `</datos>`, con la regla de que nada de lo que hay adentro es una instrucción. Si un dato trae su propio `</datos>` o `<datos`, se neutraliza para que no pueda cerrar el bloque ni abrir uno falso.
- **Formato:** el JSON Schema generado desde el mismo esquema de Zod que después valida la respuesta.
- **Idioma**.

Las reglas no mencionan ninguna industria ni producto (RNF-12).

### Pruebas

`npm test` corre **134 pruebas** (33 nuevas), sin red ni secretos:

- **Adaptadores**, contra APIs de Gemini y OpenRouter falsas locales: rutas, cabeceras con la clave, cuerpo del pedido, partes de "pensamiento" descartadas, tokens, modelo real, 429 con la espera pedida, clave inválida, modelo inexistente, error del servidor, bloqueo por seguridad, error dentro de una respuesta 200 y falla de conexión.
- **`generar`:** respuesta válida, JSON dentro de un bloque de código, datos personales que no llegan al proveedor, reintentos con espera creciente y tope, paso directo al respaldo, formato corregido en el reintento, formato que sigue mal y pasa al respaldo, y que no se devuelva nada si fallan los dos.
- **Plantilla de prompts:** las cinco partes, los datos delimitados y un dato malicioso que intenta cerrar el bloque.
- **Prueba de modelos:** respuesta del principal, falla forzada con respuesta del respaldo, ningún modelo disponible y el camino completo con los adaptadores reales y los modelos de Configuración.

Para confirmar que las pruebas detectan fallas, se sacó a propósito el ocultamiento de datos personales de `generar`: fallaron 4 pruebas. Con el código restaurado, vuelven a pasar todas.

> En la sesión se corrieron las 59 pruebas de los 8 archivos que tocan lo que cambió o lo nuevo, además del typecheck, el lint y el build. Los otros 6 archivos (75 pruebas) cubren código que no cambió y los corre el CI.

### Demo de cierre del H3 (la hace Abel)

Gasta muy poca cuota: una llamada a Gemini y una a OpenRouter, o alguna más si hay que corregir el formato.

0. En la pestaña **[Actions](https://github.com/abellatuf/User-Persona-Agente/actions)**, revisá que el workflow **CI** del último commit esté en ✅.
1. En **Actions** → **Probar modelos** → **Run workflow** se abre un recuadro con la casilla *Simular un límite de uso en Gemini*. Dejala **sin marcar** y hacé clic en el botón verde **Run workflow**. Al minuto termina en ✅. En Notion, en **Ejecuciones**, aparece la fila *Prueba de modelos* con:
   - Resultado **Lista** y *Proveedor y modelo* = "Gemini · …".
   - En el cuerpo: el intento, los tokens, la respuesta validada y la nota "el correo no salió del agente".
2. Volvé a ejecutarlo **marcando** *Simular un límite de uso en Gemini*. Aparece la fila *Prueba de modelos · falla forzada* con:
   - *Proveedor y modelo* = "OpenRouter · … (respaldo)".
   - En el cuerpo, los 3 intentos de Gemini con *error: limite* y después la respuesta de OpenRouter.

> Si el paso 1 falla con *error: modelo*, el nombre del modelo de Gemini no existe para tu clave. Escribí otro en *Modelo principal* de **Configuración** y volvé a probar. Ante cualquier otra falla, el detalle de cada intento queda en el cuerpo de la fila y en el paso **Probar modelos** del log. Las claves nunca aparecen.

**Demo de cierre del H3:** CI en verde ✅ y las dos pruebas en *Lista*. **Cumplida el 2026-10-17.**
- **Sin falla forzada:** respondió *Gemini · gemini-3.6-flash* en el primer intento, con 580 tokens, y el correo de prueba llegó al modelo como `[CORREO]`.
- **Con falla forzada:** 3 intentos simulados de Gemini con *error: limite* y después respondió *OpenRouter · liquid/lfm-2.5-2.6b:free (respaldo)*, el modelo gratuito que eligió `openrouter/free`, con 751 tokens.

> **Lecciones aprendidas:**
> - Las primeras corridas fallaron con *"Ningún modelo devolvió una respuesta válida"*. La causa: en **Configuración**, *Modelo principal* y *Modelo de respaldo* tenían el texto de relleno de la plantilla ("Por definir en H3…"), y el agente lo tomó como nombre de modelo. OpenRouter respondió 400 (*not a valid model ID*). Se corrigió en Notion (`openrouter/free`) sin tocar código. El agente se comportó como debía: no inventó nada, registró cada intento y no escribió nada. **Posible mejora para más adelante:** que la etapa 0 avise si esos campos tienen algo que no parece un nombre de modelo.
> - La casilla de la falla forzada está en el recuadro de **Run workflow** de GitHub, no en Notion. Las primeras corridas se hicieron con la casilla marcada, así que Gemini no se llamaba. El título de la fila (*"· falla forzada"*) permite distinguirlas.

> **Lección aprendida:** esta sesión del asistente corrió en una PC con Windows sin Node.js ni git. Con el permiso de Abel, se bajó el `.zip` oficial de Node 24.22.0 desde nodejs.org, se verificó con su `SHASUMS256.txt` y se descomprimió en la carpeta de la sesión, sin instalar nada en el sistema. Como la ruta de esa carpeta supera el límite de 260 caracteres de Windows, se trabajó a través de una letra de unidad temporal (`subst`). El código se bajó y se subió con el conector, como siempre.

---

## H4. Etapa 1: agente de contexto

El agente ya arma el contexto del producto a partir de las fuentes que indica el PM: lee documentos y una URL, le pide al modelo cada campo con su fuente y una **cita textual**, **verifica por código que la cita exista en la fuente**, y deja el contexto en *Por confirmar* sin pisar lo que cargó el PM. Las etapas 2 a 5 no arrancan hasta que el PM lo confirma.

| Tarea | Quién | Estado |
|-------|-------|--------|
| T4.1 Leer documentos adjuntos en Notion | 🤖 | ✅ `.md`, `.txt`, `.csv` y `.pdf` (con `unpdf`) |
| T4.2 Leer una URL pública | 🤖 | ✅ Una sola página, sin direcciones privadas |
| T4.3 Prompt y esquema, con fuente por campo o "No encontrado" | 🤖 | ✅ Con cita verificada por código |
| T4.4 Contexto en *Por confirmar* y bloqueo de las etapas siguientes | 🤖 | ✅ |
| T4.5 Formulario de contexto manual | 🤖 | ✅ Vista de formulario *Contexto manual* |
| T4.6 Lectura desde GitHub (*could*) | 🤖 | ⏸️ Queda para el final del MVP |
| T4.7 Revisión de Abel con cobros-recurrentes | 👤 | ✅ Cumplida el 2026-10-24 |
| Demo | 👤 | ✅ Cumplida el 2026-10-24 |

### Decisiones de diseño (aprobadas por Abel el 2026-10-18)

- **Una sola fila de contexto por espacio**, como Configuración. Sin filas, o con más de una, la solicitud termina en *Error* con el motivo. Para otro producto se duplica la plantilla.
- **Fuentes:** los archivos de *Documentos fuente* y la dirección de *URL fuente*, en la misma fila.
  - Documentos: `.md`, `.txt` y `.csv` como texto; `.pdf` con [`unpdf`](https://github.com/unjs/unpdf) 1.8.1, la primera dependencia nueva desde el H1 (JavaScript puro; su paquete de dibujo es opcional y no se instala). Otros formatos se saltean con un aviso. Hasta 10 MB.
  - URL: una sola página, sin seguir enlaces, solo `http` o `https`, hasta 2 MB y 20 s. Se rechazan las direcciones locales y privadas, también después de una redirección. El texto se saca del HTML con un extractor propio y simple.
  - Tope de **60.000 caracteres por fuente**; si se recorta, queda anotado.
- **Cita verificada por código:** por cada campo, el modelo devuelve *valor*, *fuente* y *cita*. El código acepta el campo solo si la fuente es una de las que se le pasaron y si la cita, de al menos 4 palabras, **aparece en el texto de esa fuente** (sin distinguir mayúsculas, acentos, signos ni formato Markdown). Si no, el campo queda en "No encontrado" y el motivo va a Ejecuciones. En la columna «· fuente» queda la fuente con la cita, por ejemplo `spec.md · «…»`.
- **No pisar al PM:** el agente solo escribe los campos vacíos o en "No encontrado". Si un campo tiene otro valor, no lo toca y deja su propuesta en las notas de Ejecuciones. Para regenerar un campo, se vacía. El título (*Nombre*) solo se escribe si está vacío.
- **Contexto Confirmado:** el agente no lo toca y termina en *Error* con el mensaje "pasalo a *Por confirmar* si querés rehacerlo".
- **Contexto manual (HU-03b):** si no hay fuentes, el agente no llama a ningún modelo. Marca «Cargado por el PM» en la fuente de cada campo con valor, "No encontrado" en los vacíos, y deja todo en *Por confirmar*.
- **Idioma:** se escribe en *Idioma* del contexto (si está vacío) y las etapas siguientes lo leen de ahí. *Idioma* de Configuración no se usa.
- **Bloqueo de las etapas 2 a 5 (T4.4):** antes de *Repreguntar*, *Relevar la web*, *Sintetizar* y *Planificar validación*, el código exige el contexto *Confirmado*. Si no lo está, la solicitud termina en *Error* con el motivo.
- **`agente.yml` recibe las claves de los modelos.** El generador se arma una vez por corrida y no llama a nada por sí solo: sin solicitudes que usen un modelo, no se gastan tokens. Si faltan las claves, solo fallan las etapas que las necesitan, con el motivo.
- **Lección del H3:** si *Modelo principal* o *Modelo de respaldo* tienen algo que no parece un nombre de modelo (por ejemplo, un texto con espacios), no se llama y el motivo queda en Ejecuciones.
- **Privacidad (HU-03):** la descripción de la base Contexto avisa que las fuentes se envían a un proveedor de IA gratuito. Además, los datos personales de las fuentes se ocultan antes del prompt, y la cita se verifica contra ese mismo texto.

### Pruebas

`npm test` corre **165 pruebas** (31 nuevas), sin red ni secretos:

- **Fuentes**, con un servidor local: `.md` con BOM, PDF, recorte al tope, formato no soportado sin descargar nada, página HTML sin scripts ni estilos, redirecciones (y su límite), contenido que no es texto, 404, tamaño máximo, y el rechazo de `localhost`, `10.x`, `192.168.x`, `::1` y otras direcciones privadas.
- **Etapa 1:** campos con fuente y cita, "No encontrado", cita inventada y fuente inventada rechazadas, correo oculto antes del modelo, no pisar al PM, contexto Confirmado intacto, contexto manual sin modelo, cero o dos filas, fuentes que no se pueden leer, sin modelo disponible, formato inválido sin escrituras y el camino por el bucle.
- **Bloqueo:** *Repreguntar* sin contexto Confirmado termina en *Error*; con el contexto Confirmado, la etapa sigue.
- **Modelos:** el texto de relleno de Configuración no se usa como modelo.

Para confirmar que las pruebas detectan fallas, se sacó a propósito la verificación de la cita: fallaron 2 pruebas. Con el código restaurado, vuelven a pasar todas.

> En la sesión se corrieron las 90 pruebas de los 10 archivos que tocan lo que cambió o lo nuevo, además del typecheck, el lint y el build. Los otros 6 archivos (75 pruebas) cubren código que no cambió y los corre el CI. La lectura de una URL real no se pudo probar en la sesión porque Node no tiene salida a internet en esta PC; la valida la demo.

### Demo de cierre del H4 (la hace Abel)

La guía detallada, paso por paso, está en [demo-h4-guia.md](demo-h4-guia.md).

0. En **[Actions](https://github.com/abellatuf/User-Persona-Agente/actions)** → **CI**, revisá que el último commit esté en ✅.
1. En Notion, en **Configuración**, volvé a **marcar** *Agente activo*.
2. En **Contexto del producto**, abrí la fila del producto (o creala). Subí `cobros-recurrentes-spec.md` en **Documentos fuente**. Dejá los campos vacíos y *Estado* en *Por confirmar*.
3. En **Solicitudes**, creá una fila con *Etapa* = **Armar contexto** y *Estado* = **Pendiente**.
4. En Actions → **Agente** → **Run workflow** → **Run workflow**.
5. Al terminar, en **Contexto del producto**:
   - *Estado* = **Por confirmar**.
   - Cada campo con su valor y su «· fuente» con la cita, o "No encontrado".
   - En **Ejecuciones**, la fila de la solicitud con el modelo que respondió y una nota por campo.
6. **Bloqueo:** sin confirmar el contexto, creá otra solicitud con *Etapa* = **Repreguntar** y corré **Agente** otra vez. Tiene que terminar en **Error** con el motivo "el contexto del producto no está Confirmado".
7. **T4.7:** revisá el contexto, completá lo que quedó en "No encontrado", anotá qué tuviste que corregir y marcalo como **Confirmado**.

**Demo de cierre del H4:** *Armar contexto* en *Lista*, el bloqueo funcionando y el contexto *Confirmado* por Abel. **Cumplida el 2026-10-24.**

### Resultado de la demo del H4

**Armar contexto (2026-10-21).** La solicitud terminó en *Lista*, con 15 lecturas, 6 escrituras y 0 intentos bloqueados. Gemini (`gemini-3.6-flash`) respondió **503 por alta demanda** en los 3 intentos, así que contestó el respaldo: `openrouter/free` eligió `liquid/lfm-2.5-2.6b:free`. Se usaron 5.919 tokens. La spec se leyó completa (9.376 caracteres).

| Campo | Resultado del agente | Revisión de Abel |
|-------|----------------------|------------------|
| Nombre | "App de Cobros Recurrentes" | Sin cambios |
| Propuesta de valor | Con fuente y cita verificada | Sin cambios |
| Usuarios que creemos tener | Con fuente y cita verificada | Sin cambios |
| Mercado | "Argentina, pesos (ARS)", con cita | Sin cambios |
| Modelo de negocio | "Conciliación manual (Modelo A)…", con cita | Sin cambios |
| Problema | "No encontrado": el código rechazó la cita | **Completado por el PM** |
| Competidores | "No encontrado": la spec no los nombra | **Completado por el PM** |

**Métrica de retrabajo del H4:** de los 6 campos, el agente completó 4 y **ninguno necesitó corrección**. Los otros 2 los completó el PM, sin que el agente inventara nada. El *Idioma* ("español") también lo detectó el agente.

**Bloqueo (2026-10-21).** *Repreguntar* con el contexto en *Por confirmar* terminó en *Error* con el motivo "El contexto del producto no está Confirmado…", sin llamar a ningún modelo.

**Confirmación (2026-10-24).** Abel completó *Problema* y *Competidores* (los dos con «Cargado por el PM» como fuente) y pasó el contexto a *Confirmado*.

> **Lecciones aprendidas:**
> - **El respaldo salvó la corrida, pero con un modelo chico.** Con Gemini saturado, respondió un modelo de 2.600 millones de parámetros. Las citas pasaron la verificación, pero la calidad baja: por ejemplo, *Usuarios que creemos tener* describe lo que hacen el emisor y el pagador, y no quiénes son. La verificación de citas protege contra lo inventado, no contra lo flojo.
> - **Notion crea filas vacías con mucha facilidad.** Pasó dos veces en la demo: al hacer clic en la tabla de Contexto apareció una fila nueva sin datos, y el agente frenó con "tiene 2 filas". Se comportó como estaba previsto, pero es una fricción para el PM.
> - **Se confundieron los workflows.** Se corrió *Probar modelos* en lugar de *Agente*, y la solicitud quedó en *Pendiente*. Se agregó a la guía cómo reconocerlo.
> - **Para repetir una solicitud,** alcanza con volver a ponerla en *Pendiente*. Cada corrida deja su propia fila en Ejecuciones.
> - **El MCP de Notion del asistente tiene un tope de consultas en el plan gratuito.** Se agotó durante la demo. Abrir las filas una por una sigue funcionando.

### Pendientes que salieron de la demo (sin tocar código hasta que Abel apruebe)

> **Actualización del 2026-10-25:** los pendientes 1 y 3 quedaron resueltos (ver [Resultado de la demo del H5](#resultado-de-la-demo-del-h5), "Contexto rehecho con Gemini"). Sigue abierto el 2.

1. **Cita rechazada de *Problema*.** ✅ *Resuelto el 2026-10-25: no era un falso negativo.* El modelo propuso "Un emisor (persona física o entidad chica) necesita cobrarle a un pagador un monto recurrente e indefinido (hasta que el pagador decida cancelar), sin exigirle login ni manejar datos sensibles de pago", y el código la rechazó, aunque la parte final casi igual se aceptó en *Propuesta de valor*. Hay que ver si el modelo cambió alguna palabra (la regla funcionó bien) o si la verificación tiene un falso negativo, por ejemplo con los paréntesis. Si es un falso negativo, se corrige con una prueba nueva.
2. **Filas de contexto totalmente vacías.** Proponer que el agente las ignore al contar las filas, en lugar de frenar. Una fila con algún dato seguiría contando.
3. **Calidad con Gemini.** ✅ *Hecho el 2026-10-25.* Volver a probar *Armar contexto* cuando Gemini no esté saturado, para medir la calidad con el modelo principal. Se puede hacer en la evaluación del H9, sin repetir esta demo.

---

## H5. Etapa 2: entrevistas y repreguntas

El agente ya procesa las entrevistas del equipo. Por cada miembro que respondió el formulario base: lo vincula con su fila de Equipo, guarda cada respuesta como **evidencia del equipo** y escribe **hasta 5 repreguntas** en el cuerpo de su página. Cuando el miembro responde y marca su entrevista *Completa*, el agente guarda también esas respuestas como evidencia.

| Tarea | Quién | Estado |
|-------|-------|--------|
| T5.1 Formulario base agnóstico | 🤖 + 👤 aprueba | ✅ 13 preguntas, aprobadas por Abel el 2026-10-24. Vista de formulario *Entrevista base* |
| T5.2 Respuestas como evidencia *Supuesto del equipo* | 🤖 | ✅ Una fila por respuesta, vinculada a la entrevista y al miembro |
| T5.3 Prompt de repreguntas | 🤖 | ✅ Hasta 5 por miembro, cada una con su respuesta de origen |
| T5.4 Estados de la entrevista y *avanzar sin las incompletas* | 🤖 | ✅ La regla para sintetizar queda lista para el H7 |
| T5.5 Prueba con sombreros | 👤 | ✅ Cumplida el 2026-10-25 (PM respondido por Abel; Ingeniería y Negocio simulados por el asistente, a pedido de Abel) |

### Formulario base (T5.1)

13 preguntas, sin mencionar ninguna industria ni producto (RNF-12), más *Nombre del miembro* y *Rol del miembro*. Cada pregunta es una propiedad de texto de Entrevistas con su código adelante, por ejemplo *P01 · ¿Quiénes creés que son los usuarios principales del producto?…*.

| # | Pregunta |
|---|----------|
| P01 | ¿Quiénes creés que son los usuarios principales del producto? Si hay más de un tipo, describí cada uno. |
| P02 | Pensá en un usuario concreto, real o que te imagines con claridad. ¿Cómo es su día a día en lo que tiene que ver con el problema que resolvemos? |
| P03 | ¿Qué problema o necesidad tiene ese usuario que el producto busca resolver? ¿Qué le pasa si no lo resuelve? |
| P04 | ¿Cómo lo resuelve hoy, sin nuestro producto? (herramientas, personas, procesos, trucos) |
| P05 | ¿Qué es lo que más le molesta o le cuesta de esa forma actual? |
| P06 | ¿Qué tendría que pasar para que decida probar el producto? ¿Qué lo frenaría? |
| P07 | ¿Qué resultado concreto espera lograr? ¿Cómo se daría cuenta de que el producto le sirvió? |
| P08 | ¿En qué contexto lo usaría? (dónde, cuándo, con qué frecuencia, con quién) |
| P09 | ¿Qué diferencias importantes hay entre los distintos tipos de usuario? ¿Alguno necesita algo muy distinto? |
| P10 | ¿Quién decide usarlo, quién lo usa y quién paga? ¿Son la misma persona? |
| P11 | ¿Qué creés que el resto del equipo da por sentado sobre los usuarios y vos no estás tan seguro? |
| P12 | ¿En qué te basás para lo que respondiste? (charlas con usuarios, datos, experiencia propia, intuición) ¿Qué pesa más? |
| P13 | Si pudieras hacerle una sola pregunta a un usuario real, ¿cuál sería? |

### Decisiones de diseño (aprobadas por Abel el 2026-10-24)

- **A. Las 13 preguntas**, tal como están arriba.
- **B. El agente crea el miembro en Equipo** si no hay uno con el mismo nombre (sin distinguir mayúsculas ni acentos), y vincula la entrevista. Amplía los permisos de la etapa 2 a la base Equipo.
- **C. Las repreguntas pueden tocar el mismo tema, pero nunca revelan lo que dijo otro miembro**, ni de forma anónima. Por ejemplo, "¿Podés contar un caso concreto en el que viste quién decide, quién usa y quién paga?", y no "Otra persona del equipo cree que…". Es más estricto que la HU-05, para no sesgar ni exponer a nadie.
- **D. Las respuestas a las repreguntas pasan a evidencia** cuando la entrevista está *Completa* y se vuelve a pedir *Repreguntar*. La etapa *Sintetizar* del H7 va a hacer esta misma conversión antes de sintetizar.
- **Conviene pedir *Repreguntar* cuando ya respondieron todos:** así el modelo compara las respuestas de cada miembro con las de los demás. Las de los otros llegan al prompt **sin nombre** ("Otro miembro 1…").

### Cómo funciona *Repreguntar*

1. Lee Entrevistas, Equipo y el contexto confirmado. Las entrevistas sin *Nombre del miembro* se saltean, con un aviso.
2. **Por cada entrevista en *Pendiente* o *Base respondida*:**
   - La vincula con su miembro de Equipo (o lo crea) y le pone título si no tiene: "Nombre (Rol)".
   - Guarda una evidencia por respuesta: *Tipo* = *Supuesto del equipo*, título "P04 · Nombre (Rol)", extracto con la pregunta y la respuesta, y una *Clave* estable para no duplicar.
   - Si el cuerpo de la página ya tiene repreguntas (por ejemplo, de una corrida que falló a mitad), no genera otras y pasa la entrevista a *Repreguntas pendientes*.
   - Si no, le pide al modelo las repreguntas, las pasa por las reglas del código y las escribe en el cuerpo de la página. La entrevista pasa a *Repreguntas pendientes*. Si el modelo considera que las respuestas alcanzan, pasa a *Completa* y el motivo queda registrado (HU-05).
3. **Por cada entrevista *Completa*:** lee las respuestas a las repreguntas y guarda cada una como evidencia ("R1 (sobre P04) · Nombre (Rol)"). Las que quedaron sin responder se anotan en Ejecuciones.

**Lo controla el código, no el modelo:**

| Regla | Si no se cumple |
|-------|-----------------|
| Hasta 5 repreguntas por miembro | Se descartan las que sobran |
| Cada una vinculada a una pregunta que el miembro respondió | Se descarta |
| No repite una pregunta del formulario | Se descarta |
| No menciona a otros miembros, sus nombres, lo que dijeron ni un desacuerdo | Se descarta (decisión C) |
| Sin repetidas | Se descarta |
| Una entrevista *Completa* no vuelve a otro estado | La escritura se bloquea (regla nueva del Escritor) |

Cada descarte queda en las notas de Ejecuciones con su motivo. Que las repreguntas sean abiertas y sin sesgo lo pide el prompt y lo va a medir la evaluación del H9: el código no lo puede juzgar bien.

**Entrevistas para sintetizar (T5.4, HU-06).** Solo entran las *Completas*. Si falta alguna, la síntesis no arranca, salvo que la solicitud tenga en *Opciones* "avanzar sin las entrevistas incompletas". En ese caso se registra cuáles quedaron afuera. La regla está en `reglas.ts` y se conecta en el H7.

### Decisiones tomadas al implementar

- **Repreguntas con marcas fijas.** El servidor MCP de Notion (2.5.2) solo acepta párrafos y viñetas en el cuerpo de una página. Cada repregunta usa tres renglones: "❓ Repregunta 1 · sobre tu respuesta a P04 («…»)", el texto de la repregunta y "✍️ Tu respuesta:". El código lee la respuesta que está después de esa marca, en el mismo renglón o en los siguientes, hasta la próxima repregunta.
- **El agente lee cada respuesta por el código de la pregunta** (P01…), que es la propiedad de Notion completa. La etapa 0 exige las 13 propiedades con su nombre exacto.
- **"El resto del equipo" no se bloquea** en las repreguntas, porque es parte de la pregunta P11 y se puede repreguntar sobre eso.
- **Sin modelo disponible no se escribe nada**, ni siquiera la evidencia: las repreguntas son la parte principal de la etapa.

### Pruebas

`npm test` corre **188 pruebas** (23 nuevas), sin red ni secretos:

- **Formulario:** 13 preguntas, códigos únicos y la etapa 0 exigiendo cada propiedad.
- **Cuerpo de la página:** el formato de las repreguntas y la lectura de las respuestas, en uno o varios renglones, ignorando lo que haya antes.
- **Reglas:** el tope, el vínculo con una respuesta que existe, no repetir el formulario, las menciones a otros miembros (frases, nombres y desacuerdos), las repetidas y la excepción de P11.
- **Entrevistas para sintetizar:** todas Completas, con incompletas sin la opción, con la opción y sin ninguna Completa.
- **Etapa:** miembros creados y vinculados, evidencia por respuesta, repreguntas en la página, el modelo sin ver nombres ni correos de los otros miembros, descartes con su motivo, sin repreguntas → *Completa*, repetir sin duplicar, repreguntas ya escritas, evidencia de las respuestas a repreguntas, miembro existente, sin modelo sin escrituras, entrevista sin nombre y el camino por el bucle.
- **Regla de escritura:** una entrevista *Completa* no vuelve atrás, pero se puede vincular.

Para confirmar que las pruebas detectan fallas, se sacó a propósito la regla de "no mencionar a otros miembros": fallaron 2 pruebas. Con la regla restaurada, vuelven a pasar todas.

> En la sesión se corrieron las 188 pruebas, el typecheck, el lint y el build, con el Node portátil. El código se subió en tres commits y se comparó el SHA de cada archivo subido con la copia local.

### Demo de cierre del H5 (la hace Abel)

La guía detallada, paso por paso, está en [demo-h5-guia.md](demo-h5-guia.md).

0. En **[Actions](https://github.com/abellatuf/User-Persona-Agente/actions)** → **CI**, revisá que el último commit ("H5 (3/3)…") esté en ✅. Los dos anteriores pueden aparecer en ❌, porque se subieron por partes.
1. En **Entrevistas**, revisá el formulario *Entrevista base* y marcá *Nombre del miembro* y *Rol del miembro* como obligatorias.
2. Respondé el formulario **3 veces**, como PM, Ingeniería y Negocio, con un nombre distinto por sombrero y **al menos 2 divergencias a propósito**. Medí el tiempo de cada uno.
3. En **Solicitudes**, creá una fila con *Etapa* = **Repreguntar** y corré **Agente**.
4. Revisá Equipo, Entrevistas (con hasta 5 repreguntas en cada página), Evidencia y Ejecuciones.
5. Respondé las repreguntas debajo de cada "✍️ Tu respuesta:" y pasá cada entrevista a **Completa**.
6. Volvé a pedir *Repreguntar* y corré **Agente**: aparecen las evidencias de las respuestas a las repreguntas.
7. Pasale al asistente los minutos por sombrero, las divergencias que planteaste y qué te parecieron las repreguntas.

**Demo de cierre del H5:** formulario, repreguntas y evidencia funcionando de punta a punta con Gemini, y el ajuste del prompt subido. **Cumplida el 2026-10-25.**

### Resultado de la demo del H5

**Cómo se hizo.** Abel respondió el formulario como **PM** en **menos de 15 minutos**: cumple el objetivo de 30 minutos o menos por miembro. Los sombreros **Ingeniería** y **Negocio** los escribió el asistente, a pedido de Abel, con divergencias pensadas contra las respuestas del PM. Por eso esas dos entrevistas sirven para probar el agente, pero no reflejan conocimiento real del equipo, y la métrica de esfuerzo solo se midió con el PM.

| Qué se probó | Resultado | Evidencia en Notion |
|--------------|-----------|---------------------|
| Formulario base | 3 entrevistas: PM (13 respuestas), Ingeniería (9) y Negocio (9) | [Abel PM](https://app.notion.com/p/404245a35f2b800dbb2fe340831daa4f), [Abel Ingeniería](https://app.notion.com/p/404245a35f2b81b7ad32ebd2597bcf85), [Abel Negocio](https://app.notion.com/p/404245a35f2b81548247f2fac452d102) |
| *Repreguntar*, primera corrida | *Lista*. 3 miembros creados en Equipo y vinculados, **31 evidencias** del formulario base, **5 repreguntas por entrevista**, las 3 entrevistas en *Repreguntas pendientes*. 60 lecturas, 51 escrituras, 0 intentos bloqueados | [Ejecución 2026-10-25 20:16](https://app.notion.com/p/404245a35f2b8177b0f1c021e1e6d42d) |
| Modelo | Respondió **Gemini** (`gemini-3.6-flash`) para las 3. En dos entrevistas dio 503 primero y los reintentos alcanzaron, sin pasar al respaldo. Unos 13.800 tokens en total | Misma ejecución |
| Respuestas a las repreguntas | **13 evidencias "R…"**: 5 de Ingeniería, 5 de Negocio y 3 del PM. Las repreguntas 4 y 5 del PM, sin responder, quedaron anotadas. Sin llamar a ningún modelo | [Ejecución 20:35](https://app.notion.com/p/404245a35f2b81008290c2d832c4aed8), [Ejecución 20:41](https://app.notion.com/p/404245a35f2b8108b1dae8d3ee94e6a2) |
| Idempotencia | La segunda corrida actualizó las 10 evidencias anteriores en lugar de duplicarlas | 13 filas "R…" en Evidencia |
| Entrevista que no estaba *Completa* | Se esperó: "Esperando respuestas a las repreguntas: 1", sin leer sus respuestas | Ejecución 20:35 |

**Calidad de las repreguntas.** En general, buenas: abiertas, piden ejemplos concretos o en qué se basa cada uno, y van a las divergencias (P01, P09 y P10 a Ingeniería; P06 y P10 a Negocio). Ninguna mencionó a otro miembro, así que el filtro no descartó ninguna. Pero **dos insinuaron la postura de otro miembro** sin nombrarlo:
- A PM (repregunta 5): "¿qué diferencia a un profesional independiente de una pequeña entidad u organización?". La distinción la había hecho Negocio.
- A Ingeniería (repregunta 3): "¿qué escenarios podrían darse donde el decisor, el usuario y quien paga no coincidan?". Es la postura de Negocio, y además presupone que esos escenarios existen.

**Ajuste del prompt (aprobado por Abel el 2026-10-25).** Se agregó la regla "No introduce distinciones, tipos, casos ni alternativas que el miembro no mencionó. Repreguntá sobre lo que él dijo, con sus propias palabras". Una prueba nueva verifica que la regla llegue al modelo, y falló antes de aplicar el cambio: **189 pruebas**. El ajuste solo afecta a las entrevistas que se repregunten de ahora en adelante; su efecto se mide en la evaluación del H9.

**Divergencias planteadas a propósito** (se usan en el H7 para verificar que la síntesis las detecte):

| Pregunta | PM | Ingeniería | Negocio |
|----------|----|------------|---------|
| **P01** ¿Cuántos tipos de usuario? | 2: cobradores y pagadores | **1 solo:** el pagador no es usuario | **2 tipos de emisor** (profesional y organización) + pagadores |
| **P09** Diferencias entre usuarios | Cobrador ≠ pagador | **Ninguna importante** | (en P01: organización ≠ profesional) |
| **P10** ¿Quién decide, usa y paga? | El prestador | **La misma persona** | **No siempre:** la comisión decide, el tesorero usa, la organización paga |
| **P06** ¿Qué lo empuja a probarlo? | Que el volumen haga inmanejable el Excel | — | **La plata que pierde por morosidad**, aunque tenga pocos pagadores |

Además, P11 abre supuestos distintos: Ingeniería cree que el emisor va a pedir conciliación automática; Negocio duda de que quiera pagar por el servicio.

**Contexto rehecho con Gemini (pendientes 1 y 3 del H4).** Antes de la demo se volvió a pedir *Armar contexto*, esta vez con el modelo principal ([Ejecución 2026-10-25 16:46](https://app.notion.com/p/404245a35f2b813199e0df6c17c57b2b)). Respondió `gemini-3.6-flash` al primer intento:

| Campo | 21/10 (respaldo, modelo chico) | 25/10 (Gemini) |
|-------|--------------------------------|----------------|
| Usuarios que creemos tener | Lo que *hacen* emisor y pagador | **Mejor:** *quiénes son* (persona física o entidad chica, profesionales, sociedades de fomento) |
| Mercado | "Argentina, pesos (ARS)" | Igual, un poco más completo |
| Propuesta de valor | Completado, con cita | "No encontrado" |
| Modelo de negocio | "Modelo A" de conciliación, con cita | "No encontrado" |

Gemini es más conservador. En *Modelo de negocio* tiene razón: el "Modelo A" explica la conciliación, no cómo gana plata el producto. El modelo chico lo había completado con una cita real pero mal interpretada. Abel completó *Propuesta de valor* y *Modelo de negocio* ("Negocio B2B, para pequeños emprendedores") y volvió a confirmar el contexto.

**El pendiente de la cita rechazada no era un falso negativo.** Gemini citó la spec textual: "Un emisor (persona física o entidad chica: particular, sociedad de fomento, profesional independiente, etc.)". La cita del 21/10 decía "(persona física o entidad chica)": el modelo chico recortó la frase, y la regla hizo bien en rechazarla. No hay que tocar código.

> **Lecciones aprendidas:**
> - **El filtro de código frena las menciones explícitas, no las sugerencias.** Una repregunta puede traer la idea de otro miembro sin nombrarlo. El ajuste del prompt lo reduce; la revisión humana y el H9 lo miden.
> - **Hay que pasar la entrevista a *Completa*.** Si no, el agente no lee las respuestas a las repreguntas (pasó en la demo). La guía y la descripción de la base lo dicen.
> - **El servidor MCP de Notion no deja marcar preguntas obligatorias** en un formulario. No hace falta: el agente saltea las entrevistas sin nombre y lo avisa.
> - **Gemini sigue con picos de 503**, pero los reintentos alcanzaron en todas las llamadas de la demo.
> - **El código del H5 ya corría en producción antes de la demo:** una corrida de *Repreguntar* sin entrevistas respondió "No hay entrevistas con el formulario base respondido", como estaba previsto.

### Pendientes que salieron de la demo

1. **Medir el efecto del ajuste del prompt** con entrevistas nuevas, en la evaluación del H9.
2. **Esfuerzo por miembro con personas reales:** en el H5 solo se midió con el PM (menos de 15 minutos). Se puede medir en la prueba de aceptación del H9.
3. Del H4 sigue abierto: que el agente ignore las filas de contexto totalmente vacías.

---

## H6. Etapa 3: relevamiento web

El agente ya busca información pública sobre los usuarios y el mercado del producto. Arma una consulta por tema, la busca con **Tavily**, abre cada página, le pide al modelo un hallazgo con una **cita textual que el código verifica** en la página y guarda hasta 15 **evidencias públicas** con URL, título, fecha de consulta y extracto.

| Tarea | Quién | Estado |
|-------|-------|--------|
| T6.1 Búsqueda web | 🤖 | ✅ Con Tavily (planificada con Gemini + Google Search, ver la decisión C revisada) |
| T6.2 Verificar cada URL | 🤖 | ✅ Se abre cada página, se guarda la dirección final y las que no responden se descartan con su motivo |
| T6.3 Guardar la evidencia pública | 🤖 | ✅ Hasta 15 por corrida, sin repetir las URL ya guardadas |
| T6.4 Manejar la cuota agotada | 🤖 | ✅ La etapa queda *Incompleta*, la solicitud en *Lista* y el motivo en Ejecuciones. Visto con errores reales el 2026-10-26 |

### Decisiones de diseño (aprobadas por Abel el 2026-10-26)

- **A. Las URL salen del buscador, no del texto del modelo.** El modelo nunca escribe una dirección que se guarde: así no puede inventar fuentes.
- **B. Cita verificada por código.** Cada hallazgo trae una cita de 8 a 40 palabras, y el código comprueba que esté textual en el texto de la página (con la misma normalización que el H4). Si no está, el hallazgo se descarta y queda anotado.
- **C. Si no se puede buscar, la etapa queda *Incompleta*** y no se inventa nada. El respaldo de OpenRouter no tiene búsqueda gratuita (su complemento web se paga, contra el RNF-01).
- **D. Hasta 15 evidencias por corrida, y las URL ya guardadas se saltean** (comparando la dirección final normalizada). Repetir la etapa no duplica filas.

**Decisión C revisada (aprobada por Abel el 2026-10-26): buscador separado del modelo, Tavily.** El diseño original buscaba con Gemini y Google Search. En la demo, esa búsqueda no funcionó en la capa gratuita (ver el resultado más abajo). Se evaluaron cuatro caminos:

| Opción | Costo | Por qué no (por ahora) |
|--------|-------|------------------------|
| **Tavily**, plan *Researcher* | Gratis: 1.000 créditos por mes, sin tarjeta. 4 por corrida | **Elegida.** Cumple el RNF-01 y deja el resto del diseño igual |
| Facturación de Gemini | Unos USD 1 a 3 por mes (5.000 búsquedas gratis, pero se cobra la generación de todas las etapas) | Choca con el RNF-01 y el gasto es variable |
| Búsqueda web de Claude, con crédito prepago | USD 10 cada 1.000 búsquedas; unos USD 0,05 a 0,08 por corrida con Haiku | Un tercer proveedor, y deja de ser gratis |
| Brave o Exa | Crédito mensual (Brave, posiblemente con tarjeta) | Tavily es más simple y no pide tarjeta |

Con Tavily, **Gemini arma una consulta corta por tema** (con OpenRouter de respaldo, como en las demás etapas) y Tavily la busca. Las URL siguen saliendo del buscador, así que A se mantiene; B y D no cambian. La facturación de Gemini y la búsqueda de Claude quedan como mejora futura.

### Cómo funciona *Relevar la web*

1. Necesita el contexto **Confirmado** (precondición del H4). Sin modelo o sin `TAVILY_API_KEY` termina *Incompleta* con el motivo, sin escribir nada.
2. **Consultas:** una llamada al modelo devuelve una consulta por tema (*Usuarios y problemas*, *Cómo lo resuelven hoy*, *Mercado* y *Opiniones*), de 4 a 12 palabras, sin el nombre del producto. Un tema sin consulta válida se saltea y la etapa queda *Incompleta*.
3. **Búsqueda:** Tavily, búsqueda básica (1 crédito), 8 resultados por tema. Los datos personales se ocultan antes de enviar la consulta. Ante 429 reintenta; ante 401 o créditos agotados (432 o 433) corta las búsquedas que faltan.
4. **Lectura:** abre hasta 20 de las primeras 30 URL (la misma lectura de páginas del H4: sin direcciones privadas, hasta 2 MB y 20 segundos), se queda con la dirección final y saltea las ya guardadas.
5. **Hallazgos:** las páginas van al modelo de a 5, recortadas a 20.000 caracteres y con los datos personales ocultos. El código verifica cada cita (decisión B).
6. **Guardado:** hasta 15 filas en Evidencia con *Tipo* = *Pública*, *URL*, *Fecha de consulta*, *Etapa que la creó* y un *Extracto* con la cita entre «comillas» y el hallazgo. La *Clave* se arma con la URL, así que repetir actualiza en lugar de duplicar.
7. **Ejecuciones:** la consulta de cada tema y cuántas fuentes trajo, cada URL descartada y cada hallazgo descartado con su motivo, lo guardado, los intentos de cada llamada y los tokens.

### Decisiones tomadas al implementar

- **Una etapa *Incompleta* deja la solicitud en *Lista***, no en *Error*, con el motivo en Ejecuciones (T6.4: no falla el resto). **Confirmado por Abel el 2026-10-26.**
- **Lotes de 5 páginas, recortadas a 20.000 caracteres**, para que cada llamada entre holgada en el contexto de los modelos gratuitos.
- **Se leen hasta 20 páginas para quedarse con hasta 15**, porque algunas citas no se verifican.
- **Con Tavily:** 432 y 433 (créditos del plan) se tratan como límite de uso; la clave es opcional, así que sin ella solo esta etapa se entera; se quitó la búsqueda de Gemini, que queda en el historial de git.
- **El 429 de Gemini registra qué cuota se superó y su límite**, cuando Google manda el detalle `QuotaFailure`. Se agregó para diagnosticar la demo y sirvió en la última corrida.

### Pruebas

`npm test` corre **206 pruebas**, sin red ni secretos (200 con la búsqueda de Gemini; +1 por el detalle de la cuota; +5 netas con Tavily):

- **Etapa:** consultas por tema y URL tomadas del buscador; dirección final después de una redirección; URL que no responde, descartada y anotada; cita que no está en la página y fuente inventada, descartadas; sin modelo y sin clave del buscador, *Incompleta* sin escrituras; consultas que no se pueden armar; tema sin consulta válida; créditos agotados al principio y a mitad de camino; extracción que falla; URL ya guardada (decisión D); tope de 15; y el camino por el bucle, con la solicitud en *Lista* y la ejecución en *Incompleta*.
- **Tavily:** el pedido (cabecera, consulta, búsqueda básica y 8 resultados), las URL de los resultados aunque la respuesta traiga otro texto, y 401, 432 y 429 con `Retry-After`.
- **Buscador:** reintento ante límite, datos personales ocultos en la consulta y el tipo de error.
- **Claves:** `TAVILY_API_KEY` opcional (vacía cuenta como ausente) y el motivo cuando falta.
- **Gemini:** el 429 con `QuotaFailure` pone la cuota y su límite al principio del mensaje, aunque el texto de Google sea largo.

> En la sesión se corrieron las pruebas, el typecheck, el lint y el build con el Node portátil antes de cada subida, y se comparó el SHA de cada archivo subido con la copia local. Commits del H6: el código original (`1350601` a `1cdb9b4`, 200 pruebas), el detalle de la cuota (`8acbed2`, 201) y Tavily (`fd5869b`, 206).

### Demo de cierre del H6 (la hace Abel)

La guía detallada, paso por paso, está en [demo-h6-guia.md](demo-h6-guia.md): revisar el CI, pedir *Relevar la web*, revisar la evidencia, verificar 3 o 4 fuentes a mano, repetir sin duplicar y, de forma opcional, probar el caso sin búsqueda.

**Demo de cierre del H6:** evidencia pública guardada con URL que abren y citas verificadas, sin duplicar al repetir. **Cumplida el 2026-10-26.** El paso 5 se salteó, a pedido de Abel: el caso sin búsqueda ya se había visto cuatro veces con errores reales.

### Resultado de la demo del H6

**Primer intento: la búsqueda con Google no está en la capa gratuita.** Con el diseño original, *Relevar la web* quedó *Incompleta* cuatro veces. En todas, la solicitud quedó en *Lista*, no se gastaron tokens y no se escribió evidencia: T6.4 funcionó con errores reales.

| Corrida | Modelo | Resultado | Ejecución |
|---------|--------|-----------|-----------|
| 15:45 | `gemini-3.6-flash` | 429 en la primera búsqueda | [Ejecución](https://app.notion.com/p/405245a35f2b81b4ab6cd5e48c30a144) |
| 15:56, *Probar modelos* | `gemini-3.6-flash` | **Generar sí funciona** (dos 503 y respuesta al tercer intento) | [Ejecución](https://app.notion.com/p/405245a35f2b81ea868edd4404e9265c) |
| 16:01 | `gemini-3.8-flash` | 429 en la primera búsqueda | [Ejecución](https://app.notion.com/p/405245a35f2b81679ff5edd4f7540d97) |
| 16:17 | `gemini-3.6-flash`, con el detalle de cuota | 429; Google no mandó el detalle esa vez | [Ejecución](https://app.notion.com/p/405245a35f2b81459383d78ff9333604) |
| 16:20 | `gemini-2.5-flash` | 404: «no longer available to new users» | [Ejecución](https://app.notion.com/p/405245a35f2b812c817addc1839f80c8) |

La [página de precios de la API de Gemini](https://ai.google.dev/gemini-api/docs/pricing) lo explica: *Grounding with Google Search* figura «Not available» en la capa gratuita de los Gemini 3.x Flash, y solo los 2.5 lo traían gratis (hasta 500 pedidos por día), pero ya no se ofrecen a usuarios nuevos. *Modelo principal* volvió a `gemini-3.6-flash` después de cada prueba.

**Con Tavily: dos corridas en *Lista*, 22 evidencias públicas y sin duplicados.**

| Qué se probó | Primera corrida | Segunda corrida (repetir) |
|--------------|-----------------|---------------------------|
| Ejecución | [2026-10-26 16:53](https://app.notion.com/p/405245a35f2b813c8fb4f222b753c795) | [2026-10-26 17:12](https://app.notion.com/p/405245a35f2b819c9f70d2813c00a7be) |
| Consultas (Gemini) | 4, todas con sentido, por ejemplo «problemas para cobrar cuotas recurrentes emprendedores profesionales independientes argentina» | 4 distintas a las de la primera vez, así que trajeron otras fuentes |
| Fuentes → páginas leídas → citas verificadas → guardadas | 32 → 18 → 11 → **11** | 32 → 19 → 11 → **11** |
| URL descartadas | 11: 6 con 403 (Reddit, entre otras), 4 sin texto legible y 1 sin conexión | 8: con 403 o 401, sin texto o de más de 2 MB |
| Decisión B | Ninguna cita rechazada | **2 citas rechazadas**: el modelo unió fragmentos con «…» |
| Decisión D | — | **2 URL ya guardadas, salteadas** (Qobra y Rebill). Ninguna fila repetida |
| Modelos de extracción | Gemini en 2 lotes y OpenRouter en 2, por 503 de Gemini | Gemini en 2 y OpenRouter en 2, por 503 y por el **límite diario** |
| Tokens | Unos 65.000 | Unos 70.000 |
| Créditos de Tavily | 4 | 4 |

**Verificación a mano: 8 de 8 citas en su página.** El asistente abrió 5 fuentes ([Qobra](https://app.notion.com/p/405245a35f2b81e6a50bc0958a58cf13), [Mercado Pago Suscripciones](https://app.notion.com/p/405245a35f2b81649541df66ba689948), [Recurrente](https://app.notion.com/p/405245a35f2b81ec84d2ff34def51f7a), [Programa de Empleo Independiente](https://app.notion.com/p/405245a35f2b81c995caee2ed0a47130) y [Niveals](https://app.notion.com/p/405245a35f2b8131b097dc0850608dab)) y Abel otras 3 ([Recaudo](https://app.notion.com/p/405245a35f2b81c8a136d49e9a74c924), [Rebill: alternativas a Mercado Pago](https://app.notion.com/p/405245a35f2b811ab298cfcaf8142c2b) y [Stripe](https://app.notion.com/p/405245a35f2b819184e9fcdf4d129a60)). Las 8 páginas cargaron y las 8 citas estaban textuales.

**Utilidad (lectura del asistente): unas 11 de las 22 evidencias sirven.**
- **Útiles:** muestran cómo se cobra hoy y quiénes compiten. [Qobra](https://app.notion.com/p/405245a35f2b81e6a50bc0958a58cf13) (orquestador argentino de cuotas, con portal sin login, para colegios y clubes), [Mercado Pago Suscripciones](https://app.notion.com/p/405245a35f2b81649541df66ba689948) (link por WhatsApp, sin sitio web), [Recaudo](https://app.notion.com/p/405245a35f2b81c8a136d49e9a74c924) (cobrar por WhatsApp), [Talo](https://app.notion.com/p/405245a35f2b817cb378df6407c85ad8) (tarjeta recurrente con 10 a 15 % de fallos por mes, DEBIN, CVU fijo y links), [Bebot](https://app.notion.com/p/405245a35f2b81ed8b86eaf9e033e99b) (morosidad del 15 al 35 % por mes en Argentina), [Recurrente](https://app.notion.com/p/405245a35f2b81ec84d2ff34def51f7a), las dos de Rebill, [Aunoa](https://app.notion.com/p/405245a35f2b8139bb85f2f894dec745), [Niveals](https://app.notion.com/p/405245a35f2b8131b097dc0850608dab) y [Mercado Pago (herramientas)](https://app.notion.com/p/405245a35f2b81a7a7ecd8d28e808ef9).
- **Flojas:** la cita existe, pero aportan poco o son de otro mercado: fichas de CB Insights (Wallbit, Prex, HSBC y Uelz), CoinMarketCap, el programa PEI, Stripe (e-commerce en general), Point Tap, Rankia, Mercado Pago **Colombia** y una pasarela de **Guatemala**.

**Dos hallazgos para el H7:**
1. **Qobra, Mercado Pago Suscripciones y Recaudo contradicen el campo *Competidores* del contexto**, que dice que no hay competidores directos. La síntesis tiene que mostrar esta divergencia entre el equipo y la evidencia pública.
2. **Casi todas las fuentes son de empresas que venden una solución.** No quedó ninguna voz directa de usuarios: los foros bloquean la lectura (Reddit dio 403) y el tema *Opiniones* no guardó nada útil. Hay que tenerlo en cuenta al asignar la confianza de los atributos.

**El límite diario de Gemini es bajo.** La última corrida mostró el detalle de la cuota: `GenerateRequestsPerDayPerProjectPerModel-FreeTier`, **límite 20** pedidos por día para `gemini-3.6-flash`. Hoy se gastaron entre las pruebas y las demos, y el respaldo de OpenRouter cubrió lo que faltaba. Una corrida de *Relevar la web* usa unos 5 pedidos.

> **Lecciones aprendidas:**
> - **Antes de diseñar sobre una función gratuita, hay que revisar la tabla de precios por modelo.** El H6 supuso que la búsqueda de Google venía con cualquier Gemini Flash gratuito, y no era así. La prueba de modelos del H3 no la cubría, porque solo generaba.
> - **Separar el buscador del modelo hizo el cambio barato.** La interfaz `Buscador` permitió pasar a Tavily sin tocar la lectura, la verificación ni el guardado.
> - **Registrar el detalle del error paga.** El detalle de la cuota no apareció cuando se lo buscaba, pero en la corrida siguiente mostró el límite diario de 20.
> - **El respaldo de OpenRouter es parte normal de la etapa,** no una excepción: respondió en la mitad de las extracciones, entre los 503 y el límite diario de Gemini.
> - **Que la cita sea real no la hace útil.** La decisión B garantiza que la cita existe; la utilidad la juzga el PM, y la mide la evaluación del H9.

### Pendientes que salieron de la demo

1. **País en la búsqueda:** pasarle a Tavily el país del campo *Mercado* (parámetro `country`), para evitar fuentes de otros mercados. Sin tocar código hasta que Abel lo apruebe.
2. **Voces de usuarios:** buscar una forma de sumar foros y reseñas (Reddit y otros bloquean la lectura). Se puede revisar en el H9 o como mejora.
3. **No reintentar un límite diario:** si el 429 dice que la cuota es por día, pasar directo al respaldo en lugar de esperar y reintentar.
4. **Cuota diaria de Gemini (20 pedidos):** tenerla en cuenta al diseñar el H7, que va a necesitar varias llamadas por corrida.
5. Del H4 sigue abierto: que el agente ignore las filas de contexto totalmente vacías.

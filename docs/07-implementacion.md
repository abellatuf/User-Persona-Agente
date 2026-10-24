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
| H5. Entrevistas | 🟡 Código en `main`, falta la demo |
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

1. **Cita rechazada de *Problema*.** El modelo propuso "Un emisor (persona física o entidad chica) necesita cobrarle a un pagador un monto recurrente e indefinido (hasta que el pagador decida cancelar), sin exigirle login ni manejar datos sensibles de pago", y el código la rechazó, aunque la parte final casi igual se aceptó en *Propuesta de valor*. Hay que ver si el modelo cambió alguna palabra (la regla funcionó bien) o si la verificación tiene un falso negativo, por ejemplo con los paréntesis. Si es un falso negativo, se corrige con una prueba nueva.
2. **Filas de contexto totalmente vacías.** Proponer que el agente las ignore al contar las filas, en lugar de frenar. Una fila con algún dato seguiría contando.
3. **Calidad con Gemini.** Volver a probar *Armar contexto* cuando Gemini no esté saturado, para medir la calidad con el modelo principal. Se puede hacer en la evaluación del H9, sin repetir esta demo.

---

## H5. Etapa 2: entrevistas y repreguntas

El agente ya procesa las entrevistas del equipo. Por cada miembro que respondió el formulario base: lo vincula con su fila de Equipo, guarda cada respuesta como **evidencia del equipo** y escribe **hasta 5 repreguntas** en el cuerpo de su página. Cuando el miembro responde y marca su entrevista *Completa*, el agente guarda también esas respuestas como evidencia.

| Tarea | Quién | Estado |
|-------|-------|--------|
| T5.1 Formulario base agnóstico | 🤖 + 👤 aprueba | ✅ 13 preguntas, aprobadas por Abel el 2026-10-24. Vista de formulario *Entrevista base* |
| T5.2 Respuestas como evidencia *Supuesto del equipo* | 🤖 | ✅ Una fila por respuesta, vinculada a la entrevista y al miembro |
| T5.3 Prompt de repreguntas | 🤖 | ✅ Hasta 5 por miembro, cada una con su respuesta de origen |
| T5.4 Estados de la entrevista y *avanzar sin las incompletas* | 🤖 | ✅ La regla para sintetizar queda lista para el H7 |
| T5.5 Prueba con sombreros | 👤 | ⏳ Pendiente (demo) |

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

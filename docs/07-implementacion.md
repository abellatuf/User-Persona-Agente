# Fase 7: Implementación y validación

Se sigue el plan de la [Fase 6](06-plan-de-tareas.md), hito por hito. Cada hito cierra con una demo y la aprobación de Abel.

## Avance

| Hito | Estado |
|------|--------|
| H0. Preparación de cuentas y accesos | ✅ Cerrado |
| H1. Esqueleto sin modelo | ✅ Cerrado |
| H2. Reglas en código | ✅ Cerrado |
| H3. Capa de modelos | ✅ Cerrado |
| H4. Agente de contexto | 🔜 Próximo |
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

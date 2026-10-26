# User-Persona Agente

Agente de IA para construir y usar User Personas basadas en evidencia.

Este repositorio documenta el diseño y la construcción de un agente de IA con **Spec Driven Development (SDD)**. Cada fase produce una especificación que funciona como contrato para la siguiente. No se pasa a una fase sin aprobar la anterior.

> 🔁 **¿Retomás el trabajo en otro chat?** Empezá por el [Caso de estudio: bitácora del proyecto](#caso-de-estudio-bitácora-del-proyecto).

## Base metodológica: *Inspired*, de Marty Cagan

Toda la solución se apoya en el enfoque de **product discovery** que Marty Cagan describe en *Inspired: How to Create Tech Products Customers Love*. Estas son las ideas del libro que guían las decisiones de este proyecto:

| Idea de *Inspired* | Cómo se refleja en la solución |
|--------------------|--------------------------------|
| Las personas son útiles solo si nacen de **investigación con usuarios reales**. Una persona inventada formaliza supuestos. | Cada atributo se vincula a su evidencia, y los supuestos del equipo se marcan como tales, con confianza baja. |
| Discovery busca reducir los **cuatro riesgos**: valor, usabilidad, factibilidad y viabilidad de negocio. | Las personas atacan sobre todo los riesgos de **valor** y **usabilidad**: para quién es y qué problema le resuelve. |
| Los equipos de producto se miden por **resultados (outcomes)**, no por lo que entregan (output). | Las personas sirven para definir para quién es cada iniciativa y qué cambio se espera. Ver la visión a largo plazo. |
| Las ideas se **validan con usuarios** antes de construir. | Cada supuesto de baja confianza tiene un plan de validación con usuarios reales. |
| El equipo necesita **contacto frecuente con usuarios**. | El agente no reemplaza ese contacto: lo dispara, proponiendo a quién y qué preguntar. |

> Las ideas de la tabla son una síntesis propia del enfoque del libro, no citas textuales.

## Estado del proceso

Cada fase está en su propio archivo dentro de [`docs/`](docs/).

| # | Fase | Estado |
|---|------|--------|
| 1 | [Definición del problema](docs/01-definicion-del-problema.md) | ✅ Aprobada |
| 2 | [Visión del producto](docs/02-vision-del-producto.md) | ✅ Aprobada |
| 3 | [Requisitos](docs/03-requisitos.md) (historias, criterios de aceptación, RNF) | ✅ Aprobada |
| 4 | [Especificación del agente](docs/04-especificacion-del-agente.md) (rol, capacidades, herramientas, límites) | ✅ Aprobada |
| 5 | [Diseño técnico](docs/05-diseno-tecnico.md) (arquitectura, modelo, prompts, memoria, evals) | ✅ Aprobada |
| 6 | [Plan de tareas](docs/06-plan-de-tareas.md) | ✅ Aprobada |
| 7 | [Implementación y validación](docs/07-implementacion.md) | 🟡 En curso: H0 a H5 ✅, H6 con la búsqueda pasada a Tavily y la demo pendiente |

---

## Caso de estudio: bitácora del proyecto

> Esta sección permite **retomar el trabajo en otro chat** sin perder el contexto. Para continuar, pegá el enlace de este README y pedí seguir desde la fase en revisión.

### Cómo trabajamos

- **Spec Driven Development** fase por fase. No se avanza sin la aprobación explícita de Abel.
- Todo se documenta en español: el README tiene el índice y esta bitácora, y cada fase vive en su archivo de `docs/`. Se sube a `main` después de cada cambio.
- **Método de implementación** (confirmado): el asistente escribe y prueba el código en la carpeta de su sesión de Claude Code y lo sube a GitHub con el conector. Abel no necesita instalar nada. Si la sesión corre en una PC sin Node.js, el asistente baja el Node portátil oficial a la carpeta de la sesión, con permiso de Abel y sin instalar nada en el sistema. Además, un workflow de CI corre las pruebas en cada cambio.
- Abel define y decide. El asistente propone, cuestiona y redacta.
- La base metodológica es *Inspired*, de Marty Cagan.

### Recursos

| Recurso | Detalle |
|---------|---------|
| Repositorio de la spec y del código | [abellatuf/User-Persona-Agente](https://github.com/abellatuf/User-Persona-Agente), rama `main`, **privado** |
| Producto de prueba principal | `franCiti/cobros-recurrentes` (privado). Se usa solo su spec, `cobros-recurrentes-spec.md`. |
| Segundo producto de prueba | `abellatuf/rutina-app` (privado, de Abel). |
| Conector de GitHub | Token de acceso fino con permiso **Contents: Read and write** sobre este repo. No puede crear repositorios ni leer `cobros-recurrentes`. También tiene **Workflows: Read and write**, para subir los archivos de `.github/workflows/`. |
| Plantilla de Notion | [User-Persona Agente](https://app.notion.com/p/3fa245a35f2b81f2afcec088c81678a4) (privada), con 10 bases. El detalle y los IDs están en [docs/notion-plantilla.md](docs/notion-plantilla.md). |
| Conexión con Notion | El asistente usa el MCP de Notion de su sesión. El agente usa el servidor MCP oficial de Notion (`@notionhq/notion-mcp-server` 2.5.2) con el token de la integración *User-Persona Agente* (secreto `NOTION_TOKEN`). |
| Modelos | Gemini (principal) y OpenRouter (respaldo). Se eligen desde la página Configuración de Notion: hoy `gemini-3.6-flash` y `openrouter/free`. Si los campos quedan vacíos, se usan los valores por defecto del código (`gemini-3.8-flash` y `openrouter/free`). |
| Buscador web | **Tavily**, plan gratuito *Researcher* (1.000 créditos por mes, sin tarjeta), cuenta de Abel. Secreto `TAVILY_API_KEY`. Solo lo usa la etapa *Relevar la web* (H6): 4 búsquedas básicas por corrida. |
| Código del agente | [`agent/`](agent/) (TypeScript). Workflows: [`agente.yml`](.github/workflows/agente.yml) (programado a las 15 h de Argentina, y manual), [`ci.yml`](.github/workflows/ci.yml) (pruebas en cada cambio) y [`probar-modelos.yml`](.github/workflows/probar-modelos.yml) (prueba de modelos, solo manual). |

### Bitácora de decisiones

| Fecha | Fase | Decisión |
|-------|------|----------|
| 2026-10-14 | 1 | Problema: los equipos deciden sin un entendimiento compartido y basado en evidencia del usuario. Solución: User Personas basadas en evidencia, con IA y aprobación humana. |
| 2026-10-14 | 1 | Proyecto personal, agnóstico de producto. El caso general no tiene investigación previa: las fuentes son el equipo, el contexto del producto, la web y, a veces, investigación propia. |
| 2026-10-14 | 2 | Objetivo: aprendizaje y portfolio, para un público limitado. |
| 2026-10-14 | 2 | Se descarta construir una app web. La solución es **solo Notion** (formularios + bases relacionadas) más un **agente propio** conectado por **MCP**. Jira queda para el futuro. |
| 2026-10-14 | 2 | Entrevista a cada miembro por separado: formulario base + repreguntas del agente en su página. |
| 2026-10-14 | 2 | Trazabilidad obligatoria: cada atributo tiene evidencia. Solo el PM aprueba. |
| 2026-10-14 | 2 | Prueba con cobros-recurrentes, con Abel en el rol de varios miembros del equipo. |
| 2026-10-14 | 3 | Modelos: **Gemini (capa gratuita)** como principal y **OpenRouter** como secundario. Reemplaza la idea inicial de usar Claude. |
| 2026-10-14 | 3 | Idioma del equipo. Sin plazo fijo. |
| 2026-10-15 | 3 | **Contexto asistido:** el agente extrae el contexto de fuentes que indica el PM (documento en Notion o URL como *must*, GitHub como *could*). Cada campo cita su fuente, lo que no encuentra lo completa el PM, y el PM confirma antes de seguir. El formulario manual queda como alternativa. |
| 2026-10-15 | 3 | La investigación propia (HU-08) y la persona viva (HU-15) pasan a *must*. Se aprueban la regla de confianza y la base Ejecuciones. |
| 2026-10-15 | 3 | cobros-recurrentes: hay autorización, pero se usa solo la spec. **rutina-app** (`abellatuf/rutina-app`) se suma como segundo caso de prueba, para verificar que el agente sea agnóstico de producto. |
| 2026-10-15 | 3 | Se aprueba la Fase 3. |
| 2026-10-15 | 4 | Borrador de la especificación: un agente por etapas (0 a 5), estado solo en Notion, reglas aplicadas por código (confianza, trazabilidad, estados prohibidos) y criterios de escalamiento al humano. |
| 2026-10-15 | 4 | Un solo agente por etapas, cada etapa funciona como un agente especializado (la etapa 1 es el agente de contexto). La fiabilidad se asegura con tareas acotadas, formato validado, reglas en código y evaluaciones. |
| 2026-10-15 | 4 | Estados de la persona: el agente solo crea *Borrador*. El PM la pasa a *En revisión* al empezar a revisarla y después a *Aprobada* o *Rechazada*. La evidencia nueva genera una versión nueva y la anterior queda *Reemplazada*. Ajusta HU-13 y HU-15. |
| 2026-10-15 | 4 | Los topes (15 fuentes web, 5 personas, 5 repreguntas) son máximos: el agente sigue con lo que encuentra. |
| 2026-10-15 | 4 | Se aprueba la Fase 4. |
| 2026-10-15 | 5 | Stack: **TypeScript**, cliente MCP hacia un servidor MCP de Notion con token de integración, Gemini con búsqueda integrada de Google, OpenRouter de respaldo, Zod y Vitest. |
| 2026-10-15 | 5 | Ejecución **todo desde Notion**: base Solicitudes + GitHub Actions programado **una vez por día a las 15 h de Argentina**. Se pausa desde la página Configuración y no gasta tokens si no hay solicitudes. El código va en este mismo repo, que hoy es privado. |
| 2026-10-15 | 5 | El repo **queda privado**: no hace falta que sea público. La pausa se hace desde la casilla *Agente activo* de Notion, con un paso a paso en la Fase 5. |
| 2026-10-15 | 5 | Se agrega el permiso **Workflows: Read and write** al token del conector. Se probó creando `.github/workflows/README.md`. |
| 2026-10-15 | 5 | Se aprueba la Fase 5. |
| 2026-10-15 | 6 | Borrador del plan: 10 hitos verticales (H0 a H9), cada uno con una demo y la aprobación de Abel. Primero el circuito con Notion y las reglas en código, y recién después el modelo de lenguaje. |
| 2026-10-15 | 6 | Se aprueban el orden de los hitos y el cierre con demo. El asistente crea la plantilla de Notion con el MCP de Notion. Cada fase pasa a su archivo en `docs/`. |
| 2026-10-15 | 6 | El asistente crea la **plantilla de Notion**: página raíz privada y 10 bases relacionadas (T1.2). *Agente activo* queda desmarcado hasta el H1. Los formularios quedan para H4 y H5. |
| 2026-10-15 | 6 | Abel no puede trabajar en su máquina por ahora. **Propuesta:** el asistente escribe y prueba el código en la carpeta de su sesión y lo sube con el conector, con CI en GitHub Actions como segunda red. Pendiente de confirmación. |
| 2026-10-15 | 6 | Abel confirma el método de implementación. **Se aprueba la Fase 6.** |
| 2026-10-15 | 7 | Arranca la Fase 7 con el **H0**: guía paso a paso para la integración de Notion, las claves y los secretos, y un workflow *Verificar accesos* que prueba los tres secretos sin mostrarlos. |
| 2026-10-15 | 7 | **Se cierra el H0:** integración de Notion, claves de Gemini y OpenRouter, y los tres secretos cargados. *Verificar accesos* en verde. El primer intento dio 404 porque la página no estaba compartida con la integración. |
| 2026-10-15 | 7 | Diseño del **H1** aprobado: servidor MCP oficial de Notion (`@notionhq/notion-mcp-server` 2.5.2) por stdio, interfaz `EspacioNotion` para probar sin Notion, una fila en Ejecuciones por corrida (también *Pausado* y *Sin pendientes*), hasta 10 solicitudes por ejecución, y `agente.yml` solo con `NOTION_TOKEN` para no gastar tokens. Se sube directo a `main`. |
| 2026-10-15 | 7 | Código del H1 en `main`: etapa 0, bucle de solicitudes, registro en Ejecuciones, `agente.yml` y CI. 25 pruebas, incluida una de integración con el servidor MCP real y una API de Notion falsa. Las etapas 1 a 5 son marcadores sin modelo. Falta la demo de Abel. |
| 2026-10-16 | 7 | **Se cierra el H1:** CI en verde, y en la demo la Solicitud pasó a *Lista* con su fila en Ejecuciones, sin gastar tokens. *Agente activo* queda marcado. |
| 2026-10-16 | 7 | Diseño del **H2** aprobado: un único `Escritor` con `guardar` (con clave crea o actualiza), `actualizar` y `archivar` (agregada a pedido de Abel, va a la papelera y nunca elimina), siempre pasando por las reglas. Un intento bloqueado deja la solicitud en *Error*. Dos filas distintas de investigación propia cuentan como fuentes independientes. Se agregan *Clave* y *Editado por el PM* a la plantilla. |
| 2026-10-16 | 7 | Código del H2 en `main`: confianza, estados prohibidos, trazabilidad, no pisar al PM, datos personales y claves. 101 pruebas. **Ajuste:** desmarcar *Editado por el PM* no vuelve a habilitar al agente (haría falta una "huella"). Por ahora la casilla queda fija. |
| 2026-10-16 | 7 | **Se cierra el H2:** CI en verde con las 101 pruebas. |
| 2026-10-16 | 7 | Diseño del **H3** aprobado: interfaz común `generar` con adaptadores de Gemini y OpenRouter sin SDK nuevos, datos personales ocultos dentro de `generar`, reintentos ante límites de uso y respaldo. Ante formato inválido: un reintento con corrección y después el respaldo. Los tokens van en las notas de Ejecuciones. La demo usa un workflow aparte, `probar-modelos.yml`, y `agente.yml` sigue sin las claves de los modelos hasta el H4. |
| 2026-10-16 | 7 | La sesión del asistente corre en una PC con Windows sin Node.js. Con permiso de Abel, se usa el Node portátil oficial (24.22.0, verificado con SHASUMS) dentro de la carpeta de la sesión. |
| 2026-10-16 | 7 | Código del H3 en `main`: capa de modelos, plantilla base de prompts y prueba de modelos. 134 pruebas. Al implementar: modelos por defecto `gemini-3.8-flash` y `openrouter/free`, editables desde Configuración; a Gemini se le pide JSON con el esquema en el prompt, a OpenRouter con `json_schema`, y Zod valida siempre; la falla forzada de la demo es simulada y no llama a Gemini. Falta la demo de Abel. |
| 2026-10-17 | 7 | Abel aprueba las decisiones tomadas al implementar el H3. Instalar Node.js en su PC queda para más adelante; mientras tanto se usa el Node portátil. |
| 2026-10-17 | 7 | Las primeras corridas de *Probar modelos* fallaron porque *Modelo de respaldo* en Configuración tenía el texto de relleno de la plantilla ("Por definir en H3…"). Con permiso de Abel, el asistente lo cambió a `openrouter/free`. *Modelo principal* queda en `gemini-3.6-flash`, elegido por Abel. |
| 2026-10-17 | 7 | **Se cierra el H3:** CI en verde; sin falla forzada respondió Gemini (`gemini-3.6-flash`) y con falla forzada respondió OpenRouter (`openrouter/free` eligió `liquid/lfm-2.5-2.6b:free`). En las dos, el correo de prueba llegó al modelo como `[CORREO]`. |
| 2026-10-18 | 7 | Diseño del **H4** aprobado: una sola fila de contexto por espacio; fuentes en *Documentos fuente* (`.md`, `.txt`, `.csv` y `.pdf` con `unpdf`) y *URL fuente* (una página, sin direcciones privadas); **cita textual verificada por código** en la fuente; el agente solo completa campos vacíos o en "No encontrado"; contexto manual sin modelo; bloqueo de las etapas 2 a 5 hasta que el PM confirme. GitHub (*could*) queda para el final del MVP. |
| 2026-10-18 | 7 | Código del H4 en `main`: lectura de fuentes, etapa 1, precondición de contexto confirmado y control de los nombres de modelo de Configuración. `agente.yml` recibe las claves de los modelos. 165 pruebas. En Notion: aviso de privacidad en la base Contexto y formulario *Contexto manual*. Falta la demo de Abel. |
| 2026-10-21 | 7 | Demo del H4: *Armar contexto* terminó en *Lista*. Gemini respondió 503 (alta demanda) en los 3 intentos y contestó el respaldo (`openrouter/free` eligió `liquid/lfm-2.5-2.6b:free`). 4 de 6 campos quedaron con cita verificada. *Problema* quedó en "No encontrado" porque el código rechazó la cita, y *Competidores* porque la spec no los nombra. El bloqueo funcionó: *Repreguntar* sin contexto confirmado terminó en *Error* sin llamar a ningún modelo. |
| 2026-10-21 | 7 | En Notion se crearon dos veces filas vacías en *Contexto del producto* sin querer, y el agente frenó con "tiene 2 filas", como estaba previsto. La segunda la mandó a la papelera el asistente, a pedido de Abel. |
| 2026-10-24 | 7 | **Se cierra el H4:** Abel completó *Problema* y *Competidores* y confirmó el contexto. Retrabajo: 0 de los 4 campos que completó el agente necesitaron corrección. Quedan tres pendientes, sin tocar código: revisar la cita rechazada, ignorar las filas de contexto vacías y volver a probar con Gemini. |
| 2026-10-24 | 7 | Diseño del **H5** aprobado: formulario base de **13 preguntas** agnósticas, más nombre y rol; una propiedad por pregunta en Entrevistas; la etapa *Repreguntar* vincula cada entrevista con su miembro (**lo crea en Equipo si no existe**), guarda cada respuesta como evidencia del equipo y escribe hasta 5 repreguntas en el cuerpo de la página. **Las repreguntas pueden tocar el mismo tema, pero nunca revelan lo que dijo otro miembro.** Las respuestas a las repreguntas pasan a evidencia cuando la entrevista está *Completa* y se vuelve a pedir *Repreguntar*. |
| 2026-10-24 | 7 | En Notion: propiedades nuevas en Entrevistas y formulario *Entrevista base*. Código del H5 en `main`, con reglas en código para las repreguntas (tope, vínculo con la respuesta, sin repetir el formulario y sin mencionar a otros miembros), la regla de entrevistas para sintetizar (T5.4) y una regla de escritura: una entrevista *Completa* no vuelve atrás. 188 pruebas. Al implementar: el servidor MCP de Notion solo escribe párrafos, así que las repreguntas usan marcas fijas (❓ y ✍️). Falta la demo de Abel. |
| 2026-10-25 | 7 | **Contexto rehecho con Gemini** (pendiente 3 del H4): respondió `gemini-3.6-flash` al primer intento. Mejoró *Usuarios* (ahora dice quiénes son) y *Mercado*; dejó *Propuesta de valor* y *Modelo de negocio* en "No encontrado". El modelo chico había completado *Modelo de negocio* con el "Modelo A" de conciliación, que no es un modelo de negocio: la cita era real, pero la interpretación no. Abel completó los dos campos y volvió a confirmar el contexto. **Pendiente 1 resuelto:** la cita de *Problema* del 21/10 se rechazó porque el modelo chico recortó la frase de la spec, no por un falso negativo. No hay que tocar código. La corrida de *Repreguntar* de ese día (sin entrevistas todavía) confirmó que el código del H5 ya corre en producción. |
| 2026-10-25 | 7 | Demo del H5: Abel respondió el sombrero **PM** (en menos de 15 minutos) y pidió que el asistente simulara **Ingeniería** y **Negocio**, con divergencias a propósito en P01, P09, P10 y P06. *Repreguntar* con Gemini: 3 miembros creados, 31 evidencias y 5 repreguntas por entrevista ([ejecución](https://app.notion.com/p/404245a35f2b8177b0f1c021e1e6d42d)). Después, 13 evidencias de las respuestas a las repreguntas, sin modelo, sin duplicar y con las 2 sin responder anotadas ([ejecución](https://app.notion.com/p/404245a35f2b8108b1dae8d3ee94e6a2)). |
| 2026-10-25 | 7 | Ninguna repregunta mencionó a otro miembro, pero dos **insinuaron su postura** sin nombrarlo. Abel aprueba un ajuste del prompt: no introducir distinciones ni alternativas que el miembro no mencionó. 189 pruebas. |
| 2026-10-25 | 7 | **Se cierra el H5.** El detalle, con los links a Notion, está en la [Fase 7](docs/07-implementacion.md#resultado-de-la-demo-del-h5). |
| 2026-10-26 | 7 | Diseño del **H6** aprobado: 4 búsquedas por tema (usuarios y problemas, cómo lo resuelven hoy, mercado, opiniones) con Gemini y Google Search; **las URL salen de los metadatos de la búsqueda**, no del texto del modelo; cada URL se abre y se guarda la dirección final; **cita verificada por código** en la página (decisión B); hasta 15 evidencias públicas por corrida y **las URL ya guardadas se saltean** (decisión D). **Si Gemini no puede buscar, la etapa queda Incompleta** (decisión C): el respaldo de OpenRouter no tiene búsqueda gratuita (su complemento web se paga, contra el RNF-01; queda como opción futura). |
| 2026-10-26 | 7 | Código del H6 en `main`: búsqueda con Google en el adaptador de Gemini, buscador con reintentos, etapa *Relevar la web* y lectura de las URL de la evidencia pública ya guardada. Al implementar: una etapa *Incompleta* deja la solicitud en *Lista* (no en *Error*), con el motivo en Ejecuciones (T6.4: no falla el resto); las páginas van al modelo de a 5, recortadas a 20.000 caracteres; se leen hasta 20 páginas para quedarse con hasta 15. 200 pruebas. Falta la demo de Abel. |
| 2026-10-26 | 7 | Primer intento de la demo del H6: la búsqueda con Google **no funciona en la capa gratuita**. *Relevar la web* quedó *Incompleta* 4 veces, sin tokens ni evidencia y con la solicitud en *Lista*: 429 con `gemini-3.6-flash` ([15:45](https://app.notion.com/p/405245a35f2b81b4ab6cd5e48c30a144) y [16:17](https://app.notion.com/p/405245a35f2b81459383d78ff9333604)) y con `gemini-3.8-flash` ([16:01](https://app.notion.com/p/405245a35f2b81679ff5edd4f7540d97)), y 404 con `gemini-2.5-flash` ([16:20](https://app.notion.com/p/405245a35f2b812c817addc1839f80c8): «no longer available to new users»). La generación sí funciona ([*Prueba de modelos* de las 15:56](https://app.notion.com/p/405245a35f2b81ea868edd4404e9265c)). Causa, según la [página de precios](https://ai.google.dev/gemini-api/docs/pricing): *Grounding with Google Search* figura «Not available» en la capa gratuita de los Gemini 3.x Flash, y solo los 2.5 lo traían gratis. Para diagnosticar, el 429 de Gemini registra el detalle de la cuota cuando Google lo manda (esta vez no lo mandó). *Modelo principal* volvió a `gemini-3.6-flash`. |
| 2026-10-26 | 7 | Abel **confirma** que una etapa *Incompleta* deja la solicitud en *Lista*, con el motivo en Ejecuciones. |
| 2026-10-26 | 7 | **Decisión C revisada: buscador separado del modelo, Tavily** (plan gratuito, 1.000 créditos por mes, sin tarjeta). Se evaluaron: facturación de Gemini (unos USD 1 a 3 por mes, pero cobra también la generación de todas las etapas, contra el RNF-01), búsqueda web de Claude con crédito prepago (USD 10 cada 1.000 búsquedas, unos USD 0,05 a 0,08 por corrida con Haiku) y Brave o Exa (crédito mensual, posiblemente con tarjeta). Quedan como mejora futura. Gemini arma una consulta por tema y Tavily la busca: **las URL salen del buscador**, así que la decisión A se mantiene; B y D no cambian. Sin `TAVILY_API_KEY`, solo *Relevar la web* queda *Incompleta*. Abel creó la cuenta y cargó el secreto. |
| 2026-10-26 | 7 | Código con Tavily en `main`: adaptador nuevo, buscador por consulta, consultas armadas por el modelo y `agente.yml` con el secreto. Se quitó la búsqueda de Gemini, que queda en el historial de git. 206 pruebas. |

### Próximo paso

**Demo del H6 con Tavily.** Seguí la guía paso a paso de [docs/demo-h6-guia.md](docs/demo-h6-guia.md): revisar el CI, pedir *Relevar la web*, revisar la evidencia pública, abrir 3 o 4 fuentes a mano para verificar URL y citas, repetir la etapa sin duplicar y, si querés, probar el caso sin búsqueda.

El asistente le repite a Abel la guía paso por paso, revisa en Notion cada resultado, documenta las evidencias en la Fase 7 (sección completa del H6, con los intentos fallidos de hoy) y cierra el H6. Después sigue el **H7: síntesis de personas**, empezando por la propuesta de diseño.

Pendientes a tener en cuenta:
- **Aviso de privacidad:** sumar a la descripción de la base *Contexto del producto* que las consultas de búsqueda se envían a Tavily (el MCP de Notion no muestra esa descripción, así que lo hace Abel a mano).
- Las divergencias planteadas en la demo del H5 están en la [Fase 7](docs/07-implementacion.md#resultado-de-la-demo-del-h5). Se usan en el H7 para verificar que la síntesis las detecte.
- Las entrevistas de Ingeniería y Negocio las simuló el asistente: sirven para probar el agente, no reflejan conocimiento real del equipo.
- *Agente activo* está **marcada**: el programado diario de las 15 h atiende las solicitudes pendientes.
- El contexto de cobros-recurrentes está **Confirmado** y las 3 entrevistas están **Completas**.
- Del H4 sigue abierto: que el agente ignore las filas de contexto totalmente vacías. Del H5: medir el efecto del ajuste del prompt y el esfuerzo por miembro con personas reales, en el H9.
- T4.6 (contexto desde GitHub, *could*) queda para el final del MVP.

### Cómo retomar en otro chat

Si el contexto de un chat se agota, abrí uno nuevo y pegá este mensaje:

> Estoy construyendo un agente con Spec Driven Development. Toda la spec y las decisiones están en https://github.com/abellatuf/User-Persona-Agente (repo privado). Leé el README (índice y bitácora) y los archivos de `docs/`, y seguí desde el **Próximo paso** de la bitácora. Trabajamos fase por fase, en español, y no se avanza sin mi aprobación.

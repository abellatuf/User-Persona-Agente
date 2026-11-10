# Plantilla de Notion

Creada el 2026-10-15 con el MCP de Notion (tarea T1.2), en el espacio **"Espacio de Abel Latuf"**.

**Página raíz:** [User-Persona Agente](https://app.notion.com/p/3fa245a35f2b81f2afcec088c81678a4). Es privada. En el hito H0, Abel la comparte con la integración del agente (T0.2).

## Bases de datos

| Base | Data source ID | Relaciones |
|------|----------------|------------|
| Configuración | `de3cb0ff-3f04-40b4-9cad-9342b177b12e` | — (una sola fila: *Configuración del agente*) |
| Equipo | `a6565b62-6a72-42a3-8cb8-632a1b02314d` | ↔ Entrevistas |
| Contexto del producto | `acf50bb3-01f8-4d02-b324-b6385022a556` | — (una sola fila por producto) |
| Solicitudes | `2e3c1c30-d51d-4d54-b04e-d8ca6219de6b` | ↔ Ejecuciones |
| Entrevistas | `2e12b4ac-b6c2-4335-a7d8-e23b15221f03` | ↔ Equipo (Miembro), ↔ Evidencia |
| Ejecuciones | `19c0b3fc-666b-41f5-8d7d-2ff602222281` | ↔ Solicitudes |
| User Personas | `66110292-329d-4c26-a9d6-ac47849964f3` | ↔ Atributos, ↔ sí misma (Versión anterior / Versión siguiente) |
| Evidencia | `0c57fc5f-aa53-4d5a-ae63-969c50f5dfe4` | ↔ Entrevistas, ↔ Atributos |
| Atributos | `10c0eff2-9f48-4a11-b773-4e361d1f2629` | ↔ User Personas, ↔ Evidencia, ↔ Supuestos a validar |
| Supuestos a validar | `52dcc77d-24a1-4584-ad0d-c25fed833fc4` | ↔ Atributos |

## Espacio de evaluación (H9)

Creado el 2026-11-09 con el MCP de Notion: página [Evaluaciones](https://app.notion.com/p/411245a35f2b81feae4bf98386f719e1), dentro de la raíz. Tiene una copia de las diez bases, con las mismas propiedades y relaciones. Solo la usa `evals.yml` (`ESPACIO=evaluacion`), y el runner manda a la papelera sus filas en cada corrida, menos *Configuración* (*Agente activo* marcada y `gemini-3.6-flash`). Desde el 2026-11-10, su *Modelo de respaldo* es `nvidia/nemotron-3.5-super-vl:free` en lugar de `openrouter/free`, para probar un respaldo fijo más grande sin tocar el espacio del PM.

| Base | Data source ID |
|------|----------------|
| Configuración | `2b65c12d-6400-43ea-8049-05f68919de7f` |
| Equipo | `425f5e8c-4056-4dac-863f-f18832bb5efd` |
| Contexto del producto | `64f03849-afb1-4322-afd1-d9e2ee571c73` |
| Solicitudes | `c5abee68-1c42-44c3-b9e5-d6d6920165e5` |
| Entrevistas | `46010d33-58e2-4f7c-9b28-8d14750454a2` |
| Ejecuciones | `1fb7094b-c903-476e-a8c0-a7ed3685ce93` |
| User Personas | `981330cd-367c-4c74-abfe-df72a8f90b4a` |
| Evidencia | `8a889fa4-71bc-40cb-812f-350d88aa47e0` |
| Atributos | `13500cab-4def-4513-934e-ca642a40f68e` |
| Supuestos a validar | `ccf23d55-ad76-45e6-b4a4-ac712898e9b2` |

## Decisiones de implementación

- **Configuración es una base con una sola fila**, no una página suelta, porque Notion solo permite casillas como *Agente activo* dentro de una base.
- **Cada campo del contexto tiene su par "· fuente"** (por ejemplo, *Problema* y *Problema · fuente*). Así la trazabilidad del contexto se ve en la misma fila.
- **La investigación propia se guarda en Evidencia**, con *Tipo = Investigación propia*, *Método de investigación* y *Muestra*.
- **Agente activo empezó desmarcado**, porque el agente todavía no existía. Abel lo marcó en la demo del H1 (2026-10-16).
- **Clave** (H2, 2026-10-16): propiedad de texto en Evidencia, Atributos, User Personas y Supuestos a validar. La usa el agente para no duplicar filas al repetir una etapa. Es técnica: se puede ocultar en las vistas y no hay que editarla.
- **Editado por el PM** (H2, 2026-10-16): casilla en Atributos. La marca el agente cuando detecta que el PM editó el atributo. Desde ese momento el agente no lo cambia y deja sus propuestas en *Sugerencia del agente*.
- **Modelos en Configuración** (H3, 2026-10-17): *Modelo principal* y *Modelo de respaldo* tenían un texto de relleno ("Por definir en H3…") que el agente tomaba como nombre de modelo. Se corrigieron (`gemini-3.6-flash` y `openrouter/free`), y desde el H4 el agente no usa un valor que no parezca un nombre de modelo.
- **Aviso de privacidad** (H4, 2026-10-18): la descripción de la base Contexto del producto explica que hay una sola fila por producto, dónde van las fuentes y que **las fuentes se envían a un proveedor de IA gratuito** (HU-03, RNF-06).
- **Formulario *Contexto manual*** (H4, 2026-10-18): vista de formulario sobre Contexto del producto, creada con el MCP de Notion, con *Nombre*, los seis campos e *Idioma* (HU-03b). Después de cargarlo, se pide *Armar contexto* sin fuentes y el agente marca la fuente de cada campo como «Cargado por el PM».
- **Entrevistas** (H5, 2026-10-24): una propiedad de texto por pregunta del formulario base, con su código adelante (*P01 · ¿Quiénes creés…?* a *P13 · …*), más *Nombre del miembro* y *Rol del miembro*. Se borró *Respuestas del formulario base*, que no se usaba. La descripción de la base explica el circuito y avisa que las respuestas se envían a un proveedor de IA gratuito. El agente lee cada respuesta por el código de la pregunta, así que el texto de la pregunta se puede ajustar si se actualiza también `agent/src/stages/2-repreguntar/formulario.ts`.
- **Formulario *Entrevista base*** (H5, 2026-10-24): vista de formulario sobre Entrevistas, creada con el MCP de Notion. Desde el MCP no se pueden marcar preguntas como obligatorias ni agregar la descripción del formulario: se hace a mano desde Notion (ver [demo-h5-guia.md](demo-h5-guia.md), paso 1).
- **Repreguntas en el cuerpo de la página** (H5, 2026-10-24): el servidor MCP de Notion solo escribe párrafos, así que cada repregunta usa renglones con marcas fijas (❓ y ✍️). El miembro responde debajo de «✍️ Tu respuesta:» y no tiene que borrar las marcas.
- **Aviso de privacidad del H6** (2026-10-26): Abel agregó a mano, en la descripción de la base Contexto del producto, que las consultas de búsqueda de *Relevar la web* se arman con el contexto y se envían a Tavily, con los datos personales ocultos. Se hizo a mano porque el MCP de Notion no muestra esa descripción y pisarla sin verla borraría el aviso del H4.

- **Formulario *Investigación propia*** (H7, 2026-10-31): vista de formulario sobre Evidencia, con *Título*, *Método de investigación*, *Fecha de consulta*, *Muestra*, *Extracto* y *Tipo* (HU-08). El MCP de Notion solo deja ver la pregunta del título, así que las demás preguntas y la descripción («No incluyas datos personales…») las revisa Abel a mano. Abel corrigió la opción «Análitica» a «Analítica» en *Método de investigación*.
- **Atributos y Sugerencia del agente** (H7, 2026-11-05): al volver a sintetizar, el agente actualiza cada atributo por su fila (A1, A2… en el prompt). Si el PM lo editó, conserva su texto y deja la propuesta completa en *Sugerencia del agente*. En *Posturas*, una postura del contexto se escribe como «Campo *Nombre*: «texto del campo»», con el texto copiado tal cual.
- **Sintetizada el** (H8, 2026-11-06): fecha en User Personas. La escribe el agente cada vez que sintetiza la persona; la evidencia creada después cuenta como nueva para una persona *Aprobada*.
- **Vista *Por versión*** (H9, 2026-11-10): tabla en *User Personas* con *Versión* junto al nombre, ordenada por nombre y por versión de mayor a menor. Sirve para no confundir dos versiones de una persona, que tienen el mismo nombre.
- **Excluir de la síntesis** (H8, 2026-11-06): casilla en Evidencia. La marca el PM para que el agente no use esa fila al sintetizar, sin borrarla.

## Pendiente

- **Vistas útiles:** por ejemplo, Solicitudes pendientes y personas por estado.

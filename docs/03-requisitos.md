# Fase 3: Requisitos

## Restricciones y requisitos no funcionales (RNF)

| ID | Requisito | Detalle |
|----|-----------|---------|
| RNF-01 | **Costo cero en IA** | Se usa la **capa gratuita de Gemini** como proveedor principal y **modelos gratuitos de OpenRouter** como secundario. |
| RNF-02 | **Independencia del proveedor** | El agente accede a los modelos mediante una capa de abstracción. Cambiar de proveedor o de modelo es configuración, no código. |
| RNF-03 | **Tolerancia a límites de uso** | Las capas gratuitas limitan solicitudes y tokens. Cuando se alcanza un límite, el agente espera y reintenta o pasa al proveedor secundario. Nunca pierde trabajo: cada etapa se puede retomar donde quedó. |
| RNF-04 | **Idempotencia** | Volver a ejecutar una etapa no duplica evidencias, atributos ni personas: actualiza lo que existe. |
| RNF-05 | **Idioma del equipo** | El agente trabaja en el idioma en que se cargó el contexto del producto: repreguntas, personas, evidencia y planes de validación. |
| RNF-06 | **Privacidad** | Según sus términos, las capas gratuitas pueden usar los datos enviados para mejorar los modelos. Por eso **no se cargan datos personales** de usuarios finales: la investigación propia se carga anonimizada y los formularios lo advierten. |
| RNF-07 | **Aprobación protegida por código** | La regla "el agente nunca marca una persona como Aprobada" se controla **en el código**, antes de cada escritura en Notion, y no solo en el prompt. |
| RNF-08 | **Auditoría** | Cada ejecución queda registrada en Notion: etapa, fecha, proveedor y modelo, qué leyó, qué escribió y qué errores hubo. |
| RNF-09 | **Ejecución a demanda** | En el MVP, el PM pide cada etapa desde Notion y el agente la atiende en su próxima ejecución programada (ajustado en la Fase 5). La ejecución automática ante cada formulario nuevo queda para el futuro. |
| RNF-10 | **Mínimo acceso** | El agente solo accede a las páginas de Notion que se comparten explícitamente con su integración. |
| RNF-11 | **Fuentes verificables** | Toda evidencia pública tiene URL, título, fecha de consulta y extracto. |
| RNF-12 | **Agnóstico de producto** | Ni los formularios, ni los prompts, ni las plantillas mencionan una industria o un producto concreto. |
| RNF-13 | **Plazo** | Sin plazo fijo: se avanza fase por fase. |

## Regla de nivel de confianza

Un atributo toma el nivel de su **mejor evidencia**:

| Nivel | Cuándo |
|-------|--------|
| 🟢 **Alta** | Lo respalda investigación propia con usuarios reales, de al menos dos fuentes independientes. |
| 🟡 **Media** | Lo respalda una sola investigación propia, o información pública que coincide con lo que dice el equipo. |
| 🔴 **Baja** | Solo lo respaldan supuestos del equipo, o información pública que el equipo no confirma. |

Un atributo con **divergencia** sin resolver nunca puede tener confianza alta.

## Épicas e historias de usuario

Prioridad según MoSCoW: **M** = must, **S** = should, **C** = could.

### E1. Espacio de trabajo

**HU-01 · Plantilla de Notion (M).** Como PM, quiero duplicar una plantilla de Notion con las bases y los formularios listos, para empezar sin configurar nada.
- **Dado** que duplico la plantilla, **entonces** existen las bases Contexto del producto, Equipo, Entrevistas, Evidencia, User Personas, Atributos, Supuestos a validar, Ejecuciones y Solicitudes, la página Configuración (ajustado en la Fase 5), con sus relaciones, la página de fuentes del contexto y los formularios de entrevista base, de investigación propia y de contexto manual.
- **Dado** que ejecuto el agente, **cuando** falta alguna base o propiedad obligatoria, **entonces** el agente no avanza y lista lo que falta.

**HU-02 · Conexión segura (M).** Como PM, quiero conectar el agente solo a mi espacio del proyecto, para controlar qué puede leer y escribir.
- **Dado** que compartí el espacio con la integración, **entonces** el agente opera solo sobre esas páginas.

### E2. Contexto del producto

**HU-03 · Contexto asistido (M).** Como PM, quiero indicarle al agente de dónde sacar el contexto del producto, en lugar de escribirlo yo, para no repetir información que ya existe.
- El PM indica **al menos una fuente**: un documento subido a Notion, como una spec, un PRD o un pitch (**M**); la URL pública del producto (**M**); o un repositorio de GitHub (**C**).
- **Dado** que indiqué las fuentes, **cuando** ejecuto la etapa de contexto, **entonces** el agente completa la página de Contexto del producto: nombre, problema que resuelve, propuesta de valor, usuarios que creemos tener, país o mercado, modelo de negocio y competidores.
- Cada campo indica **de qué fuente salió**.
- Los campos que el agente no encuentra quedan marcados como **"No encontrado"**. El agente no los inventa, y **los completa el PM**.
- El contexto queda en estado **Por confirmar**. **Ninguna etapa siguiente arranca hasta que el PM lo marca como Confirmado.**
- Las fuentes que se le pasan al agente se envían a un proveedor de IA. Por eso se advierte que solo se usen fuentes que el PM está autorizado a compartir (ver RNF-06).

**HU-03b · Formulario de contexto manual (S).** Como PM de un producto que todavía no tiene nada escrito, por ejemplo una idea temprana, quiero cargar el contexto en un formulario.
- Tiene los mismos campos que el contexto asistido y también requiere la confirmación del PM.

### E3. Entrevista al equipo

**HU-04 · Formulario base (M).** Como miembro del equipo, quiero responder un formulario corto sobre los usuarios, para aportar lo que sé sin preparación previa.
- El formulario tiene **como máximo 15 preguntas** y no menciona ninguna industria.
- Cada respuesta queda en Entrevistas, vinculada al miembro y a su rol, y genera evidencia del tipo **supuesto del equipo**.

**HU-05 · Repreguntas (M).** Como miembro del equipo, quiero recibir repreguntas sobre mis respuestas, para profundizar donde fui vago o di algo que puede contradecir a otros.
- **Dado** que ejecuto la etapa de repreguntas, **entonces** el agente escribe en la página de cada miembro **como máximo 5 repreguntas**, cada una vinculada a la respuesta que la motivó.
- Las repreguntas son abiertas, no sugieren la respuesta y no repiten preguntas del formulario.
- Si las respuestas ya son suficientes, el agente puede no generar repreguntas, y lo registra.

**HU-06 · Cierre de la entrevista (M).** Como miembro del equipo, quiero responder las repreguntas en mi página y marcar mi entrevista como completa.
- La síntesis solo usa entrevistas en estado **Completa**, salvo que el PM decida avanzar sin las que falten. En ese caso se registra.

### E4. Relevamiento web

**HU-07 · Búsqueda de información pública (M).** Como PM, quiero que el agente busque información pública sobre el mercado y los usuarios, para contrastar lo que cree el equipo.
- Cada hallazgo se guarda como evidencia del tipo **pública**, con URL, título, fecha de consulta y extracto. No se guarda ningún hallazgo sin URL.
- **Dado** que la búsqueda no está disponible, por ejemplo porque se agotó la cuota, **entonces** la etapa queda incompleta y la síntesis aclara que no hay evidencia pública.

### E5. Investigación propia

**HU-08 · Carga de investigación (M).** Como aportante de evidencia, quiero cargar investigación propia mediante un formulario, para que las personas se apoyen en datos reales.
- Campos: tipo (entrevista, encuesta, analítica, soporte u otro), fecha, método, muestra y hallazgos.
- El formulario advierte que no hay que incluir datos personales.
- Cada carga se guarda como evidencia del tipo **investigación propia**.

### E6. Síntesis de personas

**HU-09 · Proto-personas (M).** Como PM, quiero que el agente proponga segmentos y proto-personas, para tener un borrador sobre el cual decidir.
- Cada persona se crea en estado **Borrador** y explica por qué es un segmento distinto de las demás.
- Los atributos se agrupan en objetivos, problemas, comportamientos y contexto de uso.
- **Cada atributo tiene al menos una evidencia vinculada** y un nivel de confianza calculado según la regla de confianza.
- El agente no incluye atributos decorativos que no sirvan para decidir.

**HU-10 · Divergencias (M).** Como PM, quiero ver dónde no está de acuerdo el equipo, para discutirlo con evidencia.
- **Dado** que dos o más miembros afirman cosas incompatibles sobre el mismo aspecto, **entonces** el atributo se marca con **divergencia** y muestra cada postura con su autor y su rol, sin elegir una.

**HU-11 · Resumen de la síntesis (S).** Como PM, quiero un resumen al principio de cada persona, para revisarla rápido.
- Incluye las fuentes usadas, la cantidad de atributos por nivel de confianza, las divergencias y la información que falta.

### E7. Revisión y aprobación

**HU-12 · Revisión y edición (M).** Como PM, quiero editar y comentar las personas en Notion.
- **Dado** que edité un atributo, **cuando** el agente vuelve a sintetizar, **entonces** no pisa mi edición: si propone un cambio, lo deja como sugerencia.

**HU-13 · Aprobación exclusiva del PM (M).** Como PM, quiero ser el único que aprueba o rechaza una persona.
- Solo el PM puede cambiar el estado a **En revisión**, **Aprobada** o **Rechazada** (ajustado en la Fase 4).
- **Dado** que el agente intenta marcar una persona como Aprobada, **entonces** el código bloquea la operación y la registra.
- Al rechazar, el PM indica un motivo y el agente lo tiene en cuenta en la próxima síntesis.

### E8. Validación y evolución

**HU-14 · Plan de validación (M).** Como PM, quiero un plan para validar cada supuesto de baja confianza, para saber qué preguntar y a quién.
- Cada atributo de confianza baja tiene un supuesto a validar con método sugerido (entrevista, encuesta, prueba o analítica), perfil de usuario a contactar y preguntas abiertas y no sesgadas.

**HU-15 · Persona viva (M).** Como PM, quiero que la persona se actualice cuando entra evidencia nueva.
- **Dado** que se cargó evidencia nueva relacionada con una persona aprobada, **cuando** ejecuto la síntesis, **entonces** el agente crea una **versión nueva** en **Borrador**, con un registro de cambios. La versión aprobada sigue vigente hasta que el PM apruebe la nueva (ajustado en la Fase 4).

### E9. Operación

**HU-16 · Registro de ejecuciones (M).** Como PM, quiero ver qué hizo el agente en cada ejecución, para auditar y depurar.
- Cada ejecución crea una fila en **Ejecuciones** con etapa, fecha, proveedor y modelo, cantidad de lecturas y escrituras, resultado y errores.

**HU-17 · Proveedor de respaldo (S).** Como PM, quiero que el agente siga funcionando cuando el proveedor principal no responde.
- **Dado** que Gemini devuelve un error de límite o de disponibilidad, **entonces** el agente reintenta con espera y, si sigue fallando, pasa a OpenRouter y lo registra.

## Prueba de aceptación del MVP

Escenario completo con **cobros-recurrentes**:

1. El PM duplica la plantilla, sube a Notion **solo la spec** del producto (`cobros-recurrentes-spec.md`, no el código) y ejecuta la etapa de contexto. Completa los campos "No encontrado" y confirma el contexto.
2. Abel completa el formulario base **con al menos 3 sombreros** (por ejemplo PM, ingeniería y negocio) y plantea **al menos 2 divergencias** a propósito.
3. El agente genera repreguntas, Abel las responde y cierra cada entrevista.
4. El agente releva información pública sobre cobros recurrentes y sus usuarios en Argentina.
5. El agente sintetiza las proto-personas.
6. Se verifican las métricas de la Fase 2:
   - 100% de atributos con evidencia.
   - Ninguna persona aprobada por el agente.
   - Todas las divergencias planteadas detectadas.
   - Todos los supuestos de confianza baja con su plan de validación.
   - Esfuerzo por sombrero de 30 minutos o menos.
7. El PM revisa, edita y aprueba o rechaza. Se mide la aceptación y el retrabajo.

**Segundo caso de prueba (S): rutina-app.** Es una app de rutinas de gimnasio y su repositorio es 100% de Abel. Un dominio tan distinto de cobros-recurrentes permite verificar que el agente es realmente **agnóstico de producto** (RNF-12). Repetimos el mismo escenario y comparamos los resultados de los dos casos.

## Preguntas abiertas de la Fase 3

- [x] ~~**Presupuesto**~~: costo cero, con Gemini (capa gratuita) como principal y OpenRouter como secundario.
- [x] ~~**Idioma**~~: el del equipo.
- [x] ~~**Plazo**~~: sin plazo fijo.
- [x] ~~**Prioridades**~~: la investigación propia (HU-08) y la persona viva (HU-15) suben a *must*.
- [x] ~~**Regla de confianza**~~: aprobada.
- [x] ~~**Base Ejecuciones**~~: aprobada.
- [x] ~~**Contexto del producto**~~: lo extrae el agente desde un documento o una URL (*must*) o desde GitHub (*could*). El PM completa lo que falta y confirma. El formulario queda como alternativa.
- [x] ~~**Privacidad del caso de prueba**~~: hay autorización para usar cobros-recurrentes (Abel es co-owner de la idea), pero el agente recibe **solo la spec**, no el código.

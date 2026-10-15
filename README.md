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

| # | Fase | Estado |
|---|------|--------|
| 1 | [Definición del problema](#fase-1-definición-del-problema) | ✅ Aprobada |
| 2 | [Visión del producto](#fase-2-visión-del-producto) | ✅ Aprobada |
| 3 | [Requisitos](#fase-3-requisitos) (historias, criterios de aceptación, RNF) | ✅ Aprobada |
| 4 | [Especificación del agente](#fase-4-especificación-del-agente) (rol, capacidades, herramientas, límites) | 🟡 En revisión |
| 5 | Diseño técnico (arquitectura, modelo, prompts, memoria, evals) | ⚪ Pendiente |
| 6 | Plan de tareas | ⚪ Pendiente |
| 7 | Implementación y validación | ⚪ Pendiente |

---

## Fase 1: Definición del problema

### Enunciado

Los equipos de producto toman decisiones de discovery y delivery sin un entendimiento compartido y basado en evidencia de quiénes son sus usuarios, qué necesitan y cómo cada funcionalidad afecta su comportamiento. Por eso construyen funcionalidades que no generan valor, priorizan por intuición o por quien habla más fuerte, y no pueden explicar el impacto de lo que entregan.

### Contexto

Los equipos (PM, diseño e ingeniería) trabajan con un backlog de funcionalidades, pero el conocimiento del usuario está fragmentado. Queda en la cabeza de algunas personas, en investigaciones aisladas o en supuestos que nadie validó.

### Ámbito

- Proyecto personal, independiente de cualquier organización.
- **Agnóstico de producto:** la solución tiene que adaptarse a cualquier producto y a cualquier equipo de producto.

### Situación actual

En el caso general, el equipo **no cuenta con investigación previa**: no hay entrevistas, encuestas ni personas documentadas. Lo que sí suele existir es lo siguiente:

| Fuente de información | Disponibilidad |
|-----------------------|----------------|
| Conocimiento tácito del equipo de producto (lo que creen saber del usuario) | Siempre |
| Contexto del producto: propuesta de valor, funcionalidades, mercado, modelo de negocio | Siempre |
| Información pública: competidores, reseñas, foros, estudios de mercado | Casi siempre, se puede relevar de internet |
| Investigación propia: entrevistas, encuestas, analítica, tickets de soporte | Solo en algunos equipos |

La solución tiene que funcionar con las tres primeras fuentes y aprovechar la cuarta cuando exista. Por ejemplo, el equipo puede cargarla mediante formularios.

### Por qué automatización e IA

Definir personas bien hecho requiere tiempo, criterio metodológico y capacidad de sintetizar mucha información dispersa. La mayoría de los equipos no lo hace por falta de tiempo o de práctica. Una solución con IA puede hacer cuatro cosas:

- **Guiar** al equipo con las preguntas correctas, aunque no tenga experiencia en research.
- **Relevar y sintetizar** información pública y propia mucho más rápido que una persona.
- **Detectar** contradicciones y supuestos no validados en lo que dice el equipo.
- **Proponer** borradores de personas que el equipo revisa, en lugar de partir de una hoja en blanco.

### Restricción fundamental: humano en el circuito

La IA **propone** y las personas **deciden**. Ninguna User Persona se considera válida hasta que la revisa y aprueba un responsable humano, por ejemplo el Product Manager.

### Quién se ve afectado

- **Equipos de producto:** discuten opiniones en lugar de evidencia y les cuesta alinear prioridades.
- **Usuarios finales:** reciben funcionalidades que no resuelven sus problemas reales.
- **Negocio:** invierte capacidad de desarrollo en iniciativas de bajo impacto.

### Síntomas observables

> ⚠️ Son síntomas genéricos. Hay que reemplazarlos o complementarlos con ejemplos reales de la organización.

- Las historias dicen "como usuario…" sin especificar qué tipo de usuario.
- Cada miembro del equipo describe al usuario de forma distinta.
- Las funcionalidades se lanzan sin una hipótesis de impacto ni una métrica asociada.
- Las funcionalidades recién lanzadas tienen baja adopción.
- El equipo no tiene contacto directo y frecuente con usuarios.

### Causas raíz probables

1. No hay una práctica sistemática de discovery con usuarios reales.
2. Lo que se aprende de los usuarios no se documenta ni se comparte de forma accionable.
3. Las funcionalidades se definen como *output* y no como *outcome* para un segmento concreto.
4. No hay un lenguaje común para hablar de los distintos tipos de usuario.

### Impacto

- Se desperdicia capacidad de desarrollo.
- El *time-to-value* es más lento.
- Se ponen en riesgo el **valor** y la **usabilidad**, dos de los cuatro riesgos de producto de Marty Cagan.
- Los equipos se desmotivan cuando lo que construyen no se usa.

### Hipótesis de solución

> Creemos que si los equipos construyen y usan **User Personas basadas en investigación con usuarios reales**, lograremos un entendimiento compartido del usuario que mejore la priorización y el diseño de funcionalidades. Sabremos que funcionó cuando **[métricas por definir]**.
>
> Y creemos que una **solución con IA que guíe al equipo, releve información y proponga personas trazables a su evidencia, con aprobación humana**, baja lo suficiente el costo de hacerlo como para que cualquier equipo lo adopte.

### Posibles métricas de éxito

| Métrica | Línea base | Objetivo |
|---------|-----------|----------|
| % de iniciativas con una persona objetivo y una hipótesis de impacto explícitas | ? | ? |
| Adopción o uso de las funcionalidades lanzadas, comparado con la línea base | ? | ? |
| Cantidad de entrevistas o contactos con usuarios por equipo por mes | ? | ? |
| Alineación del equipo: consistencia de respuestas a "¿para quién es esto y qué problema le resuelve?" | ? | ? |

### Riesgo principal

Cagan advierte que una persona inventada en un workshop, sin datos detrás, es contraproducente porque solo formaliza los supuestos. La persona tiene que nacer de la investigación, y hay que actualizarla y usarla en las decisiones del día a día. Si no, termina como un póster en la pared.

**Implicancia para la solución:** el riesgo es aún mayor con una IA, porque puede generar personas verosímiles sin ninguna evidencia detrás. Como en el caso general las fuentes son el conocimiento del equipo e información pública, el resultado inicial va a ser una **proto-persona**, es decir, una hipótesis y no una verdad. Por eso:

1. Cada atributo de la persona indica su **fuente** y su **nivel de confianza**: dato de investigación propia, dato público o supuesto del equipo.
2. La solución no oculta los supuestos. Los expone y propone **cómo validarlos**, por ejemplo con guías de entrevista o encuestas.
3. La persona es un **artefacto vivo**: madura a medida que entra evidencia nueva.

### Preguntas abiertas de la Fase 1

- [x] ~~**Ámbito**~~: proyecto personal y agnóstico de producto.
- [x] ~~**Situación actual**~~: en general no hay investigación previa; ver las fuentes de información disponibles.
- [x] ~~**Por qué IA**~~: guiar, relevar, sintetizar, detectar supuestos y proponer borradores, siempre con aprobación humana.
- [x] ~~**Métricas**~~: definidas en la Fase 2.
- [x] ~~**Restricciones técnicas**~~: definidas en la Fase 3 como requisitos no funcionales.

---

## Fase 2: Visión del producto

### Objetivo del proyecto

Proyecto de **aprendizaje y portfolio**. Busca demostrar Spec Driven Development y el diseño de agentes de IA con un **MVP funcional y bien documentado**, pensado para un **público limitado**. No hace falta escala, multi-tenant ni monetización.

### Forma de la solución: Notion + agente de IA

En lugar de construir una aplicación propia, la solución usa **Notion como interfaz y como base de conocimiento**, y un **agente de IA** que lee y escribe en Notion.

| Necesidad | Se resuelve con |
|-----------|-----------------|
| Cargar el contexto del producto | **El agente lo extrae** de fuentes que indica el PM (documento o URL), y el PM lo confirma. Hay un formulario como alternativa (ajustado en la Fase 3). |
| Cargar la investigación propia | **Formularios de Notion** |
| Entrevistar a cada miembro del equipo | Formulario base de Notion + **repreguntas del agente** en la página de cada miembro |
| Guardar fuentes y evidencia | **Base de datos** de Notion |
| Detallar las User Personas con trazabilidad | **Bases de datos relacionadas**: cada atributo se vincula a su evidencia |
| Revisar y aprobar | **Estado** de la persona, que solo cambia el PM, y comentarios de Notion |
| Versionar | Historial de páginas de Notion |

**Por qué Notion:**
- El público es limitado. No hace falta construir login, invitaciones, pantallas ni permisos: Notion ya los tiene.
- Todo queda en un solo lugar: la información, los formularios y las personas.
- El esfuerzo se concentra en lo que importa demostrar, que es **el agente y la spec**.

**Decisión sobre el agente:** un **agente propio**, con código y prompts propios, que lee y escribe en Notion mediante **MCP**. Notion también tiene agentes nativos y se podría hacer sin código, pero un agente propio da control sobre los prompts, la trazabilidad y las evaluaciones, y tiene más valor para un portfolio. El detalle de la conexión se define en la Fase 5.

**Modelo de lenguaje** (definido en la Fase 3): la **capa gratuita de Gemini** como proveedor principal y **OpenRouter** como secundario. El agente no depende de un proveedor en particular.

### Declaración de visión

> **Para** equipos de producto (PM, diseño e ingeniería) **que** necesitan saber para quién construyen, pero no tienen el tiempo ni la práctica para hacer research,
> **User-Persona Agente** es un **agente de IA que trabaja dentro de Notion**: recopila el conocimiento del equipo mediante formularios y repreguntas, releva información pública, suma la investigación propia y **detalla User Personas trazables a su evidencia**.
> **A diferencia de** los generadores de personas con IA, que inventan perfiles verosímiles en segundos, y de los workshops tradicionales, que formalizan supuestos, **nuestro producto** muestra de dónde sale cada atributo y qué tan confiable es, expone los desacuerdos del equipo, propone cómo validar los supuestos y **no da nada por válido sin la aprobación del Product Manager**.

**Visión a largo plazo:** que las personas sean el lenguaje común del equipo y estén conectadas a las decisiones del día a día. Por ejemplo, integrar Jira para vincular personas a épicas e historias.

### Usuarios y roles

| Rol | Qué hace |
|-----|----------|
| **Product Manager (owner)** | Duplica el espacio de Notion, indica las fuentes del contexto del producto y lo confirma, invita al equipo, ejecuta el agente, revisa, edita y **aprueba o rechaza** las personas. |
| **Miembro del equipo** (diseño, ingeniería, negocio) | Completa el formulario base y responde las repreguntas del agente en su página. |
| **Aportante de evidencia** (opcional; puede ser el PM) | Carga investigación propia mediante un formulario: entrevistas, encuestas, analítica o tickets de soporte. |

### Estructura en Notion (alto nivel)

```mermaid
erDiagram
    CONTEXTO_PRODUCTO ||--o{ ENTREVISTA : "enmarca"
    MIEMBRO ||--o{ ENTREVISTA : "responde"
    ENTREVISTA ||--o{ EVIDENCIA : "genera"
    EVIDENCIA }o--o{ ATRIBUTO : "respalda"
    USER_PERSONA ||--o{ ATRIBUTO : "se compone de"
    ATRIBUTO ||--o| SUPUESTO_A_VALIDAR : "si es de baja confianza"
```

| Base de datos | Contenido |
|---------------|-----------|
| **Contexto del producto** | Propuesta de valor, mercado, competidores y modelo de negocio, cada uno con su fuente. Lo arma el agente a partir de las fuentes que indica el PM, y el PM lo confirma. |
| **Equipo** | Miembros y roles. |
| **Entrevistas** | Respuestas al formulario base y repreguntas del agente, una página por miembro. |
| **Evidencia** | Cada fuente con su tipo (supuesto del equipo, información pública o investigación propia), su origen (miembro o URL) y un extracto. |
| **User Personas** | Una página por persona, con estado (`Borrador → En revisión → Aprobada / Rechazada`), versión y aprobador. |
| **Atributos** | Afirmaciones de la persona por categoría (objetivos, problemas, comportamientos, contexto), con nivel de confianza, evidencias relacionadas y marca de divergencia. |
| **Supuestos a validar** | Plan de validación de cada atributo de baja confianza: método, preguntas sugeridas y estado. |

> El modelo de datos detallado se define en la Fase 5.

### Flujo principal

```mermaid
flowchart LR
    A[1. Contexto asistido<br/>+ confirmación del PM] --> B[2. Formulario base<br/>a cada miembro]
    B --> B2[2b. Repreguntas<br/>del agente]
    A --> C[3. Relevamiento<br/>web]
    A --> D[4. Formulario: investigación<br/>propia - opcional]
    B2 --> E[5. Síntesis en Notion:<br/>proto-personas]
    C --> E
    D --> E
    E --> F{6. Revisión<br/>del PM}
    F -- editar / rechazar --> E
    F -- aprobar --> G[7. Persona aprobada<br/>+ supuestos a validar]
    G -- nueva evidencia --> E
```

1. **Contexto del producto:** el PM indica las fuentes, el agente arma el contexto y el PM lo confirma. Si no hay nada escrito, se usa un formulario (ajustado en la Fase 3).
2. **Entrevista a cada miembro:** cada uno completa por separado un formulario base agnóstico de producto. Después, el agente analiza las respuestas y escribe **repreguntas** en la página de cada miembro para profundizar, aclarar o pedir ejemplos.
3. **Relevamiento web:** el agente busca competidores, reseñas, foros y estudios públicos, y registra cada fuente en la base de evidencia.
4. **Investigación propia** (opcional): se carga mediante un formulario.
5. **Síntesis:** el agente crea o actualiza las páginas de User Persona y sus atributos, cada uno vinculado a su evidencia, con nivel de confianza y marca de divergencia entre miembros.
6. **Revisión humana:** el PM edita, comenta, rechaza o aprueba. **El agente nunca puede marcar una persona como Aprobada.**
7. **Supuestos a validar:** para cada atributo de baja confianza, el agente propone cómo validarlo. Cuando entra evidencia nueva, la persona vuelve a revisión con una nueva versión.

### Principios de producto

1. **Evidencia por sobre verosimilitud:** una persona incompleta y honesta vale más que una completa e inventada.
2. **La IA propone y el humano decide:** toda persona necesita la aprobación explícita del PM.
3. **Supuestos a la vista:** cada atributo muestra su fuente (investigación propia, información pública o supuesto del equipo) y su nivel de confianza.
4. **El desacuerdo es información:** las divergencias del equipo se muestran, no se promedian.
5. **Agnóstico de producto:** ni los formularios, ni las preguntas, ni las plantillas asumen una industria o un tipo de producto.
6. **Accionable, no decorativa:** la persona prioriza objetivos, problemas, comportamientos y contexto de uso por sobre datos de color ("le gusta el café").
7. **Artefacto vivo:** la persona tiene versiones y madura con la evidencia.
8. **Donde el equipo ya trabaja:** todo pasa en Notion, sin herramientas nuevas que adoptar.

### Qué es y qué no es

| ✅ Es | ❌ No es |
|-------|---------|
| Un agente de discovery que estructura y acelera la definición de personas dentro de Notion | Un generador de personas en un clic |
| Una herramienta que hace explícitos los supuestos y propone cómo validarlos | Un reemplazo de hablar con usuarios reales |
| Un espacio donde el equipo se alinea sobre quién es el usuario | Una herramienta de analítica ni un CRM |
| Un MVP de portfolio para un público limitado | Una aplicación web propia ni un SaaS |

### Alcance

| MVP | Futuro (fuera del MVP) |
|-----|------------------------|
| Plantilla de Notion con bases de datos y formularios | Integración con Jira: personas vinculadas a épicas e historias y marca de historias "como usuario…" sin persona |
| Contexto asistido desde un documento o una URL, con confirmación del PM | Ingesta automática (transcripciones, analítica, tickets) |
| Formulario base para cada miembro del equipo + repreguntas del agente | Ejecución automática del agente ante cada formulario nuevo |
| Relevamiento web con fuentes citadas | Alertas de personas desactualizadas |
| Formulario de investigación propia | Uso por muchos equipos en paralelo |
| Síntesis de proto-personas con fuente, confianza y divergencias | |
| Revisión y aprobación por el PM mediante estados de Notion | |
| Supuestos a validar con métodos sugeridos | |

### Métricas de éxito del producto

Las métricas de impacto de la Fase 1, como la adopción de funcionalidades o el % de iniciativas con persona objetivo, se miden a largo plazo y quedan fuera del alcance de un MVP de portfolio. Para el MVP medimos la **calidad y la utilidad de la solución**:

| Métrica | Tipo | Objetivo MVP |
|---------|------|--------------|
| **Trazabilidad:** % de atributos de cada persona vinculados a al menos una evidencia | Guardrail | **100%** |
| **Aprobación indebida:** personas que el agente marca como Aprobada | Guardrail | **0** |
| **Aceptación:** % de personas propuestas que **el PM aprueba**, con o sin ediciones menores | Calidad | ≥ 70% |
| **Retrabajo:** % de atributos que el PM tiene que reescribir | Calidad | ≤ 30% |
| **Esfuerzo por miembro:** formulario base + repreguntas | Eficiencia | ≤ 30 min (pauta de diseño: ≤ 15 preguntas base y ≤ 5 repreguntas) |
| **Tiempo total:** desde el contexto cargado hasta la primera persona aprobada | Eficiencia | ≤ 1 día de calendario |
| **Accionabilidad:** % de supuestos de baja confianza con un plan de validación | Accionabilidad | 100% |
| **Alineación:** divergencias del equipo detectadas y mostradas | Alineación | Se detectan todas las divergencias planteadas a propósito en la prueba |

**Qué significa trazabilidad.** Un *atributo* es cada afirmación de la persona, por ejemplo "Concilia los pagos a mano en Excel una vez por semana". Para que cuente como trazable, tiene que estar vinculado al menos a una fila de la base de **Evidencia** que diga de dónde salió: la respuesta de un miembro del equipo, una fuente pública con su URL o una investigación propia. Si solo lo dijo el equipo, igual queda vinculado, pero como **supuesto del equipo** y con confianza baja. Lo que no puede existir es un atributo sin ninguna evidencia, porque eso sería algo que el agente inventó.

### Plan de prueba del MVP

**Producto de prueba: cobros-recurrentes.** Es una app para que un **emisor** (un particular, una sociedad de fomento o un profesional independiente, en Argentina) le cobre un monto recurrente a un **pagador**. El pago se pide por email o WhatsApp, sin login, y la conciliación del comprobante es manual. Es un buen caso de prueba por tres razones:

- Es un producto real, con una spec escrita pero **sin investigación con usuarios**: el caso general que plantea la Fase 1.
- Tiene dos actores muy distintos y, dentro del emisor, **segmentos que pueden tener necesidades diferentes**. Son candidatos naturales a varias personas.
- Su spec es la fuente del **contexto asistido**: se sube a Notion solo la spec, no el código del repositorio.

**Miembros del equipo: una persona con distintos sombreros.** Abel completa los formularios y responde las repreguntas varias veces, cada vez con un rol distinto, por ejemplo PM, diseño, ingeniería y negocio. Cada rol tiene su propio nivel de conocimiento del usuario y sus opiniones. En algunos puntos se plantean **divergencias a propósito** para verificar que el agente las detecte. Como responde una persona real, el esfuerzo por miembro **se mide en minutos**.

### Preguntas abiertas de la Fase 2

- [x] ~~**Objetivo del proyecto**~~: aprendizaje y portfolio, con un público limitado.
- [x] ~~**Forma**~~: Notion (formularios + bases de datos) con un agente de IA. Jira queda para el futuro.
- [x] ~~**Entrevistas**~~: a cada miembro del equipo por separado, con formulario base y repreguntas del agente.
- [x] ~~**Agente**~~: propio, conectado a Notion por MCP. Usa Gemini (capa gratuita) como modelo principal y OpenRouter como secundario.
- [x] ~~**Métricas**~~: aprobadas.
- [x] ~~**Producto de prueba**~~: **cobros-recurrentes**. Abel hace de los distintos miembros del equipo.
- [x] ~~**Base metodológica**~~: *Inspired*, de Marty Cagan.

---

## Fase 3: Requisitos

### Restricciones y requisitos no funcionales (RNF)

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
| RNF-09 | **Ejecución a demanda** | En el MVP, el PM ejecuta el agente por etapa. La ejecución automática queda para el futuro. |
| RNF-10 | **Mínimo acceso** | El agente solo accede a las páginas de Notion que se comparten explícitamente con su integración. |
| RNF-11 | **Fuentes verificables** | Toda evidencia pública tiene URL, título, fecha de consulta y extracto. |
| RNF-12 | **Agnóstico de producto** | Ni los formularios, ni los prompts, ni las plantillas mencionan una industria o un producto concreto. |
| RNF-13 | **Plazo** | Sin plazo fijo: se avanza fase por fase. |

### Regla de nivel de confianza

Un atributo toma el nivel de su **mejor evidencia**:

| Nivel | Cuándo |
|-------|--------|
| 🟢 **Alta** | Lo respalda investigación propia con usuarios reales, de al menos dos fuentes independientes. |
| 🟡 **Media** | Lo respalda una sola investigación propia, o información pública que coincide con lo que dice el equipo. |
| 🔴 **Baja** | Solo lo respaldan supuestos del equipo, o información pública que el equipo no confirma. |

Un atributo con **divergencia** sin resolver nunca puede tener confianza alta.

### Épicas e historias de usuario

Prioridad según MoSCoW: **M** = must, **S** = should, **C** = could.

#### E1. Espacio de trabajo

**HU-01 · Plantilla de Notion (M).** Como PM, quiero duplicar una plantilla de Notion con las bases y los formularios listos, para empezar sin configurar nada.
- **Dado** que duplico la plantilla, **entonces** existen las bases Contexto del producto, Equipo, Entrevistas, Evidencia, User Personas, Atributos, Supuestos a validar y Ejecuciones, con sus relaciones, la página de fuentes del contexto y los formularios de entrevista base, de investigación propia y de contexto manual.
- **Dado** que ejecuto el agente, **cuando** falta alguna base o propiedad obligatoria, **entonces** el agente no avanza y lista lo que falta.

**HU-02 · Conexión segura (M).** Como PM, quiero conectar el agente solo a mi espacio del proyecto, para controlar qué puede leer y escribir.
- **Dado** que compartí el espacio con la integración, **entonces** el agente opera solo sobre esas páginas.

#### E2. Contexto del producto

**HU-03 · Contexto asistido (M).** Como PM, quiero indicarle al agente de dónde sacar el contexto del producto, en lugar de escribirlo yo, para no repetir información que ya existe.
- El PM indica **al menos una fuente**: un documento subido a Notion, como una spec, un PRD o un pitch (**M**); la URL pública del producto (**M**); o un repositorio de GitHub (**C**).
- **Dado** que indiqué las fuentes, **cuando** ejecuto la etapa de contexto, **entonces** el agente completa la página de Contexto del producto: nombre, problema que resuelve, propuesta de valor, usuarios que creemos tener, país o mercado, modelo de negocio y competidores.
- Cada campo indica **de qué fuente salió**.
- Los campos que el agente no encuentra quedan marcados como **"No encontrado"**. El agente no los inventa, y **los completa el PM**.
- El contexto queda en estado **Por confirmar**. **Ninguna etapa siguiente arranca hasta que el PM lo marca como Confirmado.**
- Las fuentes que se le pasan al agente se envían a un proveedor de IA. Por eso se advierte que solo se usen fuentes que el PM está autorizado a compartir (ver RNF-06).

**HU-03b · Formulario de contexto manual (S).** Como PM de un producto que todavía no tiene nada escrito, por ejemplo una idea temprana, quiero cargar el contexto en un formulario.
- Tiene los mismos campos que el contexto asistido y también requiere la confirmación del PM.

#### E3. Entrevista al equipo

**HU-04 · Formulario base (M).** Como miembro del equipo, quiero responder un formulario corto sobre los usuarios, para aportar lo que sé sin preparación previa.
- El formulario tiene **como máximo 15 preguntas** y no menciona ninguna industria.
- Cada respuesta queda en Entrevistas, vinculada al miembro y a su rol, y genera evidencia del tipo **supuesto del equipo**.

**HU-05 · Repreguntas (M).** Como miembro del equipo, quiero recibir repreguntas sobre mis respuestas, para profundizar donde fui vago o di algo que puede contradecir a otros.
- **Dado** que ejecuto la etapa de repreguntas, **entonces** el agente escribe en la página de cada miembro **como máximo 5 repreguntas**, cada una vinculada a la respuesta que la motivó.
- Las repreguntas son abiertas, no sugieren la respuesta y no repiten preguntas del formulario.
- Si las respuestas ya son suficientes, el agente puede no generar repreguntas, y lo registra.

**HU-06 · Cierre de la entrevista (M).** Como miembro del equipo, quiero responder las repreguntas en mi página y marcar mi entrevista como completa.
- La síntesis solo usa entrevistas en estado **Completa**, salvo que el PM decida avanzar sin las que falten. En ese caso se registra.

#### E4. Relevamiento web

**HU-07 · Búsqueda de información pública (M).** Como PM, quiero que el agente busque información pública sobre el mercado y los usuarios, para contrastar lo que cree el equipo.
- Cada hallazgo se guarda como evidencia del tipo **pública**, con URL, título, fecha de consulta y extracto. No se guarda ningún hallazgo sin URL.
- **Dado** que la búsqueda no está disponible, por ejemplo porque se agotó la cuota, **entonces** la etapa queda incompleta y la síntesis aclara que no hay evidencia pública.

#### E5. Investigación propia

**HU-08 · Carga de investigación (M).** Como aportante de evidencia, quiero cargar investigación propia mediante un formulario, para que las personas se apoyen en datos reales.
- Campos: tipo (entrevista, encuesta, analítica, soporte u otro), fecha, método, muestra y hallazgos.
- El formulario advierte que no hay que incluir datos personales.
- Cada carga se guarda como evidencia del tipo **investigación propia**.

#### E6. Síntesis de personas

**HU-09 · Proto-personas (M).** Como PM, quiero que el agente proponga segmentos y proto-personas, para tener un borrador sobre el cual decidir.
- Cada persona se crea en estado **Borrador** y explica por qué es un segmento distinto de las demás.
- Los atributos se agrupan en objetivos, problemas, comportamientos y contexto de uso.
- **Cada atributo tiene al menos una evidencia vinculada** y un nivel de confianza calculado según la regla de confianza.
- El agente no incluye atributos decorativos que no sirvan para decidir.

**HU-10 · Divergencias (M).** Como PM, quiero ver dónde no está de acuerdo el equipo, para discutirlo con evidencia.
- **Dado** que dos o más miembros afirman cosas incompatibles sobre el mismo aspecto, **entonces** el atributo se marca con **divergencia** y muestra cada postura con su autor y su rol, sin elegir una.

**HU-11 · Resumen de la síntesis (S).** Como PM, quiero un resumen al principio de cada persona, para revisarla rápido.
- Incluye las fuentes usadas, la cantidad de atributos por nivel de confianza, las divergencias y la información que falta.

#### E7. Revisión y aprobación

**HU-12 · Revisión y edición (M).** Como PM, quiero editar y comentar las personas en Notion.
- **Dado** que edité un atributo, **cuando** el agente vuelve a sintetizar, **entonces** no pisa mi edición: si propone un cambio, lo deja como sugerencia.

**HU-13 · Aprobación exclusiva del PM (M).** Como PM, quiero ser el único que aprueba o rechaza una persona.
- Solo el PM puede cambiar el estado a **Aprobada** o **Rechazada**.
- **Dado** que el agente intenta marcar una persona como Aprobada, **entonces** el código bloquea la operación y la registra.
- Al rechazar, el PM indica un motivo y el agente lo tiene en cuenta en la próxima síntesis.

#### E8. Validación y evolución

**HU-14 · Plan de validación (M).** Como PM, quiero un plan para validar cada supuesto de baja confianza, para saber qué preguntar y a quién.
- Cada atributo de confianza baja tiene un supuesto a validar con método sugerido (entrevista, encuesta, prueba o analítica), perfil de usuario a contactar y preguntas abiertas y no sesgadas.

**HU-15 · Persona viva (M).** Como PM, quiero que la persona se actualice cuando entra evidencia nueva.
- **Dado** que se cargó evidencia nueva relacionada con una persona aprobada, **cuando** ejecuto la síntesis, **entonces** la persona vuelve a **En revisión** con una nueva versión y un registro de cambios.

#### E9. Operación

**HU-16 · Registro de ejecuciones (M).** Como PM, quiero ver qué hizo el agente en cada ejecución, para auditar y depurar.
- Cada ejecución crea una fila en **Ejecuciones** con etapa, fecha, proveedor y modelo, cantidad de lecturas y escrituras, resultado y errores.

**HU-17 · Proveedor de respaldo (S).** Como PM, quiero que el agente siga funcionando cuando el proveedor principal no responde.
- **Dado** que Gemini devuelve un error de límite o de disponibilidad, **entonces** el agente reintenta con espera y, si sigue fallando, pasa a OpenRouter y lo registra.

### Prueba de aceptación del MVP

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

### Preguntas abiertas de la Fase 3

- [x] ~~**Presupuesto**~~: costo cero, con Gemini (capa gratuita) como principal y OpenRouter como secundario.
- [x] ~~**Idioma**~~: el del equipo.
- [x] ~~**Plazo**~~: sin plazo fijo.
- [x] ~~**Prioridades**~~: la investigación propia (HU-08) y la persona viva (HU-15) suben a *must*.
- [x] ~~**Regla de confianza**~~: aprobada.
- [x] ~~**Base Ejecuciones**~~: aprobada.
- [x] ~~**Contexto del producto**~~: lo extrae el agente desde un documento o una URL (*must*) o desde GitHub (*could*). El PM completa lo que falta y confirma. El formulario queda como alternativa.
- [x] ~~**Privacidad del caso de prueba**~~: hay autorización para usar cobros-recurrentes (Abel es co-owner de la idea), pero el agente recibe **solo la spec**, no el código.

---

## Fase 4: Especificación del agente

### Rol e identidad

El agente actúa como un **asistente de investigación de usuarios** que trabaja con el método de *Inspired*. No es el dueño de las personas: es quien **prepara el material** para que el equipo decida.

| Rasgo | Qué significa en la práctica |
|-------|------------------------------|
| **Escéptico** | Trata todo lo que dice el equipo como un supuesto hasta que haya evidencia. |
| **Trazable** | No afirma nada que no pueda vincular a una fuente. Si no sabe algo, dice "no encontrado". |
| **Neutral** | No toma partido en las divergencias del equipo: muestra cada postura. |
| **Curioso** | Repregunta para pedir ejemplos concretos, no opiniones generales. |
| **Breve** | Escribe para que el PM revise rápido: atributos cortos y accionables. |

### Arquitectura: un agente, etapas separadas

Propuesta: **un solo agente** que se ejecuta **por etapas**. Cada etapa tiene su propio objetivo, sus instrucciones, sus herramientas permitidas y sus condiciones de entrada y salida. No hay varios agentes que conversan entre sí.

**Por qué:** es más simple de construir, probar y depurar; consume menos cuota de las capas gratuitas; y como el PM ejecuta cada etapa a demanda (RNF-09), no hace falta un orquestador que coordine agentes. Si alguna etapa crece mucho, se puede separar más adelante sin cambiar el contrato.

**Sin memoria oculta:** el agente no guarda estado propio entre ejecuciones. **Todo el estado vive en Notion**: cada ejecución lee lo que necesita, escribe sus resultados y deja registro en Ejecuciones. Así, cualquier etapa se puede retomar o repetir (RNF-03, RNF-04).

### Etapas

| # | Etapa | Se ejecuta cuando | Lee | Escribe | HU |
|---|-------|-------------------|-----|---------|----|
| 0 | **Verificar espacio** | Antes de cualquier otra etapa | Estructura del espacio | Ejecuciones | HU-01, HU-02 |
| 1 | **Armar contexto** | Hay fuentes cargadas y el contexto no está confirmado | Fuentes (documentos, URL, GitHub) | Contexto del producto (estado *Por confirmar*) | HU-03 |
| 2 | **Repreguntar** | El contexto está *Confirmado* y hay entrevistas con el formulario base respondido | Contexto, Entrevistas | Repreguntas en cada Entrevista, Evidencia (supuestos del equipo) | HU-04, HU-05 |
| 3 | **Relevar la web** | El contexto está *Confirmado* | Contexto | Evidencia (pública) | HU-07 |
| 4 | **Sintetizar** | Las entrevistas están *Completas* (o el PM decidió avanzar sin alguna) | Contexto, Entrevistas, Evidencia, personas existentes y sus ediciones | User Personas, Atributos, divergencias, resumen | HU-06, HU-08 a HU-12, HU-15 |
| 5 | **Planificar validación** | Hay atributos de confianza baja sin plan | Atributos, Evidencia | Supuestos a validar | HU-14 |

```mermaid
flowchart LR
    V[0. Verificar espacio] --> C[1. Armar contexto]
    C --> PM1{PM confirma<br/>contexto}
    PM1 --> R[2. Repreguntar]
    PM1 --> W[3. Relevar la web]
    R --> M{Miembros completan<br/>entrevistas}
    M --> S[4. Sintetizar]
    W --> S
    S --> P[5. Planificar validación]
    P --> PM2{PM revisa<br/>y decide}
    PM2 -- nueva evidencia --> S
```

### Herramientas y permisos por etapa

El agente usa estas herramientas. Cada etapa solo tiene habilitadas las que necesita (mínimo privilegio).

| Herramienta | 0 | 1 | 2 | 3 | 4 | 5 |
|-------------|---|---|---|---|---|---|
| **Notion – leer** (bases, páginas, documentos adjuntos) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Notion – escribir** (solo en las bases del proyecto) | Ejecuciones | Contexto | Entrevistas, Evidencia | Evidencia | Personas, Atributos | Supuestos |
| **Buscar en la web** | | | | ✅ | | |
| **Leer una URL** | | ✅ | | ✅ | | |
| **GitHub – leer** (*could*) | | ✅ | | | | |
| **Modelo de lenguaje** (Gemini u OpenRouter) | | ✅ | ✅ | ✅ | ✅ | ✅ |

Todas las etapas escriben además en **Ejecuciones** (RNF-08).

### Qué decide el modelo y qué decide el código

Para que las reglas no dependan de que el modelo "se porte bien", se separa lo que requiere juicio de lo que es una regla:

| Lo decide el **modelo de lenguaje** | Lo decide el **código** (determinístico) |
|-------------------------------------|------------------------------------------|
| Extraer campos del contexto desde las fuentes | Que cada campo del contexto tenga fuente o diga "No encontrado" |
| Redactar repreguntas | Que haya como máximo 5 por miembro y estén vinculadas a una respuesta |
| Elegir qué buscar en la web y resumir hallazgos | Que cada hallazgo tenga una URL **que se pudo abrir de verdad** |
| Agrupar segmentos y redactar atributos | Que cada atributo tenga al menos una evidencia vinculada |
| Clasificar cada evidencia (equipo, pública o propia) | **Calcular el nivel de confianza** con la regla de la Fase 3 |
| Detectar posturas incompatibles entre miembros | Que un atributo con divergencia nunca tenga confianza alta |
| Proponer métodos y preguntas de validación | Que todo atributo de confianza baja tenga un supuesto a validar |
| — | Que el agente **nunca** escriba los estados *Aprobada* ni *Rechazada* |
| — | Que no pise campos editados por el PM: si quiere cambiarlos, deja una sugerencia |

Las respuestas del modelo se piden en un **formato estructurado** y el código las valida antes de escribir en Notion. Si no pasan la validación, no se escriben: se reintenta o se registra el error.

### Ciclo de vida de una User Persona

```mermaid
stateDiagram-v2
    [*] --> Borrador: el agente la crea
    Borrador --> EnRevision: el agente termina y pasa sus controles
    EnRevision --> Aprobada: solo el PM
    EnRevision --> Rechazada: solo el PM, con motivo
    Rechazada --> Borrador: nueva síntesis tiene en cuenta el motivo
    Aprobada --> EnRevision: entra evidencia nueva (nueva versión)
```

Propuesta: el agente pasa la persona de *Borrador* a *En revisión* **solo si pasa sus propios controles**: 100% de atributos con evidencia, confianza calculada y supuestos de confianza baja con plan. Si no los pasa, la deja en *Borrador* e indica qué falta.

Otros estados:

| Elemento | Estados |
|----------|---------|
| Contexto del producto | *Por confirmar* → *Confirmado* (solo el PM) |
| Entrevista | *Pendiente* → *Base respondida* → *Repreguntas pendientes* → *Completa* |
| Supuesto a validar | *Pendiente* → *En validación* → *Validado* / *Refutado* |

### Límites del agente

**Nunca:**
- Marca una persona como *Aprobada* o *Rechazada*, ni el contexto como *Confirmado*.
- Escribe un atributo sin evidencia, ni inventa una URL, un dato o una cita.
- Pisa lo que editó una persona del equipo.
- Escribe fuera de las bases del proyecto.
- Elige una postura cuando el equipo no está de acuerdo.

**Topes por ejecución** (para cuidar la cuota gratuita y el tiempo del equipo):

| Tope | Valor propuesto |
|------|-----------------|
| Repreguntas por miembro | ≤ 5 |
| Fuentes web registradas por relevamiento | ≤ 15 |
| Personas por síntesis | Entre 1 y 5. Si la evidencia no alcanza para distinguir segmentos, propone menos y lo explica. |

**Datos personales:** si detecta datos personales evidentes en lo que lee, como correos, teléfonos o documentos de identidad, no los envía al modelo: los reemplaza por un marcador y avisa en Ejecuciones (RNF-06).

### Cuándo se detiene y pide intervención humana

| Situación | Qué hace el agente |
|-----------|--------------------|
| Falta una base o propiedad en Notion | No avanza. Lista qué falta. |
| El contexto no está *Confirmado* | No avanza a las etapas 2 a 5. |
| Hay campos del contexto *No encontrados* | Los deja marcados para que los complete el PM. |
| Hay entrevistas incompletas | No sintetiza, salvo que el PM indique avanzar sin ellas. |
| La evidencia no alcanza para distinguir segmentos | Propone menos personas y explica qué información falta. |
| Se agotaron la cuota principal y la secundaria | Guarda lo avanzado, marca la etapa como *Incompleta* y explica cuándo reintentar. |

### Manejo de errores

| Error | Comportamiento | Registro |
|-------|----------------|----------|
| Límite de uso del proveedor principal | Espera y reintenta. Si sigue fallando, pasa a OpenRouter (HU-17). | Proveedor, modelo y reintentos |
| Respuesta del modelo con formato inválido | Reintenta pidiendo el formato correcto. Si sigue fallando, no escribe nada. | Respuesta rechazada |
| URL que no se puede abrir | Descarta el hallazgo. | URL descartada y motivo |
| Error al escribir en Notion | Reintenta. La etapa se puede repetir sin duplicar (RNF-04). | Operación fallida |
| Intento de escribir un estado prohibido | El código lo bloquea. | Intento bloqueado (cuenta para la métrica de aprobación indebida) |

### Preguntas abiertas de la Fase 4

- [ ] ¿Avanzamos con **un solo agente por etapas** en lugar de varios agentes?
- [ ] ¿Está bien que el agente pase la persona a *En revisión* cuando pasa sus controles, o preferís que eso también lo haga el PM?
- [ ] ¿Están bien los topes: 15 fuentes web por relevamiento y entre 1 y 5 personas por síntesis?

---

## Caso de estudio: bitácora del proyecto

> Esta sección permite **retomar el trabajo en otro chat** sin perder el contexto. Para continuar, pegá el enlace de este README y pedí seguir desde la fase en revisión.

### Cómo trabajamos

- **Spec Driven Development** fase por fase. No se avanza sin la aprobación explícita de Abel.
- Todo se documenta en este README, en español, y se sube a `main` después de cada cambio.
- Abel define y decide. El asistente propone, cuestiona y redacta.
- La base metodológica es *Inspired*, de Marty Cagan.

### Recursos

| Recurso | Detalle |
|---------|---------|
| Repositorio de la spec | [abellatuf/User-Persona-Agente](https://github.com/abellatuf/User-Persona-Agente), rama `main` |
| Producto de prueba principal | `franCiti/cobros-recurrentes` (privado). Se usa solo su spec, `cobros-recurrentes-spec.md`. |
| Segundo producto de prueba | `abellatuf/rutina-app` (privado, de Abel). |
| Conector de GitHub | Token de acceso fino con permiso **Contents: Read and write** sobre este repo. No puede crear repositorios ni leer `cobros-recurrentes`. |
| Conexión con Notion | Por MCP. Abel la configura en otro chat. |

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

### Próximo paso

Revisar y aprobar la **Fase 4: Especificación del agente**. Después sigue la **Fase 5: Diseño técnico**: arquitectura, conexión por MCP, modelos, prompts, modelo de datos en Notion y evaluaciones.

# Fase 1: Definición del problema

## Enunciado

Los equipos de producto toman decisiones de discovery y delivery sin un entendimiento compartido y basado en evidencia de quiénes son sus usuarios, qué necesitan y cómo cada funcionalidad afecta su comportamiento. Por eso construyen funcionalidades que no generan valor, priorizan por intuición o por quien habla más fuerte, y no pueden explicar el impacto de lo que entregan.

## Contexto

Los equipos (PM, diseño e ingeniería) trabajan con un backlog de funcionalidades, pero el conocimiento del usuario está fragmentado. Queda en la cabeza de algunas personas, en investigaciones aisladas o en supuestos que nadie validó.

## Ámbito

- Proyecto personal, independiente de cualquier organización.
- **Agnóstico de producto:** la solución tiene que adaptarse a cualquier producto y a cualquier equipo de producto.

## Situación actual

En el caso general, el equipo **no cuenta con investigación previa**: no hay entrevistas, encuestas ni personas documentadas. Lo que sí suele existir es lo siguiente:

| Fuente de información | Disponibilidad |
|-----------------------|----------------|
| Conocimiento tácito del equipo de producto (lo que creen saber del usuario) | Siempre |
| Contexto del producto: propuesta de valor, funcionalidades, mercado, modelo de negocio | Siempre |
| Información pública: competidores, reseñas, foros, estudios de mercado | Casi siempre, se puede relevar de internet |
| Investigación propia: entrevistas, encuestas, analítica, tickets de soporte | Solo en algunos equipos |

La solución tiene que funcionar con las tres primeras fuentes y aprovechar la cuarta cuando exista. Por ejemplo, el equipo puede cargarla mediante formularios.

## Por qué automatización e IA

Definir personas bien hecho requiere tiempo, criterio metodológico y capacidad de sintetizar mucha información dispersa. La mayoría de los equipos no lo hace por falta de tiempo o de práctica. Una solución con IA puede hacer cuatro cosas:

- **Guiar** al equipo con las preguntas correctas, aunque no tenga experiencia en research.
- **Relevar y sintetizar** información pública y propia mucho más rápido que una persona.
- **Detectar** contradicciones y supuestos no validados en lo que dice el equipo.
- **Proponer** borradores de personas que el equipo revisa, en lugar de partir de una hoja en blanco.

## Restricción fundamental: humano en el circuito

La IA **propone** y las personas **deciden**. Ninguna User Persona se considera válida hasta que la revisa y aprueba un responsable humano, por ejemplo el Product Manager.

## Quién se ve afectado

- **Equipos de producto:** discuten opiniones en lugar de evidencia y les cuesta alinear prioridades.
- **Usuarios finales:** reciben funcionalidades que no resuelven sus problemas reales.
- **Negocio:** invierte capacidad de desarrollo en iniciativas de bajo impacto.

## Síntomas observables

> ⚠️ Son síntomas genéricos. Hay que reemplazarlos o complementarlos con ejemplos reales de la organización.

- Las historias dicen "como usuario…" sin especificar qué tipo de usuario.
- Cada miembro del equipo describe al usuario de forma distinta.
- Las funcionalidades se lanzan sin una hipótesis de impacto ni una métrica asociada.
- Las funcionalidades recién lanzadas tienen baja adopción.
- El equipo no tiene contacto directo y frecuente con usuarios.

## Causas raíz probables

1. No hay una práctica sistemática de discovery con usuarios reales.
2. Lo que se aprende de los usuarios no se documenta ni se comparte de forma accionable.
3. Las funcionalidades se definen como *output* y no como *outcome* para un segmento concreto.
4. No hay un lenguaje común para hablar de los distintos tipos de usuario.

## Impacto

- Se desperdicia capacidad de desarrollo.
- El *time-to-value* es más lento.
- Se ponen en riesgo el **valor** y la **usabilidad**, dos de los cuatro riesgos de producto de Marty Cagan.
- Los equipos se desmotivan cuando lo que construyen no se usa.

## Hipótesis de solución

> Creemos que si los equipos construyen y usan **User Personas basadas en investigación con usuarios reales**, lograremos un entendimiento compartido del usuario que mejore la priorización y el diseño de funcionalidades. Sabremos que funcionó cuando **[métricas por definir]**.
>
> Y creemos que una **solución con IA que guíe al equipo, releve información y proponga personas trazables a su evidencia, con aprobación humana**, baja lo suficiente el costo de hacerlo como para que cualquier equipo lo adopte.

## Posibles métricas de éxito

| Métrica | Línea base | Objetivo |
|---------|-----------|----------|
| % de iniciativas con una persona objetivo y una hipótesis de impacto explícitas | ? | ? |
| Adopción o uso de las funcionalidades lanzadas, comparado con la línea base | ? | ? |
| Cantidad de entrevistas o contactos con usuarios por equipo por mes | ? | ? |
| Alineación del equipo: consistencia de respuestas a "¿para quién es esto y qué problema le resuelve?" | ? | ? |

## Riesgo principal

Cagan advierte que una persona inventada en un workshop, sin datos detrás, es contraproducente porque solo formaliza los supuestos. La persona tiene que nacer de la investigación, y hay que actualizarla y usarla en las decisiones del día a día. Si no, termina como un póster en la pared.

**Implicancia para la solución:** el riesgo es aún mayor con una IA, porque puede generar personas verosímiles sin ninguna evidencia detrás. Como en el caso general las fuentes son el conocimiento del equipo e información pública, el resultado inicial va a ser una **proto-persona**, es decir, una hipótesis y no una verdad. Por eso:

1. Cada atributo de la persona indica su **fuente** y su **nivel de confianza**: dato de investigación propia, dato público o supuesto del equipo.
2. La solución no oculta los supuestos. Los expone y propone **cómo validarlos**, por ejemplo con guías de entrevista o encuestas.
3. La persona es un **artefacto vivo**: madura a medida que entra evidencia nueva.

## Preguntas abiertas de la Fase 1

- [x] ~~**Ámbito**~~: proyecto personal y agnóstico de producto.
- [x] ~~**Situación actual**~~: en general no hay investigación previa; ver las fuentes de información disponibles.
- [x] ~~**Por qué IA**~~: guiar, relevar, sintetizar, detectar supuestos y proponer borradores, siempre con aprobación humana.
- [x] ~~**Métricas**~~: definidas en la Fase 2.
- [x] ~~**Restricciones técnicas**~~: definidas en la Fase 3 como requisitos no funcionales.

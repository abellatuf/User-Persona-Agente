# Demo del H8: guía paso a paso

Guía para la demo de cierre del H8 (plan de validación y persona viva). El diseño está en la bitácora del [README](../README.md#bitácora-de-decisiones), del 2026-11-06, y en [07-implementacion.md](07-implementacion.md#h8-etapa-5-validación-y-persona-viva).

Todo se hace desde la página raíz **[User-Persona Agente](https://app.notion.com/p/3fa245a35f2b81f2afcec088c81678a4)** y desde la pestaña **[Actions](https://github.com/abellatuf/User-Persona-Agente/actions)** de GitHub.

*Planificar validación* hace 1 llamada por persona en *Borrador* (2 si pide una corrección). *Sintetizar* hace 1 para los segmentos y 1 por persona.

## Antes de empezar

- En **Actions** → **CI**, el último commit del H8 tiene que estar en ✅.
- El contexto sigue **Confirmado** y hay al menos una persona en **Borrador** con atributos de confianza **Baja**.

## Paso 1. Pedir «Planificar validación»

1. En **Solicitudes**, creá una fila: **Solicitud** "Demo H8: planificar", **Etapa** **Planificar validación**, **Estado** **Pendiente**.
2. En **Actions** → **Agente** → **Run workflow**, y esperá a que termine en ✅.
3. Revisá:
   - **Supuestos a validar:** un supuesto *Pendiente* por cada atributo Baja, vinculado a su atributo, con *Método*, *Perfil a contactar* y de 3 a 5 *Preguntas sugeridas*.
   - **Las preguntas:** que pregunten por lo que la persona hizo, no por el futuro («¿Pagarías…?»), que no empiecen con «¿No…?» y que no repitan el atributo.
   - **User Personas → *Controles*:** «✅ N de N supuestos de confianza baja con plan».
   - **Ejecuciones:** los supuestos creados por persona y, si hubo, los planes descartados y por qué.
4. Editá un supuesto (por ejemplo, una pregunta) y volvé a pedir *Planificar validación*: el agente no lo toca ni crea otro.

## Paso 2. Persona viva

1. Pasá una persona a **Aprobada**.
2. Cargá una evidencia nueva sobre ella con el formulario **Investigación propia** (por ejemplo, una encuesta con su *Muestra*).
3. Pedí **Sintetizar**, como en el H7, y revisá:
   - Aparece la **versión 2 en *Borrador***, con *Versión anterior* vinculada y un *Registro de cambios* que nombra la evidencia nueva.
   - La versión 1 sigue **Aprobada** y sin cambios.
   - Si ningún atributo usó la evidencia nueva, *Ejecuciones* lo dice y no hay versión nueva.
4. Pasá la versión 2 a **Aprobada** y corré el agente sin solicitudes (**Run workflow**). La versión 1 pasa a **Reemplazada**, y la fila *Sin pendientes* de *Ejecuciones* lo dice.

## Paso 3. Lo que entró del H7

- **Excluir de la síntesis:** marcá la casilla en una evidencia y pedí *Sintetizar*: *Ejecuciones* dice que quedó afuera.
- **Persona rechazada sin versión nueva:** si el modelo no la vuelve a proponer, *Ejecuciones* lo avisa.
- **Atributo editado por el PM:** el aviso muestra el texto del atributo, no el ID.
- **Límite diario de Gemini:** si se agota, *Ejecuciones* muestra un solo intento de Gemini y la respuesta de OpenRouter, sin esperas.

## Si algo falla

Anotá la fila de *Ejecuciones* (resultado, notas y errores) y avisame. No borres nada.

# Demo del H7: guía paso a paso

Guía para la demo de cierre del H7 (síntesis de personas). El diseño y las decisiones están en la bitácora del [README](../README.md#bitácora-de-decisiones), del 2026-10-31.

Todo se hace desde la página raíz **[User-Persona Agente](https://app.notion.com/p/3fa245a35f2b81f2afcec088c81678a4)** y desde la pestaña **[Actions](https://github.com/abellatuf/User-Persona-Agente/actions)** de GitHub.

Cada corrida de *Sintetizar* usa unas 4 a 6 llamadas al modelo: 1 para los segmentos y 1 por persona. `gemini-3.6-flash` admite 20 pedidos por día, así que es normal que responda OpenRouter en algunas.

## Antes de empezar

- En **Actions** → **CI**, el último commit ("H7 (2/2): etapa Sintetizar, reglas y pruebas") tiene que estar en ✅. El anterior ("H7: etapa Sintetizar…") puede aparecer en ❌, porque se subió por partes.
- El contexto de cobros-recurrentes sigue **Confirmado** y las 3 entrevistas siguen **Completas**.
- **Formulario *Investigación propia*:** en la base **Evidencia** hay una vista nueva de formulario con ese nombre. Abrila y revisá que tenga estas preguntas (si falta alguna, agregala a mano): *Título*, *Método de investigación*, *Fecha de consulta*, *Muestra*, *Extracto* y *Tipo*. Agregale una descripción que diga «No incluyas datos personales (nombres, correos, teléfonos)». El MCP de Notion no deja hacer estas dos cosas.

## Paso 1. Pedir «Sintetizar»

1. En **Solicitudes**, creá una fila:
   - **Solicitud:** "Demo H7: sintetizar".
   - **Etapa:** **Sintetizar**.
   - **Estado:** **Pendiente**.
2. En **Actions** → **Agente** → **Run workflow** → **Run workflow**.
3. Esperá a que termine en ✅.

## Paso 2. Revisar el resultado

1. **Solicitudes:** "Demo H7: sintetizar" en **Lista**.
2. **Ejecuciones**, en la fila de la solicitud: los segmentos propuestos, cada persona con cuántos atributos y divergencias tiene, lo que se descartó y por qué, y los intentos de cada llamada.
3. **User Personas:** hasta 5 personas en **Borrador**. En cada una, mirá:
   - *Por qué es un segmento distinto*.
   - *Resumen*: fuentes usadas, atributos por nivel de confianza, divergencias y lo que falta.
   - *Controles*: «✅ … atributos con evidencia (100 %)».
4. **Atributos:** cada uno con *Categoría*, *Evidencias* (al menos una), *Confianza* y, si hay desacuerdo, *Divergencia* marcada y las *Posturas* con autor y rol.

## Paso 3. ¿Detectó las divergencias?

Buscá en los atributos las divergencias que planteaste en el H5 y la del H6:

| Tema | Lo que dijo cada uno |
|------|----------------------|
| **P01** ¿Cuántos tipos de usuario? | PM: cobradores y pagadores · Ingeniería: uno solo · Negocio: dos tipos de emisor |
| **P09** Diferencias entre usuarios | PM: cobrador ≠ pagador · Ingeniería: ninguna importante |
| **P10** ¿Quién decide, usa y paga? | PM: el prestador · Ingeniería: la misma persona · Negocio: no siempre |
| **P06** ¿Qué lo empuja a probarlo? | PM: el volumen hace inmanejable el Excel · Negocio: la plata que pierde por morosidad |
| **Competidores** (H6) | Contexto: «no podemos nombrar competidores directos» · Web: Qobra, Mercado Pago Suscripciones, Recaudo |

Anotá cuáles aparecieron como divergencia y si alguna postura quedó mal atribuida.

## Paso 4. Editar un atributo y repetir (HU-12)

1. Elegí un atributo de una persona en *Borrador* y cambiale la *Afirmación* a mano.
2. Volvé a poner la solicitud en **Pendiente** y corré **Agente**.
3. Tu edición tiene que seguir igual, en la misma fila: el agente recibe los atributos actuales como A1, A2… y actualiza esa fila. Se marca *Editado por el PM*, y la propuesta del agente queda en *Sugerencia del agente*.
4. Ni la persona ni el atributo se duplican.

## Paso 5. Rechazar una persona y ver la versión 2 (T7.6)

1. En una persona, poné *Estado* = **Rechazada** y escribí un *Motivo de rechazo* (por ejemplo, «Mezcla profesionales independientes con clubes»).
2. Volvé a pedir *Sintetizar* y corré **Agente**.
3. Tiene que aparecer una persona nueva en **Borrador** con *Versión* = 2, vinculada en *Versión anterior* a la rechazada, y un *Registro de cambios* con el motivo y lo que cambió. La rechazada no se toca.
4. Si el motivo dice que la persona no debería existir (por ejemplo, «no aplica en el común de los casos»), el agente no la vuelve a proponer y no hay versión nueva.

## Paso 6 (opcional). Cargar investigación propia (HU-08)

1. Con el formulario *Investigación propia*, cargá 1 o 2 resultados **de prueba** y aclaralo en el título (por ejemplo, «Encuesta simulada a 20 clubes»).
2. Volvé a pedir *Sintetizar*.
3. Los atributos respaldados por una investigación propia suben a confianza **Media**, y por dos, a **Alta**.

## Paso 7. Pasale al asistente

- Cuántas personas salieron y si los segmentos tienen sentido.
- Qué divergencias detectó y cuáles no.
- Si los atributos sirven para decidir o hay relleno.
- Cómo te fue con la edición y con el rechazo.

El asistente revisa las filas en Notion, documenta el resultado con las evidencias y cierra el H7.

## Si algo sale mal

- **"No hay ninguna entrevista Completa" o "Faltan entrevistas":** revisá el *Estado* de las entrevistas, o agregá en *Opciones* de la solicitud «avanzar sin las entrevistas incompletas».
- **"Segmentos: Ningún modelo…":** Gemini y OpenRouter no respondieron bien. Probá de nuevo en un rato.
- **Ejecución *Incompleta*:** falló la llamada de alguna persona; las otras se guardaron. Repetí la solicitud.
- **Una persona no se escribió («no se escribe, porque…»):** está *En revisión* o *Aprobada*, y el agente no la toca. Es lo esperado.
- **"El contexto del producto no está Confirmado":** volvé a confirmarlo.

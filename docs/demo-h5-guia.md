# Demo del H5: guía paso a paso

Guía detallada para la demo de cierre del H5 (entrevistas y repreguntas, T5.5). El resumen está en la [Fase 7](07-implementacion.md#demo-de-cierre-del-h5-la-hace-abel).

Todo se hace desde la página raíz **[User-Persona Agente](https://app.notion.com/p/3fa245a35f2b81f2afcec088c81678a4)** y desde la pestaña **[Actions](https://github.com/abellatuf/User-Persona-Agente/actions)** de GitHub.

## Estado: ✅ demo cumplida el 2026-10-25

Todos los pasos se cumplieron. Abel respondió el sombrero PM (en menos de 15 minutos) y el asistente simuló Ingeniería y Negocio, a pedido de Abel. El resultado, con los links a Notion, está en la [Fase 7](07-implementacion.md#resultado-de-la-demo-del-h5). La guía queda como referencia para repetir la demo con otro producto.

Vas a responder el formulario **3 veces**, una por sombrero (PM, Ingeniería y Negocio), y vas a plantear **al menos 2 divergencias a propósito**. La demo gasta poca cuota: una llamada al modelo por entrevista.

## Antes de empezar

- En **Actions** → **CI**, el último commit ("H5: …") tiene que estar en ✅.
- *Agente activo* sigue marcada en **Configuración**, y el contexto de cobros-recurrentes sigue **Confirmado**.
- **Tené un reloj a mano:** hay que medir cuántos minutos te lleva cada sombrero (formulario + repreguntas). El objetivo es 30 minutos o menos por miembro.

## Paso 1. Revisar el formulario

1. Abrí la base **Entrevistas** y elegí la vista **Entrevista base** (es un formulario).
2. Revisá que estén *Entrevista*, *Nombre del miembro*, *Rol del miembro* y las 13 preguntas (P01 a P13).
3. **Recomendado:** marcá *Nombre del miembro* y *Rol del miembro* como obligatorias. En el formulario, hacé clic en cada una y activá **Required** (u **Obligatoria**). El asistente no puede hacerlo desde el MCP de Notion.
4. **Recomendado:** agregá esta descripción arriba del formulario:
   > No incluyas datos personales de usuarios reales. Tus respuestas se envían a un proveedor de IA gratuito.

## Paso 2. Responder como 3 sombreros

Respondé el formulario 3 veces. En cada una:

- **Nombre del miembro:** usá un nombre distinto por sombrero, por ejemplo "Abel PM", "Abel Ingeniería" y "Abel Negocio". **Importante:** si usás el mismo nombre, el agente cree que es la misma persona y vincula las 3 entrevistas al mismo miembro de Equipo.
- **Rol del miembro:** PM, Ingeniería o Negocio.
- **Entrevista** (el título): podés dejarlo vacío; el agente le pone "Nombre (Rol)".
- **Medí el tiempo** de cada sombrero y anotalo.

**Divergencias a propósito:** en al menos 2 preguntas, hacé que los sombreros digan cosas incompatibles. Por ejemplo:
- **P10:** un sombrero dice que quien usa es el mismo que paga; otro, que paga otra persona.
- **P01 o P09:** un sombrero dice que hay un solo tipo de usuario; otro, que hay dos muy distintos.

**Anotá qué divergencias planteaste**, con la pregunta y qué dijo cada sombrero. Se van a usar en el H7, para verificar que la síntesis las detecte.

## Paso 3. Pedir «Repreguntar»

1. En **Solicitudes**, creá una fila:
   - **Solicitud:** "Demo H5: repreguntar".
   - **Etapa:** **Repreguntar**.
   - **Estado:** **Pendiente**.
2. En **Actions** → **Agente** (no *Probar modelos*) → **Run workflow** → **Run workflow**.
3. Esperá a que termine en ✅.

## Paso 4. Revisar el resultado

1. **Solicitudes:** "Demo H5: repreguntar" en **Lista**.
2. **Equipo:** 3 filas nuevas, una por sombrero, con su rol.
3. **Entrevistas:** cada una con su título ("Abel PM (PM)"…), vinculada a su miembro y en **Repreguntas pendientes**.
4. **Abrí cada entrevista:** en el cuerpo de la página hay hasta 5 repreguntas. Cada una dice sobre qué respuesta es, y abajo tiene un renglón **"✍️ Tu respuesta:"**. Fijate que:
   - sean abiertas y no sugieran la respuesta;
   - **no digan lo que respondió otro sombrero** (decisión C).
5. **Evidencia:** una fila por cada respuesta del formulario, con *Tipo* = *Supuesto del equipo* y vinculada a su entrevista.
6. **Ejecuciones:** en la fila de la solicitud, el modelo que respondió y, en el cuerpo, una nota por entrevista con el motivo de cada repregunta (y las que se descartaron, si hubo).

## Paso 5. Responder las repreguntas

En cada entrevista:

1. Escribí tu respuesta **debajo** de cada "✍️ Tu respuesta:" (o en el mismo renglón, a continuación). Podés usar varios renglones.
2. **No borres** los renglones que empiezan con ❓ o ✍️: el agente los usa para encontrar tus respuestas.
3. Sumá este tiempo al del sombrero.
4. Cuando termines, cambiá el **Estado** de la entrevista a **Completa**.

Si una entrevista quedó directamente en *Completa* en el paso 4, es porque el agente consideró que no hacía falta repreguntar. El motivo está en Ejecuciones.

## Paso 6. Guardar las respuestas como evidencia

1. Volvé a poner "Demo H5: repreguntar" en **Pendiente** (o creá otra solicitud *Repreguntar*).
2. Corré **Agente** otra vez.
3. En **Evidencia** aparecen filas nuevas "R1 (sobre P04) · Abel PM (PM)"…, con la repregunta y tu respuesta. Esta vez no se llama a ningún modelo.

## Paso 7. Pasale al asistente

- Los **minutos por sombrero** (formulario + repreguntas).
- Las **divergencias que planteaste** (pregunta y qué dijo cada sombrero).
- Qué te parecieron las repreguntas: ¿abiertas? ¿sesgadas? ¿alguna inútil?

El asistente revisa las filas en Notion y cierra el H5.

## Si algo sale mal

- **"No hay entrevistas con el formulario base respondido":** las entrevistas no tienen respuestas en P01 a P13, o el formulario guardó las respuestas en otra base.
- **"falta «Nombre del miembro», se saltea":** completá el nombre en esa entrevista y volvé a pedir *Repreguntar*.
- **Las 3 entrevistas quedaron vinculadas al mismo miembro:** usaste el mismo nombre. Corregí *Nombre del miembro*, vaciá *Miembro* en las entrevistas afectadas y volvé a pedir *Repreguntar*.
- **"todas las repreguntas se descartaron":** el modelo propuso repreguntas que no cumplían las reglas. La entrevista queda en *Base respondida* y se reintenta en la próxima corrida. El detalle está en Ejecuciones.
- **"El contexto del producto no está Confirmado":** alguien lo pasó a *Por confirmar*. Volvé a confirmarlo.
- **La solicitud sigue en *Pendiente*:** corriste *Probar modelos* en lugar de *Agente*.

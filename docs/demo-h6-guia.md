# Demo del H6: guía paso a paso

Guía para la demo de cierre del H6 (relevamiento web). El diseño y las decisiones están en la bitácora del [README](../README.md#bitácora-de-decisiones), del 2026-10-26.

Todo se hace desde la página raíz **[User-Persona Agente](https://app.notion.com/p/3fa245a35f2b81f2afcec088c81678a4)** y desde la pestaña **[Actions](https://github.com/abellatuf/User-Persona-Agente/actions)** de GitHub.

La demo gasta poca cuota: unas 7 llamadas a Gemini (4 búsquedas y hasta 3 extracciones).

## Antes de empezar

- En **Actions** → **CI**, el último commit ("H6: pruebas de Relevar la web") tiene que estar en ✅. Los anteriores del H6 pueden aparecer en ❌, porque se subieron por partes.
- *Agente activo* sigue marcada en **Configuración**, y el contexto de cobros-recurrentes sigue **Confirmado**.

## Paso 1. Pedir «Relevar la web»

1. En **Solicitudes**, creá una fila:
   - **Solicitud:** "Demo H6: relevar la web".
   - **Etapa:** **Relevar la web**.
   - **Estado:** **Pendiente**.
2. En **Actions** → **Agente** (no *Probar modelos*) → **Run workflow** → **Run workflow**.
3. Esperá a que termine en ✅. Puede tardar un poco más que las otras etapas, porque abre cada página.

## Paso 2. Revisar el resultado

1. **Solicitudes:** "Demo H6: relevar la web" en **Lista**.
2. **Ejecuciones**, en la fila de la solicitud:
   - **Resultado:** *Lista* (o *Incompleta*, si Gemini no pudo buscar; ver "Si algo sale mal").
   - **Proveedor y modelo:** Gemini.
   - En el cuerpo: cuántas fuentes encontró cada búsqueda, las URL descartadas con su motivo, los hallazgos descartados porque la cita no estaba en la página, y la lista de lo que se guardó.
3. **Evidencia:** hasta **15 filas nuevas** con *Tipo* = **Pública**, cada una con *Título*, *URL*, *Fecha de consulta* (hoy) y un *Extracto* que empieza con la cita entre «comillas».

## Paso 3. Verificar 3 o 4 fuentes a mano

Elegí 3 o 4 filas de Evidencia al azar y, en cada una:

1. Abrí la **URL**: tiene que cargar.
2. Buscá la cita en la página (Ctrl+F con unas palabras del medio de la cita). Tiene que estar.
3. Fijate si el hallazgo **sirve** para entender a los usuarios o al mercado, o si es relleno.

Anotá cuántas abrieron, cuántas citas encontraste y cuáles te parecieron útiles.

## Paso 4. Repetir sin duplicar (decisión D)

1. Volvé a poner la solicitud en **Pendiente** y corré **Agente** otra vez.
2. En Ejecuciones tienen que aparecer notas "Ya estaba guardada, se saltea: …" para las URL que ya estaban.
3. En Evidencia no tiene que haber filas repetidas. Puede haber alguna nueva, si la búsqueda trajo fuentes distintas.

## Paso 5 (opcional). Probar «cuota agotada» (T6.4)

Sirve para ver qué pasa si Gemini no puede buscar, sin esperar a que se agote la cuota de verdad.

1. En **Configuración**, cambiá *Modelo principal* a `gemini-no-existe`. **Anotá el valor actual** (`gemini-3.6-flash`) para volver a ponerlo.
2. Creá otra solicitud *Relevar la web* y corré **Agente**.
3. Tiene que terminar con la solicitud en **Lista** y la ejecución en **Incompleta**, con el motivo en *Errores* y la nota "no se guardó evidencia pública".
4. **Volvé a poner** `gemini-3.6-flash` en *Modelo principal*.

## Paso 6. Pasale al asistente

- Cuántas evidencias se guardaron y si las URL abrieron.
- Si las citas estaban en las páginas.
- Qué hallazgos te parecieron útiles y cuáles no.

El asistente revisa las filas en Notion, documenta el resultado con las evidencias y cierra el H6.

## Si algo sale mal

- **Ejecución *Incompleta* con "Gemini respondió 404" o "modelo" en *Errores*:** el modelo de Configuración no acepta la búsqueda de Google, o no existe. Probá con otro Flash en *Modelo principal* y volvé a pedir la etapa.
- **Ejecución *Incompleta* con "429":** se agotó la cuota diaria de búsquedas de la capa gratuita. Probá al día siguiente.
- **Muchas "URL descartada":** algunos sitios bloquean lectores automáticos o tardan más de 20 segundos. Es esperable que se pierdan algunas.
- **Pocas evidencias:** el modelo propone menos de 15 si no encuentra citas verificables. Es preferible a guardar fuentes sin respaldo.
- **"El contexto del producto no está Confirmado":** alguien lo pasó a *Por confirmar*. Volvé a confirmarlo.

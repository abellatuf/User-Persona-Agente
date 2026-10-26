# Demo del H6: guía paso a paso

Guía para la demo de cierre del H6 (relevamiento web). El diseño y las decisiones están en la bitácora del [README](../README.md#bitácora-de-decisiones), del 2026-10-26. La búsqueda la hace **Tavily** (decisión C revisada): la búsqueda con Google de Gemini no tiene capa gratuita en los modelos 3.x.

Todo se hace desde la página raíz **[User-Persona Agente](https://app.notion.com/p/3fa245a35f2b81f2afcec088c81678a4)** y desde la pestaña **[Actions](https://github.com/abellatuf/User-Persona-Agente/actions)** de GitHub.

La demo gasta poca cuota: 4 créditos de Tavily (de 1.000 por mes) y unas 5 llamadas a Gemini (1 para armar las consultas y hasta 4 extracciones).

## Antes de empezar

- En **Actions** → **CI**, el último commit del código ("H6: búsqueda web con Tavily") tiene que estar en ✅.
- En [Settings → Secrets and variables → Actions](https://github.com/abellatuf/User-Persona-Agente/settings/secrets/actions) tiene que estar el secreto `TAVILY_API_KEY`, además de `NOTION_TOKEN`, `GEMINI_API_KEY` y `OPENROUTER_API_KEY`.
- *Agente activo* sigue marcada en **Configuración**, *Modelo principal* dice `gemini-3.6-flash` y el contexto de cobros-recurrentes sigue **Confirmado**.

## Paso 1. Pedir «Relevar la web»

1. En **Solicitudes**, poné la fila "Demo H6: relevar la web" (etapa **Relevar la web**) en **Pendiente**. Si no existe, creala con esos datos.
2. En **Actions** → **Agente** (no *Probar modelos*) → **Run workflow** → **Run workflow**.
3. Esperá a que termine en ✅. Puede tardar unos minutos, porque abre cada página.

## Paso 2. Revisar el resultado

1. **Solicitudes:** "Demo H6: relevar la web" en **Lista**.
2. **Ejecuciones**, en la fila nueva de la solicitud:
   - **Resultado:** *Lista* (o *Incompleta*, ver "Si algo sale mal").
   - **Proveedor y modelo:** algo como "Gemini · gemini-3.6-flash / Tavily".
   - En el cuerpo: la consulta de cada tema y cuántas fuentes trajo, las URL descartadas con su motivo, los hallazgos descartados porque la cita no estaba en la página, y la lista de lo que se guardó.
3. **Evidencia:** hasta **15 filas nuevas** con *Tipo* = **Pública**, cada una con *Título*, *URL*, *Fecha de consulta* (hoy) y un *Extracto* que empieza con la cita entre «comillas».

## Paso 3. Verificar 3 o 4 fuentes a mano

Elegí 3 o 4 filas de Evidencia al azar y, en cada una:

1. Abrí la **URL**: tiene que cargar.
2. Buscá la cita en la página (Ctrl+F con unas palabras del medio de la cita). Tiene que estar.
3. Fijate si el hallazgo **sirve** para entender a los usuarios o al mercado, o si es relleno.

Anotá cuántas abrieron, cuántas citas encontraste y cuáles te parecieron útiles. Mirá también si las 4 consultas tienen sentido para el producto.

## Paso 4. Repetir sin duplicar (decisión D)

1. Volvé a poner la solicitud en **Pendiente** y corré **Agente** otra vez.
2. En Ejecuciones tienen que aparecer notas "Ya estaba guardada, se saltea: …" para las URL que ya estaban.
3. En Evidencia no tiene que haber filas repetidas. Puede haber alguna nueva, si la búsqueda trajo fuentes distintas.

## Paso 5 (opcional). Probar «sin búsqueda» (T6.4)

Ya se vio cuatro veces con errores reales el 2026-10-26 (429 y 404 de Gemini). Si querés verlo con Tavily, sin gastar créditos:

1. En **Settings → Secrets and variables → Actions**, editá `TAVILY_API_KEY` y poné un valor inválido, por ejemplo `tvly-invalida`. **Tené a mano la clave real** (está en [app.tavily.com](https://app.tavily.com)) para volver a ponerla.
2. Creá otra solicitud *Relevar la web* y corré **Agente**.
3. Tiene que terminar con la solicitud en **Lista** y la ejecución en **Incompleta**, con "Tavily respondió 401" en *Errores* y la nota "no se guardó evidencia pública".
4. **Volvé a poner** la clave real en `TAVILY_API_KEY`.

## Paso 6. Pasale al asistente

- Cuántas evidencias se guardaron y si las URL abrieron.
- Si las citas estaban en las páginas.
- Qué hallazgos te parecieron útiles y cuáles no.

El asistente revisa las filas en Notion, documenta el resultado con las evidencias y cierra el H6.

## Si algo sale mal

- **Ejecución *Incompleta* con "Falta el secreto TAVILY_API_KEY":** el secreto no está cargado o tiene otro nombre. Revisalo en Settings.
- **"Tavily respondió 401":** la clave es inválida. Copiala de nuevo desde [app.tavily.com](https://app.tavily.com).
- **"Tavily respondió 432":** se terminaron los créditos del mes. Se renuevan solos el mes siguiente.
- **"Consultas de búsqueda: Ningún modelo…":** Gemini y OpenRouter no pudieron armar las consultas (por ejemplo, 503 por alta demanda). Probá de nuevo en un rato.
- **Muchas "URL descartada":** algunos sitios bloquean lectores automáticos o tardan más de 20 segundos. Es esperable que se pierdan algunas.
- **Pocas evidencias:** el modelo propone menos de 15 si no encuentra citas verificables. Es preferible a guardar fuentes sin respaldo.
- **"El contexto del producto no está Confirmado":** alguien lo pasó a *Por confirmar*. Volvé a confirmarlo.

# Demo del H4: guía paso a paso

Guía detallada para la demo de cierre del H4 (agente de contexto). El resumen está en la [Fase 7](07-implementacion.md#demo-de-cierre-del-h4-la-hace-abel).

Todo se hace desde la página raíz **[User-Persona Agente](https://app.notion.com/p/3fa245a35f2b81f2afcec088c81678a4)**, donde están todas las bases, y desde la pestaña **[Actions](https://github.com/abellatuf/User-Persona-Agente/actions)** de GitHub.

## Estado al 2026-10-21

- ✅ **Paso 1:** *Agente activo* está marcada en [Configuración](https://app.notion.com/p/3fa245a35f2b81a7b2b0c49a13a22863). Modelos: `gemini-3.6-flash` y `openrouter/free`.
- ✅ **Paso 2:** la spec está subida en *Documentos fuente* de la [fila del producto](https://app.notion.com/p/400245a35f2b809490ecd3eac460417e), con *Estado* = *Por confirmar* y los campos vacíos. El archivo quedó como `cobros-recurrentes-spec.md.md`, con la extensión repetida. No es un problema: se lee igual, y ese es el nombre que va a aparecer como fuente.
- ⚠️ **Falta borrar una fila vacía:** en *Contexto del producto* hay **2 filas**. La segunda está vacía ([esta](https://app.notion.com/p/400245a35f2b80ee873bc8224a423e6c)) y probablemente se creó sin querer. Con dos filas, el agente se frena y pide que quede una sola. Ver el paso 2b.

## Paso 2b. Dejar una sola fila de contexto

1. Abrí la base **Contexto del producto**.
2. Ubicá la fila **vacía**: la que **no** tiene nada en *Documentos fuente*.
3. Pasá el mouse sobre la fila, hacé clic en los **⋮⋮** (seis puntitos) que aparecen a la izquierda y elegí **Delete** (o **Eliminar**). Va a la papelera, de donde se puede recuperar.
4. Tiene que quedar **una sola fila**: la que tiene `cobros-recurrentes-spec.md.md` en *Documentos fuente*.

## Paso 3. Pedir «Armar contexto»

1. Volvé a la página raíz y abrí la base **Solicitudes**.
2. Hacé clic en **New** (o **Nuevo**), arriba a la derecha de la tabla, y completá:
   - **Solicitud** (el título): por ejemplo, "Demo H4: armar contexto".
   - **Etapa**: elegí **Armar contexto** de la lista.
   - **Estado**: **Pendiente**.
3. No toques las otras propiedades, como *Opciones*, *Pedido por* o *Ejecuciones*.

## Paso 4. Correr el agente

1. Entrá a **[Actions](https://github.com/abellatuf/User-Persona-Agente/actions)**.
2. En la lista de la izquierda, elegí **CI**. La ejecución de arriba (commit "H4: corrige el escape del BOM…") tiene que estar en ✅. Si el commit anterior, "H4 (2/2)…", aparece en ❌, es esperable: tenía una prueba con un error que el commit siguiente corrige.
3. En la lista de la izquierda, elegí **Agente** (no *Probar modelos*).
4. Hacé clic en **Run workflow**. En este workflow no hay ninguna casilla, solo la rama `main`. Después, en el botón verde **Run workflow**.
5. Esperá 1 o 2 minutos hasta que termine en ✅.

## Paso 5. Revisar el resultado

1. En **Solicitudes**, la fila "Demo H4: armar contexto" tiene que estar en **Lista**.
2. En **Contexto del producto**, abrí la fila:
   - **Nombre**: ahora tiene el nombre del producto.
   - **Estado**: sigue en **Por confirmar**.
   - Cada campo (Problema, Propuesta de valor, Usuarios que creemos tener, Mercado, Modelo de negocio, Competidores) tiene un texto, o dice **No encontrado**.
   - Cada «· fuente» dice `cobros-recurrentes-spec.md.md · «la frase copiada de la spec»`, o **No encontrado**.
   - **Idioma**: por ejemplo, "español".
3. En **Ejecuciones**, abrí la fila más nueva, "… · Armar contexto · Demo H4…". En el cuerpo de la página hay una nota por campo, que explica por qué se aceptó o por qué quedó en "No encontrado". También muestra qué modelo respondió y cuántos tokens usó.

## Paso 6. Comprobar el bloqueo

1. **Sin tocar el contexto**, que tiene que seguir en *Por confirmar*, creá otra fila en **Solicitudes**:
   - **Solicitud**: "Demo H4: bloqueo".
   - **Etapa**: **Repreguntar**.
   - **Estado**: **Pendiente**.
2. Corré **Agente** otra vez desde Actions, igual que en el paso 4.
3. La solicitud tiene que terminar en **Error**. En su fila de **Ejecuciones**, la propiedad **Errores** tiene que decir "El contexto del producto no está Confirmado…".

## Paso 7. Revisar y confirmar el contexto (T4.7)

1. En la fila de **Contexto del producto**, completá a mano los campos que dicen **No encontrado**: borrá ese texto y escribí el tuyo.
2. Corregí cualquier campo que el agente haya entendido mal.
3. **Anotá qué tuviste que completar y qué corregiste.** Es la métrica de retrabajo del H4.
4. Cuando esté bien, cambiá **Estado** a **Confirmado**.

Al terminar, pasale al asistente lo que anotaste en el paso 7. El asistente revisa las filas en Notion y cierra el H4.

## Si algo sale mal

- **La solicitud termina en *Error* con "tiene 2 filas":** falta el paso 2b.
- **"No se pudo leer ninguna de las fuentes":** en Ejecuciones, la nota "Fuente salteada" dice por qué. Volvé a subir el archivo.
- **"Ningún modelo devolvió una respuesta válida":** en el cuerpo de la fila de Ejecuciones está el detalle de cada intento.

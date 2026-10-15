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

Cada fase está en su propio archivo dentro de [`docs/`](docs/).

| # | Fase | Estado |
|---|------|--------|
| 1 | [Definición del problema](docs/01-definicion-del-problema.md) | ✅ Aprobada |
| 2 | [Visión del producto](docs/02-vision-del-producto.md) | ✅ Aprobada |
| 3 | [Requisitos](docs/03-requisitos.md) (historias, criterios de aceptación, RNF) | ✅ Aprobada |
| 4 | [Especificación del agente](docs/04-especificacion-del-agente.md) (rol, capacidades, herramientas, límites) | ✅ Aprobada |
| 5 | [Diseño técnico](docs/05-diseno-tecnico.md) (arquitectura, modelo, prompts, memoria, evals) | ✅ Aprobada |
| 6 | [Plan de tareas](docs/06-plan-de-tareas.md) | ✅ Aprobada |
| 7 | [Implementación y validación](docs/07-implementacion.md) | 🟡 En curso: H0 |

---

## Caso de estudio: bitácora del proyecto

> Esta sección permite **retomar el trabajo en otro chat** sin perder el contexto. Para continuar, pegá el enlace de este README y pedí seguir desde la fase en revisión.

### Cómo trabajamos

- **Spec Driven Development** fase por fase. No se avanza sin la aprobación explícita de Abel.
- Todo se documenta en español: el README tiene el índice y esta bitácora, y cada fase vive en su archivo de `docs/`. Se sube a `main` después de cada cambio.
- **Método de implementación** (confirmado): el asistente escribe y prueba el código en la carpeta de su sesión de Claude Code (que tiene Node.js) y lo sube a GitHub con el conector. Abel no necesita instalar nada. Además, un workflow de CI corre las pruebas en cada cambio.
- Abel define y decide. El asistente propone, cuestiona y redacta.
- La base metodológica es *Inspired*, de Marty Cagan.

### Recursos

| Recurso | Detalle |
|---------|---------|
| Repositorio de la spec y del código | [abellatuf/User-Persona-Agente](https://github.com/abellatuf/User-Persona-Agente), rama `main`, **privado** |
| Producto de prueba principal | `franCiti/cobros-recurrentes` (privado). Se usa solo su spec, `cobros-recurrentes-spec.md`. |
| Segundo producto de prueba | `abellatuf/rutina-app` (privado, de Abel). |
| Conector de GitHub | Token de acceso fino con permiso **Contents: Read and write** sobre este repo. No puede crear repositorios ni leer `cobros-recurrentes`. También tiene **Workflows: Read and write**, para subir los archivos de `.github/workflows/`. |
| Plantilla de Notion | [User-Persona Agente](https://app.notion.com/p/3fa245a35f2b81f2afcec088c81678a4) (privada), con 10 bases. El detalle y los IDs están en [docs/notion-plantilla.md](docs/notion-plantilla.md). |
| Conexión con Notion | El asistente usa el MCP de Notion de su sesión. El agente va a usar un servidor MCP con token de integración (Fase 5). |

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
| 2026-10-15 | 4 | Un solo agente por etapas, cada etapa funciona como un agente especializado (la etapa 1 es el agente de contexto). La fiabilidad se asegura con tareas acotadas, formato validado, reglas en código y evaluaciones. |
| 2026-10-15 | 4 | Estados de la persona: el agente solo crea *Borrador*. El PM la pasa a *En revisión* al empezar a revisarla y después a *Aprobada* o *Rechazada*. La evidencia nueva genera una versión nueva y la anterior queda *Reemplazada*. Ajusta HU-13 y HU-15. |
| 2026-10-15 | 4 | Los topes (15 fuentes web, 5 personas, 5 repreguntas) son máximos: el agente sigue con lo que encuentra. |
| 2026-10-15 | 4 | Se aprueba la Fase 4. |
| 2026-10-15 | 5 | Stack: **TypeScript**, cliente MCP hacia un servidor MCP de Notion con token de integración, Gemini con búsqueda integrada de Google, OpenRouter de respaldo, Zod y Vitest. |
| 2026-10-15 | 5 | Ejecución **todo desde Notion**: base Solicitudes + GitHub Actions programado **una vez por día a las 15 h de Argentina**. Se pausa desde la página Configuración y no gasta tokens si no hay solicitudes. El código va en este mismo repo, que hoy es privado. |
| 2026-10-15 | 5 | El repo **queda privado**: no hace falta que sea público. La pausa se hace desde la casilla *Agente activo* de Notion, con un paso a paso en la Fase 5. |
| 2026-10-15 | 5 | Se agrega el permiso **Workflows: Read and write** al token del conector. Se probó creando `.github/workflows/README.md`. |
| 2026-10-15 | 5 | Se aprueba la Fase 5. |
| 2026-10-15 | 6 | Borrador del plan: 10 hitos verticales (H0 a H9), cada uno con una demo y la aprobación de Abel. Primero el circuito con Notion y las reglas en código, y recién después el modelo de lenguaje. |
| 2026-10-15 | 6 | Se aprueban el orden de los hitos y el cierre con demo. El asistente crea la plantilla de Notion con el MCP de Notion. Cada fase pasa a su archivo en `docs/`. |
| 2026-10-15 | 6 | El asistente crea la **plantilla de Notion**: página raíz privada y 10 bases relacionadas (T1.2). *Agente activo* queda desmarcado hasta el H1. Los formularios quedan para H4 y H5. |
| 2026-10-15 | 6 | Abel no puede trabajar en su máquina por ahora. **Propuesta:** el asistente escribe y prueba el código en la carpeta de su sesión y lo sube con el conector, con CI en GitHub Actions como segunda red. Pendiente de confirmación. |
| 2026-10-15 | 6 | Abel confirma el método de implementación. **Se aprueba la Fase 6.** |
| 2026-10-15 | 7 | Arranca la Fase 7 con el **H0**: guía paso a paso para la integración de Notion, las claves y los secretos, y un workflow *Verificar accesos* que prueba los tres secretos sin mostrarlos. |

### Próximo paso

**H0 (Abel):** seguir la guía de [docs/07-implementacion.md](docs/07-implementacion.md) (T0.1 a T0.4) y ejecutar el workflow *Verificar accesos*. Con el resultado en verde se cierra el H0 y arranca el **H1: esqueleto sin modelo**.

### Cómo retomar en otro chat

Si el contexto de un chat se agota, abrí uno nuevo y pegá este mensaje:

> Estoy construyendo un agente con Spec Driven Development. Toda la spec y las decisiones están en https://github.com/abellatuf/User-Persona-Agente (repo privado). Leé el README (índice y bitácora) y los archivos de `docs/`, y seguí desde el **Próximo paso** de la bitácora. Trabajamos fase por fase, en español, y no se avanza sin mi aprobación.

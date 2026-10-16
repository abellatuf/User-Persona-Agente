# Plantilla de Notion

Creada el 2026-10-15 con el MCP de Notion (tarea T1.2), en el espacio **"Espacio de Abel Latuf"**.

**Página raíz:** [User-Persona Agente](https://app.notion.com/p/3fa245a35f2b81f2afcec088c81678a4). Es privada. En el hito H0, Abel la comparte con la integración del agente (T0.2).

## Bases de datos

| Base | Data source ID | Relaciones |
|------|----------------|------------|
| Configuración | `de3cb0ff-3f04-40b4-9cad-9342b177b12e` | — (una sola fila: *Configuración del agente*) |
| Equipo | `a6565b62-6a72-42a3-8cb8-632a1b02314d` | ↔ Entrevistas |
| Contexto del producto | `acf50bb3-01f8-4d02-b324-b6385022a556` | — |
| Solicitudes | `2e3c1c30-d51d-4d54-b04e-d8ca6219de6b` | ↔ Ejecuciones |
| Entrevistas | `2e12b4ac-b6c2-4335-a7d8-e23b15221f03` | ↔ Equipo (Miembro), ↔ Evidencia |
| Ejecuciones | `19c0b3fc-666b-41f5-8d7d-2ff602222281` | ↔ Solicitudes |
| User Personas | `66110292-329d-4c26-a9d6-ac47849964f3` | ↔ Atributos, ↔ sí misma (Versión anterior / Versión siguiente) |
| Evidencia | `0c57fc5f-aa53-4d5a-ae63-969c50f5dfe4` | ↔ Entrevistas, ↔ Atributos |
| Atributos | `10c0eff2-9f48-4a11-b773-4e361d1f2629` | ↔ User Personas, ↔ Evidencia, ↔ Supuestos a validar |
| Supuestos a validar | `52dcc77d-24a1-4584-ad0d-c25fed833fc4` | ↔ Atributos |

## Decisiones de implementación

- **Configuración es una base con una sola fila**, no una página suelta, porque Notion solo permite casillas como *Agente activo* dentro de una base.
- **Cada campo del contexto tiene su par "· fuente"** (por ejemplo, *Problema* y *Problema · fuente*). Así la trazabilidad del contexto se ve en la misma fila.
- **La investigación propia se guarda en Evidencia**, con *Tipo = Investigación propia*, *Método de investigación* y *Muestra*.
- **Agente activo empezó desmarcado**, porque el agente todavía no existía. Abel lo marcó en la demo del H1 (2026-10-16).

## Pendiente

- **Formularios:** entrevista base (H5, cuando Abel apruebe las preguntas), investigación propia sobre Evidencia y contexto manual (H4).
- **Vistas útiles:** por ejemplo, Solicitudes pendientes y personas por estado.

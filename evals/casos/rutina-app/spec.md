# Carga: MVP de rutinas inteligentes

## Problema
Quien entrena en un gimnasio repite la misma rutina durante meses: no sabe cuándo cambiarla ni cómo adaptarla a las máquinas que tiene su gimnasio. Armar una rutina nueva le lleva tiempo o le cuesta un profesor.

## Usuarios
Personas que entrenan en un gimnasio, con distinto nivel de experiencia, que quieren una rutina acorde a su objetivo, a sus días disponibles y a sus lesiones.

## Propuesta de valor
Genera una rutina con IA a partir del nivel, el objetivo, los días por semana, las lesiones y el equipamiento real del gimnasio, y avisa cuando conviene cambiarla.

## Flujo
1. Ingreso con cuenta (Supabase).
2. Onboarding: nivel, objetivo, días por semana y lesiones.
3. Inventario: qué equipamiento tiene el gimnasio.
4. Rutina: cargar la rutina actual o generar una nueva con IA (Gemini).
5. Panel con la rutina activa y un aviso a los 60 días para renovarla.

## Mercado
Argentina, en español.

## Modelo de negocio
A definir. Se evalúa un plan gratuito con una rutina activa y un plan pago con renovaciones ilimitadas.

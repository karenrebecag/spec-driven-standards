---
name: discover
description: Convierte una petición en problema, usuario, hipótesis, alcance, exclusiones, riesgos y métrica de éxito, antes de escribir una línea de spec. Invocación manual con /discover.
disable-model-invocation: true
---

# /discover — antes del qué, el por qué

Una petición ("hazme un dashboard") no es un problema. Este skill la convierte en algo que se puede
decidir y medir, antes de que `/spec` la vuelva requisitos. Es el paso 0 del ciclo spec-driven.

## Lo que produce

1. **Problema** — qué duele hoy, en términos del usuario, no de la solución pedida. La petición suele
   ser una solución disfrazada; recupera el problema debajo.
2. **Usuario** — quién lo sufre y en qué contexto. Si son varios, cuál es el primario.
3. **Hipótesis** — "creemos que [cambio] logrará [resultado] para [usuario]". Falsable.
4. **Métrica de éxito** — el número que confirma o refuta la hipótesis. Una, medible, con línea base
   actual. Sin métrica no hay discovery: hay opinión.
5. **Alcance** — qué entra en esta iteración.
6. **Exclusiones** — qué NO entra, dicho explícitamente. Es lo que evita el scope creep.
7. **Riesgos** — técnicos, de usuario y de negocio; qué asunción, si es falsa, tira todo.

## Proceso

1. No aceptes la solución pedida como el problema. Pregunta (una pregunta, no un cuestionario) si el
   problema real es ambiguo.
2. Reúsa antes de proponer construir: ¿ya existe algo que resuelve el 80%?
3. Entrega el documento de discovery y **para** — la priorización (hacerlo o no, ahora o después) es
   decisión humana, no del skill.

## Siguiente paso
Un discovery aprobado alimenta `/spec`, que lo vuelve requisitos trazables. La métrica de éxito de
aquí es la que `/learn` mide en producción para cerrar el ciclo.

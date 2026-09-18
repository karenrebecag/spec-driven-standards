---
name: learn
description: Convierte la evidencia post-release o post-incidente en decisiones — hipótesis confirmada/refutada, acciones correctivas, deuda técnica y nuevos ítems de backlog. Invocación manual con /learn.
disable-model-invocation: true
---

# /learn — cerrar el ciclo, no solo archivar

El postmortem y las métricas post-release no valen nada si no cambian una decisión. Este skill toma
la evidencia y produce cambios concretos, no un documento que nadie relee.

## Entradas

- **Post-release**: la métrica de éxito que `/discover` definió, medida ya en producción.
- **Post-incidente**: la línea temporal y las evidencias de `/incident`.

## Salida (todo con owner y accionable)

1. **Hipótesis: confirmada o refutada.** La que `/discover` planteó. Si se refutó, dilo — un
   experimento que falla también es aprendizaje. Sin "quedó más o menos".
2. **Acciones correctivas** — qué cambia para que el incidente no se repita, o para capitalizar lo
   que funcionó. Cada una con owner.
3. **Deuda técnica** — lo que se tomó prestado bajo presión y hay que pagar; con el `HACK:` y su
   trigger de upgrade si aplica.
4. **Backlog** — los ítems nuevos que salen de esto, priorizados, listos para volver a `/discover`
   o `/spec`.

## Principio
El ciclo es discover → spec → ship → release → observe → (incident) → learn → discover. `/learn` es
la bisagra que reinyecta la evidencia al principio. Un aprendizaje sin ítem de backlog o decisión
es un aprendizaje perdido.

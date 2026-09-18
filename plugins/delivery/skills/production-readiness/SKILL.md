---
name: production-readiness
description: Checklist que impide considerar una funcionalidad "lista" sin owner, señales de salud, logs, métrica, alerta, SLO y runbook. Invocación manual con /production-readiness.
disable-model-invocation: true
---

# /production-readiness — "hecho" no es "en verde local"

Una funcionalidad no está lista porque pasa los tests. Está lista cuando, si se cae en producción,
alguien se entera, sabe qué mirar y sabe qué hacer. Este skill audita eso y alimenta el dossier de
`/release`.

## Checklist (cada ítem es un bloqueo, no una sugerencia)

- [ ] **Owner** — hay una persona responsable de esta funcionalidad en on-call.
- [ ] **Logs** — los caminos de error emiten logs estructurados con contexto suficiente para el triage.
- [ ] **Métrica** — hay al menos una métrica que refleja si la funcionalidad hace su trabajo.
- [ ] **Alerta** — una condición de fallo dispara una alerta accionable (no ruido).
- [ ] **SLO** — hay un objetivo declarado (disponibilidad/latencia/error rate) y se mide contra él.
- [ ] **Runbook** — existe un procedimiento para el fallo más probable: síntoma → diagnóstico → mitigación.
- [ ] **Rollback** — se puede revertir sin pérdida de datos, y está probado el camino.
- [ ] **Dependencias** — las llamadas externas tienen timeout y comportamiento definido ante fallo.

## Proceso

1. Recorre el checklist contra el cambio real (lee el diff y la instrumentación, no asumas).
2. Apóyate en `/observe` para lo de logs/métrica/traza y en el agente `sre-engineer` para SLO/runbook.
3. Reporta qué falta, con el ítem concreto a crear — no "mejora la observabilidad", sino "la métrica
   X no existe, agrégala en Y".
4. Lo que quede sin cubrir bloquea el `/release`: no marques `production_ready` con huecos.

## Boundary
Read-only: reporta y stop. Crear la métrica/alerta/runbook que falta es trabajo de implementación
(pasa por el loop `/ship` y su gate), no de este skill.

---
name: incident
description: Guía el manejo de un incidente — triage, severidad, comunicación, evidencias, mitigación, línea temporal y seguimiento. Invocación manual con /incident.
disable-model-invocation: true
---

# /incident — de "algo se cayó" a "controlado y aprendido"

Estructura la respuesta a un incidente en vivo. Prioridad: **mitigar primero, entender después**.
La causa raíz se investiga con calma; el impacto se corta ya.

## Flujo

1. **Triage y severidad** — declara SEV según impacto (SEV1 caída total / datos; SEV2 degradación
   grave; SEV3 parcial; SEV4 menor). La severidad define la urgencia y quién entra.
2. **Comunicación** — un canal, un owner de incidente (incident commander), actualizaciones a
   intervalo fijo. Estado claro para quien no está en la sala.
3. **Evidencias** — captura logs, métricas y trazas del momento (usa `/observe`) ANTES de que roten
   o se pierdan al reiniciar.
4. **Mitigación** — la acción que corta el impacto: rollback (`/release` tiene el plan), feature flag
   off, escalar recursos. No busques la causa raíz mientras sangra.
5. **Línea temporal** — reconstruye qué pasó y cuándo, para el postmortem.
6. **Seguimiento** — el incidente no cierra al mitigar; cierra cuando `/learn` convierte el
   postmortem en acciones correctivas con owner.

Apóyate en los agentes `incident-responder` y `devops-incident-responder`.

## Principio
Postmortem sin culpa (blameless): el objetivo es el sistema que falló, no la persona. Un incidente
bien llevado produce mejoras; uno mal llevado produce miedo a reportar.

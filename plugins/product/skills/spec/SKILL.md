---
name: spec
description: Genera una especificación trazable — requisitos funcionales y no funcionales, criterios de aceptación, dependencias, datos, seguridad y plan de pruebas. Invocación manual con /spec.
disable-model-invocation: true
---

# /spec — la especificación que el resto del ciclo consume

Toma un discovery aprobado y lo vuelve una spec que `planner`/`/ship` pueden implementar, `qa-reviewer`
puede verificar y `/release` puede exponer. Trazable: cada requisito rastrea a una necesidad del
discovery y a un criterio de aceptación.

## Estructura

1. **Objetivo** — una frase, atada al problema y la métrica de éxito del discovery.
2. **Requisitos funcionales** — qué hace el sistema, cada uno verificable. Numerados para trazar.
3. **Requisitos no funcionales** — rendimiento, disponibilidad, accesibilidad (ver plugin
   `experience`), i18n, seguridad. Con umbrales, no adjetivos ("< 200ms p95", no "rápido").
4. **Criterios de aceptación** — por requisito, en forma verificable (dado/cuando/entonces). Es lo
   que `qa-reviewer` mapea contra los tests.
5. **Datos** — qué entidades, qué cambia en el esquema, qué migración (y su reversibilidad).
6. **Dependencias** — servicios, APIs, flags, y qué pasa si cada uno falla.
7. **Seguridad** — superficies nuevas: input en frontera de confianza, auth, secretos.
8. **Plan de pruebas** — qué se cubre con unit / integración / e2e, y qué queda fuera y por qué.

## Reglas

- Respeta las constantes del entorno: máximo 3–5 archivos por cambio; si no cabe, la spec lo dice y
  parte en fases mergeables (mínima → happy path → edge cases → optimización).
- Nada de requisitos no verificables ("intuitivo", "escalable"): si no se puede escribir su criterio
  de aceptación, no es un requisito, es un deseo.
- La spec se muestra y **se aprueba** antes de implementar. Es la única parada obligatoria antes de
  `/ship`.

## Encaje
`/discover` → **`/spec`** → `/ship` (implementa+revisa+gate) → `/release` (expone) → `/observe` →
`/learn` → de vuelta a `/discover`.

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
   que `qa-reviewer` mapea contra los tests. Si la sección 7 marcó superficie expuesta, cada vector
   ofensivo lleva su propio criterio verificable ("un IDOR en `GET /orders/:id` de otro usuario
   devuelve 403", no "es seguro").
5. **Datos** — qué entidades, qué cambia en el esquema, qué migración (y su reversibilidad).
6. **Dependencias** — servicios, APIs, flags, y qué pasa si cada uno falla.
7. **Seguridad** — no solo declara las superficies nuevas, **decide** qué se ataca. Si el cambio
   toca una superficie sensible (auth, permisos, endpoints públicos, uploads, pagos, webhooks,
   input en frontera de confianza, `fetch` a URL de usuario), aplica la skill `threat-modeling` y
   deja escrito:
   - `superficie_expuesta: sí | no` — el flag que `/release` y el `release-gate` leen después.
     En el dossier JSON de `/release` se traduce a booleano: `sí → true`, `no → false`. Ante la
     duda (cambio sin spec o sin flag claro), `sí`.
   - Cuando es `sí`: las familias `offensive-*` que aplican al cambio, por criterio y por nombre
     (p.ej. `offensive-idor` para rutas con ids de recurso, `offensive-jwt` para tokens,
     `offensive-ssrf` para fetch a URLs de usuario, `offensive-sqli` para queries con input). Esto
     es una decisión escrita, no ejecución: nada ofensivo corre en `/spec`. La ejecución ocurre en
     `/release` vía `/pentest`, bajo `.pentest-scope.json`.
   - Secretos nuevos y dónde viven.
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

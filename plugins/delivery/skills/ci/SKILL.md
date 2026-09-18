---
name: ci
description: Diseña o revisa la pipeline de CI — lint, test unitario, integración, E2E, seguridad, build y artefactos. Invocación manual con /ci.
disable-model-invocation: true
---

# /ci — la pipeline como puerta de calidad

Diseña una pipeline nueva o audita una existente. El objetivo no es "que corra", sino que **falle
temprano y por la razón correcta**, y que su verde signifique algo (es lo que el `/release` cita
como `ci_green`).

## Etapas (en orden de costo creciente; corta apenas una falla)

1. **Lint / format** — estilo y errores obvios antes de gastar en tests.
2. **Type check** — `tsc` u equivalente.
3. **Unit** — rápidos, aislados, deterministas.
4. **Integration** — endpoints y datos, con dependencias externas mockeadas o efímeras.
5. **E2E** — flujos críticos (Playwright). Solo los críticos: son caros y frágiles.
6. **Seguridad** — `npm audit`, escaneo de secretos, SAST si aplica.
7. **Build** — el artefacto de producción; que el build roto no llegue a deploy.
8. **Artefactos** — versión, checksum, y que sean reproducibles.

## Proceso

1. Detecta el stack y el runner (GitHub Actions es el default del entorno). Lee la config existente
   antes de proponer.
2. Apóyate en el agente `devops-engineer` para la mecánica del runner y el caché.
3. Para cada etapa: qué corre, cuándo corta, y qué señal emite. Sin etapas decorativas.
4. La pipeline debe reportar un estado por SHA que `/release` pueda leer como `ci_green`.

## Boundary
Diseña y revisa; no despliega. El deploy vive en `/release` + `release-gate`. No agregues una
etapa de deploy automático a la pipeline: exponer es decisión de Karen.

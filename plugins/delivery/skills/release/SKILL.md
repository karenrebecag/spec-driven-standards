---
name: release
description: Produce el dossier de release y lo deja listo para el release-gate — versión, changelog, riesgos, migraciones, feature flags, plan de despliegue, smoke tests y rollback. Invocación manual con /release.
disable-model-invocation: true
---

# /release — dossier para exponer un cambio con seguridad

El `review-gate` ya respondió "¿está revisado para integrarse?". Este responde la otra pregunta:
"¿se puede EXPONER, observar y revertir?". Produce `.release-approval.json`, que el
`release-gate` (hook PreToolUse) exige antes de dejar correr un `vercel --prod` o un
`supabase db push`. Sin dossier vigente para el HEAD actual, el despliegue se deniega.

## Pasos

1. **Contexto** — `git rev-parse HEAD` (el SHA que se expone), `git log` desde el último release,
   y qué cambia de cara al usuario. Apóyate en el agente `deployment-engineer` para la estrategia.
2. **Changelog y riesgos** — qué entra, qué puede romper, y el blast radius.
3. **Migraciones de datos** — estado: `none` | `additive` | `destructive`. Una migración
   destructiva no se despliega junto al código que la necesita; va antes, compatible hacia atrás.
4. **Exposición** — feature flag o estrategia (canary / progresivo). Si no aplica, decláralo.
5. **Smoke tests** — la lista mínima que confirma que el despliegue quedó sano en producción.
6. **Rollback** — el plan concreto para revertir (alias anterior, revert, flag off). No es opcional.
7. **Owner de on-call** — quién responde si algo se cae.
8. **CI** — confirma verde para ese SHA exacto.

## Salida

Escribe `.release-approval.json` en la raíz del proyecto:

```json
{
  "sha": "<8 chars de HEAD>",
  "ci_green": true,
  "approvals": { "qa": true, "security": true, "release": true },
  "rollback_plan": "revertir alias a la versión previa",
  "migrations_state": "none",
  "owner": "<on-call>",
  "feature_flag": "<nombre o null>",
  "observability": "<dashboard/alerta o null>",
  "expires": "<ISO opcional>"
}
```

Los tres `approvals` requieren que QA, seguridad y release hayan firmado sobre este SHA — no los
marques en `true` sin esa firma. Muestra el dossier a Karen antes de escribirlo.

## Límite
`/release` prepara y habilita; **no despliega**. El deploy lo corre Karen (regla `ask`) y el
`release-gate` lo deja pasar solo si este dossier está completo y vigente. Merge y deploy son de Karen.

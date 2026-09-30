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
5b. **QA de release y pentest — condicional a la superficie.** Si la spec marcó
   `superficie_expuesta: sí`, este dossier NO se firma sin dos evidencias reales para este SHA:
   - **QA de release:** corre `release-testing-workflow` (o `production-verification` para el
     post-deploy). Deja el reporte en `reports/qa-<sha>.md` en el repo.
   - **Pentest:** corre `/pentest` contra tu preview/staging propio (nunca producción ni terceros),
     bajo `.pentest-scope.json` vigente. El loop cierra cuando el vector que funcionaba deja de
     funcionar, con su test de regresión. Deja el reporte en `reports/pentest-<sha>.md`.
   Ambos reportes se **commitean** con el cambio: así viajan en el PR y el `release-gate` puede
   además comprobar por diff que los tests de regresión entraron con este SHA. Cada hallazgo lleva
   su línea `Regresion: <path>::<test>` (ver `/pentest` paso 6), que es lo que el `release-verifier`
   usa para confirmar el cierre.
   Sin superficie expuesta, este paso se declara `n/a` y se sigue. Ante un cambio sin spec o sin
   flag, decide explícitamente y ante la duda trátalo como expuesto. Los reportes llevan el SHA de
   HEAD en el nombre, que es como el `release-gate` los resuelve. `/pentest` es la única vía que ejecuta skills
   `offensive-*`; `/ship` nunca lo hace. Las skills viven en tu máquina vía `scripts/bootstrap-qa.sh`
   (QA) y el plugin `security` (offensive-*); no se redistribuyen.
6. **Rollback** — el plan concreto para revertir (alias anterior, revert, flag off). No es opcional.
7. **Owner de on-call** — quién responde si algo se cae.
8. **CI** — confirma verde para ese SHA exacto.

## Salida

Escribe `.release-approval.json` en la raíz del proyecto:

```json
{
  "sha": "<8 chars de HEAD>",
  "ci_green": true,
  "superficie_expuesta": false,
  "approvals": { "qa": true, "security": true, "release": true },
  "security_report": "<ruta al reporte de pentest, o null si superficie_expuesta=false>",
  "qa_report": "<ruta al reporte de QA de release, o null si superficie_expuesta=false>",
  "rollback_plan": "revertir alias a la versión previa",
  "migrations_state": "none",
  "owner": "<on-call>",
  "feature_flag": "<nombre o null>",
  "observability": "<dashboard/alerta o null>",
  "expires": "<ISO opcional>"
}
```

Los tres `approvals` requieren que QA, seguridad y release hayan firmado sobre este SHA — no los
marques en `true` sin esa firma. Copia `superficie_expuesta` desde la spec (`sí → true`). Cuando es
`true`, el `release-gate` **exige** que `security_report` y `qa_report` apunten a archivos
existentes (no basta el booleano): son los reportes del paso 5b, con el SHA en el nombre. Esa
verificación del gate llega con su propio cambio de hook (`release-gate.mjs`, PR aparte); hasta que
ese PR entre, la exigencia vive en esta prosa pero aún no la hace cumplir el hook. Muestra el
dossier a Karen antes de escribirlo.

## Límite
`/release` prepara y habilita; **no despliega**. El deploy lo corre Karen (regla `ask`) y el
`release-gate` lo deja pasar solo si este dossier está completo y vigente. Merge y deploy son de Karen.

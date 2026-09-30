# ADR 0002 — Contrato del release-gate: clave `release-verifier` y deny en pre-deploy

Fecha: 2026-09-30 · Estado: Propuesto (pendiente de firma de Karen)
Programa: release-verifier · Brief: `docs/research/release-verifier.md`

## Contexto

Hoy `release-gate.mjs` prueba, cuando la superficie está expuesta, que los reportes de
pentest/QA **existen** (archivo real, no vacío). Su `HACK:` reconoce que no prueba que esos
hallazgos **se hayan cerrado**. Este programa eleva el piso reusando el patrón de
`review-gate`: un verificador independiente emite un veredicto y el HOOK lo hace cumplir
contra un hash, no contra un campo declarado por el agente.

Eso cambia el contrato del hook de deploy y del archivo de estado. Un cambio de contrato de
un gate se firma (estándar de la casa: seguridad/CI).

## Decisión

1. **Nueva clave en `.git/claude-review.json`: `release-verifier`.** El modo `subagent-stop`
   del `release-gate` persiste, tras parsear la línea `RELEASE:` fallando cerrado:
   `{ verdict, findings, closed, unverified, sha, reportHash, tests:[...paths], ts }`.
   El hook recomputa `HEAD8` y `sha256(reporte)`; no confía en ningún campo que el agente
   escriba. El estado vive en el git-dir, no commiteado, vía `resolveStatePath`.

2. **Nuevo camino de deny en `pre-deploy`.** Además de lo que ya exige el dossier, el gate
   deniega el deploy salvo que exista una entrada `release-verifier` con `verdict==='CLOSED'`,
   `unverified===0`, `sha===HEAD8` y `reportHash===sha256(reporte actual)`. Desactualizado,
   ausente o con hash distinto ⇒ deny, con el motivo. La comprobación entra por un inyectable
   (`verifierState`) para mantener `evaluateRelease` pura y testeable, como ya se hizo con
   `reportExists`.

## Límites (honestos, van en el código y la doc)

- **Autoautorización dentro del mismo dominio de confianza** no se cierra: el agente podría
  escribir el archivo de estado directo, igual que `pentest-scope` concede que podría
  escribir su propio alcance. Los gates suben el costo y dejan rastro; el binding a
  `(HEAD8, sha256(reporte))` obliga a que un registro forjado case con el reporte y el HEAD
  reales. El `ask` de Karen en `vercel --prod` / `supabase db push` sigue siendo el gate real.
- **Válvula manual:** `! vercel --prod` tecleado por Karen no pasa por PreToolUse, a
  propósito.
- **Staleness:** cualquier commit posterior al veredicto invalida `sha`; se re-corre el
  verificador, no se relaja el check.

## Consecuencias

- `release-gate.mjs` gana un modo por argv (`subagent-stop` | default `pre-deploy`), como
  `review-gate`.
- `config/settings.json`: el matcher SubagentStop gana `release-verifier`.
- Un deploy de superficie expuesta queda bloqueado hasta que el verificador firme CLOSED
  sobre el reporte y el HEAD vigentes. Sube el piso; no reemplaza el `ask` final de Karen.

## Firma

- [ ] Karen — al aceptar, cambiar `Estado: Propuesto` por `Estado: Aceptado`.

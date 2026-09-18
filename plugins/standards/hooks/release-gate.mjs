#!/usr/bin/env node
// Gate de release: deniega un despliegue/promocion salvo que exista un dossier de release valido
// para el commit exacto que se va a exponer. Complementa al review-gate: aquel responde "¿esta
// revisado para integrarse?"; este responde "¿se puede EXPONER con seguridad, observar y revertir?".
//
// PreToolUse sobre Bash. Si el comando es de despliegue (vercel --prod, supabase db push, etc.) y
// no hay `.release-approval.json` vigente para el HEAD actual con los campos requeridos, deniega.
//
// El dossier lo produce /release y lo aprueban QA/seguridad/release. Campos requeridos:
//   sha, ci_green, approvals{qa,security,release}, rollback_plan, migrations_state, owner.
// Opcionales (advisory): feature_flag, observability, expires.
//
// HACK: gate de forma, no de fondo. Verifica que el dossier exista y este completo para el SHA,
// no que el rollback realmente funcione. Sube a validacion real cuando haya un runner de smoke.

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const DEPLOY_RE = /\b(vercel\s+(deploy\s+)?.*--prod|vercel\s+--prod|supabase\s+db\s+push|supabase\s+db\s+reset)\b/
const APPROVALS = ['qa', 'security', 'release']

export function isDeployCommand(command) {
  if (typeof command !== 'string' || !command) return false
  return DEPLOY_RE.test(command)
}

// Devuelve { allow, reason } dado el dossier, el SHA que se despliega y el ahora en ms.
export function evaluateRelease(dossier, sha, nowMs) {
  if (!dossier || typeof dossier !== 'object') {
    return { allow: false, reason: 'Despliegue bloqueado: no hay .release-approval.json. Corre /release para producir el dossier (CI, aprobaciones, rollback, migraciones, owner).' }
  }
  const faltan = []
  if (dossier.sha !== sha) faltan.push(`el dossier es de otro commit (SHA), esta desactualizado (dossier=${dossier.sha || '?'}, HEAD=${sha})`)
  if (dossier.ci_green !== true) faltan.push('CI no esta en verde para este SHA')
  for (const a of APPROVALS) {
    if (!dossier.approvals || dossier.approvals[a] !== true) faltan.push(`falta aprobacion de ${a}`)
  }
  if (!dossier.rollback_plan || String(dossier.rollback_plan).trim() === '') faltan.push('falta plan de rollback')
  if (dossier.migrations_state === undefined || dossier.migrations_state === null || String(dossier.migrations_state).trim() === '') faltan.push('falta estado de migraciones de datos')
  if (!dossier.owner || String(dossier.owner).trim() === '') faltan.push('falta owner de on-call')
  if (dossier.expires !== undefined) {
    const exp = Date.parse(dossier.expires)
    if (Number.isNaN(exp) || exp < nowMs) faltan.push('el dossier de release esta vencido')
  }

  if (faltan.length === 0) return { allow: true, reason: '' }
  return {
    allow: false,
    reason: 'Despliegue bloqueado: el dossier de release no habilita exponer este commit. ' + faltan.join('; ') + '. Actualiza /release sobre el HEAD actual.',
  }
}

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
}

function readDossier(cwd) {
  try {
    return JSON.parse(readFileSync(join(cwd, '.release-approval.json'), 'utf8'))
  } catch {
    return null
  }
}

function readStdin() {
  try {
    return JSON.parse(readFileSync(0, 'utf8'))
  } catch {
    return {}
  }
}

function main() {
  const input = readStdin()
  const command = input.tool_input && input.tool_input.command
  if (!isDeployCommand(command)) process.exit(0)

  const cwd = input.cwd || process.cwd()
  let sha
  try {
    sha = git(cwd, ['rev-parse', 'HEAD']).slice(0, 8)
  } catch {
    sha = ''
  }
  const result = evaluateRelease(readDossier(cwd), sha, Date.now())
  if (result.allow) process.exit(0)

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: result.reason,
      },
    }),
  )
  process.exit(0)
}

if (import.meta.url === `file://${process.argv[1]}`) main()

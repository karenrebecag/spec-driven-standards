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
import { readFileSync, realpathSync, statSync } from 'node:fs'
import { join, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'

const DEPLOY_RE = /\b(vercel\s+(deploy\s+)?.*--prod|vercel\s+--prod|supabase\s+db\s+push|supabase\s+db\s+reset)\b/
const APPROVALS = ['qa', 'security', 'release']

export function isDeployCommand(command) {
  if (typeof command !== 'string' || !command) return false
  return DEPLOY_RE.test(command)
}

// Reportes exigidos cuando la spec marco superficie expuesta: campo -> que evidencia es.
const SURFACE_REPORTS = [
  ['security_report', 'pentest (/pentest)'],
  ['qa_report', 'QA de release (release-testing-workflow / production-verification)'],
]

// Expuesto = el campo esta presente y no es false. Un booleano true, o cualquier valor que no
// sea false (incluido un "true"/1 de un dossier escrito a mano), exige reportes; un campo ausente
// (dossier viejo) mantiene el comportamiento previo. Se falla cerrado ante un valor ambiguo.
function isSurfaceExposed(dossier) {
  return 'superficie_expuesta' in dossier && dossier.superficie_expuesta !== false
}

// Verificador por defecto de un reporte: existe, es un ARCHIVO (no un directorio) y no esta vacio.
// Un existsSync a secas aceptaba "." o un archivo vacio como evidencia. `p` ya viene resuelto.
function isReportFile(p) {
  const s = statSync(p, { throwIfNoEntry: false })
  return !!s && s.isFile() && s.size > 0
}

// Crea el verificador real contra disco, atado a la raiz del proyecto donde vive el dossier.
// Exportado para probar la resolucion de ruta y el chequeo de archivo sin pasar por el hook.
export function reportChecker(cwd) {
  return (p) => isReportFile(isAbsolute(p) ? p : join(cwd, p))
}

// Devuelve { allow, reason } dado el dossier, el SHA que se despliega y el ahora en ms.
// `reportExists` es inyectable para mantener la funcion pura y testeable; el entrypoint pasa un
// verificador real contra el disco. Solo se consulta cuando la superficie esta expuesta.
export function evaluateRelease(dossier, sha, nowMs, { reportExists = isReportFile } = {}) {
  if (!dossier || typeof dossier !== 'object') {
    return { allow: false, reason: 'Despliegue bloqueado: no hay .release-approval.json. Corre /release para producir el dossier (CI, aprobaciones, rollback, migraciones, owner).' }
  }
  const faltan = []
  if (dossier.sha !== sha) faltan.push(`el dossier es de otro commit (SHA), esta desactualizado (dossier=${dossier.sha || '?'}, HEAD=${sha})`)
  if (dossier.ci_green !== true) faltan.push('CI no esta en verde para este SHA')
  for (const a of APPROVALS) {
    if (!dossier.approvals || dossier.approvals[a] !== true) faltan.push(`falta aprobacion de ${a}`)
  }
  // Superficie expuesta (lo marca /spec): el booleano no basta, exige un archivo de reporte real.
  // HACK: el gate comprueba que el archivo exista y no este vacio, no que corresponda a este SHA
  // ni que el pentest/QA realmente pasara. Subir a atar el reporte al SHA (por nombre o contenido)
  // cuando un reporte viejo colandose sea un riesgo observado.
  if (isSurfaceExposed(dossier)) {
    for (const [field, label] of SURFACE_REPORTS) {
      const ruta = dossier[field]
      if (typeof ruta !== 'string' || ruta.trim() === '') {
        faltan.push(`superficie expuesta: falta ${field}, el reporte de ${label}`)
      } else if (!reportExists(ruta)) {
        faltan.push(`superficie expuesta: ${field} no apunta a un archivo con contenido (${ruta}), no hay evidencia de ${label}`)
      }
    }
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

  let result
  try {
    let sha
    try {
      sha = git(cwd, ['rev-parse', 'HEAD']).slice(0, 8)
    } catch {
      sha = ''
    }
    // reportChecker resuelve las rutas relativas a la raiz del proyecto (donde vive el dossier).
    result = evaluateRelease(readDossier(cwd), sha, Date.now(), { reportExists: reportChecker(cwd) })
  } catch (err) {
    // Un gate de deploy falla CERRADO: ante un error inesperado, deniega con el motivo en vez de
    // dejar pasar el despliegue (un exit distinto de la denegacion no bloquearia la tool).
    result = { allow: false, reason: `Despliegue bloqueado: el release-gate fallo al evaluar (${err && err.message ? err.message : err}). Revisa el dossier.` }
  }
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

// argv[1] conserva el symlink (~/.claude/hooks) pero import.meta.url ya es el realpath: se comparan reales.
function isEntrypoint() {
  try {
    return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
  } catch {
    return false
  }
}

if (isEntrypoint()) main()

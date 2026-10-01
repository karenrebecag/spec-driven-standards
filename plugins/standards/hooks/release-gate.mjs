#!/usr/bin/env node
// Gate de release: deniega un despliegue/promocion salvo que exista un dossier de release valido
// para el commit exacto que se va a exponer. Complementa al review-gate: aquel responde "¿esta
// revisado para integrarse?"; este responde "¿se puede EXPONER con seguridad, observar y revertir?".
//
// Dos modos (argv[2]):
//   subagent-stop  hook SubagentStop del release-verifier: extrae su linea RELEASE y la guarda
//                  contra (HEAD8, sha256(reporte)). Si no la escribio, lo bloquea para que la
//                  escriba. Rechaza un veredicto de otro SHA o firmado sobre un arbol sucio.
//   (sin modo)     hook PreToolUse sobre Bash: si el comando es de despliegue y no hay dossier
//                  vigente para HEAD, deniega. Con superficie expuesta exige, ademas de los
//                  reportes, el veredicto CLOSED del release-verifier atado a este commit y reporte.
//
// El dossier lo produce /release y lo aprueban QA/seguridad/release. Campos requeridos:
//   sha, ci_green, approvals{qa,security,release}, rollback_plan, migrations_state, owner.
// Opcionales (advisory): feature_flag, observability, expires.

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync, realpathSync, renameSync, statSync } from 'node:fs'
import { join, isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { validateRegresionPath, branchBase } from './release-verify.mjs'

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

// Veredicto del release-verifier: la ULTIMA linea no vacia debe casar EXACTO. Cualquier prosa
// despues, orden distinto, sha no hex o conteo ausente devuelve null -> el gate falla cerrado.
const RELEASE_RE = /^RELEASE:\s+(CLOSED|OPEN)\s+sha=([0-9a-f]{8})\s+findings=(\d+)\s+closed=(\d+)\s+unverified=(\d+)$/

export function parseReleaseVerdict(text) {
  if (typeof text !== 'string') return null
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length === 0) return null
  const m = RELEASE_RE.exec(lines[lines.length - 1])
  if (!m) return null
  return { verdict: m[1], sha: m[2], findings: Number(m[3]), closed: Number(m[4]), unverified: Number(m[5]) }
}

// Devuelve { allow, reason } dado el dossier, el SHA que se despliega y el ahora en ms.
// `reportExists` es inyectable para mantener la funcion pura y testeable; el entrypoint pasa un
// verificador real contra el disco. `verifierState` es la entrada `release-verifier` persistida y
// `currentReportHash` el sha256 del reporte vigente; ambos solo se consultan con superficie expuesta.
export function evaluateRelease(dossier, sha, nowMs, { reportExists = isReportFile, verifierState, currentReportHash, treeDirty = false } = {}) {
  if (!dossier || typeof dossier !== 'object') {
    return { allow: false, reason: 'Despliegue bloqueado: no hay .release-approval.json. Corre /release para producir el dossier (CI, aprobaciones, rollback, migraciones, owner).' }
  }
  const faltan = []
  // `vercel --prod` sube el arbol de trabajo, no HEAD: un arbol sucio desplegaria codigo que no
  // paso por el commit ni por la revision. El dossier, sin trackear, no cuenta (lo exenta dirtyPaths).
  if (treeDirty) faltan.push('el arbol de trabajo tiene cambios sin commitear: el deploy subiria codigo no revisado (commitea o descarta antes de desplegar)')
  // El SHA debe ser un HEAD resoluble (8 hex) e igual al del dossier. Exigir el formato cierra el
  // caso de un HEAD no resoluble (sha=''): un dossier forjado con "sha":"" ya no casaria con ''.
  if (!/^[0-9a-f]{8}$/.test(sha) || dossier.sha !== sha) faltan.push(`el dossier no ata a un commit valido para este SHA (dossier=${dossier.sha || '?'}, HEAD=${sha || 'desconocido'})`)
  if (dossier.ci_green !== true) faltan.push('CI no esta en verde para este SHA')
  for (const a of APPROVALS) {
    if (!dossier.approvals || dossier.approvals[a] !== true) faltan.push(`falta aprobacion de ${a}`)
  }
  // Superficie expuesta (lo marca /spec): ni el booleano ni la mera existencia del reporte bastan.
  // Primero los reportes existen; luego el release-verifier tuvo que FIRMAR que los hallazgos de
  // pentest se cerraron, atado a este SHA y al hash del reporte vigente (no a un campo declarado).
  if (isSurfaceExposed(dossier)) {
    for (const [field, label] of SURFACE_REPORTS) {
      const ruta = dossier[field]
      if (typeof ruta !== 'string' || ruta.trim() === '') {
        faltan.push(`superficie expuesta: falta ${field}, el reporte de ${label}`)
      } else if (!reportExists(ruta)) {
        faltan.push(`superficie expuesta: ${field} no apunta a un archivo con contenido (${ruta}), no hay evidencia de ${label}`)
      }
    }
    faltan.push(...surfaceVerifierGaps(verifierState, sha, currentReportHash))
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

// Falla cerrado: sin veredicto, o con uno que no sea CLOSED/completo/atado al SHA y al hash del
// reporte vigente, devuelve el motivo por el que no se puede exponer.
function surfaceVerifierGaps(vs, sha, currentReportHash) {
  if (!vs || typeof vs !== 'object') {
    return ['superficie expuesta: falta el veredicto CLOSED del release-verifier (corre el verificador que confirma que los hallazgos de pentest se cerraron)']
  }
  const gaps = []
  if (vs.verdict !== 'CLOSED') gaps.push(`superficie expuesta: el release-verifier no cerro los hallazgos (verdict=${vs.verdict || '?'})`)
  if (vs.unverified !== 0) gaps.push(`superficie expuesta: quedan ${vs.unverified} hallazgos unverified`)
  if (vs.closed !== vs.findings) gaps.push(`superficie expuesta: el release-verifier cerro ${vs.closed}/${vs.findings} hallazgos`)
  if (vs.sha !== sha) gaps.push(`superficie expuesta: el veredicto del release-verifier es de otro commit (SHA ${vs.sha || '?'}, HEAD ${sha})`)
  if (typeof currentReportHash !== 'string' || vs.reportHash !== currentReportHash) gaps.push('superficie expuesta: el reporte de pentest cambio desde que se verifico (hash distinto)')
  return gaps
}

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim()
}

// Sin trim: `status --porcelain -z` separa con NUL y la primera entrada empieza con el codigo de
// estado (p.ej. " M "), cuyo espacio inicial un .trim() borraria, corriendo el corte de la ruta.
function gitRaw(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
}

// Rutas con cambios en el arbol. Formato -z: cada entrada es `XY <ruta>` terminada en NUL; un
// rename/copy (R/C en el estado) anade la ruta VIEJA como la siguiente entrada, SIN el prefijo XY,
// asi que hay que consumirla con estado y no aplicarle slice(3). El dossier se exenta SOLO como
// untracked exacto (`?? .release-approval.json`): un rename o borrado que lo toque si es suciedad.
export function dirtyPaths(cwd) {
  const parts = gitRaw(cwd, ['status', '--porcelain', '-z']).split('\0')
  const dirty = []
  for (let i = 0; i < parts.length; i++) {
    const e = parts[i]
    if (!e) continue
    const xy = e.slice(0, 2)
    const path = e.slice(3)
    if (xy[0] === 'R' || xy[0] === 'C') i++ // la ruta vieja es la entrada siguiente: consumirla
    if (xy === '??' && path === '.release-approval.json') continue
    dirty.push(path)
  }
  return dirty
}

function readDossier(cwd) {
  try {
    return JSON.parse(readFileSync(join(cwd, '.release-approval.json'), 'utf8'))
  } catch {
    return null
  }
}

// ---- Estado persistido, compartido con review-gate: .git/claude-review.json, clave por agente ----

// En un worktree, --git-dir es absoluto: join() lo pegaba a cwd y el estado acababa dentro del
// arbol de trabajo. resolve() respeta la ruta absoluta y solo une la relativa.
export function resolveStatePath(cwd, gitDir) {
  return join(resolve(cwd, gitDir), 'claude-review.json')
}

function statePath(cwd) {
  return resolveStatePath(cwd, git(cwd, ['rev-parse', '--git-dir']))
}

function readState(cwd) {
  try {
    const s = JSON.parse(readFileSync(statePath(cwd), 'utf8'))
    // Un JSON valido pero no-objeto (null, array) rompe al indexarlo por clave de agente; tratarlo
    // como vacio falla cerrado (sin veredicto no hay aprobacion).
    return s && typeof s === 'object' && !Array.isArray(s) ? s : {}
  } catch {
    return {}
  }
}

// Escribe atomico: a un temporal y luego rename, asi otro gate nunca lee un JSON a medio escribir y
// se queda sin las claves de los demas. HACK: dos writeState en paralelo pueden pisarse (gana el ultimo
// rename, se pierde la clave del otro). Poner un lock de archivo si llega a haber gates concurrentes
// de verdad; hoy cada hook es un proceso corto y solo.
function writeState(cwd, state) {
  const p = statePath(cwd)
  mkdirSync(join(p, '..'), { recursive: true })
  const tmp = `${p}.${process.pid}.tmp`
  writeFileSync(tmp, JSON.stringify(state, null, 2))
  renameSync(tmp, p)
}

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex')
}

// El reporte ata cada hallazgo a su test con una linea `Regresion: <path>::<test>`. Se extraen los
// paths (dato, no instruccion), SIN deduplicar: el conteo de lineas reales se cruza contra findings.
// La regex exige `::` tras el path, asi una mencion en prosa de "Regresion:" no cuenta.
function extractRegresionPaths(reportText) {
  const paths = []
  for (const m of reportText.matchAll(/Regresion:\s*`?([^\s`]+?)::/g)) paths.push(m[1])
  return paths
}

// Resuelve el `security_report` del dossier a una ruta absoluta (una relativa se une al cwd; una
// absoluta se respeta). El dossier es un input de confianza y el reporte SOLO se hashea, nunca se
// ejecuta, por eso no se confina a la raiz como si se hace con las rutas de test del reporte.
function reportPathOf(dossier, cwd) {
  const rp = dossier && typeof dossier.security_report === 'string' ? dossier.security_report.trim() : ''
  if (!rp) return null
  return isAbsolute(rp) ? rp : join(cwd, rp)
}

// Normaliza una ruta de repo para comparar: separadores a `/`, colapsa `//` y quita `./` inicial.
function normPath(p) {
  return p.replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(/^\.\//, '')
}

// Tests que NO aparecen en el diff de la rama (base..HEAD). Devuelve [] (omite la atadura) cuando:
// no hay base de rama (HEAD===base, o un repo sin main/master/origin: branchBase con allowRoot=false
// devuelve null), o el diff no se puede computar. HACK: cuando se omite, solo queda la atadura por
// hash de pre-deploy (PR-1); es una atadura SECUNDARIA. Disparador de mejora: exigir una base
// explicita de release (el ultimo SHA desplegado) cuando no hay rama por defecto.
function testsOutsideBranchDiff(cwd, tests) {
  if (tests.length === 0) return []
  let base
  let head
  try {
    base = branchBase(cwd, { allowRoot: false })
    head = git(cwd, ['rev-parse', 'HEAD'])
  } catch {
    return []
  }
  if (!base || base === head) return []
  let changed
  try {
    // -z evita que git entrecomille nombres no-ASCII (core.quotePath). `--name-only` imprime rutas
    // relativas a la raiz del repo; el hook corre con cwd = esa raiz (ahi vive el dossier), asi que
    // se comparan contra la ruta del reporte tal cual, ambas normalizadas. Un cwd en subdirectorio
    // daria un falso rechazo (falla cerrado), no un bypass.
    changed = new Set(
      gitRaw(cwd, ['diff', '--name-only', '-z', `${base}..HEAD`]).split('\0').filter(Boolean).map(normPath),
    )
  } catch {
    return []
  }
  return tests.filter((t) => !changed.has(normPath(t)))
}

function block(reason) {
  process.stdout.write(JSON.stringify({ decision: 'block', reason }))
}

function runSubagentStop(input) {
  if (input.agent_type !== 'release-verifier') return

  // En un bucle de bloqueo (stop_hook_active) no se re-bloquea, pero un veredicto corregido SI debe
  // persistirse: de lo contrario un primer intento bloqueado dejaria el deploy denegado para siempre.
  const looping = !!input.stop_hook_active
  const reject = (reason) => {
    if (!looping) block(reason)
  }

  const cwd = input.cwd || process.cwd()
  const v = parseReleaseVerdict(input.last_assistant_message)
  if (!v) {
    reject(
      'El release-verifier debe terminar con una linea exacta:\n' +
        'RELEASE: CLOSED|OPEN sha=<hex8> findings=N closed=N unverified=N\n' +
        'Escribela como ultima linea con los conteos reales y termina.',
    )
    return
  }

  let sha
  let dirty
  try {
    sha = git(cwd, ['rev-parse', 'HEAD']).slice(0, 8)
    dirty = dirtyPaths(cwd).length > 0
  } catch {
    return // sin repo git no hay nada que registrar
  }
  if (v.sha !== sha) {
    reject(`El veredicto es del commit ${v.sha} pero HEAD es ${sha}. Vuelve a verificar sobre el HEAD actual.`)
    return
  }
  if (dirty) {
    reject('El arbol de trabajo esta sucio: firma el veredicto sobre un arbol limpio para que ate al commit real.')
    return
  }

  const abs = reportPathOf(readDossier(cwd), cwd)
  if (!abs) {
    reject('No hay security_report en .release-approval.json: no se puede atar el veredicto a un reporte. Corre /release primero.')
    return
  }
  let reportBuf
  let text
  try {
    reportBuf = readFileSync(abs)
    text = reportBuf.toString('utf8')
  } catch {
    reject(`No se pudo leer el reporte de pentest (${abs}).`)
    return
  }

  // El hook cruza el conteo contra el reporte, no confia en el numero que el agente declaro: un
  // CLOSED debe cubrir TODOS los hallazgos (una linea Regresion por hallazgo), no dejar ninguno
  // abierto, y cada ruta debe resolver dentro del repo. Asi un `CLOSED findings=0` sobre un reporte
  // con hallazgos, o uno cuyo test sale del arbol, no abre el gate.
  const declared = extractRegresionPaths(text)
  const valid = declared.filter((p) => validateRegresionPath(cwd, p))
  if (v.verdict === 'CLOSED') {
    if (v.closed !== v.findings || v.unverified !== 0) {
      reject('Un veredicto CLOSED exige closed===findings y unverified===0.')
      return
    }
    if (v.findings !== declared.length) {
      reject(`Veredicto CLOSED con findings=${v.findings}, pero el reporte tiene ${declared.length} lineas Regresion. El conteo no cuadra con el reporte.`)
      return
    }
    if (valid.length !== declared.length) {
      reject('Alguna ruta Regresion es invalida o sale del repo: ese hallazgo no puede contarse como cerrado.')
      return
    }
    // Atadura por diff (sign-time, sobre la rama): cada test de regresion debe ser parte de ESTE
    // cambio, no un archivo preexistente. En main (HEAD === base) no hay diff de rama y se omite:
    // la atadura por hash de pre-deploy sigue. Un test fuera del diff de la rama rechaza el cierre.
    const missing = testsOutsideBranchDiff(cwd, [...new Set(valid)])
    if (missing.length) {
      reject(`Estos tests de regresion no aparecen en el diff de la rama (${missing.join(', ')}): un cierre debe apoyarse en tests que este cambio introduce o toca, no en archivos preexistentes. Firma sobre la rama del cambio.`)
      return
    }
  }

  // HACK: el gate confia en el conteo `closed` que el agente declara; no re-ejecuta release-verify.mjs
  // por hallazgo. Techo: un agente comprometido o inyectado por el reporte podria firmar CLOSED sin
  // correr el verificador. Disparador de mejora: cerrar cuando el gate re-ejecute verifyFinding sobre
  // state.tests en pre-deploy (o el modo diff de PR-3 exija los tests en el diff del PR).
  const tests = [...new Set(valid.map(normPath))]
  const reportHash = sha256(reportBuf)

  const state = readState(cwd)
  state['release-verifier'] = { verdict: v.verdict, findings: v.findings, closed: v.closed, unverified: v.unverified, sha, reportHash, tests, ts: Date.now() }
  writeState(cwd, state)
}

function runPreDeploy(input) {
  const command = input.tool_input && input.tool_input.command
  if (!isDeployCommand(command)) process.exit(0)

  // HACK: el gate inspecciona input.cwd, no el directorio que vercel despliega. Un
  // `cd otro && vercel --prod` o `vercel --prod --cwd <dir>` evaluaria un arbol distinto al
  // desplegado. Techo aceptado. Disparador de mejora: extraer `--cwd`/`cd` del comando y evaluar
  // ESE arbol cuando el abuso aparezca.
  const cwd = input.cwd || process.cwd()

  let result
  try {
    let sha
    let treeDirty = false
    try {
      sha = git(cwd, ['rev-parse', 'HEAD']).slice(0, 8)
      treeDirty = dirtyPaths(cwd).length > 0
    } catch {
      sha = ''
      // sin repo git el SHA queda '' y evaluateRelease deniega (no es un HEAD resoluble de 8 hex);
      // la suciedad no se evalua pero el deploy ya esta bloqueado por el SHA.
    }
    const dossier = readDossier(cwd)
    let verifierState
    let currentReportHash
    // Solo con superficie expuesta hace falta el veredicto del release-verifier y el hash del reporte.
    if (dossier && isSurfaceExposed(dossier)) {
      try {
        verifierState = readState(cwd)['release-verifier']
      } catch {
        verifierState = undefined
      }
      const abs = reportPathOf(dossier, cwd)
      if (abs) {
        try {
          currentReportHash = sha256(readFileSync(abs))
        } catch {
          currentReportHash = undefined // falla cerrado: evaluateRelease deniega por hash ausente
        }
      }
    }
    result = evaluateRelease(dossier, sha, Date.now(), { reportExists: reportChecker(cwd), verifierState, currentReportHash, treeDirty })
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

function readStdin() {
  try {
    return JSON.parse(readFileSync(0, 'utf8'))
  } catch {
    return {}
  }
}

function main() {
  const mode = process.argv[2]
  const input = readStdin()
  if (mode === 'subagent-stop') runSubagentStop(input)
  else runPreDeploy(input)
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

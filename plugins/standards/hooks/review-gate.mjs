#!/usr/bin/env node
// Gate del loop de revision: obliga a que un commit hecho por Claude tenga veredicto
// APPROVE de code-reviewer Y security-reviewer para el diff exacto que se va a commitear.
//
// Dos modos (argv[2]):
//   subagent-stop  hook SubagentStop: extrae el VERDICT del reviewer y lo guarda contra
//                  el hash del diff actual. Si el reviewer no escribio la linea, lo bloquea
//                  para que la escriba (salvo que stop_hook_active ya sea true).
//   pre-commit     hook PreToolUse sobre `git commit`: niega el commit si el diff toca
//                  codigo y no hay APPROVE de ambos reviewers para este mismo diff.
//
// Sin dependencias. Lee JSON del hook por stdin y responde por stdout el contrato de hooks.
// HACK: el gate solo cubre commits que pasan por la tool Bash de Claude. Un `! git commit`
// escrito en el prompt corre directo y no dispara PreToolUse — es la valvula manual de Karen.
//
// El repo es el del trabajo, no el de la sesion (work-repo.mjs): el veredicto va al repo donde el
// reviewer trabajo segun su log, y el commit se evalua en el directorio efectivo del comando.

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync, realpathSync, renameSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { finalReport } from './handback.mjs'
import { finishWork, isGitCommit, repoFromCommand, repoRoot, workOf } from './work-repo.mjs'

const REVIEWERS = ['code-reviewer', 'security-reviewer', 'qa-reviewer']
const CODE_EXT = /\.(m?[jt]sx?|py|go|rs|rb|php|java|kt|swift|c|cc|cpp|h|hpp|cs|scala|sh|sql|astro|vue|svelte)$/i
const VERDICT_RE = /verdict:\s*(APPROVE|WARNING|BLOCK)\s+critical=(\d+)\s+high=(\d+)/gi

export function parseVerdict(text) {
  if (typeof text !== 'string') return null
  let last = null
  for (const m of text.matchAll(VERDICT_RE)) last = m
  if (!last) return null
  return { verdict: last[1].toUpperCase(), critical: Number(last[2]), high: Number(last[3]) }
}

function verdictFromSubagentStop(input) {
  return parseVerdict(finalReport({ ...input, pattern: VERDICT_RE, noticePrefix: 'review-gate' }))
}

export function isCodeDiff(files) {
  return Array.isArray(files) && files.some((f) => CODE_EXT.test(f))
}

// Decide si un commit puede proceder dado el estado de revision guardado y el hash del
// diff que se va a commitear. Devuelve { allow, reason }.
export function evaluateCommit(reviewState, diffHash) {
  const missing = []
  const stale = []
  const rejected = []

  for (const name of REVIEWERS) {
    const r = reviewState && reviewState[name]
    if (!r) {
      missing.push(name)
    } else if (r.diffHash !== diffHash) {
      stale.push(name)
    } else if (r.verdict !== 'APPROVE' || r.critical > 0 || r.high > 0) {
      rejected.push(`${name} (${r.verdict} critical=${r.critical} high=${r.high})`)
    }
  }

  if (missing.length === 0 && stale.length === 0 && rejected.length === 0) {
    return { allow: true, reason: '' }
  }

  const parts = ['Commit bloqueado: el diff no tiene revision aprobada vigente.']
  if (missing.length) parts.push(`Falta revision de: ${missing.join(', ')}.`)
  if (stale.length) parts.push(`Revision desactualizada (el codigo cambio despues) en: ${stale.join(', ')}. Vuelve a revisar (re-review).`)
  if (rejected.length) parts.push(`No aprobaron: ${rejected.join('; ')}.`)
  parts.push('Corre /ship o invoca los reviewers sobre el diff actual antes de commitear.')
  return { allow: false, reason: parts.join(' ') }
}

// ---- IO de git y del estado, aisladas para que la logica de arriba sea testeable pura ----

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
}

// Hash estable del cambio pendiente: el diff contra HEAD (tracked, staged y no staged) mas
// el contenido de los archivos sin trackear. Reviewer-time y commit-time computan lo mismo.
function computeDiffHash(cwd) {
  const h = createHash('sha256')
  h.update(git(cwd, ['diff', 'HEAD']))
  const untracked = git(cwd, ['ls-files', '--others', '--exclude-standard']).split('\n').filter(Boolean).sort()
  for (const f of untracked) {
    h.update(`\0untracked:${f}\0`)
    try {
      h.update(readFileSync(join(cwd, f)))
    } catch {
      // borrado entre el listado y la lectura: el marcador del nombre ya entra al hash
    }
  }
  return h.digest('hex').slice(0, 16)
}

function changedFiles(cwd) {
  const tracked = git(cwd, ['diff', 'HEAD', '--name-only']).split('\n')
  const untracked = git(cwd, ['ls-files', '--others', '--exclude-standard']).split('\n')
  return [...tracked, ...untracked].filter(Boolean)
}

// En un worktree, --git-dir es absoluto: join() lo pegaba a cwd y el estado acababa dentro del
// arbol de trabajo, cambiando el hash del diff que acababa de registrar.
export function resolveStatePath(cwd, gitDir) {
  return join(resolve(cwd, gitDir), 'claude-review.json')
}

function statePath(cwd) {
  return resolveStatePath(cwd, git(cwd, ['rev-parse', '--git-dir']).trim())
}

function readState(cwd) {
  try {
    const s = JSON.parse(readFileSync(statePath(cwd), 'utf8'))
    // Un JSON valido pero no-objeto (null, array) rompe al indexarlo por clave de agente; tratarlo
    // como vacio falla cerrado (sin veredicto no hay APPROVE).
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

function readStdin() {
  try {
    return JSON.parse(readFileSync(0, 'utf8'))
  } catch {
    return {}
  }
}

function runSubagentStop(input) {
  const agent = input.agent_type
  if (!REVIEWERS.includes(agent)) return

  const cwd = input.cwd || process.cwd()
  const v = verdictFromSubagentStop(input)
  if (!v) {
    if (input.stop_hook_active) {
      finishWork(input)
      process.stdout.write(
        JSON.stringify({
          systemMessage:
            `review-gate: ${agent} termino sin VERDICT parseable; no se registro APPROVE. ` +
            'Con handback, confirma que SubagentHandback incluya la linea VERDICT en su message.',
        }),
      )
      return
    }
    process.stdout.write(
      JSON.stringify({
        decision: 'block',
        reason:
          `El review de ${agent} debe terminar con una linea exacta:\n` +
          'VERDICT: APPROVE|WARNING|BLOCK critical=N high=N\n' +
          'Escribela como ultima linea con los conteos reales y termina.',
      }),
    )
    return
  }

  // Repo donde trabajo el reviewer segun su log; sin evidencia unica, el de la sesion (K3).
  const repo = workOf(input).repo || cwd
  finishWork(input)
  let hash
  try {
    hash = computeDiffHash(repo)
  } catch {
    return // sin repo git no hay nada que registrar
  }
  const state = readState(repo)
  state[agent] = { verdict: v.verdict, critical: v.critical, high: v.high, diffHash: hash, ts: Date.now() }
  writeState(repo, state)
}

function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    }),
  )
}

function runPreCommit(input) {
  const command = input.tool_input && input.tool_input.command
  if (typeof command !== 'string' || !isGitCommit(command)) return

  // Antes un repo irresoluble era "no es repo, nada que exigir": `--git-dir`, `cd $X` o un subshell
  // pasaban sin gate. Ahora el commit se niega con el motivo.
  // A la raiz: el reviewer registra contra la raiz (workOf), y el hash desde un subdirectorio difiere.
  const dir = repoFromCommand(command, input.cwd || process.cwd())
  const repo = dir && (repoRoot(dir) || dir)
  if (!repo) {
    deny(
      'Commit bloqueado: no se puede determinar en que repo corre este git commit ' +
        '(--git-dir/--work-tree, GIT_DIR, variables, ~, subshell, varios cd o commits a repos distintos ' +
        'en un mismo comando). Usa `git -C <ruta-absoluta> commit` o `cd <ruta-absoluta> && git commit`, ' +
        'un repo por comando.',
    )
    return
  }
  let files
  let hash
  try {
    files = changedFiles(repo)
    hash = computeDiffHash(repo)
  } catch {
    return // no es un repo git: el propio git commit va a fallar
  }
  if (!isCodeDiff(files)) return // solo docs/config: sin gate

  const result = evaluateCommit(readState(repo), hash)
  if (!result.allow) deny(result.reason)
}

function main() {
  const mode = process.argv[2]
  const input = readStdin()
  if (mode === 'subagent-stop') runSubagentStop(input)
  else if (mode === 'pre-commit') runPreCommit(input)
  process.exit(0)
}

// Solo corre como CLI, no cuando el test lo importa.
// argv[1] conserva el symlink (~/.claude/hooks) pero import.meta.url ya es el realpath: se comparan reales.
function isEntrypoint() {
  try {
    return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
  } catch {
    return false
  }
}

if (isEntrypoint()) main()

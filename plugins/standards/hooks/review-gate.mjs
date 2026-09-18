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

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

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

function statePath(cwd) {
  const gitDir = git(cwd, ['rev-parse', '--git-dir']).trim()
  return join(cwd, gitDir, 'claude-review.json')
}

function readState(cwd) {
  try {
    return JSON.parse(readFileSync(statePath(cwd), 'utf8'))
  } catch {
    return {}
  }
}

function writeState(cwd, state) {
  const p = statePath(cwd)
  mkdirSync(join(p, '..'), { recursive: true })
  writeFileSync(p, JSON.stringify(state, null, 2))
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
  if (input.stop_hook_active) return // ya estamos en un bucle de bloqueo: no re-bloquear

  const cwd = input.cwd || process.cwd()
  const v = parseVerdict(input.last_assistant_message)
  if (!v) {
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

  let hash
  try {
    hash = computeDiffHash(cwd)
  } catch {
    return // sin repo git no hay nada que registrar
  }
  const state = readState(cwd)
  state[agent] = { verdict: v.verdict, critical: v.critical, high: v.high, diffHash: hash, ts: Date.now() }
  writeState(cwd, state)
}

function runPreCommit(input) {
  const command = input.tool_input && input.tool_input.command
  if (typeof command !== 'string' || !/\bgit\s+commit\b/.test(command)) return

  const cwd = input.cwd || process.cwd()
  let files
  let hash
  try {
    files = changedFiles(cwd)
    hash = computeDiffHash(cwd)
  } catch {
    return // no es un repo git: nada que exigir
  }
  if (!isCodeDiff(files)) return // solo docs/config: sin gate

  const result = evaluateCommit(readState(cwd), hash)
  if (result.allow) return

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: result.reason,
      },
    }),
  )
}

function main() {
  const mode = process.argv[2]
  const input = readStdin()
  if (mode === 'subagent-stop') runSubagentStop(input)
  else if (mode === 'pre-commit') runPreCommit(input)
  process.exit(0)
}

// Solo corre como CLI, no cuando el test lo importa.
if (import.meta.url === `file://${process.argv[1]}`) main()

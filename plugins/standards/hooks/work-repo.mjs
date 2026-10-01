#!/usr/bin/env node
// A que repo pertenece un trabajo. Los gates tomaban `input.cwd`, que es el directorio donde se abrio
// la sesion: un subagente que trabajaba en otro repo dejaba su veredicto en el repo de la sesion, y
// `git -C otro commit` se evaluaba contra un arbol sin cambios. Este modulo saca el repo de la
// evidencia de cada evento (brief docs/research/gate-work-repo.md, K1-K5):
//   - el gate de commit: el directorio efectivo del comando (`git -C`, un `cd` inicial).
//   - SubagentStop: el log que este mismo archivo escribe en PreToolUse por cada tool que llama un
//     subagente. Solo campos documentados (session_id, agent_id, tool_input); no se lee el transcript.
// Duda -> null, y el que llama vuelve al `cwd` (K3).
//
// Modo CLI `log` (hook PreToolUse): anota la evidencia de la llamada. Nunca decide ni imprime nada,
// y cualquier error se traga: registrar no puede romper la tool del agente.
//
// HACK: `/usr/bin/git`, `env git`, `sh -c`, `eval` y los alias de git no se reconocen como git. Pasar a
// un parser de shell real (o al sandbox con denyWrite) cuando aparezca un caso de esas formas en un gate.

import { execFileSync } from 'node:child_process'
import {
  appendFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
} from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, isAbsolute, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseShell } from './shell-parse.mjs'

const ID_RE = /^[A-Za-z0-9_-]+$/
const LOG_DIR = 'claude-gates'
const DAY_MS = 24 * 3600 * 1000
const BRIEF_RE = /\/docs\/research\/[^/]+\.md$/
// Opciones globales de git que consumen el argumento siguiente sin cambiar de directorio.
const GIT_OPT_WITH_ARG = new Set(['-c', '--namespace', '--config-env', '--exec-path'])
// Palabras que preceden al comando real sin cambiar de directorio. La regex vieja de review-gate las
// atravesaba (`time git commit`, `if ...; then git commit`); el parser no puede perderlas.
const WRAPPERS = new Set(['if', 'then', 'elif', 'else', 'while', 'until', 'do', '{', '!', 'time', 'command', 'exec', 'nohup', 'xargs', 'builtin', 'nice'])
const ASSIGNERS = new Set(['export', 'declare', 'typeset', 'local', 'readonly'])
const ASSIGN_RE = /^[A-Za-z_]\w*=/
// Cambian el repo sobre el que actua git sin pasar por `-C`: con ellos el directorio no dice nada.
const GIT_ENV_RE = /^GIT_(DIR|WORK_TREE|INDEX_FILE)=/

// ---- shell: subcomandos, cd y git ----

function skipWrapper(w) {
  const rest = w.slice(1)
  if (w[0].text === 'nice' && rest[0] && rest[0].text === '-n') return rest.slice(2)
  let i = 0
  while (rest[i] && rest[i].text.startsWith('-') && rest[i].text !== '-') i++
  return rest.slice(i)
}

// Quita asignaciones y envoltorios del inicio. gitEnv: una asignacion GIT_* para este comando;
// sticky: una que queda para los siguientes (`export GIT_DIR=...`, o una linea que solo asigna).
function headOf(words) {
  let w = words
  let gitEnv = false
  let sticky = false
  while (w.length) {
    const t = w[0].text
    if (ASSIGN_RE.test(t)) {
      if (GIT_ENV_RE.test(t)) gitEnv = true
      w = w.slice(1)
    } else if (ASSIGNERS.has(t)) {
      if (w.slice(1).some((a) => GIT_ENV_RE.test(a.text))) sticky = true
      return { words: [], gitEnv, sticky }
    } else if (WRAPPERS.has(t)) w = skipWrapper(w)
    else break
  }
  if (!w.length && gitEnv) sticky = true
  return { words: w, gitEnv, sticky }
}

// Recorre las opciones globales de git como git: hasta el primer argumento sin `-`, aplicando cada -C.
function gitInvocation(words, dir) {
  let d = dir
  let i = 1
  for (; i < words.length; i++) {
    const t = words[i].text
    if (t === '-C') {
      const p = words[++i]
      if (!p || p.dynamic) d = null
      else if (p.text !== '' && d !== null) d = resolve(d, p.text)
    } else if (t === '--git-dir' || t === '--work-tree') {
      d = null
      i++
    } else if (t.startsWith('--git-dir=') || t.startsWith('--work-tree=')) d = null
    else if (GIT_OPT_WITH_ARG.has(t)) i++
    else if (!t.startsWith('-')) break
  }
  return { dir: d, sub: words[i] ? words[i].text : '' }
}

function cdStep(words, sub, st, out) {
  st.cdCount++
  const arg = words[1]
  if (st.unknown || sub.subshell || st.cdCount > 1 || !arg || arg.dynamic || arg.text.startsWith('-')) {
    st.unknown = true
    return
  }
  st.dir = resolve(st.dir, arg.text)
  out.cds.push(st.dir)
}

function step(sub, st, out) {
  const { words, gitEnv, sticky } = headOf(sub.words)
  if (sticky) st.sticky = true
  if (!words.length) return
  const here = st.unknown || sub.subshell ? null : st.dir
  out.located.push({ words, dir: here })
  const head = words[0].text
  if (head === 'pushd' || head === 'popd') st.unknown = true
  else if (head === 'cd') cdStep(words, sub, st, out)
  else if (head === 'cat' && here !== null) {
    for (const a of words.slice(1)) {
      if (!a.dynamic && !a.op && !a.text.startsWith('-')) out.cats.push(resolve(here, a.text))
    }
  } else if (head === 'git') out.gits.push(gitInvocation(words, gitEnv || st.sticky ? null : here))
}

// Sigue el directorio como lo haria el shell, en las formas que se resuelven sin ejecutar nada. El
// texto de cada `$(...)`/backtick se recorre aparte: un git ahi adentro existe, pero su directorio no.
function walk(command, cwd) {
  const { subs, inners } = parseShell(command)
  const st = { dir: cwd, unknown: cwd === null, cdCount: 0, sticky: false }
  const out = { gits: [], cds: [], cats: [], located: [] }
  for (const sub of subs) step(sub, st, out)
  for (const inner of inners) {
    for (const g of walk(inner, null).gits) out.gits.push({ dir: null, sub: g.sub })
  }
  return out
}

// Subcomandos con el directorio donde corre cada uno (null si ya no es cierto), sin el cuerpo de los
// heredocs. Base del analisis estatico de escrituras por Bash.
export function commandSubs(command, cwd) {
  return walk(command, cwd).located
}

// El directorio donde corren los `git commit` del comando. null si no hay commit, si alguno no se
// resuelve o si van a repos distintos: con varios, mirar solo el primero dejaba pasar los demas.
export function repoFromCommand(command, cwd) {
  const commits = walk(command, cwd).gits.filter((g) => g.sub === 'commit')
  if (!commits.length || commits.some((c) => c.dir === null)) return null
  const dirs = [...new Set(commits.map((c) => c.dir))]
  return dirs.length === 1 ? dirs[0] : null
}

// Reemplaza la regex `\bgit\s+commit\b`: no casaba `git -C x commit` y si casaba `echo "git commit"`.
export function isGitCommit(command) {
  return walk(command, '/').gits.some((g) => g.sub === 'commit')
}

// ---- evidencia (K2) ----

const uniq = (xs) => [...new Set(xs)]

function safeRealpath(p) {
  try {
    return realpathSync(p)
  } catch {
    return null
  }
}

function underClaude(p, home) {
  const homes = uniq([home, safeRealpath(home)].filter(Boolean))
  return homes.some((h) => p === join(h, '.claude') || p.startsWith(join(h, '.claude') + '/'))
}

const isBrief = (p) => BRIEF_RE.test(p) && !p.endsWith('/INDEX.md')

// Rutas que una llamada toca y briefs que lee. La exclusion de ~/.claude se juzga sobre la ruta tal
// como la escribio la tool: despues de realpath esas rutas son el checkout de spec-driven-standards.
export function evidenceOf(toolName, toolInput, cwd, home) {
  const ti = toolInput || {}
  const abs = (p) => (isAbsolute(p) ? normalize(p) : resolve(cwd, p))
  let paths = []
  let briefs = []
  if (toolName === 'Read' || toolName === 'Edit' || toolName === 'Write' || toolName === 'MultiEdit') {
    if (typeof ti.file_path === 'string') paths = [abs(ti.file_path)]
    briefs = paths.filter(isBrief)
  } else if (toolName === 'NotebookEdit') {
    if (typeof ti.notebook_path === 'string') paths = [abs(ti.notebook_path)]
  } else if (toolName === 'Grep' || toolName === 'Glob') {
    paths = [typeof ti.path === 'string' && ti.path ? abs(ti.path) : cwd]
  } else if (toolName === 'Bash') {
    const { gits, cds, cats } = walk(ti.command, cwd)
    paths = [...gits.map((g) => g.dir).filter(Boolean), ...cds]
    briefs = cats.filter(isBrief)
  }
  const keep = (p) => !underClaude(p, home)
  return { paths: uniq(paths).filter(keep), briefs: uniq(briefs).filter(keep) }
}

// K3: exactamente un repo gana; cero o varios devuelven null y el que llama vuelve al `cwd`.
export function pickRepo(roots) {
  const set = uniq(roots.filter(Boolean))
  return set.length === 1 ? set[0] : null
}

// ---- log por agente, fuera de todo repo (K1) ----

// Los ids llegan por stdin y van a una ruta: sin validarlos, un `../` escribiria fuera del log.
export function logFile(tmp, sessionId, agentId) {
  if (typeof sessionId !== 'string' || typeof agentId !== 'string') return null
  if (!ID_RE.test(sessionId) || !ID_RE.test(agentId)) return null
  return join(tmp, LOG_DIR, sessionId, `${agentId}.jsonl`)
}

// En un /tmp compartido otro usuario podria precrear el directorio, o dejar un symlink a otro lado:
// solo se usa un directorio real (lstat, no sigue el link) y propio.
function isOwnDir(dir) {
  const st = lstatSync(dir)
  return st.isDirectory() && (typeof process.getuid !== 'function' || st.uid === process.getuid())
}

function ownedDir(dir) {
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  return isOwnDir(dir)
}

// Una linea por llamada en un solo append: los hooks corren en paralelo y O_APPEND no intercala.
export function appendEvidence(input, { tmp = tmpdir(), home = homedir() } = {}) {
  const file = logFile(tmp, input.session_id, input.agent_id)
  if (!file) return
  const ev = evidenceOf(input.tool_name, input.tool_input, input.cwd || process.cwd(), home)
  if (!ev.paths.length && !ev.briefs.length) return
  if (!ownedDir(join(tmp, LOG_DIR)) || !ownedDir(dirname(file))) return
  appendFileSync(file, JSON.stringify(ev) + '\n', { mode: 0o600 })
}

function parseLog(text) {
  const paths = []
  const briefs = []
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    try {
      const e = JSON.parse(line)
      if (Array.isArray(e.paths)) paths.push(...e.paths.filter((p) => typeof p === 'string'))
      if (Array.isArray(e.briefs)) briefs.push(...e.briefs.filter((p) => typeof p === 'string'))
    } catch {
      // linea a medio escribir o ajena: no aporta evidencia
    }
  }
  return { paths: uniq(paths), briefs: uniq(briefs) }
}

// null = no hay log, o no se puede leer (permisos, un directorio en su lugar): evidencia ausente (K3),
// nunca un error que tumbe el SubagentStop y pierda el veredicto.
export function readEvidence(sessionId, agentId, { tmp = tmpdir() } = {}) {
  const file = logFile(tmp, sessionId, agentId)
  if (!file) return null
  try {
    return parseLog(readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

export function dropEvidence(sessionId, agentId, { tmp = tmpdir() } = {}) {
  const file = logFile(tmp, sessionId, agentId)
  if (file) rmSync(file, { force: true })
}

// Barre sesiones cuyo directorio no se toca hace mas de maxAgeMs: agentes que murieron sin SubagentStop.
export function sweepOld({ tmp = tmpdir(), maxAgeMs = DAY_MS, now = Date.now() } = {}) {
  const base = join(tmp, LOG_DIR)
  if (!existsSync(base) || !isOwnDir(base)) return
  for (const name of readdirSync(base)) {
    if (!ID_RE.test(name)) continue
    const dir = join(base, name)
    try {
      if (now - lstatSync(dir).mtimeMs > maxAgeMs) rmSync(dir, { recursive: true, force: true })
    } catch {
      // borrado por otro barrido en paralelo
    }
  }
}

// ---- resolucion a repo (IO de git) ----

// Raiz real del arbol que contiene `path`, o null si no esta en un arbol de trabajo (incluido `.git/`).
export function repoRoot(path) {
  let dir = path
  while (dir && !existsSync(dir)) {
    const up = dirname(dir)
    if (up === dir) return null
    dir = up
  }
  try {
    if (!statSync(dir).isDirectory()) dir = dirname(dir)
    const top = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    return top ? realpathSync(top) : null
  } catch {
    return null
  }
}

// Para SubagentStop: el repo donde trabajo el agente y, si leyo exactamente un brief, ese brief.
// repo null = sin evidencia, log ilegible o varios repos: el que llama usa el `cwd` (K3).
export function workOf(input, opts = {}) {
  const ev = readEvidence(input.session_id, input.agent_id, opts)
  if (!ev) return { repo: null, brief: null }
  const repo = pickRepo(ev.paths.map(repoRoot))
  return { repo, brief: ev.briefs.length === 1 ? ev.briefs[0] : null }
}

// Cierre de un subagente: su log se borra y de paso se barren sesiones abandonadas.
export function finishWork(input, opts = {}) {
  try {
    dropEvidence(input.session_id, input.agent_id, opts)
    sweepOld(opts)
  } catch {
    // limpiar es best-effort
  }
}

function readStdin() {
  try {
    return JSON.parse(readFileSync(0, 'utf8'))
  } catch {
    return {}
  }
}

function isEntrypoint() {
  try {
    return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
  } catch {
    return false
  }
}

if (isEntrypoint() && process.argv[2] === 'log') {
  try {
    appendEvidence(readStdin())
  } catch {
    // registrar es best-effort: nunca romper la tool
  }
  process.exit(0)
}

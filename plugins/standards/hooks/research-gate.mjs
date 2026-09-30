#!/usr/bin/env node
// Gate de investigacion: ninguna decision tecnica entra al codigo sin procedencia. Deniega escribir
// codigo cuando el cambio de la rama ya no es "chico" y la rama no trae un Reference Brief aprobado.
// Es la etapa /research hecha cumplir: sin esto, una sesion pasa de la idea al codigo y la etapa
// queda como prosa que nadie esta obligado a seguir.
//
// PreToolUse sobre Write|Edit|MultiEdit|NotebookEdit. Para un archivo de codigo dentro de un repo git:
//   - cambio de la rama (contra su base) + lo que la tool va a escribir <= 20 lineas de codigo y
//     sin tocar manifiestos de dependencias  -> pasa: es el nivel "omitir" de /research.
//   - si no -> exige un brief docs/research/<slug>.md AGREGADO O MODIFICADO en esta rama, con
//     Estado AUTO o APROBADO y lint-brief limpio (incluida la caducidad de Versiones:).
// El brief se ata a la rama por el diff, no por un campo: reusar un brief viejo es tocarlo (anotar
// la reutilizacion), lo que deja rastro en la rama que lo usa.
//
// Falla abierto ante errores de git: romper la edicion de una sesion es peor que un falso negativo.
// Requiere el layout de link.sh (plugins standards y product en el mismo arbol): importa lint-brief
// del skill research. En un plugin suelto el import falla, el hook sale con error y no bloquea.
//
// HACK: solo ve las tools de edicion. Un archivo escrito por Bash (heredoc, sed -i, cp) no pasa por
// aqui. Extender a Bash cuando aparezca un caso real de ese atajo.
// HACK: en la rama por defecto de un repo SIN remoto, la base es HEAD: cada commit reinicia el
// conteo. Los commits ya pasan por review-gate. Contar desde el primer commit propio cuando aparezca
// un repo local-only que lo necesite.
// HACK: confia en el Estado que el brief declara; no verifica que research-verifier lo haya emitido.
// Validar la firma cuando el verificador escriba su veredicto en un archivo propio.

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { lintBrief, readProjectVersions } from '../../product/skills/research/lint-brief.mjs'

export const OMIT_MAX_LINES = 20

const CODE_EXT =
  /\.([cm]?[jt]sx?|py|ipynb|go|rs|rb|php|java|kts?|swift|dart|lua|exs?|c|cc|cpp|h|hpp|cs|scala|sh|bash|zsh|ps1|bat|sql|astro|vue|svelte|html|css|scss|ya?ml|toml|tf)$/i
// Sin extension o con sufijo libre (Dockerfile.prod). HACK: un ejecutable sin extension fuera de esta
// lista (.husky/pre-commit) no se ve; ampliar cuando aparezca uno que importe.
const CODE_NAMES = /^(Dockerfile|Containerfile)(\..+)?$|^(Makefile|Jenkinsfile|Rakefile|Justfile)$/
const DEP_NAMES = /^requirements.*\.txt$|^build\.gradle(\.kts)?$|^settings\.gradle(\.kts)?$/
const DEP_FILES = new Set([
  'bun.lock',
  'npm-shrinkwrap.json',
  'Pipfile',
  'Pipfile.lock',
  '.npmrc',
  'pom.xml',
  'Podfile',
  'Podfile.lock',
  'deno.json',
  'deno.lock',
  'package.json',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lockb',
  'Package.swift',
  'Package.resolved',
  'requirements.txt',
  'pyproject.toml',
  'poetry.lock',
  'uv.lock',
  'go.mod',
  'go.sum',
  'Cargo.toml',
  'Cargo.lock',
  'Gemfile',
  'Gemfile.lock',
  'composer.json',
  'composer.lock',
])
const RESEARCH_DIR = 'docs/research/'
const EDIT_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit'])

const basename = (path) => path.split(/[\\/]/).pop()
const isCode = (path) => CODE_EXT.test(path) || CODE_NAMES.test(basename(path))
const isDepFile = (path) => DEP_FILES.has(basename(path)) || DEP_NAMES.test(basename(path))
const toPosix = (p) => p.split(sep).join('/')

// true si escribir en absPath cae bajo el gate.
export function isGatedPath(absPath, repoRoot, home) {
  if (absPath.startsWith(join(home, '.claude') + sep)) return false
  if (!isCode(absPath) && !isDepFile(absPath)) return false
  const rel = toPosix(relative(repoRoot, absPath))
  return !(rel.startsWith(RESEARCH_DIR) && rel.endsWith('.md'))
}

// Listas de git con -z: sin comillas para nombres no ASCII y sin ambiguedad con saltos de linea.
export function splitZ(text) {
  return String(text).split('\0').filter(Boolean)
}

// `git diff --numstat -z`: "add\tdel\tpath\0", o en un renombre "add\tdel\t\0viejo\0nuevo\0".
export function parseNumstatZ(text) {
  const parts = String(text).split('\0')
  const rows = []
  for (let i = 0; i < parts.length; i++) {
    if (!parts[i]) continue
    // Solo los dos primeros tabs separan campos: el nombre puede traer tabs propios.
    const m = parts[i].match(/^([^\t]*)\t([^\t]*)\t([\s\S]*)$/)
    if (!m) continue
    const [, add, del, file] = m
    const path = file === '' ? parts[(i += 2)] : file
    if (path === undefined) break
    if (add === '-') rows.push({ add: 0, del: 0, file: path, binary: true })
    else rows.push({ add: Number(add), del: Number(del), file: path })
  }
  return rows
}

// Lineas agregadas + borradas de archivos de codigo.
export function countNumstat(rows) {
  return rows.reduce((n, r) => (r.binary || !isCode(r.file) ? n : n + r.add + r.del), 0)
}

export function touchesDependencies(files) {
  return files.some(isDepFile)
}

// Lineas reales: un salto de linea final no abre una linea nueva.
export function countLines(s) {
  if (typeof s !== 'string' || !s.length) return 0
  return s.split('\n').length - (s.endsWith('\n') ? 1 : 0)
}

// Lineas que la tool esta a punto de escribir.
export function proposedLines(toolName, input) {
  if (!input) return 0
  if (toolName === 'Write') return countLines(input.content)
  if (toolName === 'Edit') return countLines(input.new_string)
  if (toolName === 'MultiEdit') return (input.edits || []).reduce((n, e) => n + countLines(e.new_string), 0)
  if (toolName === 'NotebookEdit') return countLines(input.new_source)
  return 0
}

// { ok, reason } de un brief: Estado habilitante y lint limpio contra las versiones del proyecto.
export function briefVerdict(md, projectVersions) {
  const estado = (String(md).match(/Estado:\s*([A-Z]+)/) || [])[1] || '?'
  if (estado !== 'AUTO' && estado !== 'APROBADO') return { ok: false, reason: `Estado ${estado}` }
  const lint = lintBrief(md, projectVersions)
  if (!lint.ok) {
    const first = lint.errors.slice(0, 3).map((e) => `${e.rule} ${e.message}`).join('; ')
    return { ok: false, reason: `no pasa lint-brief (${lint.errors.length} errores: ${first})` }
  }
  return { ok: true, reason: '' }
}

// Decision final. briefs = [{ path, ok, reason }] de los briefs que la rama agrego o modifico.
export function evaluateEdit({ changedLines, proposed, depsTouched, briefs }) {
  const total = changedLines + proposed
  if (total <= OMIT_MAX_LINES && !depsTouched) return { allow: true, reason: '' }
  if (briefs.some((b) => b.ok)) return { allow: true, reason: '' }

  const why = depsTouched
    ? 'la rama cambia dependencias (manifiesto o lockfile)'
    : `el cambio de la rama llega a ${total} lineas de codigo (el nivel "omitir" de /research es hasta ${OMIT_MAX_LINES})`
  const parts = [`Edicion bloqueada por research-gate: ${why} y la rama no trae un Reference Brief aprobado.`]
  if (briefs.length) parts.push(`Briefs en la rama que no habilitan: ${briefs.map((b) => `${b.path}: ${b.reason}`).join('; ')}.`)
  parts.push(
    'Corre /research antes de seguir: escribe docs/research/<slug>.md, pasa lint-brief y research-verifier, y deja Estado AUTO (o APROBADO por Karen si escala).',
    'Si un brief existente ya cubre la pregunta, reusalo anotando la reutilizacion en el brief dentro de esta rama.',
  )
  return { allow: false, reason: parts.join(' ') }
}

// ---- IO: git y archivos, aislada para que lo de arriba se pruebe puro ----

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 })
}

function nearestDir(path) {
  let dir = dirname(path)
  while (!existsSync(dir)) {
    const up = dirname(dir)
    if (up === dir) return null
    dir = up
  }
  return dir
}

const DEFAULT_REFS = ['origin/HEAD', 'origin/main', 'origin/master', 'main', 'master']

// La base de la rama: donde se separo de la rama por defecto, NUNCA su upstream (empujar la rama
// reiniciaria el conteo). En la rama por defecto misma, su upstream: cuenta lo no publicado.
function branchBase(root) {
  const branch = git(root, ['rev-parse', '--abbrev-ref', 'HEAD']).trim()
  let defaultBranch = ''
  try {
    defaultBranch = git(root, ['rev-parse', '--abbrev-ref', 'origin/HEAD']).trim().replace(/^origin\//, '')
  } catch {
    defaultBranch = ''
  }
  const onDefault = branch === defaultBranch || (!defaultBranch && (branch === 'main' || branch === 'master'))
  const refs = onDefault ? ['@{upstream}', ...DEFAULT_REFS] : DEFAULT_REFS
  for (const ref of refs) {
    try {
      return git(root, ['merge-base', 'HEAD', ref]).trim()
    } catch {
      // ref inexistente: probar la siguiente
    }
  }
  return git(root, ['rev-parse', 'HEAD']).trim()
}

function untrackedFiles(root) {
  return splitZ(git(root, ['ls-files', '-z', '--others', '--exclude-standard']))
}

// Para en cuanto se pasa del umbral: la respuesta ya es "hace falta brief", y leer un arbol sin
// trackear enorme en cada edicion es latencia pura.
function untrackedLines(root, files, budget) {
  let total = 0
  for (const f of files) {
    if (total > budget) break
    if (!isCode(f)) continue
    try {
      total += countLines(readFileSync(join(root, f), 'utf8'))
    } catch {
      // borrado entre el listado y la lectura
    }
  }
  return total
}

function branchBriefs(root, changed) {
  const versions = readProjectVersions(root)
  return changed
    .filter((f) => f.startsWith(RESEARCH_DIR) && f.endsWith('.md') && !f.endsWith('/INDEX.md'))
    .map((path) => {
      try {
        return { path, ...briefVerdict(readFileSync(join(root, path), 'utf8'), versions) }
      } catch {
        return { path, ok: false, reason: 'no se pudo leer' }
      }
    })
}

export function decide(input, home = realHome()) {
  if (!EDIT_TOOLS.has(input.tool_name)) return null
  const ti = input.tool_input || {}
  const raw = ti.file_path || ti.notebook_path
  if (typeof raw !== 'string' || !raw) return null
  const target = isAbsolute(raw) ? raw : resolve(input.cwd || process.cwd(), raw)

  const dir = nearestDir(target)
  if (!dir) return null
  let root
  try {
    root = realpathSync(git(dir, ['rev-parse', '--show-toplevel']).trim())
  } catch {
    return null // fuera de un repo git
  }
  const real = resolve(realpathSync(dir), relative(dir, target))
  if (!isGatedPath(real, root, home)) return null

  const base = branchBase(root)
  // --no-renames: un renombre se cuenta como borrado + alta, asi una edicion grande no se esconde.
  const rows = parseNumstatZ(git(root, ['diff', '--numstat', '-z', '--no-renames', base]))
  const untracked = untrackedFiles(root)
  const changed = [...rows.map((r) => r.file), ...untracked]
  const committed = countNumstat(rows)

  return evaluateEdit({
    changedLines: committed + untrackedLines(root, untracked, OMIT_MAX_LINES - committed),
    proposed: proposedLines(input.tool_name, ti),
    depsTouched: touchesDependencies(changed) || isDepFile(real),
    briefs: branchBriefs(root, changed),
  })
}

// El exento de ~/.claude se compara contra rutas reales: el HOME tambien, por si es un symlink.
function realHome() {
  const home = process.env.HOME || homedir()
  try {
    return realpathSync(home)
  } catch {
    return home
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
  let result = null
  try {
    result = decide(readStdin())
  } catch {
    result = null // git inesperado: falla abierto
  }
  if (result && !result.allow) {
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

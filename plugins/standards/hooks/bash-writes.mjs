#!/usr/bin/env node
// research-gate para escrituras hechas por Bash o PowerShell (brief docs/research/gate-escrituras-bash.md).
// research-gate solo veia las tools de edicion; el 2026-10-01 un agente puso briefs en APROBADO con
// python por Bash y otro edito un .swift con sed justo despues de que le denegaran un Write.
//
// Dos capas, correlacionadas por tool_use_id:
//   pre           PreToolUse: analisis estatico de alta confianza (redireccion, tee, sed/perl -i,
//                 cp/mv/install/rsync/dd, interpretes con API de escritura y ruta literal). Niega lo que
//                 un Write igual negaria. Si deja pasar, guarda un snapshot por repo en su git-dir.
//   post          PostToolUse: compara contra el snapshot y ve el efecto real, se haya escrito como sea.
//   post-failure  PostToolUseFailure: lo mismo; un comando que sale != 0 no dispara PostToolUse.
// Al detectar algo DETIENE Y AVISA (`continue: false` + motivo), sin revertir nada (D2 de Karen).
//
// Falla abierto ante errores, como research-gate: romper la sesion es peor que un falso negativo.
// HACK: un hook no es frontera de seguridad. Quedan fuera las escrituras de un proceso en segundo
// plano (run_in_background), las de otra sesion, `eval`/base64, y los scripts que construyen la ruta.
// La capa posterior cubre la mayoria; el cierre real es el sandbox con denyWrite: activarlo cuando
// aparezca una escritura por estas vias que el diff posterior no vea.
// HACK (D6 de Karen): research no se exige tambien en `git commit`; si una escritura escapa a las dos
// capas y se commitea, solo review-gate la ve. Agregar el chequeo en commit cuando pase.
// HACK: atribucion por tool_use_id, pero el diff es del arbol entero: dos llamadas en paralelo sobre el
// mismo repo se atribuyen el efecto de la otra. Separar por proceso cuando un falso aviso salga de ahi.
// HACK: en interpretes la ruta literal se busca en todo el texto del comando, no solo en el argumento
// de la llamada de escritura; un script que lee src/x.ts y escribe en /tmp se niega sobre el umbral.
// Parsear el script por lenguaje cuando ese falso positivo frene trabajo real.
// HACK: un snapshot ausente o editado no decide nada (lo pide el brief): el agente puede borrarlo. Y
// `escribir && git commit --amend` no pasa por el diff porque el HEAD previo deja de ser ancestro;
// review-gate si ve ese commit. Mover el snapshot fuera del alcance del agente y comparar contra el
// arbol de snap.head si aparece un caso real.
// HACK: con PowerShell la capa estatica solo reconoce las formas POSIX (`>`, `sed -i`...); Set-Content
// y Out-File los ve solo el diff posterior. Agregar sus cmdlets si la tool se habilita en esta maquina.

import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  OMIT_MAX_LINES,
  branchContext,
  estadoOf,
  evaluateEdit,
  isBriefPath,
  isDepFile,
  isGatedPath,
  realHome,
} from './research-gate.mjs'
import { commandSubs, evidenceOf, repoRoot } from './work-repo.mjs'

const SHELL_TOOLS = new Set(['Bash', 'PowerShell'])
const ID_RE = /^[A-Za-z0-9_-]+$/
const SNAP_DIR = 'claude-bash-snap'
const INTERPRETERS = new Set(['python', 'python3', 'node', 'ruby', 'deno', 'bun', 'perl'])
const WRITE_API =
  /open\([^)]*,\s*['"][wax]b?\+?['"]|\.write_(text|bytes)\(|writeFileSync|appendFileSync|writeFile\(|appendFile\(|createWriteStream|File\.(write|open)|IO\.write/
// Un literal con extension: 'src/a.ts', "x.md". Sin comodines: un glob no es un destino concreto.
const PATH_LITERAL = /(['"])([^'"\s*?[\]]+\.[A-Za-z0-9]{1,8})\1/g
const REDIRECT = /^(\d*|&)?(>\||>>?)(.*)$/
// HACK: tope de lineas no trackeadas que lee cada snapshot, para quedar lejos del timeout de 15 s (un
// timeout falla abierto). Pasado el tope, crecer no se ve. Subirlo o contar por bytes si aparece un
// repo con mas codigo sin trackear que esto.
const SNAP_BUDGET = 50_000
// Los commits llevan hora en segundos y el snapshot en milisegundos.
const CLOCK_SLACK_MS = 2_000

// ---- capa estatica (pura) ----

const optionsWithArg = { install: new Set(['-m', '-o', '-g', '-t']), cp: new Set(['-t']), mv: new Set(['-t']), rsync: new Set() }

function nonOptions(words, withArg = new Set()) {
  const out = []
  for (let i = 0; i < words.length; i++) {
    const t = words[i].text
    if (withArg.has(t)) {
      i++
      continue
    }
    if (t.startsWith('-') && t !== '-') continue
    out.push(words[i])
  }
  return out
}

function sedFiles(args) {
  let inPlace = false
  let script = false
  const rest = []
  for (let i = 0; i < args.length; i++) {
    const t = args[i].text
    // -i, -i.bak, y combinado con otras flags cortas (-Ei, -ri): todas son edicion en el lugar.
    if (/^-[A-Za-z]*i/.test(t) || t.startsWith('--in-place')) {
      inPlace = true
      if (t.endsWith('i') && args[i + 1] && args[i + 1].text === '') i++ // BSD: `sed -i '' ...`
      continue
    }
    if (t === '-e' || t === '-f' || t === '--expression' || t === '--file') {
      script = true
      i++
      continue
    }
    if (t.startsWith('-')) continue
    rest.push(args[i])
  }
  if (!inPlace) return []
  return script ? rest : rest.slice(1)
}

function perlFiles(args) {
  let inPlace = false
  const rest = []
  for (let i = 0; i < args.length; i++) {
    const t = args[i].text
    if (/^-[A-Za-z]*i/.test(t)) inPlace = true
    if (t.startsWith('-')) {
      if (/^-[A-Za-z]*e$/.test(t)) i++ // -e / -pe / -ne consumen el script
      continue
    }
    rest.push(args[i])
  }
  return inPlace ? rest : []
}

// cp/mv/install/rsync: el destino es el ultimo argumento, o el directorio de -t. Si el destino es un
// directorio (-t, o termina en /), lo que se escribe es cada fuente dentro de el.
function copyTargets(head, args) {
  const t = args.findIndex((a) => a.text === '-t')
  const files = nonOptions(args, optionsWithArg[head])
  let dest = null
  let sources = []
  if (t !== -1 && args[t + 1]) {
    dest = args[t + 1]
    sources = files
  } else if (files.length >= 2) {
    dest = files[files.length - 1]
    sources = files.slice(0, -1)
  }
  if (!dest) return []
  // rsync con `src/` copia el contenido, no la carpeta: su destino se mira como directorio entero.
  const intoDir = head !== 'rsync' && (t !== -1 || dest.text.endsWith('/'))
  if (!intoDir) return [dest]
  return sources.map((s) => ({ text: join(dest.text, s.text.split('/').filter(Boolean).pop() || ''), dynamic: dest.dynamic || s.dynamic }))
}

function redirectTargets(words) {
  const out = []
  for (let i = 0; i < words.length; i++) {
    if (!words[i].op) continue // un `>` entre comillas es texto, no redireccion
    const m = REDIRECT.exec(words[i].text)
    if (!m) continue
    if (m[3].startsWith('&')) continue // 2>&1: duplica un descriptor, no escribe archivo
    const target = m[3] !== '' ? words[i] : words[i + 1]
    if (!target) continue
    out.push(m[3] !== '' ? { text: m[3], dynamic: target.dynamic } : target)
    if (m[3] === '') i++
  }
  return out
}

// Destinos de escritura de alta confianza, resueltos contra el directorio de cada subcomando.
export function bashWriteTargets(command, cwd) {
  const raw = String(command ?? '')
  const targets = []
  let interpreter = false
  for (const { words, dir } of commandSubs(raw, cwd)) {
    if (dir === null) continue
    const head = words[0].text
    const args = words.slice(1)
    let hits = redirectTargets(words)
    if (head === 'tee') hits = hits.concat(nonOptions(args))
    else if (head === 'sed') hits = hits.concat(sedFiles(args))
    else if (head === 'perl' && args.some((a) => /^-[A-Za-z]*i/.test(a.text))) hits = hits.concat(perlFiles(args))
    else if (head === 'cp' || head === 'mv' || head === 'install' || head === 'rsync') hits = hits.concat(copyTargets(head, args))
    else if (head === 'dd') {
      for (const a of args) if (a.text.startsWith('of=')) hits.push({ text: a.text.slice(3), dynamic: a.dynamic })
    } else if (INTERPRETERS.has(head) && WRITE_API.test(raw)) {
      // El codigo del interprete puede venir en un heredoc, que commandSubs ya quito: se mira el texto crudo.
      interpreter = true
      for (const m of raw.matchAll(PATH_LITERAL)) hits.push({ text: m[2], dynamic: false })
    }
    for (const h of hits) {
      if (h.dynamic || !h.text || h.text.startsWith('/dev/')) continue
      targets.push(resolve(dir, h.text))
    }
  }
  return { targets: [...new Set(targets)], interpreter, mentionsAprobado: /APROBADO/.test(raw) }
}

// ---- IO ----

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 })
}

function realTarget(target) {
  let dir = dirname(target)
  while (!existsSync(dir)) {
    const up = dirname(dir)
    if (up === dir) return target
    dir = up
  }
  return resolve(realpathSync(dir), relative(dir, target))
}

// Lo que git ignora (build/, dist/) no entra a la rama: escribir ahi no es codigo de la rama.
function isIgnored(root, real) {
  try {
    execFileSync('git', ['check-ignore', '-q', '--', relative(root, real)], { cwd: root, stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

const APROBADO_REASON =
  'research-gate (Bash): Estado: APROBADO es la aprobacion MANUAL de Karen. Un agente no la pone por ' +
  'Bash ni por una tool de edicion; Karen la aplica con `! sed`. Deja el brief en AUTO para que ' +
  'research-verifier lo firme, o pidele a Karen que apruebe si escala.'

export function decidePre(input, home = realHome()) {
  const command = input.tool_input && input.tool_input.command
  const cwd = input.cwd || process.cwd()
  const { targets, mentionsAprobado } = bashWriteTargets(command, cwd)
  for (const target of targets) {
    const root = repoRoot(target)
    if (!root) continue
    const real = realTarget(target)
    if (isBriefPath(real, root)) {
      let current = ''
      try {
        current = readFileSync(real, 'utf8')
      } catch {
        current = ''
      }
      if (mentionsAprobado && estadoOf(current) !== 'APROBADO') return { allow: false, reason: APROBADO_REASON }
      continue
    }
    if (!isGatedPath(real, root, home) || isIgnored(root, real)) continue
    const ctx = branchContext(root)
    const r = evaluateEdit({ ...ctx, proposed: 0, depsTouched: ctx.depsTouched || isDepFile(real) })
    if (!r.allow) return { allow: false, reason: `research-gate (Bash): este comando escribe ${relative(root, real)}. ${r.reason}` }
  }
  return { allow: true, reason: '' }
}

// Repos que un comando puede tocar: el del cwd, los de sus `cd`/`git -C` y los de sus destinos.
function reposOf(input) {
  const cwd = input.cwd || process.cwd()
  const command = input.tool_input && input.tool_input.command
  const { paths } = evidenceOf('Bash', { command }, cwd, realHome())
  const { targets } = bashWriteTargets(command, cwd)
  return [...new Set([cwd, ...paths, ...targets].map(repoRoot).filter(Boolean))]
}

function snapFile(root, id) {
  if (typeof id !== 'string' || !ID_RE.test(id)) return null
  return join(git(root, ['rev-parse', '--absolute-git-dir']).trim(), SNAP_DIR, `${id}.json`)
}

function briefEstados(root) {
  const out = {}
  const files = git(root, ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', 'docs/research'])
    .split('\0')
    .filter(Boolean)
  for (const rel of files) {
    if (!isBriefPath(join(root, rel), root)) continue
    try {
      out[rel] = estadoOf(readFileSync(join(root, rel), 'utf8'))
    } catch {
      // borrado entre el listado y la lectura
    }
  }
  return out
}

function snapshot(root) {
  const ctx = branchContext(root, SNAP_BUDGET)
  const refs = git(root, ['for-each-ref', '--format=%(objectname)', 'refs/heads', 'refs/remotes']).split('\n').filter(Boolean)
  let head = ''
  try {
    head = git(root, ['rev-parse', 'HEAD']).trim()
  } catch {
    head = '' // repo sin commits
  }
  return {
    ts: Date.now(),
    head,
    refs: [...new Set([head, ...refs].filter(Boolean))],
    lines: ctx.changedLines,
    deps: ctx.depsTouched,
    estados: briefEstados(root),
  }
}

// Un PostToolUse que nunca llega (run_in_background, sesion cortada) deja su snapshot: se barren los viejos.
function sweepSnapshots(dir, maxAgeMs = 24 * 3600 * 1000) {
  for (const name of readdirSync(dir)) {
    try {
      if (Date.now() - statSync(join(dir, name)).mtimeMs > maxAgeMs) rmSync(join(dir, name), { force: true })
    } catch {
      // borrado en paralelo por otro hook
    }
  }
}

function writeSnapshots(input) {
  for (const root of reposOf(input)) {
    const file = snapFile(root, input.tool_use_id)
    if (!file) return
    mkdirSync(dirname(file), { recursive: true })
    sweepSnapshots(dirname(file))
    const tmp = `${file}.${process.pid}.tmp`
    writeFileSync(tmp, JSON.stringify(snapshot(root)))
    renameSync(tmp, file)
  }
}

// Un brief que vuelve a un contenido que ya existia en algun commit (checkout de otra rama, stash) no
// es un APROBADO puesto por el agente: es historia que Karen ya habia aprobado.
function existedBefore(root, rel, refs) {
  if (!refs.length) return false
  try {
    const blob = git(root, ['hash-object', '--', rel]).trim()
    return git(root, ['log', '-1', '--format=%H', `--find-object=${blob}`, ...refs]).trim() !== ''
  } catch {
    return false
  }
}

// HEAD se movio solo por commits creados durante este comando, encima del HEAD anterior y sin merges:
// es `escribir && git commit`, que tiene que pasar por el diff (si no, la escritura escapaba). Checkout,
// rebase, merge y un fast-forward a commits que ya existian cambian el arbol sin ser escritura del agente.
function onlyOwnCommits(root, snap) {
  if (!snap.head) return false
  try {
    git(root, ['merge-base', '--is-ancestor', snap.head, 'HEAD'])
    const rows = git(root, ['log', '--format=%P %ct', `${snap.head}..HEAD`]).split('\n').filter(Boolean)
    return (
      rows.length > 0 &&
      rows.every((row) => {
        const parts = row.split(' ')
        const ct = Number(parts.pop())
        return parts.length === 1 && ct * 1000 >= snap.ts - CLOCK_SLACK_MS
      })
    )
  } catch {
    return false
  }
}

export function decidePost(input) {
  const reasons = []
  for (const root of reposOf(input)) {
    const file = snapFile(root, input.tool_use_id)
    if (!file || !existsSync(file)) continue
    let snap
    try {
      snap = JSON.parse(readFileSync(file, 'utf8'))
    } finally {
      rmSync(file, { force: true })
    }
    const flipped = Object.entries(briefEstados(root))
      .filter(([rel, estado]) => estado === 'APROBADO' && snap.estados[rel] !== 'APROBADO')
      .filter(([rel]) => !existedBefore(root, rel, snap.refs))
      .map(([rel]) => rel)
    if (flipped.length) {
      reasons.push(
        `research-gate (Bash): el comando paso a Estado: APROBADO ${flipped.join(', ')} en ${root}. ` +
          'Es la aprobacion manual de Karen: no se revierte solo. Devuelve esos briefs a su Estado anterior y avisale.',
      )
    }
    let head = ''
    try {
      head = git(root, ['rev-parse', 'HEAD']).trim()
    } catch {
      head = ''
    }
    if (head !== snap.head && !onlyOwnCommits(root, snap)) continue
    const ctx = branchContext(root, SNAP_BUDGET)
    const grew = ctx.changedLines > snap.lines || (ctx.depsTouched && !snap.deps)
    const r = evaluateEdit({ ...ctx, proposed: 0 })
    if (grew && !r.allow) {
      reasons.push(
        `research-gate (Bash): el comando escribio codigo en ${root} (la rama paso de ${snap.lines} a ` +
          `${ctx.changedLines} lineas; el umbral es ${OMIT_MAX_LINES}). ${r.reason} No se revirtio nada.`,
      )
    }
  }
  return reasons.join('\n')
}

function readStdin() {
  try {
    return JSON.parse(readFileSync(0, 'utf8'))
  } catch {
    return {}
  }
}

function emit(obj) {
  process.stdout.write(JSON.stringify(obj))
}

function main() {
  const mode = process.argv[2]
  const input = readStdin()
  try {
    if (!SHELL_TOOLS.has(input.tool_name) || typeof (input.tool_input && input.tool_input.command) !== 'string') return
    if (mode === 'pre') {
      const d = decidePre(input)
      if (!d.allow) {
        emit({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: d.reason } })
        return
      }
      writeSnapshots(input)
      return
    }
    const reason = decidePost(input)
    if (!reason) return
    if (mode === 'post') emit({ decision: 'block', reason, continue: false, stopReason: reason })
    else if (mode === 'post-failure') {
      emit({ continue: false, stopReason: reason, hookSpecificOutput: { hookEventName: 'PostToolUseFailure', additionalContext: reason } })
    }
  } catch {
    // falla abierto, como research-gate
  }
}

function isEntrypoint() {
  try {
    return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
  } catch {
    return false
  }
}

if (isEntrypoint()) {
  main()
  process.exit(0)
}

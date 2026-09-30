import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync, execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, appendFileSync, rmSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { brief } from '../../product/skills/research/brief-fixture.mjs'
import {
  OMIT_MAX_LINES,
  isGatedPath,
  countLines,
  parseNumstatZ,
  splitZ,
  countNumstat,
  touchesDependencies,
  proposedLines,
  briefVerdict,
  evaluateEdit,
} from './research-gate.mjs'

const HOOK = join(dirname(fileURLToPath(import.meta.url)), 'research-gate.mjs')
const HOME = '/Users/k'
const AUTO = { versiones: 'x=1', estado: 'AUTO', verificador: 'research-verifier 2026-09-30 AUTO' }

// ---- logica pura ----

test('isGatedPath: codigo dentro del repo si; el brief, docs y ~/.claude no', () => {
  assert.equal(isGatedPath('/r/src/a.ts', '/r', HOME), true)
  assert.equal(isGatedPath('/r/docs/research/x.md', '/r', HOME), false)
  assert.equal(isGatedPath('/r/docs/research/INDEX.md', '/r', HOME), false)
  assert.equal(isGatedPath('/r/README.md', '/r', HOME), false)
  assert.equal(isGatedPath('/r/data.json', '/r', HOME), false)
  assert.equal(isGatedPath(`${HOME}/.claude/hooks/x.mjs`, `${HOME}/.claude`, HOME), false)
})

test('isGatedPath: un .ts dentro de una carpeta research no es un brief', () => {
  assert.equal(isGatedPath('/r/src/research/a.ts', '/r', HOME), true)
  assert.equal(isGatedPath('/r/docs/research/tool.ts', '/r', HOME), true)
})

test('isGatedPath: los manifiestos de dependencias tambien pasan por el gate', () => {
  assert.equal(isGatedPath('/r/package.json', '/r', HOME), true)
  assert.equal(isGatedPath('/r/apps/web/pnpm-lock.yaml', '/r', HOME), true)
  assert.equal(isGatedPath('/r/Cargo.toml', '/r', HOME), true)
})

test('isGatedPath: extensiones que antes se escapaban', () => {
  for (const f of ['a.cjs', 'a.cts', 'n.ipynb', 'i.html', '.github/workflows/ci.yml', 'c.yaml', 'm.dart', 'x.lua', 'Dockerfile']) {
    assert.equal(isGatedPath(`/r/${f}`, '/r', HOME), true, f)
  }
})

test('isGatedPath: shells, JVM, IaC y nombres sin extension conocidos (ronda 3)', () => {
  const gated = ['b.kts', 's.zsh', 's.bash', 'p.ps1', 'w.bat', 'c.toml', 'main.tf', 'Dockerfile.prod', 'Containerfile', 'Jenkinsfile', 'Rakefile', 'Justfile']
  for (const f of gated) assert.equal(isGatedPath(`/r/${f}`, '/r', HOME), true, f)
})

test('touchesDependencies: variantes de manifiestos y config de registro', () => {
  const deps = ['requirements-dev.txt', 'bun.lock', 'npm-shrinkwrap.json', 'Pipfile', 'Pipfile.lock', '.npmrc', 'pom.xml', 'build.gradle', 'build.gradle.kts', 'Podfile', 'Podfile.lock', 'deno.json', 'deno.lock']
  for (const f of deps) {
    assert.equal(touchesDependencies([`x/${f}`]), true, f)
    assert.equal(isGatedPath(`/r/${f}`, '/r', HOME), true, f)
  }
})

test('parseNumstatZ conserva un tab dentro del nombre', () => {
  assert.deepEqual(parseNumstatZ('500\t0\tx.txt\t.js\u0000'), [{ add: 500, del: 0, file: 'x.txt\t.js' }])
})

test('countLines no cuenta el salto de linea final como una linea mas', () => {
  assert.equal(countLines('a\nb'), 2)
  assert.equal(countLines('a\nb\n'), 2)
  assert.equal(countLines(''), 0)
  assert.equal(countLines(undefined), 0)
})

test('parseNumstatZ y splitZ leen nombres no ASCII, renombres y binarios', () => {
  const z = '3\t1\tcafé.ts\u00002\t0\t\u0000old.ts\u0000nuevo.ts\u0000-\t-\timg.png\u0000'
  assert.deepEqual(parseNumstatZ(z), [
    { add: 3, del: 1, file: 'café.ts' },
    { add: 2, del: 0, file: 'nuevo.ts' },
    { add: 0, del: 0, file: 'img.png', binary: true },
  ])
  assert.deepEqual(splitZ('a.ts\u0000café.ts\u0000'), ['a.ts', 'café.ts'])
})

test('countNumstat suma agregadas + borradas de codigo e ignora binarios y docs', () => {
  const rows = parseNumstatZ('10\t10\tsrc/a.ts\u0000100\t0\tREADME.md\u0000-\t-\timg.png\u00001\t1\tlib/b.py\u0000')
  assert.equal(countNumstat(rows), 22)
})

test('touchesDependencies detecta manifiestos y lockfiles en cualquier carpeta', () => {
  assert.equal(touchesDependencies(['src/a.ts']), false)
  assert.equal(touchesDependencies(['package.json']), true)
  assert.equal(touchesDependencies(['apps/web/package-lock.json']), true)
  assert.equal(touchesDependencies(['Package.swift']), true)
})

test('proposedLines cuenta lo que la tool va a escribir', () => {
  assert.equal(proposedLines('Write', { content: 'a\nb\nc\n' }), 3)
  assert.equal(proposedLines('Edit', { old_string: 'x', new_string: 'a\nb' }), 2)
  assert.equal(proposedLines('MultiEdit', { edits: [{ new_string: 'a' }, { new_string: 'b\nc' }] }), 3)
  assert.equal(proposedLines('NotebookEdit', { new_source: 'print(1)' }), 1)
  assert.equal(proposedLines('Write', {}), 0)
})

test('briefVerdict: solo AUTO o APROBADO con lint limpio habilita', () => {
  assert.equal(briefVerdict(brief(AUTO), { x: '1' }).ok, true)
  assert.equal(briefVerdict(brief({ ...AUTO, estado: 'APROBADO', verificador: 'research-verifier 2026-09-30 ESCALATE' }), { x: '1' }).ok, true)
  assert.equal(briefVerdict(brief({ versiones: 'x=1' }), { x: '1' }).ok, false)
  assert.equal(briefVerdict(brief({ ...AUTO, estado: 'ESCALADO', verificador: 'research-verifier 2026-09-30 ESCALATE' }), { x: '1' }).ok, false)
})

test('briefVerdict: un brief AUTO que no pasa el linter no habilita', () => {
  const r = briefVerdict(brief({ ...AUTO, bodies: { 3: 'sin marca' } }), { x: '1' })
  assert.equal(r.ok, false)
  assert.match(r.reason, /lint/i)
})

test('briefVerdict: caduca si la version del proyecto cambio', () => {
  assert.equal(briefVerdict(brief(AUTO), { x: '2' }).ok, false)
})

test('evaluateEdit: el umbral es inclusivo en 20', () => {
  assert.equal(evaluateEdit({ changedLines: 10, proposed: OMIT_MAX_LINES - 10, depsTouched: false, briefs: [] }).allow, true)
  const r = evaluateEdit({ changedLines: 15, proposed: 6, depsTouched: false, briefs: [] })
  assert.equal(r.allow, false)
  assert.match(r.reason, /\/research/)
  assert.match(r.reason, /21/)
})

test('evaluateEdit: tocar dependencias exige brief aunque el cambio sea chico', () => {
  const r = evaluateEdit({ changedLines: 1, proposed: 1, depsTouched: true, briefs: [] })
  assert.equal(r.allow, false)
  assert.match(r.reason, /dependencias/i)
})

test('evaluateEdit: un brief aprobado habilita; uno en borrador no, y se nombra', () => {
  const big = { changedLines: 500, proposed: 10, depsTouched: true }
  assert.equal(evaluateEdit({ ...big, briefs: [{ path: 'docs/research/a.md', ok: true }] }).allow, true)
  const r = evaluateEdit({ ...big, briefs: [{ path: 'docs/research/a.md', ok: false, reason: 'Estado BORRADOR' }] })
  assert.equal(r.allow, false)
  assert.match(r.reason, /docs\/research\/a\.md: Estado BORRADOR/)
})

// ---- integracion: el CLI sobre repos git reales, uno por caso ----

const temps = []
after(() => {
  for (const d of temps) rmSync(d, { recursive: true, force: true })
})

function tmp(prefix) {
  const d = realpathSync(mkdtempSync(join(tmpdir(), prefix)))
  temps.push(d)
  return d
}

const g = (cwd, ...args) => execFileSync('git', args, { cwd, stdio: 'ignore' })

// Repo con main commiteado y una rama feat/x recien creada.
function makeRepo({ branch = 'feat/x', origin = false } = {}) {
  const repo = tmp('research-gate-')
  g(repo, 'init', '-q', '-b', 'main')
  g(repo, 'config', 'user.email', 't@t')
  g(repo, 'config', 'user.name', 't')
  writeFileSync(join(repo, 'package.json'), JSON.stringify({ devDependencies: { x: '1' } }))
  mkdirSync(join(repo, 'src'))
  writeFileSync(join(repo, 'src/a.ts'), 'export const a = 1\n')
  g(repo, 'add', '.')
  g(repo, 'commit', '-q', '-m', 'init')
  if (origin) {
    const bare = tmp('research-gate-origin-')
    g(bare, 'init', '-q', '--bare', '-b', 'main')
    g(repo, 'remote', 'add', 'origin', bare)
    g(repo, 'push', '-q', '-u', 'origin', 'main')
    g(repo, 'remote', 'set-head', 'origin', 'main')
  }
  if (branch !== 'main') g(repo, 'checkout', '-q', '-b', branch)
  return repo
}

function hook(payload, env = {}) {
  const r = spawnSync('node', [HOOK], { input: payload, encoding: 'utf8', env: { ...process.env, ...env } })
  assert.equal(r.status, 0, `el hook salio con ${r.status}: ${r.stderr}`)
  return r.stdout
}

function run(cwd, tool_name, tool_input, env) {
  const out = hook(JSON.stringify({ tool_name, tool_input, cwd }), env)
  return out ? JSON.parse(out).hookSpecificOutput.permissionDecision : 'allow'
}

const lines = (n) => Array.from({ length: n }, (_, i) => `export const v${i} = ${i}`).join('\n')
const writeBrief = (repo, opts = AUTO) => {
  mkdirSync(join(repo, 'docs/research'), { recursive: true })
  writeFileSync(join(repo, 'docs/research/demo.md'), brief(opts))
}

test('CLI: umbral exacto, 20 lineas pasan (con o sin salto final) y 21 no', () => {
  const repo = makeRepo()
  const f = join(repo, 'src/limite.ts')
  assert.equal(run(repo, 'Write', { file_path: f, content: lines(20) }), 'allow')
  assert.equal(run(repo, 'Write', { file_path: f, content: lines(20) + '\n' }), 'allow')
  assert.equal(run(repo, 'Write', { file_path: f, content: lines(21) }), 'deny')
})

test('CLI: lo commiteado en la rama cuenta: 10 commiteadas + 10 pasan, + 11 no', () => {
  const repo = makeRepo()
  writeFileSync(join(repo, 'src/b.ts'), lines(10))
  g(repo, 'add', '.')
  g(repo, 'commit', '-q', '-m', 'b')
  assert.equal(run(repo, 'Write', { file_path: join(repo, 'src/c.ts'), content: lines(10) }), 'allow')
  assert.equal(run(repo, 'Write', { file_path: join(repo, 'src/c.ts'), content: lines(11) }), 'deny')
})

test('CLI: lo escrito sin commitear, incluso con nombre no ASCII, cuenta', () => {
  const repo = makeRepo()
  writeFileSync(join(repo, 'src/café.ts'), lines(18))
  assert.equal(run(repo, 'Write', { file_path: join(repo, 'src/otro.ts'), content: lines(5) }), 'deny')
})

test('CLI: un renombre con edicion grande no se escapa del conteo', () => {
  const repo = makeRepo()
  writeFileSync(join(repo, 'src/a.ts'), lines(30))
  g(repo, 'add', '.')
  g(repo, 'commit', '-q', '-m', 'crece')
  g(repo, 'checkout', '-q', 'main')
  g(repo, 'merge', '-q', 'feat/x')
  g(repo, 'checkout', '-q', '-b', 'feat/r')
  g(repo, 'mv', 'src/a.ts', 'src/b.ts')
  writeFileSync(join(repo, 'src/b.ts'), lines(30).replace(/v1\b/g, 'w1') + '\n' + lines(25))
  g(repo, 'add', '.')
  g(repo, 'commit', '-q', '-m', 'renombra')
  assert.equal(run(repo, 'Write', { file_path: join(repo, 'src/c.ts'), content: lines(1) }), 'deny')
})

test('CLI: MultiEdit cuenta todas sus ediciones; NotebookEdit tambien pasa por el gate', () => {
  const repo = makeRepo()
  const f = join(repo, 'src/a.ts')
  const e = (n) => ({ old_string: 'a', new_string: lines(n) })
  assert.equal(run(repo, 'MultiEdit', { file_path: f, edits: [e(8), e(8)] }), 'allow')
  assert.equal(run(repo, 'MultiEdit', { file_path: f, edits: [e(8), e(8), e(8)] }), 'deny')
  assert.equal(run(repo, 'NotebookEdit', { notebook_path: join(repo, 'n.ipynb'), new_source: lines(30) }), 'deny')
})

test('CLI: editar package.json sin brief se deniega aunque sea una linea', () => {
  const repo = makeRepo()
  assert.equal(run(repo, 'Edit', { file_path: join(repo, 'package.json'), old_string: '1', new_string: '2' }), 'deny')
})

test('CLI: un manifiesto ya modificado o un lockfile nuevo bloquean el siguiente codigo', () => {
  const tracked = makeRepo()
  writeFileSync(join(tracked, 'package.json'), JSON.stringify({ devDependencies: { x: '1', y: '1' } }))
  assert.equal(run(tracked, 'Write', { file_path: join(tracked, 'src/x.ts'), content: lines(1) }), 'deny')

  const lock = makeRepo()
  mkdirSync(join(lock, 'apps/web'), { recursive: true })
  writeFileSync(join(lock, 'apps/web/pnpm-lock.yaml'), 'lockfileVersion: 9\n')
  assert.equal(run(lock, 'Write', { file_path: join(lock, 'src/x.ts'), content: lines(1) }), 'deny')
  writeBrief(lock)
  assert.equal(run(lock, 'Write', { file_path: join(lock, 'src/x.ts'), content: lines(1) }), 'allow')
})

test('CLI: escribir el brief, un doc o fuera de git siempre pasa', () => {
  const repo = makeRepo()
  assert.equal(run(repo, 'Write', { file_path: join(repo, 'docs/research/x.md'), content: lines(200) }), 'allow')
  assert.equal(run(repo, 'Write', { file_path: join(repo, 'README.md'), content: lines(200) }), 'allow')
  const outside = tmp('research-gate-out-')
  assert.equal(run(outside, 'Write', { file_path: join(outside, 'a.ts'), content: lines(200) }), 'allow')
})

test('CLI: ~/.claude queda exento (HOME del entorno)', () => {
  const home = tmp('research-gate-home-')
  const claude = join(home, '.claude')
  mkdirSync(join(claude, 'hooks'), { recursive: true })
  g(claude, 'init', '-q', '-b', 'main')
  assert.equal(run(claude, 'Write', { file_path: join(claude, 'hooks/x.mjs'), content: lines(200) }, { HOME: home }), 'allow')
})

test('CLI: ruta relativa se resuelve contra cwd, tambien desde una subcarpeta', () => {
  const repo = makeRepo()
  assert.equal(run(repo, 'Write', { file_path: 'src/rel.ts', content: lines(40) }), 'deny')
  assert.equal(run(join(repo, 'src'), 'Write', { file_path: 'rel.ts', content: lines(40) }), 'deny')
  assert.equal(run(join(repo, 'src'), 'Write', { file_path: 'rel.ts', content: lines(3) }), 'allow')
})

test('CLI: un brief AUTO en la rama habilita; BORRADOR se nombra en el motivo', () => {
  const repo = makeRepo()
  writeBrief(repo, { versiones: 'x=1' })
  const r = hook(JSON.stringify({ tool_name: 'Write', tool_input: { file_path: join(repo, 'src/c.ts'), content: lines(40) }, cwd: repo }))
  assert.match(JSON.parse(r).hookSpecificOutput.permissionDecisionReason, /docs\/research\/demo\.md: Estado BORRADOR/)
  writeBrief(repo)
  assert.equal(run(repo, 'Write', { file_path: join(repo, 'src/c.ts'), content: lines(40) }), 'allow')
})

test('CLI: el brief caduca cuando cambia la version del proyecto', () => {
  const repo = makeRepo()
  writeBrief(repo)
  writeFileSync(join(repo, 'package.json'), JSON.stringify({ devDependencies: { x: '2' } }))
  assert.equal(run(repo, 'Write', { file_path: join(repo, 'src/c.ts'), content: lines(40) }), 'deny')
})

test('CLI: el brief tiene que ser de ESTA rama; reusarlo es tocarlo', () => {
  const repo = makeRepo()
  writeBrief(repo)
  g(repo, 'add', '.')
  g(repo, 'commit', '-q', '-m', 'brief')
  g(repo, 'checkout', '-q', 'main')
  g(repo, 'merge', '-q', 'feat/x')
  g(repo, 'checkout', '-q', '-b', 'feat/y')
  const big = { file_path: join(repo, 'src/d.ts'), content: lines(40) }
  assert.equal(run(repo, 'Write', big), 'deny')
  appendFileSync(join(repo, 'docs/research/demo.md'), '\n<!-- reutilizado en feat/y -->\n')
  assert.equal(run(repo, 'Write', big), 'allow')
})

test('CLI: INDEX.md solo o un brief borrado no habilitan', () => {
  const repo = makeRepo()
  mkdirSync(join(repo, 'docs/research'), { recursive: true })
  writeFileSync(join(repo, 'docs/research/INDEX.md'), '- demo\n')
  const big = { file_path: join(repo, 'src/d.ts'), content: lines(40) }
  assert.equal(run(repo, 'Write', big), 'deny')

  writeBrief(repo)
  g(repo, 'add', '.')
  g(repo, 'commit', '-q', '-m', 'brief')
  g(repo, 'checkout', '-q', 'main')
  g(repo, 'merge', '-q', 'feat/x')
  g(repo, 'checkout', '-q', '-b', 'feat/z')
  rmSync(join(repo, 'docs/research/demo.md'))
  assert.equal(run(repo, 'Write', big), 'deny')
})

test('CLI: en la rama por defecto sin remoto cuenta lo no commiteado', () => {
  const repo = makeRepo({ branch: 'main' })
  assert.equal(run(repo, 'Write', { file_path: join(repo, 'src/m.ts'), content: lines(5) }), 'allow')
  assert.equal(run(repo, 'Write', { file_path: join(repo, 'src/m.ts'), content: lines(40) }), 'deny')
})

test('CLI: en la rama por defecto con remoto, lo no publicado cuenta aunque este commiteado', () => {
  const repo = makeRepo({ branch: 'main', origin: true })
  writeFileSync(join(repo, 'src/b.ts'), lines(15))
  g(repo, 'add', '.')
  g(repo, 'commit', '-q', '-m', 'local')
  assert.equal(run(repo, 'Write', { file_path: join(repo, 'src/c.ts'), content: lines(10) }), 'deny')
})

test('CLI: en una rama publicada, empujar no reinicia el conteo', () => {
  const repo = makeRepo({ origin: true })
  writeFileSync(join(repo, 'src/b.ts'), lines(15))
  g(repo, 'add', '.')
  g(repo, 'commit', '-q', '-m', 'b')
  g(repo, 'push', '-q', '-u', 'origin', 'feat/x')
  assert.equal(run(repo, 'Write', { file_path: join(repo, 'src/c.ts'), content: lines(10) }), 'deny')
})

test('CLI: en un worktree el gate cuenta la rama del worktree', () => {
  const repo = makeRepo({ branch: 'main' })
  const wt = join(tmp('research-gate-wt-'), 'wt')
  g(repo, 'worktree', 'add', '-q', wt, '-b', 'feat/w')
  assert.equal(run(wt, 'Write', { file_path: join(wt, 'src/c.ts'), content: lines(40) }), 'deny')
  writeBrief(wt)
  assert.equal(run(wt, 'Write', { file_path: join(wt, 'src/c.ts'), content: lines(40) }), 'allow')
})

test('CLI: falla abierto sin salida ante git roto, stdin invalido u otras tools', () => {
  const repo = makeRepo()
  writeFileSync(join(repo, '.git/HEAD'), 'basura\n')
  assert.equal(hook(JSON.stringify({ tool_name: 'Write', tool_input: { file_path: join(repo, 'src/c.ts'), content: lines(40) }, cwd: repo })), '')
  assert.equal(hook('no es json'), '')
  assert.equal(hook(''), '')
  assert.equal(hook(JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'ls' }, cwd: repo })), '')
  assert.equal(hook(JSON.stringify({ tool_name: 'Write', tool_input: {}, cwd: repo })), '')
})

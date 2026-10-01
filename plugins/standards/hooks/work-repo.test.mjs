import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync, existsSync, statSync, readdirSync, utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  repoFromCommand,
  isGitCommit,
  evidenceOf,
  pickRepo,
  logFile,
  appendEvidence,
  readEvidence,
  dropEvidence,
  sweepOld,
  workOf,
  repoRoot,
} from './work-repo.mjs'

const HOOK = fileURLToPath(new URL('./work-repo.mjs', import.meta.url))
const HOME = '/Users/k'

// ---- repoFromCommand: el directorio donde corre el `git commit` del comando ----

test('repoFromCommand: sin -C ni cd, el commit corre en el cwd', () => {
  assert.equal(repoFromCommand('git commit -m x', '/r/a'), '/r/a')
})

test('repoFromCommand: git -C absoluto y relativo, encadenados y vacio', () => {
  assert.equal(repoFromCommand('git -C /r/b commit -m x', '/r/a'), '/r/b')
  assert.equal(repoFromCommand('git -C ../b commit', '/r/a'), '/r/b')
  assert.equal(repoFromCommand('git -C /r -C b commit', '/x'), '/r/b')
  assert.equal(repoFromCommand('git -C "" commit', '/r/a'), '/r/a')
})

test('repoFromCommand: -c k=v consume su argumento sin cambiar de directorio', () => {
  assert.equal(repoFromCommand('git -c user.name=x -C /r/b commit', '/r/a'), '/r/b')
})

test('repoFromCommand: un cd inicial con && o ; fija el directorio', () => {
  assert.equal(repoFromCommand('cd /r/b && git commit -m x', '/r/a'), '/r/b')
  assert.equal(repoFromCommand('cd /r/b; git add . && git commit -m x', '/r/a'), '/r/b')
  assert.equal(repoFromCommand("cd '/r/con espacio' && git commit", '/r/a'), '/r/con espacio')
})

test('repoFromCommand: lo que no se puede resolver devuelve null', () => {
  for (const c of [
    'git --git-dir=/r/b/.git commit',
    'git --work-tree /r/b commit',
    'GIT_DIR=/r/b/.git git commit',
    'GIT_WORK_TREE=/r/b git commit',
    'cd $REPO && git commit',
    'cd ~ && git commit',
    'cd - && git commit',
    'cd && git commit',
    'cd /r/b && cd c && git commit',
    'pushd /r/b && git commit',
    '(cd /r/b && git commit)',
    'git -C "$X" commit',
    'git -C `pwd` commit',
    'git -C $(pwd) commit',
  ]) {
    assert.equal(repoFromCommand(c, '/r/a'), null, c)
  }
})

test('repoFromCommand: sin commit no hay repo de commit', () => {
  assert.equal(repoFromCommand('git status', '/r/a'), null)
})

// ---- isGitCommit: el detector que reemplaza a la regex ----

test('isGitCommit reconoce commits con opciones globales y subcomandos', () => {
  for (const c of [
    'git commit -m x',
    'git -C /r/b commit',
    'git -c k=v commit',
    'cd /r/b && git commit',
    'git add . && git commit -m "x"',
    'git --no-pager commit',
  ]) {
    assert.equal(isGitCommit(c), true, c)
  }
})

test('isGitCommit ignora texto que no es un commit', () => {
  for (const c of [
    'echo "git commit"',
    'git log --grep commit',
    'git status',
    'grep -r "git commit" .',
    "cat > notes.md <<'EOF'\ngit commit -m x\nEOF",
  ]) {
    assert.equal(isGitCommit(c), false, c)
  }
})

// Review 2026-10-01: la regex vieja `\bgit\s+commit\b` atrapaba estas formas; el parser no puede perderlas.
test('isGitCommit: envoltorios, sustituciones y bloques no esconden un commit', () => {
  for (const c of [
    'if true; then git commit -m x; fi',
    '{ git commit -m x; }',
    'for i in 1; do git commit -m x; done',
    'while false; do git commit; done',
    '! git commit -m x',
    'time git commit -m x',
    'command git commit -m x',
    'exec git commit -m x',
    'nohup git commit -m x',
    'xargs git commit -m x',
    'echo `git commit -m x`',
    'echo $(git commit -m x)',
  ]) {
    assert.equal(isGitCommit(c), true, c)
  }
})

test('isGitCommit: un comentario con apostrofo o un << aritmetico no se tragan las lineas siguientes', () => {
  assert.equal(isGitCommit("# don't stop\ngit commit -m x"), true)
  assert.equal(isGitCommit("git add .\n# it's fine\ngit -C /tmp/b commit"), true)
  assert.equal(isGitCommit('echo $((1<<N))\ngit commit -m x'), true)
  assert.equal(isGitCommit('echo "a<<b"\ngit commit -m x'), true)
  assert.equal(isGitCommit('# git commit -m x'), false)
})

test('repoFromCommand: un envoltorio no cambia el directorio; una sustitucion no se resuelve', () => {
  assert.equal(repoFromCommand('time git -C /r/b commit', '/r/a'), '/r/b')
  assert.equal(repoFromCommand('if true; then git -C /r/b commit; fi', '/r/a'), '/r/b')
  assert.equal(repoFromCommand('echo $(git commit -m x)', '/r/a'), null)
  assert.equal(repoFromCommand('echo `git commit -m x`', '/r/a'), null)
})

test('repoFromCommand: varios commits en el mismo repo se resuelven; en repos distintos no', () => {
  assert.equal(repoFromCommand('git -C /r/b commit -m x && git -C /r/b commit --amend', '/r/a'), '/r/b')
  assert.equal(repoFromCommand('git -C /r/a commit -m x && git -C /r/b commit -m y', '/x'), null)
})

test('repoFromCommand: GIT_DIR exportado o asignado en su propia linea no se resuelve', () => {
  assert.equal(repoFromCommand('export GIT_DIR=/r/b/.git; git commit', '/r/a'), null)
  assert.equal(repoFromCommand('GIT_DIR=/r/b/.git\ngit commit', '/r/a'), null)
  assert.equal(repoFromCommand('GIT_INDEX_FILE=/tmp/i git commit', '/r/a'), null)
  assert.equal(repoFromCommand('git --work-tree=/r/b commit', '/r/a'), null)
})

test('isGitCommit: un cd dentro de un heredoc no cuenta como comando', () => {
  assert.equal(repoFromCommand("cat > f <<EOF\ncd /r/b\nEOF\ngit commit", '/r/a'), '/r/a')
})

// ---- evidenceOf: que rutas cuentan como trabajo (K2) ----

test('evidenceOf: rutas de Read, Edit, Write, Grep y Glob', () => {
  assert.deepEqual(evidenceOf('Read', { file_path: '/r/b/x.ts' }, '/r/a', HOME).paths, ['/r/b/x.ts'])
  assert.deepEqual(evidenceOf('Edit', { file_path: '/r/b/x.ts' }, '/r/a', HOME).paths, ['/r/b/x.ts'])
  assert.deepEqual(evidenceOf('NotebookEdit', { notebook_path: '/r/b/n.ipynb' }, '/r/a', HOME).paths, ['/r/b/n.ipynb'])
  assert.deepEqual(evidenceOf('Grep', { path: '/r/b/src' }, '/r/a', HOME).paths, ['/r/b/src'])
  assert.deepEqual(evidenceOf('Glob', { pattern: '*.ts' }, '/r/a', HOME).paths, ['/r/a'])
  assert.deepEqual(evidenceOf('Grep', { path: 'src' }, '/r/a', HOME).paths, ['/r/a/src'])
})

test('evidenceOf: en Bash cuentan los directorios de git y los destinos de cd', () => {
  assert.deepEqual(evidenceOf('Bash', { command: 'git -C /r/b diff' }, '/r/a', HOME).paths, ['/r/b'])
  assert.deepEqual(evidenceOf('Bash', { command: 'cd /r/b && ls' }, '/r/a', HOME).paths, ['/r/b'])
  assert.deepEqual(evidenceOf('Bash', { command: 'ls -la' }, '/r/a', HOME).paths, [])
})

test('evidenceOf: lo que esta bajo ~/.claude no cuenta, juzgado sobre la ruta cruda', () => {
  assert.deepEqual(evidenceOf('Read', { file_path: `${HOME}/.claude/rules/x.md` }, '/r/a', HOME).paths, [])
  assert.deepEqual(evidenceOf('Bash', { command: `cd ${HOME}/.claude/hooks && node --test` }, '/r/a', HOME).paths, [])
  assert.deepEqual(evidenceOf('Read', { file_path: `${HOME}/.claudex/x.md` }, '/r/a', HOME).paths, [`${HOME}/.claudex/x.md`])
})

test('evidenceOf: un brief leido por Read o por cat queda anotado', () => {
  assert.deepEqual(evidenceOf('Read', { file_path: '/r/b/docs/research/x.md' }, '/r/a', HOME).briefs, ['/r/b/docs/research/x.md'])
  assert.deepEqual(evidenceOf('Read', { file_path: '/r/b/docs/research/INDEX.md' }, '/r/a', HOME).briefs, [])
  assert.deepEqual(evidenceOf('Bash', { command: 'cat /r/b/docs/research/x.md' }, '/r/a', HOME).briefs, ['/r/b/docs/research/x.md'])
  assert.deepEqual(evidenceOf('Bash', { command: 'cd /r/b && cat docs/research/x.md' }, '/r/a', HOME).briefs, ['/r/b/docs/research/x.md'])
  assert.deepEqual(evidenceOf('Bash', { command: 'head docs/research/x.md' }, '/r/a', HOME).briefs, [])
})

// ---- pickRepo: la regla de K3 ----

test('pickRepo: exactamente un repo gana; cero o varios devuelven null (fallback al cwd)', () => {
  assert.equal(pickRepo(['/r/b', '/r/b']), '/r/b')
  assert.equal(pickRepo([]), null)
  assert.equal(pickRepo(['/r/a', '/r/b']), null)
})

// ---- log por agente fuera de todo repo (K1) ----

test('logFile valida session_id y agent_id antes de usarlos en una ruta', () => {
  assert.equal(logFile('/t', 'abc-1', 'a_2'), join('/t', 'claude-gates', 'abc-1', 'a_2.jsonl'))
  assert.equal(logFile('/t', '../x', 'a'), null)
  assert.equal(logFile('/t', 's', 'a/b'), null)
  assert.equal(logFile('/t', '', 'a'), null)
  assert.equal(logFile('/t', 's', undefined), null)
})

test('appendEvidence / readEvidence: ida y vuelta, modos 0700/0600, sin agent_id no escribe', () => {
  const tmp = realpathSync(mkdtempSync(join(tmpdir(), 'work-log-')))
  try {
    appendEvidence({ session_id: 's1', tool_name: 'Read', tool_input: { file_path: '/r/b/x' }, cwd: '/r/a' }, { tmp, home: HOME })
    assert.equal(existsSync(join(tmp, 'claude-gates')), false)

    const input = { session_id: 's1', agent_id: 'a1', cwd: '/r/a' }
    appendEvidence({ ...input, tool_name: 'Read', tool_input: { file_path: '/r/b/docs/research/x.md' } }, { tmp, home: HOME })
    appendEvidence({ ...input, tool_name: 'Bash', tool_input: { command: 'git -C /r/c diff' } }, { tmp, home: HOME })
    const ev = readEvidence('s1', 'a1', { tmp })
    assert.deepEqual(ev.paths.sort(), ['/r/b/docs/research/x.md', '/r/c'])
    assert.deepEqual(ev.briefs, ['/r/b/docs/research/x.md'])

    const dir = join(tmp, 'claude-gates', 's1')
    assert.equal(statSync(dir).mode & 0o777, 0o700)
    assert.equal(statSync(join(dir, 'a1.jsonl')).mode & 0o777, 0o600)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})

test('readEvidence: log ausente es null; una linea corrupta se ignora', () => {
  const tmp = realpathSync(mkdtempSync(join(tmpdir(), 'work-log-')))
  try {
    assert.equal(readEvidence('s1', 'nadie', { tmp }), null)
    const dir = join(tmp, 'claude-gates', 's1')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'a1.jsonl'), '{"paths":["/r/b"],"briefs":[]}\n{roto\n')
    assert.deepEqual(readEvidence('s1', 'a1', { tmp }).paths, ['/r/b'])
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})

test('workOf: un log ilegible (un directorio en su lugar) es evidencia ausente, no un error', () => {
  const tmp = realpathSync(mkdtempSync(join(tmpdir(), 'work-log-')))
  try {
    mkdirSync(join(tmp, 'claude-gates', 's1', 'a1.jsonl'), { recursive: true })
    assert.equal(readEvidence('s1', 'a1', { tmp }), null)
    assert.deepEqual(workOf({ session_id: 's1', agent_id: 'a1' }, { tmp }), { repo: null, brief: null })
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})

test('repoRoot: archivo, archivo nuevo, fuera de git, dentro de .git y worktree enlazado', () => {
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'work-root-')))
  try {
    const repo = join(base, 'repo')
    mkdirSync(repo)
    const g = (cwd, ...a) => execFileSync('git', a, { cwd, stdio: 'ignore' })
    g(repo, 'init', '-q', '-b', 'main')
    g(repo, 'config', 'user.email', 't@t')
    g(repo, 'config', 'user.name', 't')
    writeFileSync(join(repo, 'a.ts'), 'x\n')
    g(repo, 'add', '.')
    g(repo, 'commit', '-qm', 'i')
    g(repo, 'worktree', 'add', '-q', join(base, 'wt'), '-b', 'w')
    assert.equal(repoRoot(join(repo, 'a.ts')), repo)
    assert.equal(repoRoot(join(repo, 'nuevo/dir/b.ts')), repo)
    assert.equal(repoRoot(join(base, 'fuera.ts')), null)
    assert.equal(repoRoot(join(repo, '.git', 'config')), null)
    assert.equal(repoRoot(join(base, 'wt', 'a.ts')), join(base, 'wt'))
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('sweepOld no borra nada si claude-gates es un symlink (un /tmp compartido)', async () => {
  const { symlinkSync } = await import('node:fs')
  const tmp = realpathSync(mkdtempSync(join(tmpdir(), 'work-log-')))
  const victima = realpathSync(mkdtempSync(join(tmpdir(), 'victima-')))
  try {
    mkdirSync(join(victima, 'viejo'))
    const old = (Date.now() - 25 * 3600 * 1000) / 1000
    utimesSync(join(victima, 'viejo'), old, old)
    symlinkSync(victima, join(tmp, 'claude-gates'))
    sweepOld({ tmp, maxAgeMs: 24 * 3600 * 1000 })
    assert.equal(existsSync(join(victima, 'viejo')), true)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
    rmSync(victima, { recursive: true, force: true })
  }
})

test('dropEvidence borra el log del agente; sweepOld borra sesiones viejas y deja las vivas', () => {
  const tmp = realpathSync(mkdtempSync(join(tmpdir(), 'work-log-')))
  try {
    const input = { session_id: 'viva', agent_id: 'a1', cwd: '/r/a', tool_name: 'Read', tool_input: { file_path: '/r/b/x' } }
    appendEvidence(input, { tmp, home: HOME })
    appendEvidence({ ...input, session_id: 'vieja' }, { tmp, home: HOME })
    const old = (Date.now() - 25 * 3600 * 1000) / 1000
    utimesSync(join(tmp, 'claude-gates', 'vieja'), old, old)

    dropEvidence('viva', 'a1', { tmp })
    assert.equal(existsSync(join(tmp, 'claude-gates', 'viva', 'a1.jsonl')), false)

    sweepOld({ tmp, maxAgeMs: 24 * 3600 * 1000 })
    assert.deepEqual(readdirSync(join(tmp, 'claude-gates')), ['viva'])
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})

// ---- CLI: el hook PreToolUse que registra ----

test('CLI log: registra fuera del repo y no cambia el diff del repo', () => {
  const tmp = realpathSync(mkdtempSync(join(tmpdir(), 'work-log-')))
  const repo = realpathSync(mkdtempSync(join(tmpdir(), 'work-repo-')))
  try {
    execFileSync('git', ['init', '-q'], { cwd: repo })
    const before = execFileSync('git', ['status', '--porcelain'], { cwd: repo, encoding: 'utf8' })
    const r = spawnSync(process.execPath, [HOOK, 'log'], {
      input: JSON.stringify({ session_id: 's', agent_id: 'a', cwd: repo, tool_name: 'Read', tool_input: { file_path: join(repo, 'x.ts') } }),
      encoding: 'utf8',
      env: { ...process.env, TMPDIR: tmp },
    })
    assert.equal(r.status, 0, r.stderr)
    assert.equal(r.stdout, '')
    assert.equal(execFileSync('git', ['status', '--porcelain'], { cwd: repo, encoding: 'utf8' }), before)
    assert.deepEqual(readEvidence('s', 'a', { tmp }).paths, [join(repo, 'x.ts')])
  } finally {
    rmSync(tmp, { recursive: true, force: true })
    rmSync(repo, { recursive: true, force: true })
  }
})

test('CLI log: un stdin roto no rompe la tool', () => {
  const r = spawnSync(process.execPath, [HOOK, 'log'], { input: '{no json', encoding: 'utf8' })
  assert.equal(r.status, 0)
  assert.equal(r.stdout, '')
})

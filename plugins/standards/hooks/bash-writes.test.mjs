import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { brief } from '../../product/skills/research/brief-fixture.mjs'
import { bashWriteTargets } from './bash-writes.mjs'

const HOOK = fileURLToPath(new URL('./bash-writes.mjs', import.meta.url))

// ---- bashWriteTargets: la capa estatica, solo formas de alta confianza ----

const T = (cmd, cwd = '/r') => bashWriteTargets(cmd, cwd).targets

test('redireccion de salida, incluida la de un heredoc', () => {
  assert.deepEqual(T('echo x > src/a.ts'), ['/r/src/a.ts'])
  assert.deepEqual(T('echo x >> /o/b.ts'), ['/o/b.ts'])
  assert.deepEqual(T('cmd >src/a.ts'), ['/r/src/a.ts'])
  assert.deepEqual(T('cmd &> log.ts'), ['/r/log.ts'])
  assert.deepEqual(T('cmd 2>&1 > out.ts'), ['/r/out.ts'])
  assert.deepEqual(T("cat > src/a.ts <<'EOF'\nexport const a = 1\nEOF"), ['/r/src/a.ts'])
  assert.deepEqual(T('echo x > /dev/null'), [])
})

test('tee, sed -i, perl -i', () => {
  assert.deepEqual(T('echo x | tee -a src/a.ts src/b.ts'), ['/r/src/a.ts', '/r/src/b.ts'])
  assert.deepEqual(T("sed -i '' 's/a/b/' src/a.ts"), ['/r/src/a.ts'])
  assert.deepEqual(T("sed -i 's/a/b/' src/a.ts"), ['/r/src/a.ts'])
  assert.deepEqual(T("sed -i.bak -e 's/x/y/' src/a.ts"), ['/r/src/a.ts'])
  assert.deepEqual(T("perl -i -pe 's/a/b/' src/a.ts"), ['/r/src/a.ts'])
  assert.deepEqual(T("sed -n '1,5p' src/a.ts"), [])
})

test('cp, mv, install, rsync y dd escriben en su destino', () => {
  assert.deepEqual(T('cp a.ts b.ts'), ['/r/b.ts'])
  assert.deepEqual(T('mv -f x.ts y/z.ts'), ['/r/y/z.ts'])
  assert.deepEqual(T('install -m 644 a b.ts'), ['/r/b.ts'])
  assert.deepEqual(T('rsync -a src/ dst/'), ['/r/dst'])
  assert.deepEqual(T('dd if=a.ts of=b.ts'), ['/r/b.ts'])
})

test('interpretes con API de escritura: las rutas literales del codigo son destino', () => {
  const py = "python3 - <<'EOF'\np='src/a.ts'\nopen(p,'w').write('x')\nEOF"
  assert.deepEqual(T(py), ['/r/src/a.ts'])
  assert.equal(bashWriteTargets(py, '/r').interpreter, true)
  assert.deepEqual(T("node -e \"require('fs').writeFileSync('src/a.ts','x')\""), ['/r/src/a.ts'])
  assert.deepEqual(T('python3 -c "print(1)"'), [])
  assert.deepEqual(T("python3 -c \"print(open('src/a.ts').read())\""), [])
})

// Review 2026-10-01: formas comunes que la capa estatica no veia.
test('sed con -i combinado (-Ei, -ri), >|, redireccion pegada y cp -t o a un directorio', () => {
  assert.deepEqual(T("sed -Ei 's/a/b/' src/a.ts"), ['/r/src/a.ts'])
  assert.deepEqual(T("sed -ri 's/a/b/' src/a.ts"), ['/r/src/a.ts'])
  assert.deepEqual(T('echo x >| src/a.ts'), ['/r/src/a.ts'])
  assert.deepEqual(T('echo a>b.ts'), ['/r/b.ts'])
  assert.deepEqual(T('echo ">x.ts"'), [])
  assert.deepEqual(T('cp -t dst a.ts b.ts'), ['/r/dst/a.ts', '/r/dst/b.ts'])
  assert.deepEqual(T('cp a.ts src/'), ['/r/src/a.ts'])
})

test('un comentario con apostrofo no esconde la escritura de la linea siguiente', () => {
  assert.deepEqual(T("# it's fine\necho x > a.ts"), ['/r/a.ts'])
})

test('un envoltorio no esconde la escritura', () => {
  assert.deepEqual(T("time sed -i '' 's/a/b/' src/a.ts"), ['/r/src/a.ts'])
})

test('el directorio sigue al cd inicial', () => {
  assert.deepEqual(T('cd /o/b && echo x > a.ts'), ['/o/b/a.ts'])
})

test('comandos de solo lectura no tienen destino', () => {
  for (const c of ['ls', 'git status', 'npm test', 'grep APROBADO docs/research/INDEX.md', 'cat src/a.ts']) {
    assert.deepEqual(T(c), [], c)
  }
})

test('mentionsAprobado detecta el token en el texto del comando', () => {
  assert.equal(bashWriteTargets('sed -i "s/AUTO/APROBADO/" docs/research/x.md', '/r').mentionsAprobado, true)
  assert.equal(bashWriteTargets('ls', '/r').mentionsAprobado, false)
})

// ---- CLI: PreToolUse (pre) + PostToolUse / PostToolUseFailure (post) sobre repos reales ----

const temps = []
after(() => {
  for (const d of temps) rmSync(d, { recursive: true, force: true })
})

const g = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
const lines = (n, tag = 'v') => Array.from({ length: n }, (_, i) => `export const ${tag}${i} = ${i}`).join('\n') + '\n'
const AUTO = { versiones: 'x=1', estado: 'AUTO', verificador: 'research-verifier 2026-09-30 AUTO' }

function makeRepo({ over = false } = {}) {
  const repo = realpathSync(mkdtempSync(join(tmpdir(), 'bash-writes-')))
  temps.push(repo)
  g(repo, 'init', '-q', '-b', 'main')
  g(repo, 'config', 'user.email', 't@t')
  g(repo, 'config', 'user.name', 't')
  mkdirSync(join(repo, 'Sources'))
  writeFileSync(join(repo, 'Sources/ClassicRuntime.swift'), 'let a = 1\n')
  // Versiones del proyecto para que un brief de prueba (Versiones: x=1) pase el lint.
  writeFileSync(join(repo, 'package.json'), JSON.stringify({ devDependencies: { x: '1' } }))
  writeFileSync(join(repo, '.gitignore'), 'build/\n')
  g(repo, 'add', '.')
  g(repo, 'commit', '-q', '-m', 'init')
  g(repo, 'checkout', '-q', '-b', 'feat/x')
  if (over) {
    writeFileSync(join(repo, 'Sources/Grande.swift'), lines(30))
    g(repo, 'add', '.')
    g(repo, 'commit', '-q', '-m', 'grande')
  }
  return repo
}

let seq = 0
function call(mode, cwd, command, { tool_name = 'Bash', id } = {}) {
  const tool_use_id = id || `toolu_${++seq}`
  const r = spawnSync(process.execPath, [HOOK, mode], {
    input: JSON.stringify({ tool_name, tool_input: { command }, tool_use_id, cwd }),
    encoding: 'utf8',
  })
  assert.equal(r.status, 0, r.stderr)
  return { out: r.stdout ? JSON.parse(r.stdout) : null, id: tool_use_id }
}
const pre = (cwd, command, opts) => call('pre', cwd, command, opts)
const post = (cwd, command, id, failed = false) => call(failed ? 'post-failure' : 'post', cwd, command, { id }).out
const decision = (o) => (o ? o.hookSpecificOutput.permissionDecision : 'allow')

test('silencio: comandos de solo lectura no deciden ni en pre ni en post', () => {
  const repo = makeRepo({ over: true })
  for (const c of ['ls', 'git status', 'npm test', 'grep APROBADO docs/research/INDEX.md']) {
    const { out, id } = pre(repo, c)
    assert.equal(out, null, c)
    assert.equal(post(repo, c, id), null, c)
  }
})

test('el snapshot vive en el git-dir: pre no ensucia el arbol', () => {
  const repo = makeRepo()
  const before = g(repo, 'status', '--porcelain')
  pre(repo, "sed -i '' 's/1/2/' Sources/ClassicRuntime.swift")
  assert.equal(g(repo, 'status', '--porcelain'), before)
})

// Regresion caso 2 (2026-10-01): tras un Write denegado, un agente edito ClassicRuntime.swift con sed.
test('caso 2: sed -i sobre un .swift con la rama sobre el umbral y sin brief se niega en pre', () => {
  const repo = makeRepo({ over: true })
  const o = pre(repo, "sed -i '' 's/a = 1/a = 2/' Sources/ClassicRuntime.swift").out
  assert.equal(decision(o), 'deny')
  assert.match(o.hookSpecificOutput.permissionDecisionReason, /ClassicRuntime\.swift.*Reference Brief/s)
  assert.equal(decision(pre(repo, "sed -i '' 's/a/b/' Sources/ClassicRuntime.swift", { tool_name: 'PowerShell' }).out), 'deny')
})

test('caso 2 variante: python con ruta armada no se ve en pre y el diff posterior lo detiene', () => {
  const repo = makeRepo({ over: true })
  const cmd = "python3 - <<'EOF'\nimport os\np=os.path.join('Sources','ClassicRuntime'+'.swift')\nopen(p,'a').write('x')\nEOF"
  const { out, id } = pre(repo, cmd)
  assert.equal(decision(out), 'allow')
  writeFileSync(join(repo, 'Sources/ClassicRuntime.swift'), lines(5, 'w'))
  const o = post(repo, cmd, id)
  assert.equal(o.decision, 'block')
  assert.equal(o.continue, false)
  assert.match(o.stopReason, /research-gate/)
  assert.equal(readFileSync(join(repo, 'Sources/ClassicRuntime.swift'), 'utf8'), lines(5, 'w')) // sin revertir
})

test('bajo el umbral, escribir codigo por Bash pasa en pre y en post', () => {
  const repo = makeRepo()
  const cmd = "sed -i '' 's/1/2/' Sources/ClassicRuntime.swift"
  const { out, id } = pre(repo, cmd)
  assert.equal(decision(out), 'allow')
  writeFileSync(join(repo, 'Sources/ClassicRuntime.swift'), 'let a = 2\n')
  assert.equal(post(repo, cmd, id), null)
})

function fourBriefs(repo) {
  mkdirSync(join(repo, 'docs/research'), { recursive: true })
  for (const n of ['a', 'b', 'c', 'd']) writeFileSync(join(repo, `docs/research/${n}.md`), brief(AUTO))
}
const flip = (repo, n) => {
  const p = join(repo, `docs/research/${n}.md`)
  writeFileSync(p, readFileSync(p, 'utf8').replace('Estado: AUTO', 'Estado: APROBADO'))
}

// Regresion caso 1 (2026-10-01): un agente puso 4 briefs en APROBADO con python por Bash.
test('caso 1: python que pasa 4 briefs a APROBADO se detiene y avisa, sin revertir (D2)', () => {
  const repo = makeRepo()
  fourBriefs(repo)
  const cmd = "python3 - <<'EOF'\nimport glob\nfor p in glob.glob('docs/research/*.md'):\n  s=open(p).read().replace('AUTO','APROBADO')\n  open(p,'w').write(s)\nEOF"
  const { out, id } = pre(repo, cmd)
  assert.equal(decision(out), 'allow') // sin ruta literal: la capa estatica no lo ve
  for (const n of ['a', 'b', 'c', 'd']) flip(repo, n)
  const o = post(repo, cmd, id)
  assert.equal(o.decision, 'block')
  assert.equal(o.continue, false)
  for (const n of ['a', 'b', 'c', 'd']) {
    assert.match(o.reason, new RegExp(`docs/research/${n}\\.md`))
    assert.match(readFileSync(join(repo, `docs/research/${n}.md`), 'utf8'), /Estado: APROBADO/) // sin revertir
  }
})

test('caso 1 variante: el mismo cambio con exit != 0 avisa por PostToolUseFailure', () => {
  const repo = makeRepo()
  fourBriefs(repo)
  const cmd = 'python3 flip.py; false'
  const { id } = pre(repo, cmd)
  for (const n of ['a', 'b', 'c', 'd']) flip(repo, n)
  const o = post(repo, cmd, id, true)
  assert.equal(o.continue, false)
  assert.equal(o.hookSpecificOutput.hookEventName, 'PostToolUseFailure')
  for (const n of ['a', 'b', 'c', 'd']) assert.match(o.hookSpecificOutput.additionalContext, new RegExp(`${n}\\.md`))
})

test('caso 1 por PowerShell: el diff posterior lo detiene igual', () => {
  const repo = makeRepo()
  fourBriefs(repo)
  const cmd = 'Get-ChildItem docs/research | ForEach-Object { (Get-Content $_) -replace "AUTO","APROBADO" | Set-Content $_ }'
  const { out, id } = pre(repo, cmd, { tool_name: 'PowerShell' })
  assert.equal(decision(out), 'allow')
  flip(repo, 'a')
  const r = call('post', repo, cmd, { tool_name: 'PowerShell', id }).out
  assert.equal(r.continue, false)
  assert.match(r.reason, /a\.md/)
})

// Review 2026-10-01: una escritura invisible para la capa estatica seguida de `git commit` en el mismo
// comando movia HEAD y se saltaba el diff posterior.
test('escritura seguida de git commit en el mismo comando no escapa al diff posterior', () => {
  const repo = makeRepo({ over: true })
  const cmd = 'python3 gen.py && git commit -qam x'
  const { id } = pre(repo, cmd)
  writeFileSync(join(repo, 'Sources/ClassicRuntime.swift'), lines(5, 'w'))
  g(repo, 'commit', '-qam', 'x')
  const o = post(repo, cmd, id)
  assert.equal(o.continue, false)
})

test('merge de una rama con codigo no es escritura del agente', () => {
  const repo = makeRepo({ over: true })
  g(repo, 'checkout', '-qb', 'otra')
  writeFileSync(join(repo, 'Sources/Otra.swift'), lines(10, 'o'))
  g(repo, 'add', '.')
  g(repo, 'commit', '-qm', 'otra')
  g(repo, 'checkout', '-q', 'feat/x')
  const cmd = 'git merge --no-ff -m m otra'
  const { id } = pre(repo, cmd)
  g(repo, 'merge', '--no-ff', '-q', '-m', 'm', 'otra')
  assert.equal(post(repo, cmd, id), null)
})

test('fast-forward a commits que ya existian no es escritura del agente', () => {
  const repo = makeRepo({ over: true })
  g(repo, 'checkout', '-qb', 'adelante')
  writeFileSync(join(repo, 'Sources/Adelante.swift'), lines(10, 'f'))
  g(repo, 'add', '.')
  execFileSync('git', ['commit', '-qm', 'adelante'], {
    cwd: repo,
    env: { ...process.env, GIT_COMMITTER_DATE: '2020-01-01T00:00:00Z', GIT_AUTHOR_DATE: '2020-01-01T00:00:00Z' },
  })
  g(repo, 'checkout', '-q', 'feat/x')
  const cmd = 'git merge --ff-only adelante'
  const { id } = pre(repo, cmd)
  g(repo, 'merge', '--ff-only', '-q', 'adelante')
  assert.equal(post(repo, cmd, id), null)
})

test('rebase y worktree add no son escrituras del agente', () => {
  const repo = makeRepo({ over: true })
  const wt = `${repo}-wt`
  temps.push(wt)
  let cmd = `git worktree add ${wt} -b w2`
  let r = pre(repo, cmd)
  g(repo, 'worktree', 'add', '-q', wt, '-b', 'w2')
  assert.equal(post(repo, cmd, r.id), null)

  g(repo, 'checkout', '-q', 'main')
  writeFileSync(join(repo, 'Sources/Main.swift'), lines(3, 'm'))
  g(repo, 'add', '.')
  g(repo, 'commit', '-qm', 'main')
  g(repo, 'checkout', '-q', 'feat/x')
  cmd = 'git rebase main'
  r = pre(repo, cmd)
  g(repo, 'rebase', '-q', 'main')
  assert.equal(post(repo, cmd, r.id), null)
})

test('sobre el umbral, escribir en /tmp, en docs o en una carpeta ignorada no decide nada', () => {
  const repo = makeRepo({ over: true })
  const out = `${repo}-fuera.ts`
  temps.push(out)
  for (const [cmd, effect] of [
    [`echo x > ${out}`, () => writeFileSync(out, 'x\n')],
    ['echo x > README.md', () => writeFileSync(join(repo, 'README.md'), 'x\n')],
    ['mkdir -p build && echo x > build/gen.ts', () => {
      mkdirSync(join(repo, 'build'), { recursive: true })
      writeFileSync(join(repo, 'build/gen.ts'), lines(40))
    }],
  ]) {
    const { out: o, id } = pre(repo, cmd)
    assert.equal(o, null, cmd)
    effect()
    assert.equal(post(repo, cmd, id), null, cmd)
  }
})

test('sobre el umbral pero con un brief que habilita, sed -i sobre codigo pasa', () => {
  const repo = makeRepo({ over: true })
  mkdirSync(join(repo, 'docs/research'), { recursive: true })
  writeFileSync(join(repo, 'docs/research/ok.md'), brief({ ...AUTO, estado: 'APROBADO' }))
  const cmd = "sed -i '' 's/1/2/' Sources/ClassicRuntime.swift"
  const { out, id } = pre(repo, cmd)
  assert.equal(decision(out), 'allow')
  writeFileSync(join(repo, 'Sources/ClassicRuntime.swift'), lines(5, 'w'))
  assert.equal(post(repo, cmd, id), null)
})

test('tocar dependencias por Bash sin brief se detiene aunque la rama sea chica', () => {
  const repo = makeRepo()
  const cmd = 'npm pkg set devDependencies.y=2'
  const { id } = pre(repo, cmd)
  writeFileSync(join(repo, 'package.json'), JSON.stringify({ devDependencies: { x: '1', y: '2' } }))
  const o = post(repo, cmd, id)
  assert.equal(o.continue, false)
})

test('caso 1 variante literal: un brief nombrado y APROBADO en el texto se niega en pre', () => {
  const repo = makeRepo()
  fourBriefs(repo)
  assert.equal(decision(pre(repo, "sed -i '' 's/Estado: AUTO/Estado: APROBADO/' docs/research/a.md").out), 'deny')
})

test('Karen: un APROBADO escrito fuera de la ventana pre/post no dispara nada en la llamada siguiente', () => {
  const repo = makeRepo()
  fourBriefs(repo)
  flip(repo, 'a') // como un `! sed` de Karen, que no pasa por los hooks
  const antes = readFileSync(join(repo, 'docs/research/a.md'), 'utf8')
  const { out, id } = pre(repo, 'ls')
  assert.equal(out, null)
  assert.equal(post(repo, 'ls', id), null)
  assert.equal(readFileSync(join(repo, 'docs/research/a.md'), 'utf8'), antes)
})

test('un brief que ya era APROBADO se puede editar por Bash', () => {
  const repo = makeRepo()
  fourBriefs(repo)
  flip(repo, 'a')
  const cmd = "sed -i '' 's/APROBADO/APROBADO/' docs/research/a.md"
  const { out, id } = pre(repo, cmd)
  assert.equal(decision(out), 'allow')
  writeFileSync(join(repo, 'docs/research/a.md'), readFileSync(join(repo, 'docs/research/a.md'), 'utf8') + '\nnota\n')
  assert.equal(post(repo, cmd, id), null)
})

test('git commit por si mismo (de cambios que ya estaban antes del comando) no decide nada', () => {
  const repo = makeRepo({ over: true })
  writeFileSync(join(repo, 'Sources/ClassicRuntime.swift'), lines(5, 'w'))
  const cmd = 'git commit -am x'
  const { id } = pre(repo, cmd)
  g(repo, 'commit', '-qam', 'x')
  assert.equal(post(repo, cmd, id), null)
})

test('un brief APROBADO traido de un commit que ya existia no es un APROBADO del agente', () => {
  const repo = makeRepo()
  fourBriefs(repo)
  g(repo, 'add', '.')
  g(repo, 'commit', '-qm', 'briefs')
  g(repo, 'checkout', '-qb', 'otra')
  flip(repo, 'a')
  g(repo, 'commit', '-qam', 'karen aprueba')
  g(repo, 'checkout', '-q', 'feat/x')
  const cmd = 'git checkout otra -- docs/research/a.md'
  const { id } = pre(repo, cmd)
  g(repo, 'checkout', 'otra', '--', 'docs/research/a.md')
  assert.equal(post(repo, cmd, id), null)
})

test('sin snapshot para el tool_use_id, post no decide nada', () => {
  const repo = makeRepo({ over: true })
  writeFileSync(join(repo, 'Sources/ClassicRuntime.swift'), lines(5, 'w'))
  assert.equal(post(repo, 'x', 'toolu_nunca'), null)
})

test('pre barre snapshots de mas de 24 h que ningun post recogio', async () => {
  const { utimesSync, readdirSync } = await import('node:fs')
  const repo = makeRepo()
  const { id } = pre(repo, 'ls')
  const dir = join(repo, '.git', 'claude-bash-snap')
  const old = (Date.now() - 25 * 3600 * 1000) / 1000
  utimesSync(join(dir, `${id}.json`), old, old)
  const { id: nuevo } = pre(repo, 'ls')
  assert.deepEqual(readdirSync(dir), [`${nuevo}.json`])
})

// El registro de hooks es parte del contrato: sin esto el codigo existe y no corre.
test('config/settings.json registra los hooks nuevos con su matcher, if y timeout', () => {
  const s = JSON.parse(readFileSync(fileURLToPath(new URL('../../../config/settings.json', import.meta.url)), 'utf8'))
  const find = (event, cmd) =>
    (s.hooks[event] || []).flatMap((m) => m.hooks.map((h) => ({ ...h, matcher: m.matcher }))).find((h) => h.command.includes(cmd))
  const log = find('PreToolUse', 'work-repo.mjs log')
  assert.equal(log.matcher, 'Read|Grep|Glob|Edit|Write|MultiEdit|NotebookEdit|Bash')
  assert.equal(find('PreToolUse', 'review-gate.mjs pre-commit').if, 'Bash(git *)')
  for (const [event, mode] of [['PreToolUse', 'pre'], ['PostToolUse', 'post'], ['PostToolUseFailure', 'post-failure']]) {
    const h = find(event, `bash-writes.mjs ${mode}`)
    assert.equal(h.matcher, 'Bash|PowerShell', event)
    assert.equal(h.timeout, 15, event)
  }
})

test('un tool_use_id con ../ no escribe fuera del git-dir', () => {
  const repo = makeRepo()
  const { out } = pre(repo, 'ls', { id: '../../escape' })
  assert.equal(out, null)
  assert.equal(g(repo, 'status', '--porcelain'), '')
})

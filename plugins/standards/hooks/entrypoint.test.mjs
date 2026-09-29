import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, symlinkSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// ~/.claude/hooks es un symlink a este directorio: el entrypoint debe correr aunque argv[1]
// llegue por el symlink, o el hook permite todo en silencio.
const HOOKS_DIR = dirname(fileURLToPath(import.meta.url))
let tmp
let linked
let emptyCwd

before(() => {
  tmp = mkdtempSync(join(tmpdir(), 'hooks-entry-'))
  linked = join(tmp, 'hooks')
  symlinkSync(HOOKS_DIR, linked)
  emptyCwd = mkdtempSync(join(tmpdir(), 'hooks-cwd-'))
})

after(() => {
  rmSync(tmp, { recursive: true, force: true })
  rmSync(emptyCwd, { recursive: true, force: true })
})

function run(hook, payload, args = [], dir = linked) {
  const r = spawnSync('node', [join(dir, hook), ...args], {
    input: JSON.stringify({ ...payload, cwd: emptyCwd }),
    encoding: 'utf8',
  })
  return { stdout: r.stdout, stderr: r.stderr, status: r.status }
}

const DEPLOY = ['vercel', '--prod'].join(' ')
const askOf = (r) => JSON.parse(r.stdout).hookSpecificOutput.permissionDecision

test('pentest-scope corre por symlink y pide autorizacion', () => {
  const r = run('pentest-scope.mjs', { tool_name: 'Bash', tool_input: { command: 'ssh kalilab id' } })
  assert.equal(r.status, 0)
  assert.equal(askOf(r), 'ask')
})

test('release-gate corre por symlink y deniega el deploy sin dossier', () => {
  const r = run('release-gate.mjs', { tool_name: 'Bash', tool_input: { command: DEPLOY } })
  assert.equal(r.status, 0)
  assert.equal(askOf(r), 'deny')
})

test('review-gate corre por symlink y bloquea un reviewer sin VERDICT', () => {
  const r = run(
    'review-gate.mjs',
    { agent_type: 'code-reviewer', last_assistant_message: 'todo bien' },
    ['subagent-stop'],
  )
  assert.equal(r.status, 0)
  assert.equal(JSON.parse(r.stdout).decision, 'block')
})

test('pentest-scope permite en silencio un comando ajeno a KaliLab', () => {
  const r = run('pentest-scope.mjs', { tool_name: 'Bash', tool_input: { command: 'ssh github.com' } })
  assert.deepEqual([r.stdout, r.status], ['', 0])
})

test('release-gate permite en silencio un comando que no despliega', () => {
  const r = run('release-gate.mjs', { tool_name: 'Bash', tool_input: { command: 'ls -la' } })
  assert.deepEqual([r.stdout, r.status], ['', 0])
})

test('review-gate ignora en silencio a un agente que no es reviewer', () => {
  const r = run('review-gate.mjs', { agent_type: 'planner', last_assistant_message: 'plan' }, ['subagent-stop'])
  assert.deepEqual([r.stdout, r.status], ['', 0])
})

test('por la ruta real (sin symlink) la decision es la misma que por el symlink', () => {
  const payload = { tool_name: 'Bash', tool_input: { command: 'ssh kalilab id' } }
  const viaLink = run('pentest-scope.mjs', payload)
  const direct = run('pentest-scope.mjs', payload, [], HOOKS_DIR)
  assert.equal(direct.status, 0)
  assert.equal(askOf(direct), askOf(viaLink))
})

test('importar los modulos no ejecuta main()', () => {
  for (const hook of ['pentest-scope.mjs', 'release-gate.mjs', 'review-gate.mjs']) {
    const r = spawnSync('node', ['-e', `import(${JSON.stringify(join(HOOKS_DIR, hook))})`], {
      input: '',
      encoding: 'utf8',
      timeout: 3000,
    })
    assert.deepEqual([r.stdout, r.status], ['', 0], hook)
  }
})

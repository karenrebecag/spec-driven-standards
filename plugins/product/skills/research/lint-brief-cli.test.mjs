import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { lintFile, parseArgs } from './lint-brief.mjs'
import { brief } from './brief-fixture.mjs'

const CLI = join(dirname(fileURLToPath(import.meta.url)), 'lint-brief.mjs')

function setup(md, pkg = { dependencies: { react: '^19.0.0' } }, name = 'demo.md') {
  const dir = mkdtempSync(join(tmpdir(), 'brief-cli-'))
  const file = join(dir, name)
  writeFileSync(file, md)
  if (pkg !== null) writeFileSync(join(dir, 'package.json'), typeof pkg === 'string' ? pkg : JSON.stringify(pkg))
  return { dir, file }
}

const run = (...args) => {
  const r = spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' })
  return { ...r, lines: r.stdout.trim().split('\n') }
}

const validBrief = () => brief({ versiones: 'react=19' })

// --- parseArgs ---

test('parseArgs checks urls by default and --no-check-urls opts out', () => {
  assert.equal(parseArgs(['b.md']).checkUrls, true)
  assert.equal(parseArgs(['b.md', '--no-check-urls']).checkUrls, false)
  assert.equal(parseArgs(['b.md', '--check-urls']).checkUrls, true)
})

test('parseArgs resolves --project and takes the first positional as file', () => {
  const a = parseArgs(['b.md', '--project', '.'])
  assert.equal(a.file, 'b.md')
  assert.equal(a.project, resolve('.'))
})

test('parseArgs is independent of flag order', () => {
  const a = parseArgs(['b.md', '--project', '.', '--no-check-urls'])
  const b = parseArgs(['--no-check-urls', '--project', '.', 'b.md'])
  assert.deepEqual(a, b)
})

test('parseArgs treats a trailing --project as a usage error, not cwd', () => {
  const a = parseArgs(['b.md', '--project'])
  assert.ok(a.usageError)
  assert.equal(a.project, null)
  assert.ok(parseArgs(['--project', '--no-check-urls', 'b.md']).usageError)
})

// --- lintFile ---

test('lintFile returns the lint errors for a valid brief as empty', async () => {
  const { dir, file } = setup(validBrief())
  assert.deepEqual(await lintFile(file, { project: dir, checkUrls: false }), [])
})

test('lintFile merges URL failures from an injected fetcher as URL rule entries', async () => {
  const { dir, file } = setup(validBrief())
  const fetcher = async (url) => ({ ok: !url.includes('swift.org'), status: 404 })
  const errors = await lintFile(file, { project: dir, checkUrls: true, fetcher })
  assert.deepEqual(errors.map((e) => e.rule), ['URL'])
  assert.match(errors[0].message, /https:\/\/swift\.org\/docs: HTTP 404/)
})

test('lintFile does not call the fetcher when url checks are off', async () => {
  const { dir, file } = setup(validBrief())
  const fetcher = async () => assert.fail('no debia llamarse')
  assert.deepEqual(await lintFile(file, { project: dir, checkUrls: false, fetcher }), [])
})

test('lintFile reports a malformed package.json as PROJECT without a stack trace', async () => {
  const { dir, file } = setup(validBrief(), '{ not json')
  const errors = await lintFile(file, { project: dir, checkUrls: false })
  assert.deepEqual(errors.map((e) => e.rule), ['PROJECT'])
  assert.doesNotMatch(errors[0].message, /at |\.mjs|JSON\.parse/)
})

test('lintFile fails HEADER when the file name differs from the slug', async () => {
  const { dir, file } = setup(validBrief(), undefined, 'otro.md')
  const errors = await lintFile(file, { project: dir, checkUrls: false })
  assert.deepEqual(errors.map((e) => e.rule), ['HEADER'])
  assert.match(errors[0].message, /otro/)
  assert.match(errors[0].message, /demo/)
})

test('lintFile does not add a filename error when the slug is already invalid', async () => {
  const { dir, file } = setup(validBrief().replace('Slug: demo', 'Slug: Bad Slug'), undefined, 'x.md')
  const errors = await lintFile(file, { project: dir, checkUrls: false })
  assert.equal(errors.filter((e) => e.rule === 'HEADER').length, 1)
})

test('lintFile reports an unreadable brief as FILE', async () => {
  const { dir } = setup(validBrief())
  const errors = await lintFile(join(dir, 'nope.md'), { project: dir, checkUrls: false })
  assert.deepEqual(errors.map((e) => e.rule), ['FILE'])
})

// --- real CLI ---

test('CLI: a valid brief exits 0 with LINT: PASS errors=0 last', () => {
  const { dir, file } = setup(validBrief())
  const r = run(file, '--project', dir, '--no-check-urls')
  assert.equal(r.status, 0)
  assert.equal(r.lines.at(-1), 'LINT: PASS errors=0')
})

test('CLI: an invalid brief exits 1 with A1 lines and a matching FAIL count', () => {
  const { dir, file } = setup(brief({ versiones: 'react=19', bodies: { 7: '- sin marca' } }))
  const r = run(file, '--no-check-urls', '--project', dir)
  assert.equal(r.status, 1)
  assert.match(r.stdout, /^A1 \d+:/m)
  const errorLines = r.lines.slice(0, -1)
  assert.equal(r.lines.at(-1), `LINT: FAIL errors=${errorLines.length}`)
})

test('CLI: no file argument exits 2', () => {
  assert.equal(run('--no-check-urls').status, 2)
})

test('CLI: --project without a value exits 2', () => {
  const { file } = setup(validBrief())
  assert.equal(run(file, '--project').status, 2)
})

test('CLI: a missing file exits 2 and still prints the LINT line', () => {
  const { dir } = setup(validBrief())
  const r = run(join(dir, 'nope.md'), '--project', dir, '--no-check-urls')
  assert.equal(r.status, 2)
  assert.equal(r.lines.at(-1), 'LINT: FAIL errors=1')
  assert.doesNotMatch(r.stderr, /at .*\.mjs/)
})

test('CLI: a malformed package.json fails with PROJECT and no stack trace', () => {
  const { dir, file } = setup(validBrief(), '{ not json')
  const r = run(file, '--project', dir, '--no-check-urls')
  assert.equal(r.status, 1)
  assert.match(r.stdout, /^PROJECT 0:/m)
  assert.equal(r.lines.at(-1), 'LINT: FAIL errors=1')
  assert.equal(r.stderr, '')
})

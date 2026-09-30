import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseBrief, lintBrief, readProjectVersions, extractUrls } from './lint-brief.mjs'
import { brief, DEFAULTS } from './brief-fixture.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const rules = (md, pv) => lintBrief(md, pv).errors.map((e) => e.rule)
const swap = (md, from, to) => md.replace(from, () => to)
const template = () => readFileSync(join(here, 'brief-template.md'), 'utf8')

// --- template ---

test('the template shape parses: header keys and sections 1-11', () => {
  const p = parseBrief(template())
  assert.equal(p.header.nivel, 'standard')
  assert.equal(p.header.estado, 'BORRADOR')
  assert.equal(p.header.verificador, 'pendiente')
  assert.deepEqual(Object.keys(p.header.versiones), ['swift-tools'])
  assert.deepEqual(Object.keys(p.sections).map(Number), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
})

test('the raw template fails with PLACEHOLDER', () => {
  assert.ok(rules(template()).includes('PLACEHOLDER'))
})

test('with title, slug and date filled the template still fails only by PLACEHOLDER', () => {
  let md = swap(template(), '<titulo>', 'Demo')
  md = swap(md, '<slug>', 'demo')
  md = swap(md, 'Fecha: YYYY-MM-DD', 'Fecha: 2026-09-30')
  assert.deepEqual([...new Set(rules(md))], ['PLACEHOLDER'])
})

test('the template passes once every sample marker is replaced', () => {
  const md = template()
    .replaceAll('<titulo>', 'Demo')
    .replaceAll('<slug>', 'demo')
    .replaceAll('YYYY-MM-DD', '2026-09-30')
    .replaceAll('<app, tests, previews, CLI...>', 'app')
    .replaceAll('Ejemplo/Archivo', 'Demo/Main')
    .replaceAll('owner/repo', 'acme/demo')
    .replaceAll('example.com', 'docs.acme.dev')
    .replaceAll('0123abc', 'abc1234')
  assert.deepEqual(lintBrief(md).errors, [])
})

// --- PLACEHOLDER ---

const MARKERS = ['<slug>', '<titulo>', '<app, tests...>', 'Ejemplo/Archivo', 'owner/repo', 'example.com', '0123abc', 'YYYY-MM-DD']

test('each placeholder marker raises PLACEHOLDER on its own', () => {
  for (const m of MARKERS) assert.deepEqual(rules(brief({ bodies: { 1: `Texto ${m} aqui` } })), ['PLACEHOLDER'], m)
})

test('markers inside comments, fences and backtick spans are ignored', () => {
  assert.deepEqual(rules(brief({ bodies: { 1: 'Texto <!-- <slug> example.com -->' } })), [])
  assert.deepEqual(rules(brief({ bodies: { 1: '```\n<slug> owner/repo\n```' } })), [])
  assert.deepEqual(rules(brief({ bodies: { 1: 'Usa `<slug>` y `example.com` asi' } })), [])
})

test('comparison operators are not angle-bracket placeholders', () => {
  assert.deepEqual(rules(brief({ bodies: { 1: 'si a < b y c > d entonces x -> y' } })), [])
})

test('an unfilled placeholder date raises HEADER and PLACEHOLDER', () => {
  assert.deepEqual(rules(swap(brief(), '2026-09-30', 'YYYY-MM-DD')), ['HEADER', 'PLACEHOLDER'])
})

// --- valid brief and parse ---

test('a fully valid brief passes', () => {
  assert.deepEqual(lintBrief(brief()).errors, [])
  assert.equal(lintBrief(brief()).ok, true)
})

test('a CRLF brief passes and keeps line numbers', () => {
  assert.deepEqual(lintBrief(brief().replace(/\n/g, '\r\n')).errors, [])
  const md = brief({ bodies: { 2: '- sin marca\nContextos: app' } }).replace(/\n/g, '\r\n')
  const e = lintBrief(md).errors.find((x) => x.rule === 'A1')
  assert.equal(md.split('\r\n')[e.line - 1], '- sin marca')
})

test('parseBrief extracts header, versions and sections', () => {
  const p = parseBrief(brief({ versiones: 'swift-tools=6.2, node=20' }))
  assert.equal(p.header.slug, 'demo')
  assert.equal(p.header.nivel, 'standard')
  assert.equal(p.header.fecha, '2026-09-30')
  assert.equal(p.header.estado, 'BORRADOR')
  assert.equal(p.header.verificador, 'pendiente')
  assert.deepEqual(p.header.versiones, { 'swift-tools': '6.2', node: '20' })
  assert.match(p.sections[2], /Existe hoy/)
  assert.ok(Array.isArray(p.lines))
})

// --- HEADER, one condition at a time ---

test('HEADER: each invalid field fails alone', () => {
  const cases = {
    'slug ausente': swap(brief(), 'Slug: demo', 'Slug: '),
    'nivel': swap(brief(), 'Nivel: standard', 'Nivel: huge'),
    'fecha formato': swap(brief(), '2026-09-30', '30/09/2026'),
    'fecha 13-45': swap(brief(), '2026-09-30', '2026-13-45'),
    'fecha 02-30': swap(brief(), '2026-09-30', '2026-02-30'),
    'versiones': swap(brief(), 'Versiones: swift-tools=6.2\n', ''),
    'verificador ausente': swap(brief(), 'Verificador: pendiente\n', ''),
  }
  for (const [name, md] of Object.entries(cases)) assert.deepEqual(rules(md), ['HEADER'], name)
})

test('HEADER: an unknown Estado fails, and pendiente does not pass with it', () => {
  assert.deepEqual(rules(brief({ estado: 'HECHO', verificador: 'research-verifier 2026-09-30 AUTO' })), ['HEADER'])
  assert.deepEqual(rules(brief({ estado: 'HECHO' })), ['HEADER', 'HEADER'])
})

test('HEADER: no header at all fails', () => {
  assert.ok(rules('## 1. x\n\ntexto').includes('HEADER'))
})

test('HEADER: slug must be a safe lowercase token', () => {
  for (const s of ['../x', 'a;b', '$(x)', 'Demo', '-x', 'a b']) {
    assert.deepEqual(rules(swap(brief(), 'Slug: demo', `Slug: ${s}`)), ['HEADER'], s)
  }
  assert.deepEqual(rules(swap(brief(), 'Slug: demo', 'Slug: a1-b2')), [])
})

test('HEADER: Verificador pendiente only with BORRADOR', () => {
  for (const estado of ['AUTO', 'ESCALADO', 'APROBADO']) {
    assert.deepEqual(rules(brief({ estado, verificador: 'pendiente' })), ['HEADER'], estado)
  }
})

test('HEADER: verified states need a research-verifier line with a real date', () => {
  for (const v of ['research-verifier 2026-13-45 AUTO', 'research-verifier 2026-09-30 MAYBE', 'research-verifier AUTO', 'lint 2026-09-30']) {
    assert.deepEqual(rules(brief({ estado: 'AUTO', verificador: v })), ['HEADER'], v)
  }
})

test('HEADER: only quick may be verified by lint', () => {
  const quick = (v) => brief({ nivel: 'quick', only: [1, 3, 9, 11], estado: 'APROBADO', verificador: v })
  assert.deepEqual(rules(quick('lint 2026-09-30')), [])
  assert.deepEqual(rules(quick('lint 2026-02-30')), ['HEADER'])
})

// --- SECTIONS ---

test('a duplicated section heading is its own error', () => {
  const md = `${brief()}\n## 6. Otra\n\n- x [KAREN:a.md]\n`
  const r = lintBrief(md)
  assert.deepEqual(r.errors.map((e) => e.rule), ['SECTIONS'])
  assert.match(r.errors[0].message, /duplicad/)
  assert.match(r.errors[0].message, /6/)
})

test('quick level with only sections 1, 3, 9 and 11 passes', () => {
  assert.equal(lintBrief(brief({ nivel: 'quick', only: [1, 3, 9, 11] })).ok, true)
})

test('quick level missing a required section fails', () => {
  const r = lintBrief(brief({ nivel: 'quick', only: [1, 3, 11] }))
  assert.ok(r.errors.some((e) => e.rule === 'SECTIONS' && /9/.test(e.message)))
})

test('standard level missing section 6 fails', () => {
  const r = lintBrief(brief({ only: [1, 2, 3, 4, 5, 7, 8, 9, 10, 11] }))
  assert.ok(r.errors.some((e) => e.rule === 'SECTIONS' && /6/.test(e.message)))
})

test('deep level requires all sections', () => {
  assert.ok(rules(brief({ nivel: 'deep', only: [1, 3, 9, 11] })).includes('SECTIONS'))
})

test('empty sections fail', () => {
  const r = lintBrief(brief({ bodies: { 6: '' } }))
  assert.ok(r.errors.some((e) => e.rule === 'SECTIONS' && /6/.test(e.message)))
  assert.ok(rules(brief({ bodies: { 1: '   ' } })).includes('SECTIONS'))
})

// --- A1 ---

test('a list item without tag fails A1 with its line number', () => {
  const md = brief({ bodies: { 2: '- una afirmacion sin marca\nContextos: app' } })
  const e = lintBrief(md).errors.find((x) => x.rule === 'A1')
  assert.ok(e)
  assert.equal(md.split('\n')[e.line - 1], '- una afirmacion sin marca')
})

test('star bullets need tags', () => {
  assert.deepEqual(rules(brief({ bodies: { 8: '* sin marca' } })), ['A1'])
  assert.deepEqual(rules(brief({ bodies: { 8: '- x [doc:https://a.b@1]' } })), [])
})

test('A1 covers numbered items, prose and table rows in tagged sections', () => {
  const ok = '- x [KAREN:a.md]\n'
  assert.deepEqual(rules(brief({ bodies: { 7: `${ok}1. numerada sin marca` } })), ['A1'])
  assert.deepEqual(rules(brief({ bodies: { 7: `${ok}prosa libre sin marca` } })), ['A1'])
  assert.deepEqual(rules(brief({ bodies: { 6: '| a | b |\n|---|---|\n| fila sin marca | x |' } })), ['A1'])
  assert.deepEqual(rules(brief({ bodies: { 6: '| a | b |\n|---|---|\n| fila [doc:https://docs.acme.dev@1.0] | x |' } })), [])
})

test('A1 exempts table header row and separator, fences and headings', () => {
  const body = '- x [KAREN:a.md]\n```\ncodigo sin marca\n```\n### Sub\n'
  assert.deepEqual(rules(brief({ bodies: { 7: body } })), [])
  assert.deepEqual(rules(brief({ bodies: { 2: '1. cosa sin marca\nContextos: app' } })), ['A1'])
})

test('A1 does not apply to section 5, which only compares options cited elsewhere', () => {
  assert.deepEqual(rules(brief({ bodies: { 5: 'prosa sin marca\n- opcion sin marca' } })), [])
})

test('list items outside provenance sections do not need tags', () => {
  assert.deepEqual(rules(brief({ bodies: { 10: '- criterio sin marca', 1: '- pregunta sin marca' } })), [])
})

test('a malformed tag fails A1 even beside a valid one', () => {
  const body = '- x [KAREN:a.md] [ref:https://g.com/r@abc12]'
  const r = lintBrief(brief({ bodies: { 4: body } }))
  assert.deepEqual(r.errors.map((e) => e.rule), ['A1'])
  assert.match(r.errors[0].message, /malformed/i)
})

test('malformed ref sha counts as missing with its own message', () => {
  const e = lintBrief(brief({ bodies: { 4: '- Ref [ref:https://github.com/o/r@main]' } })).errors.find((x) => x.rule === 'A1')
  assert.match(e.message, /malformed/i)
})

test('ref sha must be 7-40 hex', () => {
  assert.deepEqual(rules(brief({ bodies: { 4: '- x [ref:https://g.com/r@abc12]' } })), ['A1'])
  assert.deepEqual(rules(brief({ bodies: { 4: `- x [ref:https://g.com/r@${'a'.repeat(41)}]` } })), ['A1'])
  assert.deepEqual(rules(brief({ bodies: { 4: `- x [ref:https://g.com/r@${'a'.repeat(40)}]` } })), [])
})

test('doc tag without a version fails', () => {
  assert.deepEqual(rules(brief({ bodies: { 6: '- x [doc:https://swift.org/docs@]' } })), ['A1'])
  assert.deepEqual(rules(brief({ bodies: { 6: '- x [doc:https://swift.org/docs]' } })), ['A1'])
})

test('repo tag needs a numeric line', () => {
  assert.deepEqual(rules(brief({ bodies: { 2: '- x [repo:Sources/A.swift:abc]\nContextos: app' } })), ['A1'])
})

test('repo tag path must be repo-relative', () => {
  const body = (p) => ({ 2: `- x [repo:${p}:1]\nContextos: app` })
  for (const p of ['/etc/passwd', '~/x.swift', '../x.swift', 'a/../b.swift', 'C:\\x.swift']) {
    assert.deepEqual(rules(brief({ bodies: body(p) })), ['A1'], p)
  }
  for (const p of ['Sources/A.swift', 'a..b/c.swift']) assert.deepEqual(rules(brief({ bodies: body(p) })), [], p)
})

test('KAREN tag must name its source', () => {
  assert.deepEqual(rules(brief({ bodies: { 7: '- x [KAREN:chat 2026-09-30]' } })), [])
  assert.deepEqual(rules(brief({ bodies: { 7: '- x [KAREN:discovery.md]' } })), [])
})

test('a bare or empty KAREN tag fails A1 as malformed and mentions the KAREN form', () => {
  for (const tag of ['[KAREN]', '[KAREN:]', '[KAREN: ]']) {
    const r = lintBrief(brief({ bodies: { 7: `- x ${tag}` } }))
    assert.deepEqual(r.errors.map((e) => e.rule), ['A1'], tag)
    assert.match(r.errors[0].message, /malformed/i)
    assert.match(r.errors[0].message, /KAREN:fuente/)
  }
})

// --- A2 ---

test('ASSUMPTION fails A2 in every section except 9, in any case', () => {
  for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 10, 11]) {
    const [first, ...rest] = DEFAULTS[n].split('\n')
    const body = [`${first} ASSUMPTION`, ...rest].join('\n')
    assert.deepEqual(rules(brief({ bodies: { [n]: body } })), ['A2'], `seccion ${n}`)
  }
  assert.deepEqual(rules(brief({ bodies: { 4: '- assumption algo [KAREN:a.md]' } })), ['A2'])
})

test('ASSUMPTION in section 9 needs prueba: on the same line', () => {
  assert.deepEqual(rules(brief({ bodies: { 9: '- ASSUMPTION: algo' } })), ['A2'])
  assert.deepEqual(rules(brief({ bodies: { 9: '- ASSUMPTION: algo\n  prueba: en otra linea' } })), ['A2'])
  assert.deepEqual(rules(brief({ bodies: { 9: '- ASSUMPTION: algo. Prueba: medir' } })), [])
})

test('A2 fires on its own in sections 1, 4 and 6 even with prueba: on the line, and 9 passes', () => {
  const line = (tag) => `ASSUMPTION algo prueba: medir ${tag}`.trim()
  assert.deepEqual(rules(brief({ bodies: { 1: line('') } })), ['A2'])
  assert.deepEqual(rules(brief({ bodies: { 4: `- ${line('[KAREN:a.md]')}` } })), ['A2'])
  assert.deepEqual(rules(brief({ bodies: { 6: `- ${line('[KAREN:a.md]')}` } })), ['A2'])
  assert.deepEqual(rules(brief({ bodies: { 9: `- ${line('')}` } })), [])
})

// --- A1 exemption scope ---

test('checkboxes are not exempt from A1 in tagged sections but are elsewhere', () => {
  for (const n of [3, 4, 6, 7, 8]) {
    assert.deepEqual(rules(brief({ bodies: { [n]: `${DEFAULTS[n]}\n- [ ] sin marca\n- [x] hecha` } })), ['A1', 'A1'], `seccion ${n}`)
  }
  assert.deepEqual(rules(brief({ bodies: { 2: `${DEFAULTS[2]}\n- [ ] sin marca` } })), ['A1'])
  assert.deepEqual(rules(brief({ bodies: { 7: `${DEFAULTS[7]}\n- [ ] con marca [KAREN:a.md]` } })), [])
  assert.deepEqual(rules(brief({ bodies: { 10: '- [ ] criterio\n- [x] otro' } })), [])
})

test('the Contextos exemption applies only in section 2', () => {
  assert.deepEqual(rules(brief({ bodies: { 6: `${DEFAULTS[6]}\nContextos: app` } })), ['A1'])
  assert.deepEqual(rules(brief({ bodies: { 7: `${DEFAULTS[7]}\n- Contextos: app` } })), ['A1'])
  assert.deepEqual(rules(brief({ bodies: { 2: '- Existe [repo:A.swift:1]\nContextos: app' } })), [])
})

// --- code fences ---

test('an unterminated fence is a FENCE error and does not hide later checks in its section', () => {
  const md = brief({ bodies: { 7: '- x [KAREN:a.md]\n```\ncodigo' } })
  const r = lintBrief(md)
  assert.deepEqual(r.errors.map((e) => e.rule), ['FENCE'])
  assert.equal(md.split('\n')[r.errors[0].line - 1], '```')
})

test('fences cannot span sections: the heading closes the state, reports FENCE and later sections are still linted', () => {
  const md = brief({ bodies: { 6: '- x [KAREN:a.md]\n```\ncodigo', 7: '- sin marca' } })
  assert.deepEqual(rules(md), ['FENCE', 'A1'])
})

test('a fence left open at the end of the file is a FENCE error', () => {
  assert.deepEqual(rules(brief({ bodies: { 11: '| 1 | T |\n~~~\nabierto' } })), ['FENCE'])
})

test('a heading inside a fence is still a heading for parseBrief', () => {
  const p = parseBrief('Slug: a\n\n## 1. Uno\n\n```\n## 2. Dos\nx\n```\n')
  assert.deepEqual(Object.keys(p.sections).map(Number), [1, 2])
})

test('balanced fences raise no FENCE error', () => {
  assert.deepEqual(rules(brief({ bodies: { 7: '- x [KAREN:a.md]\n```\ncodigo\n```\n~~~\nmas\n~~~' } })), [])
})

// --- Estado vs Verificador ---

const AUTO = 'research-verifier 2026-09-30 AUTO'
const ESC = 'research-verifier 2026-09-30 ESCALATE'
const quick = (estado, verificador) => brief({ nivel: 'quick', only: [1, 3, 9, 11], estado, verificador })

test('Estado AUTO requires a research-verifier AUTO verdict, or lint in quick', () => {
  assert.deepEqual(rules(brief({ estado: 'AUTO', verificador: AUTO })), [])
  assert.deepEqual(rules(brief({ estado: 'AUTO', verificador: ESC })), ['HEADER'])
  assert.deepEqual(rules(quick('AUTO', 'lint 2026-09-30')), [])
  assert.match(lintBrief(brief({ estado: 'AUTO', verificador: ESC })).errors[0].message, /AUTO/)
})

test('Estado ESCALADO requires research-verifier ESCALATE, never AUTO or lint', () => {
  assert.deepEqual(rules(brief({ estado: 'ESCALADO', verificador: ESC })), [])
  assert.deepEqual(rules(brief({ estado: 'ESCALADO', verificador: AUTO })), ['HEADER'])
  assert.deepEqual(rules(quick('ESCALADO', 'lint 2026-09-30')), ['HEADER'])
  assert.match(lintBrief(brief({ estado: 'ESCALADO', verificador: AUTO })).errors[0].message, /ESCALATE/)
})

test('Estado APROBADO accepts either verifier verdict', () => {
  assert.deepEqual(rules(brief({ estado: 'APROBADO', verificador: AUTO })), [])
  assert.deepEqual(rules(brief({ estado: 'APROBADO', verificador: ESC })), [])
  assert.deepEqual(rules(quick('APROBADO', 'lint 2026-09-30')), [])
})

// --- A3 ---

test('section 3 needs at least one doc tag', () => {
  const r = lintBrief(brief({ bodies: { 3: '- x [KAREN:a.md]' } }))
  assert.deepEqual(r.errors.map((e) => e.rule), ['A3'])
  assert.match(r.errors[0].message, /fuente primaria oficial/)
  assert.deepEqual(rules(brief({ bodies: { 3: '- x [KAREN:a.md]\n<!-- [doc:https://a.b@1] -->' } })), ['A3'])
})

test('versions mismatch fails as caducado', () => {
  const r = lintBrief(brief(), { 'swift-tools': '6.3' })
  assert.deepEqual(r.errors.map((e) => e.rule), ['A3'])
  assert.match(r.errors[0].message, /caducado/)
})

test('version comparison is component-prefix with range prefixes normalized', () => {
  const cmp = (brief_, proj) => rules(brief({ versiones: `k=${brief_}` }), { k: proj })
  for (const [b, p] of [['6.2', '6.2.0'], ['6.2.0', '6.2'], ['19', '^19.0.0'], ['6.2', '^6.2'], ['6.2', '>=v6.2'], ['18.2', '~18.2']]) {
    assert.deepEqual(cmp(b, p), [], `${b} vs ${p}`)
  }
  for (const [b, p] of [['6.2', '6.3'], ['6.2', '6.20'], ['19', '190.0.0'], ['6.2.1', '6.2.2']]) {
    assert.deepEqual(cmp(b, p), ['A3'], `${b} vs ${p}`)
  }
})

test('keys on only one side are ignored when another key is shared', () => {
  const md = brief({ versiones: 'swift-tools=6.2, react=19' })
  assert.deepEqual(rules(md, { 'swift-tools': '6.2', vue: '3' }), [])
})

test('an empty project or no shared key fails closed with A3', () => {
  for (const project of [{}, { react: '19' }]) {
    const r = lintBrief(brief(), project)
    assert.deepEqual(r.errors.map((e) => e.rule), ['A3'])
    assert.match(r.errors[0].message, /no se puede comprobar caducidad/)
  }
})

test('without a project object the expiry check is skipped', () => {
  assert.deepEqual(rules(brief(), undefined), [])
})

// --- BEST_PRACTICE ---

test('every best practice spelling without a tag fails, with a tag passes', () => {
  const phrases = ['buena practica', 'buenas prácticas', 'buenas practicas', 'Best Practice', 'best-practice', 'best-practices', 'best practices', 'mejor practica', 'Mejores prácticas']
  for (const p of phrases) {
    assert.deepEqual(rules(brief({ bodies: { 1: `Es ${p} usar X.` } })), ['BEST_PRACTICE'], p)
    assert.deepEqual(rules(brief({ bodies: { 1: `Es ${p} [KAREN:discovery.md]` } })), [], p)
  }
})

// --- comments ---

test('tags, ASSUMPTION and best practice inside HTML comments are ignored', () => {
  const md = brief({
    bodies: {
      2: '- Existe [repo:A.swift:1]\nContextos: app\n<!-- - sin marca\nASSUMPTION buena practica\n-->',
      8: '- Trampa [KAREN:discovery.md] <!-- best practice -->',
    },
  })
  assert.deepEqual(lintBrief(md).errors, [])
  assert.doesNotMatch(parseBrief(md).sections[2], /ASSUMPTION/)
})

test('multi-line comments keep line numbers stable', () => {
  const md = brief({ bodies: { 2: '<!--\n\n-->\n- sin marca\nContextos: app' } })
  const e = lintBrief(md).errors.find((x) => x.rule === 'A1')
  assert.equal(md.split('\n')[e.line - 1], '- sin marca')
})

// --- CONTEXTS ---

test('standard and deep require a Contextos line in section 2', () => {
  const noCtx = { 2: '- Existe [repo:A.swift:1]' }
  assert.deepEqual(rules(brief({ bodies: noCtx })), ['CONTEXTS'])
  assert.deepEqual(rules(brief({ nivel: 'deep', bodies: noCtx })), ['CONTEXTS'])
})

test('Contextos needs at least one item and accepts list form and any case', () => {
  const body = (l) => ({ 2: `- Existe [repo:A.swift:1]\n${l}` })
  assert.ok(rules(brief({ bodies: body('Contextos:') })).includes('CONTEXTS'))
  assert.ok(rules(brief({ bodies: body('Contextos:  , ') })).includes('CONTEXTS'))
  assert.equal(lintBrief(brief({ bodies: body('- contextos: app bundle, swift test') })).ok, true)
  assert.equal(lintBrief(brief({ bodies: body('CONTEXTOS: CLI') })).ok, true)
})

test('a Contextos list item does not need a provenance tag', () => {
  assert.ok(!rules(brief({ bodies: { 2: '- Existe [repo:A.swift:1]\n- Contextos: app, tests' } })).includes('A1'))
})

test('quick is exempt from CONTEXTS even with a section 2 lacking Contextos', () => {
  const md = brief({ nivel: 'quick', only: [1, 2, 3, 9, 11], bodies: { 2: '- Existe [repo:A.swift:1]' } })
  assert.deepEqual(lintBrief(md).errors, [])
})

// --- project versions and urls ---

test('readProjectVersions reads Package.swift and package.json', () => {
  const dir = mkdtempSync(join(tmpdir(), 'brief-'))
  writeFileSync(join(dir, 'Package.swift'), '// swift-tools-version: 6.2\nimport PackageDescription\n')
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ dependencies: { react: '^19.0.0' }, devDependencies: { vitest: '~2.1.0' }, engines: { node: '>=20' } }),
  )
  assert.deepEqual(readProjectVersions(dir), { 'swift-tools': '6.2', react: '^19.0.0', vitest: '~2.1.0', node: '>=20' })
})

test('readProjectVersions falls back to the running Node version when there is no manifest', () => {
  const dir = mkdtempSync(join(tmpdir(), 'brief-'))
  const nodeVersion = process.versions.node
  // Repo sin manifiesto: A3 debe poder comprobarse contra el runtime, no quedar sin clave.
  assert.deepEqual(readProjectVersions(dir), { node: nodeVersion })
  // Un package.json sin engines tampoco aporta claves: mismo fallback.
  writeFileSync(join(dir, 'package.json'), '{}')
  assert.deepEqual(readProjectVersions(dir), { node: nodeVersion })
})

test('an explicit engines.node overrides the runtime fallback', () => {
  const dir = mkdtempSync(join(tmpdir(), 'brief-'))
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ engines: { node: '>=20' } }))
  assert.deepEqual(readProjectVersions(dir), { node: '>=20' })
})

test('the fallback does not fire when a manifest contributed any key', () => {
  // Package.swift solo: hay clave (swift-tools), no se anade node.
  const swiftDir = mkdtempSync(join(tmpdir(), 'brief-'))
  writeFileSync(join(swiftDir, 'Package.swift'), '// swift-tools-version: 6.2\n')
  assert.deepEqual(readProjectVersions(swiftDir), { 'swift-tools': '6.2' })
  // package.json con deps y sin engines: hay claves (deps), no se anade node.
  const depsDir = mkdtempSync(join(tmpdir(), 'brief-'))
  writeFileSync(join(depsDir, 'package.json'), JSON.stringify({ dependencies: { react: '^19.0.0' } }))
  assert.deepEqual(readProjectVersions(depsDir), { react: '^19.0.0' })
})

test('a brief pinning node by major matches the runtime full version through A3', () => {
  // sameVersion compara solo los componentes que ambos declaran: node=22 casa con 22.11.0.
  assert.deepEqual(rules(brief({ versiones: 'node=22' }), { node: '22.11.0' }), [])
  assert.deepEqual(rules(brief({ versiones: 'node=22.11.0' }), { node: '22.11.0' }), [])
  assert.deepEqual(rules(brief({ versiones: 'node=21' }), { node: '22.11.0' }), ['A3'])
})

test('extractUrls returns unique urls from doc and ref tags only', () => {
  const md = brief({
    bodies: {
      3: '- a [doc:https://a.com/x@1] [doc:https://a.com/x@2]\n- b [KAREN:discovery.md] https://plain.com',
      4: '- c [ref:https://g.com/r@abc1234]\n<!-- [doc:https://hidden.com@1] -->',
      6: '- d [KAREN:discovery.md]',
      8: '- e [KAREN:discovery.md]',
    },
  })
  assert.deepEqual(extractUrls(md).sort(), ['https://a.com/x', 'https://g.com/r'])
})

#!/usr/bin/env node
// Linter determinista de Reference Briefs (formato en brief-template.md).
// Uso: node lint-brief.mjs <brief.md> [--project <dir>] [--no-check-urls]
// Ultima linea: `LINT: PASS errors=0` o `LINT: FAIL errors=N`; exit 1 en FAIL, 2 en error de uso o lectura.

import { readFileSync, realpathSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkUrls, createFetcher } from './url-check.mjs'

export { checkUrls }

const NIVELS = ['quick', 'standard', 'deep']
const ESTADOS = ['BORRADOR', 'AUTO', 'ESCALADO', 'APROBADO']
const REQUIRED = { quick: [1, 3, 9, 11] }
const ALL_SECTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
// La 5 queda fuera: compara opciones cuyas afirmaciones se citan en 2-4 y 6-8, y el verificador revisa la recomendacion.
const TAGGED_SECTIONS = [2, 3, 4, 6, 7, 8]
const CONTEXTS_LEVELS = ['standard', 'deep']

const HEADING = /^##\s+(\d+)\.\s/
const FENCE = /^\s*(?:```|~~~)/
const TABLE_ROW = /^\s*\|/
const TABLE_SEP = /^\s*\|[\s|:-]*-[\s|:-]*$/
// Sin fuente nombrada, KAREN es procedencia inventada: debe decir donde lo dijo Karen.
const TAG_OPEN = /\[(repo|doc|ref|KAREN)(?=[:\]])/g
const TAG_SHAPES = {
  repo: /\[repo:([^\]\s]+):\d+\]/y,
  doc: /\[doc:[^\]\s]+@[^\]\s@]+\]/y,
  ref: /\[ref:[^\]\s]+@[0-9a-fA-F]{7,40}\]/y,
  KAREN: /\[KAREN:[^\]\s][^\]]*\]/y,
}
// La linea Contextos: es metadato de la seccion 2 (no una afirmacion) y exige su propio contenido; en otras secciones no esta exenta.
const CONTEXTS_LINE = /^\s*(?:-\s+)?Contextos:\s*(.*)$/im
const URL_TAG = /\[(?:doc|ref):([^\]\s]+)@[^\]\s@]*\]/g
const BEST_PRACTICE = /best[\s-]+practices?|buenas?\s+pr[aá]cticas?|mejor(?:es)?\s+pr[aá]cticas?/i
const ASSUMPTION = /\bASSUMPTION\b/i
const ANGLE_PLACEHOLDER = /<[^\s<>][^<>\n]*>/
const SAMPLE_MARKERS = /Ejemplo\/Archivo|owner\/repo|example\.com|0123abc|YYYY-MM-DD/i
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/
const VERIFIER_RV = /^research-verifier (\d{4}-\d{2}-\d{2}) (AUTO|ESCALATE)$/
const VERIFIER_LINT = /^lint (\d{4}-\d{2}-\d{2})$/

// LINT solo llega aqui en quick (lintVerifier ya descarto lint en otros niveles). APROBADO acepta cualquier veredicto.
const ESTADO_VERDICTS = { AUTO: ['AUTO', 'LINT'], ESCALADO: ['ESCALATE'], APROBADO: ['AUTO', 'ESCALATE', 'LINT'] }
const EXPECTED_TEXT = { AUTO: 'research-verifier AUTO, o lint en quick', ESCALADO: 'research-verifier ESCALATE', APROBADO: 'cualquier veredicto' }

const normalize = (md) => String(md ?? '').replace(/\r\n?/g, '\n')

// Reemplaza el comentario por espacios conservando saltos de linea: los numeros de linea no se mueven.
function stripComments(md) {
  return md.replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, ' '))
}

function parseVersions(text) {
  const out = {}
  for (const pair of text.split(',')) {
    const i = pair.indexOf('=')
    if (i > 0) out[pair.slice(0, i).trim()] = pair.slice(i + 1).trim()
  }
  return out
}

function parseHeaderLine(line, header) {
  if (/^Slug:/i.test(line)) {
    for (const part of line.split('|')) {
      const m = part.match(/^\s*(Slug|Nivel|Fecha|Estado):\s*(.*?)\s*$/i)
      if (m) header[m[1].toLowerCase()] = m[2]
    }
  }
  const v = line.match(/^Versiones:\s*(.*)$/i)
  if (v) header.versiones = parseVersions(v[1])
  const ver = line.match(/^Verificador:\s*(.*?)\s*$/i)
  if (ver) header.verificador = ver[1]
}

export function parseBrief(md) {
  const lines = stripComments(normalize(md)).split('\n')
  const header = { slug: '', nivel: '', fecha: '', estado: '', versiones: {}, verificador: null }
  const buckets = {}
  const duplicates = []
  let current = null

  lines.forEach((line, i) => {
    const h = line.match(HEADING)
    if (h) {
      current = Number(h[1])
      if (current in buckets) duplicates.push({ n: current, line: i + 1 })
      else buckets[current] = []
      return
    }
    if (current !== null) buckets[current].push(line)
    else parseHeaderLine(line, header)
  })

  const sections = Object.fromEntries(Object.entries(buckets).map(([n, ls]) => [n, ls.join('\n').trim()]))
  return { header, sections, lines, duplicates }
}

function isRealDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

function lintVerifier(header, err) {
  const v = header.verificador
  if (v === null) return err('HEADER', 1, 'falta la linea "Verificador:"')
  if (/^pendiente$/i.test(v)) {
    if (header.estado !== 'BORRADOR') err('HEADER', 1, `Verificador pendiente solo es valido con Estado BORRADOR (Estado: ${header.estado})`)
    return
  }
  const rv = v.match(VERIFIER_RV)
  const m = rv ?? (header.nivel === 'quick' ? v.match(VERIFIER_LINT) : null)
  if (!m || !isRealDate(m[1])) {
    return err('HEADER', 1, `Verificador invalido "${v}" (research-verifier YYYY-MM-DD AUTO|ESCALATE; lint YYYY-MM-DD solo en quick)`)
  }
  const verdict = rv ? rv[2] : 'LINT'
  const allowed = ESTADO_VERDICTS[header.estado]
  if (allowed && !allowed.includes(verdict)) {
    err('HEADER', 1, `Estado ${header.estado} no concuerda con Verificador "${v}" (se espera ${EXPECTED_TEXT[header.estado]})`)
  }
}

function lintHeader(header, md, err) {
  const need = (ok, msg) => ok || err('HEADER', 1, msg)
  need(header.slug, 'slug ausente')
  if (header.slug) need(SLUG_RE.test(header.slug), `slug invalido "${header.slug}" (${SLUG_RE})`)
  need(NIVELS.includes(header.nivel), `nivel invalido "${header.nivel}" (quick|standard|deep)`)
  need(isRealDate(header.fecha), `fecha invalida "${header.fecha}" (fecha real YYYY-MM-DD)`)
  need(ESTADOS.includes(header.estado), `estado invalido "${header.estado}"`)
  need(Object.keys(header.versiones).length > 0 && /^Versiones:/im.test(stripComments(md)), 'versiones ausentes (Versiones: k=v)')
  lintVerifier(header, err)
}

function lintSections({ header, sections, duplicates }, err) {
  for (const { n, line } of duplicates) err('SECTIONS', line, `la seccion ${n} esta duplicada`)
  const required = REQUIRED[header.nivel] ?? (NIVELS.includes(header.nivel) ? ALL_SECTIONS : [])
  for (const n of required) {
    if (!(n in sections)) err('SECTIONS', 1, `falta la seccion ${n}`)
    else if (!sections[n]) err('SECTIONS', 1, `la seccion ${n} esta vacia`)
  }
}

// Una ruta de [repo:...] que escapa del repo no es procedencia: es una lectura arbitraria del disco.
const isRepoRelative = (p) => !/^(?:[/~]|[A-Za-z]:)/.test(p) && !p.split(/[\\/]/).includes('..')

function scanTags(line) {
  const valid = []
  let malformed = 0
  for (const m of line.matchAll(TAG_OPEN)) {
    const re = TAG_SHAPES[m[1]]
    re.lastIndex = m.index
    const hit = re.exec(line)
    if (hit && (m[1] !== 'repo' || isRepoRelative(hit[1]))) valid.push(m[1])
    else malformed++
  }
  return { valid, malformed }
}

function lintProvenance(line, no, headerRow, section, err) {
  const t = line.trim()
  if (!t || headerRow || TABLE_SEP.test(line) || (section === 2 && CONTEXTS_LINE.test(line)) || /^#{1,6}\s/.test(t)) return
  const { valid, malformed } = scanTags(line)
  if (malformed) err('A1', no, 'malformed tag (repo:ruta-relativa:N, doc:url@version, ref:url@sha 7-40 hex, KAREN:fuente)')
  else if (!valid.length) err('A1', no, 'afirmacion sin marca de procedencia')
}

function lintPlaceholder(line, no, err) {
  const visible = line.replace(/`[^`\n]*`/g, (s) => ' '.repeat(s.length))
  if (ANGLE_PLACEHOLDER.test(visible) || SAMPLE_MARKERS.test(visible)) err('PLACEHOLDER', no, 'placeholder del template sin reemplazar')
}

function lintLines(lines, err) {
  let section = null
  let fencedAt = 0
  let prevRow = false
  // WHY: un fence sin cerrar apagaria todas las comprobaciones hasta el final del archivo. Decision:
  // un fence no cruza secciones; un encabezado `## N.` siempre es encabezado (igual que en parseBrief),
  // cierra el estado y reporta FENCE en la linea donde se abrio el fence.
  const closeFence = () => {
    if (fencedAt) err('FENCE', fencedAt, 'bloque de codigo sin cerrar al final de la seccion o del archivo')
    fencedAt = 0
  }
  lines.forEach((line, i) => {
    const no = i + 1
    const h = line.match(HEADING)
    if (h) closeFence()
    const isFence = !h && FENCE.test(line)
    if (isFence) fencedAt = fencedAt ? 0 : no
    const fenced = fencedAt > 0

    if (BEST_PRACTICE.test(line) && !scanTags(line).valid.length) err('BEST_PRACTICE', no, 'best practice sin marca de procedencia')
    if (ASSUMPTION.test(line)) {
      if (section !== 9) err('A2', no, `ASSUMPTION no permitido en la seccion ${section ?? 'del encabezado'}`)
      else if (!/prueba:/i.test(line)) err('A2', no, 'ASSUMPTION en la seccion 9 requiere "prueba:" en la misma linea')
    }
    if (isFence || fenced) return

    if (h) section = Number(h[1])
    const row = TABLE_ROW.test(line)
    const headerRow = row && !prevRow
    prevRow = row
    if (h) return
    lintPlaceholder(line, no, err)
    if (TAGGED_SECTIONS.includes(section)) lintProvenance(line, no, headerRow, section, err)
  })
  closeFence()
}

// Un comportamiento verificado en un solo contexto (app, swift test, previews, CLI) no vale para los demas.
function lintContexts(header, sections, err) {
  if (!CONTEXTS_LEVELS.includes(header.nivel) || !sections[2]) return
  const m = sections[2].match(CONTEXTS_LINE)
  if (!m || !m[1].split(',').some((item) => item.trim())) {
    err('CONTEXTS', 1, 'la seccion 2 necesita "Contextos: <app, tests, previews, CLI...>" con al menos un contexto')
  }
}

function lintPrimarySource(sections, err) {
  if (!sections[3]) return
  let fenced = false
  const hasDoc = sections[3].split('\n').some((line) => {
    if (FENCE.test(line)) return void (fenced = !fenced)
    return !fenced && scanTags(line).valid.includes('doc')
  })
  if (!hasDoc) err('A3', 1, 'la seccion 3 necesita al menos una fuente primaria oficial [doc:url@version]')
}

const normVersion = (v) => String(v).trim().replace(/^(?:\^|~|>=|v)+/i, '')

// 6.2 == 6.2.0 y 19 == ^19.0.0: se comparan solo los componentes que ambos lados declaran.
function sameVersion(a, b) {
  const x = normVersion(a).split('.')
  const y = normVersion(b).split('.')
  return x.slice(0, Math.min(x.length, y.length)).every((c, i) => c === y[i])
}

// La version dentro de [doc:url@v] no se compara aqui: las versiones de docs no mapean a claves
// del proyecto; la comprueba el verificador.
function lintVersions(header, project, err) {
  if (!project) return
  const shared = Object.keys(header.versiones).filter((k) => Object.hasOwn(project, k))
  if (!shared.length) {
    return err('A3', 1, 'no se puede comprobar caducidad: el brief y el proyecto no comparten ninguna version')
  }
  for (const key of shared) {
    if (!sameVersion(header.versiones[key], project[key])) {
      err('A3', 1, `brief caducado: ${key}=${header.versiones[key]} en el brief, ${project[key]} en el proyecto`)
    }
  }
}

// projectVersions undefined = sin proyecto, se omite la caducidad; un objeto (incluso vacio) la exige.
export function lintBrief(md, projectVersions) {
  const errors = []
  const err = (rule, line, message) => errors.push({ rule, line, message })
  const text = normalize(md)
  const parsed = parseBrief(text)
  lintHeader(parsed.header, text, err)
  lintSections(parsed, err)
  lintLines(parsed.lines, err)
  lintContexts(parsed.header, parsed.sections, err)
  lintPrimarySource(parsed.sections, err)
  lintVersions(parsed.header, projectVersions, err)
  return { ok: errors.length === 0, errors }
}

function readIfExists(path) {
  try {
    return readFileSync(path, 'utf8')
  } catch (e) {
    if (e.code === 'ENOENT') return null
    throw e
  }
}

export function readProjectVersions(dir) {
  const out = {}
  const swift = readIfExists(join(dir, 'Package.swift'))
  const tools = swift && swift.match(/swift-tools-version:\s*([\w.]+)/)
  if (tools) out['swift-tools'] = tools[1]

  const pkg = readIfExists(join(dir, 'package.json'))
  if (pkg) {
    const json = JSON.parse(pkg)
    Object.assign(out, json.dependencies, json.devDependencies)
    if (json.engines?.node) out.node = json.engines.node
  }
  return out
}

export function extractUrls(md) {
  const urls = new Set()
  for (const m of stripComments(normalize(md)).matchAll(URL_TAG)) urls.add(m[1])
  return [...urls]
}

export function parseArgs(argv) {
  const args = { file: null, project: process.cwd(), checkUrls: true, usageError: null }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--project') {
      const value = argv[i + 1]
      if (value === undefined || value.startsWith('--')) {
        args.project = null
        args.usageError = '--project requiere un directorio'
      } else args.project = resolve(argv[++i])
    } else if (argv[i] === '--no-check-urls') args.checkUrls = false
    else if (argv[i] === '--check-urls') args.checkUrls = true
    else if (!args.file) args.file = argv[i]
  }
  return args
}

// Devuelve siempre la lista de errores (incluidos FILE y PROJECT) para que main solo imprima.
export async function lintFile(path, { project = process.cwd(), checkUrls: check = true, fetcher } = {}) {
  let md
  try {
    md = readFileSync(path, 'utf8')
  } catch (e) {
    return [{ rule: 'FILE', line: 0, message: `no se puede leer el brief (${e.code ?? 'error'})` }]
  }
  const extra = []
  let versions
  try {
    versions = readProjectVersions(project)
  } catch {
    // Sin versiones fiables, compararlas daria un A3 enganoso sobre un problema que es del proyecto.
    extra.push({ rule: 'PROJECT', line: 0, message: 'package.json invalido o ilegible en el proyecto' })
  }
  const errors = [...lintBrief(md, versions).errors, ...extra]
  const slug = parseBrief(md).header.slug
  const name = basename(path, '.md')
  // Si el slug ya es invalido o falta, HEADER ya lo reporto: no se duplica.
  if (SLUG_RE.test(slug) && name !== slug) {
    errors.push({ rule: 'HEADER', line: 1, message: `el archivo "${name}.md" no coincide con el slug "${slug}"` })
  }
  if (check) {
    for (const f of await checkUrls(extractUrls(md), fetcher ?? createFetcher())) {
      errors.push({ rule: 'URL', line: 0, message: `${f.url}: ${f.reason}` })
    }
  }
  return errors
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.file || args.usageError) {
    console.error(args.usageError ?? 'Falta el brief.')
    console.error('Uso: node lint-brief.mjs <brief.md> [--project <dir>] [--no-check-urls]')
    process.exitCode = 2
    return
  }
  const errors = await lintFile(args.file, args)
  for (const e of errors) console.log(`${e.rule} ${e.line}: ${e.message}`)
  console.log(errors.length ? `LINT: FAIL errors=${errors.length}` : 'LINT: PASS errors=0')
  process.exitCode = errors.some((e) => e.rule === 'FILE') ? 2 : errors.length ? 1 : 0
}

// Solo corre como CLI, no cuando el test lo importa; se comparan realpaths por si hay symlinks.
function isEntrypoint() {
  try {
    return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
  } catch {
    return false
  }
}

if (isEntrypoint()) main()

#!/usr/bin/env node
// Nucleo mecanico del release-verifier, extraido de la prosa del agente para que sea determinista
// y testeable: por cada test de regresion que nombra un reporte de pentest, prueba que estuvo ROJO
// antes del fix y que pasa ahora. El agente lo invoca por hallazgo y cuenta; no reimplementa esto.
//
// "Fue rojo" se mide con una senal DOCUMENTADA: `import()` del archivo de test en un hijo.
//   exit 3 = el grafo del modulo no carga (fixture/modulo que solo anade el fix) -> unverified
//   exit 1 = cargo y un test fallo (la asercion del vector) -> fue rojo
//   exit 0 = cargo y paso -> el vector no se reprodujo -> unverified
// (ESM: import() rechaza en error de carga; node:test fija exit 1 si un test falla.)
//
// Solo Node stdlib. No ejecuta ninguna cadena del reporte: solo el archivo de test nombrado.

import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, isAbsolute, relative, sep } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim()
}

// El path del reporte es dato hostil. Rechaza inyeccion de opciones (guion inicial), rutas
// absolutas, traversal y NUL; exige que `realpath` quede dentro de la raiz (un symlink no puede
// sacar la ejecucion del arbol). Devuelve la ruta absoluta segura, o null.
export function validateRegresionPath(root, p) {
  if (typeof p !== 'string' || p === '') return null
  if (p.startsWith('-')) return null
  if (p.includes('\0')) return null
  if (isAbsolute(p)) return null
  if (p.split(/[\\/]/).includes('..')) return null
  let real
  let realRoot
  try {
    real = realpathSync(join(root, p))
    realRoot = realpathSync(root)
  } catch {
    return null
  }
  if (real !== realRoot && !real.startsWith(realRoot + sep)) return null
  return join(root, p)
}

// La base del hallazgo: el merge-base con la rama por defecto. En el merge-base ningun fix de la
// rama esta presente, asi que el test restaurado de HEAD debe ir rojo ahi. El formato del reporte
// no nombra el commit de fix, por eso no se usa `fixsha^`.
// `allowRoot` controla el fallback. En la reconstruccion de la base (verifyFinding) conviene caer
// al commit raiz. Para la atadura por diff (release-gate) NO: diffear contra el raiz haria que el
// diff sea todo el historial y la atadura se anularia en silencio, asi que alli se pasa false y un
// repo sin rama por defecto devuelve null (el llamador omite la atadura, no la finge).
export function branchBase(cwd, { allowRoot = true } = {}) {
  for (const ref of ['origin/HEAD', 'origin/main', 'origin/master', 'main', 'master']) {
    try {
      return git(cwd, ['merge-base', 'HEAD', ref])
    } catch {
      // ref ausente: probar el siguiente
    }
  }
  if (!allowRoot) return null
  try {
    return git(cwd, ['rev-list', '--max-parents=0', 'HEAD']).split('\n')[0]
  } catch {
    return null
  }
}

// exit 3 = no carga; 1 = cargo y fallo (rojo); 0 = cargo y paso; otro = ambiguo.
function probe(cwd, absTest) {
  const url = pathToFileURL(absTest).href
  const r = spawnSync(process.execPath, ['-e', `import(${JSON.stringify(url)}).catch(() => { process.exitCode = 3 })`], {
    cwd,
    encoding: 'utf8',
    timeout: 60_000,
  })
  return r.status
}

// Devuelve { status: 'closed'|'unverified', reason }. closed solo si el test carga, estuvo rojo en
// la base, y pasa en HEAD. Cualquier duda cae a unverified (falso negativo, nunca falso positivo).
export function verifyFinding(cwd, testPathRaw) {
  const abs = validateRegresionPath(cwd, testPathRaw)
  if (!abs) return { status: 'unverified', reason: `ruta de test invalida o fuera del repo: ${testPathRaw}` }
  const rel = relative(cwd, abs)

  let headSha
  let base
  try {
    headSha = git(cwd, ['rev-parse', 'HEAD'])
    base = branchBase(cwd)
  } catch (e) {
    return { status: 'unverified', reason: `git no disponible: ${e && e.message ? e.message : e}` }
  }
  if (!base) return { status: 'unverified', reason: 'no se pudo determinar la base (merge-base)' }

  // (c) debe pasar en HEAD: si no, el fix no esta verde.
  const atHead = probe(cwd, abs)
  if (atHead !== 0) return { status: 'unverified', reason: `el test no pasa en HEAD (probe exit ${atHead})` }

  const tmp = mkdtempSync(join(tmpdir(), 'relverify-'))
  const wt = join(tmp, 'wt')
  try {
    git(cwd, ['worktree', 'add', '--detach', '--quiet', wt, base])
    // Restaurar SOLO el test desde el HEAD real del repo principal. Dentro del worktree detached,
    // su HEAD es la base: usar el SHA del HEAD principal, no la palabra HEAD.
    git(wt, ['checkout', headSha, '--', rel])
    // Exigir que en la base solo cambie el test; si cambio algo mas, la prueba no aisla el fix.
    const changed = git(wt, ['status', '--porcelain', '-z']).split('\0').map((s) => s.slice(3)).filter(Boolean)
    if (changed.length !== 1 || changed[0] !== rel) {
      return { status: 'unverified', reason: `la base cambio mas que el test (${changed.join(', ') || 'nada'})` }
    }
    // Revalidar dentro del worktree: un test que sea symlink podria salir del arbol al restaurarlo.
    const absBase = validateRegresionPath(wt, rel)
    if (!absBase) return { status: 'unverified', reason: 'el test resuelve fuera del arbol en la base (symlink)' }

    const atBase = probe(wt, absBase)
    if (atBase === 3) return { status: 'unverified', reason: 'el test no carga en la base (fixture/modulo que solo anade el fix)' }
    if (atBase === 0) return { status: 'unverified', reason: 'el test pasa en la base: el vector no se reprodujo' }
    if (atBase !== 1) return { status: 'unverified', reason: `resultado ambiguo en la base (probe exit ${atBase})` }
    return { status: 'closed', reason: '' }
  } catch (e) {
    return { status: 'unverified', reason: `error reconstruyendo la base: ${e && e.message ? e.message : e}` }
  } finally {
    try {
      git(cwd, ['worktree', 'remove', '--force', wt])
    } catch {
      // un worktree que ya no esta, o un git que fallo: el rmSync de abajo limpia el tmp
    }
    try {
      rmSync(tmp, { recursive: true, force: true })
    } catch {
      // nada que limpiar
    }
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
  const res = verifyFinding(process.cwd(), process.argv[2])
  process.stdout.write(JSON.stringify(res) + '\n')
  process.exit(0)
}

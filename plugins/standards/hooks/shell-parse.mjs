// Lexer de shell minimo para los gates: subcomandos, palabras, redirecciones y el texto de las
// sustituciones. No ejecuta ni expande nada; lo que no se puede saber sin ejecutar queda marcado como
// dinamico y el que llama decide (los gates lo tratan como "no se resuelve").
//
// HACK: no es un parser de shell completo (sin case/esac, funciones, alias, `eval`). Cubre las formas
// que usan los agentes y las que la regex vieja de review-gate atrapaba. Pasar a un parser real
// (mvdan/sh via binario, o tree-sitter-bash) cuando un caso real de esas formas escape a un gate.

// Contexto en `idx` de una linea: dentro de comillas, de aritmetica `$((...))`, de un comentario, o codigo.
function contextAt(line, idx) {
  let q = null
  let arith = 0
  for (let i = 0; i < idx; i++) {
    const c = line[i]
    if (q) {
      if (c === '\\' && q === '"') i++
      else if (c === q) q = null
      continue
    }
    if (c === "'" || c === '"') q = c
    else if (c === '\\') i++
    else if (c === '#' && (i === 0 || /\s/.test(line[i - 1]))) return 'comment'
    else if (line.startsWith('$((', i)) {
      arith++
      i += 2
    } else if (arith && line.startsWith('))', i)) {
      arith--
      i++
    }
  }
  if (q) return 'quote'
  return arith ? 'arith' : 'code'
}

// Quita el cuerpo de los heredocs: un `cd` o un `git commit` dentro de un heredoc es texto, no comando.
// Un `<<` entre comillas, en aritmetica o en un comentario no abre heredoc (se tragaba las lineas siguientes).
export function stripHeredocs(cmd) {
  const out = []
  const pending = []
  for (const line of cmd.split('\n')) {
    if (pending.length) {
      const { word, tabs } = pending[0]
      if ((tabs ? line.replace(/^\t+/, '') : line) === word) pending.shift()
      continue
    }
    out.push(line)
    for (const m of line.matchAll(/(?<!<)<<(?!<)(-?)\s*(['"]?)([A-Za-z_][\w-]*)\2/g)) {
      if (contextAt(line, m.index) === 'code') pending.push({ word: m[3], tabs: m[1] === '-' })
    }
  }
  return out.join('\n')
}

class Lexer {
  constructor(src) {
    this.src = src
    this.subs = []
    this.inners = []
    this.words = []
    this.cur = null
    this.dyn = false
    this.subshell = false
    this.q = null
  }

  start() {
    if (this.cur === null) this.cur = ''
  }

  pushWord() {
    if (this.cur !== null) this.words.push({ text: this.cur, dynamic: this.dyn })
    this.cur = null
    this.dyn = false
  }

  endSub() {
    this.pushWord()
    if (this.words.length) this.subs.push({ words: this.words, subshell: this.subshell })
    this.words = []
    this.subshell = false
  }

  // Guarda el texto de `$(...)` o de `` `...` `` para analizarlo aparte; la palabra queda dinamica.
  capture(from, close, nests) {
    const s = this.src
    let depth = 1
    let q = null
    let j = from
    for (; j < s.length; j++) {
      const c = s[j]
      if (q) {
        if (c === q) q = null
      } else if (c === "'" || c === '"') q = c
      else if (nests && c === '(') depth++
      else if (c === close && --depth === 0) break
    }
    this.inners.push(s.slice(from, j))
    this.start()
    this.cur += '$()'
    this.dyn = true
    return j
  }

  // `>`, `>>`, `>|`, `2>`, `&>`, `2>&1`: un token propio, asi `a>b` y `echo ">x"` no se confunden.
  redirect(i) {
    const s = this.src
    let op = ''
    if (this.cur !== null && /^(\d+|&)$/.test(this.cur)) {
      op = this.cur
      this.cur = null
      this.dyn = false
    } else this.pushWord()
    op += '>'
    if (s[i + 1] === '>' || s[i + 1] === '|') op += s[++i]
    if (s[i + 1] === '&') {
      op += s[++i]
      while (/[\d-]/.test(s[i + 1] || '')) op += s[++i]
    }
    this.words.push({ text: op, dynamic: false, op: true })
    return i
  }

  quoted(c, i) {
    const s = this.src
    if (c === this.q) this.q = null
    else if (this.q === "'") this.cur += c
    else if (c === '\\' && i + 1 < s.length) this.cur += s[++i]
    else if (c === '$' && s[i + 1] === '(') i = this.capture(i + 2, ')', true)
    else if (c === '`') i = this.capture(i + 1, '`', false)
    else {
      if (c === '$') this.dyn = true
      this.cur += c
    }
    return i
  }

  // Un caracter fuera de comillas. Devuelve el indice donde quedo.
  bare(c, i) {
    const s = this.src
    if (c === "'" || c === '"') {
      this.start()
      this.q = c
    } else if (c === '\\' && i + 1 < s.length) {
      this.start()
      if (s[++i] !== '\n') this.cur += s[i]
    } else if (c === ' ' || c === '\t') this.pushWord()
    else if (c === '#' && this.cur === null) {
      while (i + 1 < s.length && s[i + 1] !== '\n') i++
    } else if (c === '\n' || c === ';') this.endSub()
    else if (c === '>') i = this.redirect(i)
    else if (c === '&' && s[i + 1] === '>') {
      this.pushWord()
      this.cur = '&'
    } else if (c === '&' || c === '|') {
      this.endSub()
      if (s[i + 1] === c || (c === '|' && s[i + 1] === '&')) i++
    } else if (c === '$' && s[i + 1] === '(') i = this.capture(i + 2, ')', true)
    else if (c === '`') i = this.capture(i + 1, '`', false)
    else if (c === '(' || c === ')') {
      this.pushWord()
      this.subshell = true
    } else {
      if (c === '$' || (c === '~' && this.cur === null)) this.dyn = true
      this.start()
      this.cur += c
    }
    return i
  }

  run() {
    const s = this.src
    for (let i = 0; i < s.length; i++) i = this.q ? this.quoted(s[i], i) : this.bare(s[i], i)
    this.endSub()
    return { subs: this.subs, inners: this.inners }
  }
}

// { subs: [{ words: [{ text, dynamic, op? }], subshell }], inners: [texto de cada sustitucion] }
export function parseShell(command) {
  return new Lexer(stripHeredocs(String(command ?? ''))).run()
}

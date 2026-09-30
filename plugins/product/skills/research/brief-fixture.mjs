// Soporte de tests (no es un *.test.mjs): un brief valido por construccion y sus piezas.
export const SHA = 'abc1234'

export const DEFAULTS = {
  1: 'Que decidir.',
  2: '- Existe hoy [repo:Sources/A.swift:42]\nContextos: app, swift test',
  3: '- Fuente [doc:https://swift.org/docs@6.2]',
  4: `- Ref [ref:https://github.com/acme/demo/blob/${SHA}/f@${SHA}]`,
  5: '| A | B |',
  6: '- Contra [doc:https://docs.acme.dev@1.0]',
  7: '- Ejemplo [KAREN:discovery.md]',
  8: '- Trampa [doc:https://docs.acme.dev@1.0]',
  9: '- incertidumbre menor',
  10: '- [ ] criterio',
  11: '| 1 | Titulo |',
}

// Builds a brief with every section filled with valid content; bodies replace a section body.
export function brief({
  nivel = 'standard',
  versiones = 'swift-tools=6.2',
  estado = 'BORRADOR',
  verificador = 'pendiente',
  only,
  bodies = {},
} = {}) {
  const nums = only ?? Object.keys(DEFAULTS).map(Number)
  const body = nums.map((n) => `## ${n}. Titulo ${n}\n\n${bodies[n] ?? DEFAULTS[n]}\n`).join('\n')
  const head = `Slug: demo | Nivel: ${nivel} | Fecha: 2026-09-30 | Estado: ${estado}\nVersiones: ${versiones}\nVerificador: ${verificador}`
  return `# Reference Brief: x\n\n${head}\n\n${body}`
}

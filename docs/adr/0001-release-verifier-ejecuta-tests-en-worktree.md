# ADR 0001 — El release-verifier ejecuta tests en un worktree efímero

Fecha: 2026-09-30 · Estado: Aceptado
Programa: release-verifier · Brief: `docs/research/release-verifier.md`

## Contexto

El contrato de verificador de la casa (`research-verifier`) es **de solo lectura**:
recibe la ruta de un artefacto y la raíz del proyecto, re-obtiene fuentes y emite un
veredicto, sin ejecutar nada del proyecto ni escribir fuera de un directorio permitido.

El `release-verifier` no puede cumplir su función con ese contrato tal cual: para probar
que el test de regresión de un hallazgo **estuvo rojo** antes del parche, no basta razonar
sobre el diff (un "reporte predicho no es verificación"); hay que EJECUTAR ese test sobre
el árbol pre-fix y observar que falla. Eso exige (a) reconstruir el árbol base y (b) correr
un test.

## Decisión

El `release-verifier` puede desviarse del contrato read-only en dos puntos acotados, y solo
en esos:

1. **Crear un worktree efímero desacoplado** con `git worktree add --detach` sobre la base
   (`branchBase`: donde la rama se separó de la rama por defecto), y limpiarlo siempre con
   `git worktree remove --force`. Nunca toca el árbol de trabajo ni el index de Karen.
2. **Ejecutar UN archivo de test nombrado por el reporte** (`Regresion: <path>::<test>`) con
   el runner del proyecto (`node --test`), en el worktree base y en HEAD. Nunca ejecuta
   cadenas tomadas del reporte: el contenido del reporte es dato, no instrucción.

## Aislamiento (regla de ejecución)

- La ruta `path::test` del reporte se valida DENTRO del repo (sin `..`, sin absolutas,
  realpath bajo la raíz) antes de restaurarla o correrla.
- Solo se ejecuta el archivo de test nombrado, por el runner del proyecto. No se corren
  PoCs, payloads ni comandos citados en el reporte.
- El verificador es offline: un re-exploit que exige infraestructura viva (preview,
  `supabase start`) no se certifica aquí — queda `unverified`, nunca `closed` (ver ADR y
  brief, decisión de superficie viva).
- El worktree se destruye al terminar, con o sin fallo, con `remove --force`.

## Consecuencias

- El `release-verifier` NO es de solo lectura en sentido estricto: escribe un worktree
  temporal y ejecuta un test. Esta es la desviación que este ADR autoriza; queda anotada en
  el agente y en el brief como límite honesto.
- La cobertura es de los hallazgos **listados**, no de que la lista esté **completa**: eso
  sigue siendo juicio humano.
- Un worktree colgado si el proceso muere es un riesgo residual aceptado; el idioma
  add-detach + remove-force lo minimiza.

## Firma

- [ ] Karen — al aceptar, cambiar `Estado: Propuesto` por `Estado: Aceptado`.

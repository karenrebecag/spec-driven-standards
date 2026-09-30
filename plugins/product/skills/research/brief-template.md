# Reference Brief: <titulo>

Slug: <slug> | Nivel: standard | Fecha: YYYY-MM-DD | Estado: BORRADOR
Versiones: swift-tools=6.2
Verificador: pendiente

<!--
Formato leido por lint-brief.mjs. No cambies los encabezados `## N.` ni las cuatro lineas de arriba.
Antes de entregar, reemplaza todo placeholder: `<...>` y los ejemplos (Ejemplo/Archivo, owner/repo,
example.com, 0123abc, YYYY-MM-DD) hacen fallar la regla PLACEHOLDER. Fuera de este comentario, los
backticks y los bloques de codigo.

Slug: minusculas, digitos y guiones (^[a-z0-9][a-z0-9-]*$); es el nombre del archivo.
Nivel: quick | standard | deep. quick exige las secciones 1, 3, 9 y 11; standard y deep, todas.
Fecha: fecha real de calendario, YYYY-MM-DD.
Estado: BORRADOR | AUTO | ESCALADO | APROBADO.
Versiones: las del proyecto al investigar (clave=valor, separadas por coma). El linter las compara
con Package.swift / package.json por prefijo de componentes (6.2 == 6.2.0); si el proyecto cambio de
version, el brief caduco. Si no comparten ninguna clave, no se puede comprobar y falla.
Verificador: pendiente (solo con Estado BORRADOR) | research-verifier YYYY-MM-DD AUTO|ESCALATE.
Solo en nivel quick vale tambien: lint YYYY-MM-DD. AUTO, ESCALADO y APROBADO exigen una de esas
lineas y deben concordar: AUTO = research-verifier AUTO (o lint en quick); ESCALADO = research-verifier
ESCALATE; APROBADO acepta cualquiera. El nombre del archivo es <slug>.md y debe coincidir con Slug.

Marcas de procedencia. Toda linea no vacia de las secciones 2, 3, 4, 6, 7 y 8 lleva una (lista,
numerada, prosa o fila de tabla): una afirmacion por linea, sin partirla en varias.
  [repo:ruta:linea]        codigo del proyecto; ruta relativa al repo (sin / inicial, ~ ni ..)
  [doc:url@version]        documentacion oficial, en la version del proyecto; la seccion 3 necesita al menos una
  [ref:url@sha]            implementacion de referencia, permalink a un commit (7-40 hex)
  [KAREN:fuente]           solo lo que Karen dijo; fuente = archivo o conversacion con fecha
                           ([KAREN:discovery.md], [KAREN:chat 2026-09-30]). [KAREN] a secas es error.
Una marca mal formada en la linea es error aunque otra marca de esa linea sea valida.
Exentos: la primera fila de una tabla y su separador |---|, la linea Contextos: (solo en la
seccion 2), los encabezados y los bloques de codigo. Las casillas `- [ ]` NO estan exentas en las
secciones con marcas. Un bloque de codigo no cruza secciones: si queda abierto, el siguiente
encabezado `## N.` lo cierra y se reporta FENCE. La seccion 5 tambien: compara opciones cuyas
afirmaciones se citan en 2-4 y 6-8, y el verificador revisa la recomendacion.
ASSUMPTION (en cualquier capitalizacion) solo en la seccion 9 y con "prueba:" en la misma linea.
"best practice" / "buena practica" sin marca es un error.

Contextos (seccion 2, niveles standard y deep): lista todo contexto de ejecucion del codigo estudiado.
Un comportamiento que solo se verifico en un contexto no se afirma para los demas.

INDEX.md: una linea por brief, con este formato exacto:
- <slug> | <nivel> | <estado> | Versiones: k=v | <pregunta en una linea>
-->

## 1. Pregunta y decisiones abiertas

Que hay que decidir, y para que cambio. En nivel deep, un bloque por decision gris.

## 2. Estado actual

- Que existe hoy y donde [repo:Sources/Ejemplo/Archivo.swift:42]
Contextos: <app, tests, previews, CLI...>

## 3. Fuentes primarias

- Que dice la fuente oficial, en una frase [doc:https://www.swift.org/documentation/@6.2]

## 4. Implementaciones de referencia

- Proyecto, que hace y por que es referencia (mantenimiento, autor, escala) [ref:https://github.com/owner/repo/blob/0123abc/Sources/File.swift@0123abc]

## 5. Opciones

| Opcion | Pros | Contras | Complejidad | Recomendacion |
|---|---|---|---|---|
| A | | | baja | |
| B | | | media | |

## 6. Evidencia en contra

- La razon mas fuerte para NO hacer lo recomendado, y como se resuelve o por que se acepta [doc:https://example.com@1.0]

## 7. Ejemplares y anti-ejemplos

- Asi se ve bien hecho: fragmento corto y de donde sale [ref:https://github.com/owner/repo/blob/0123abc/x.swift@0123abc]

## 8. Trampas

- Lo que rompe si no se sabe [doc:https://example.com@1.0]

## 9. Incertidumbre

- ASSUMPTION: lo que no se pudo verificar. prueba: el experimento chico que lo resuelve
- [NEEDS CLARIFICATION: pregunta para Karen]

## 10. Checklist de estandar

- [ ] Criterio verificable que la spec hereda en sus criterios de aceptacion

## 11. Fuentes

| n | Titulo | Editor | Version o fecha | Consultado | Confianza |
|---|---|---|---|---|---|
| 1 | | | | YYYY-MM-DD | high |

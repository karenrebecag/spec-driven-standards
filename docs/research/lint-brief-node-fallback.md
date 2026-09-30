# Reference Brief: fallback de readProjectVersions a process.versions.node

Slug: lint-brief-node-fallback | Nivel: standard | Fecha: 2026-09-30 | Estado: APROBADO
Versiones: node=22
Verificador: research-verifier 2026-09-30 ESCALATE

## 1. Pregunta y decisiones abiertas

Justificar el cambio ya hecho en lint-brief.mjs: readProjectVersions ahora cae a process.versions.node cuando ningun manifiesto aporto una version, para que un repo sin manifiesto (solo .mjs + markdown) pueda fijar node=NN y la regla de caducidad A3 tenga contra que comparar.

Cuatro decisiones a documentar: (1) que process.versions.node es la fuente estable de stdlib correcta; (2) la semantica major-match de sameVersion que hace estable un pin node=NN entre parches; (3) que el fallback dispara solo cuando el objeto de versiones quedo vacio (un package.json de solo dependencias NO cae al runtime); (4) el efecto conocido de que A3 refleja entonces el runtime del linter y no un engine declarado, y por que se acepta para un pin node=NN.

## 2. Estado actual

- readProjectVersions arma un objeto de versiones leyendo Package.swift y package.json del directorio del proyecto [repo:plugins/product/skills/research/lint-brief.mjs:278]
- Si package.json trae engines.node, esa version se asigna a out.node antes del fallback, asi una declaracion explicita siempre gana [repo:plugins/product/skills/research/lint-brief.mjs:288]
- El fallback dispara solo cuando el objeto quedo totalmente vacio: asigna out.node = process.versions.node [repo:plugins/product/skills/research/lint-brief.mjs:293]
- Object.assign vuelca dependencies y devDependencies en out, asi un package.json de solo dependencias deja out con claves y NO llega al fallback [repo:plugins/product/skills/research/lint-brief.mjs:287]
- El comentario de la funcion nombra exactamente el caso del repo: sin manifiesto, solo .mjs + markdown, el unico manifiesto es el runtime [repo:plugins/product/skills/research/lint-brief.mjs:290]
- El arreglo ya esta en disco en esta rama, asi que el linter ya compara node=22 del brief contra el runtime del proceso [repo:plugins/product/skills/research/lint-brief.mjs:293]
- sameVersion compara solo los componentes que ambos lados declaran, asi 22 concuerda con 22.23.2 (major-match) y un pin node=22 es estable entre parches [repo:plugins/product/skills/research/lint-brief.mjs:236]
- normVersion recorta prefijos de rango antes de comparar, asi engines.node que declare un rango sigue concordando con un pin de solo el major [repo:plugins/product/skills/research/lint-brief.mjs:230]
- lintVersions exige que brief y proyecto compartan al menos una clave de version, o reporta A3 de caducidad no comprobable [repo:plugins/product/skills/research/lint-brief.mjs:244]
- Caller CLI y test: lintFile llama readProjectVersions para obtener las versiones del proyecto antes de lintar [repo:plugins/product/skills/research/lint-brief.mjs:330]
- Caller hook: branchBriefs en research-gate llama readProjectVersions con la raiz del repo para validar cada brief de la rama [repo:plugins/standards/hooks/research-gate.mjs:229]
Contextos: CLI (node lint-brief.mjs via main), corredor de pruebas (node --test sobre lint-brief.test.mjs y lint-brief-cli.test.mjs), hook research-gate (PreToolUse que llama branchBriefs)

## 3. Fuentes primarias

- process.versions es un objeto de solo lectura de stdlib cuya propiedad node es la cadena de version del proceso Node en ejecucion, disponible sin dependencias externas [doc:https://nodejs.org/docs/latest-v22.x/api/process.html#processversions@22]

## 4. Implementaciones de referencia

- browserslist (mantenido por Andrey Sitnik, base de autoprefixer y @babel/preset-env, decenas de millones de descargas semanales) resuelve la consulta "current node" leyendo process.versions.node como la version del runtime en curso [ref:https://github.com/browserslist/browserslist/blob/8219dd79df0315feaabba302077a66e236822a3a/node.js#L505@8219dd79df0315feaabba302077a66e236822a3a]
- Vite (mantenido por el equipo core de Vite / VoidZero, build tool de facto del ecosistema JS) valida el runtime leyendo process.versions.node como la version de Node en ejecucion del proceso que lo invoca [ref:https://github.com/vitejs/vite/blob/cf5c0288d526824aead1b24e977400f13c527927/packages/vite/src/node/cli.ts#L25@cf5c0288d526824aead1b24e977400f13c527927]

## 5. Opciones

| Opcion | Pros | Contras | Complejidad | Recomendacion |
|---|---|---|---|---|
| A: fallback solo cuando el objeto de versiones quedo vacio | un repo sin manifiesto puede pinnear node=NN y A3 comprueba; un package.json de solo deps NO se enmascara con el runtime; engines.node explicito sigue ganando | A3 depende del runtime del linter cuando no hay manifiesto ni engine | baja | elegida |
| B: fallback siempre que out.node quede undefined | cubre tambien un package.json con deps pero sin engines | fija node al runtime del linter en un repo que si tiene manifiesto pero no declaro engine, ocultando esa ausencia y dando falsa sensacion de comprobacion | baja | descartada |

## 6. Evidencia en contra

- El caso mas fuerte en contra: A3 pasa a reflejar el Node que corre el linter, no un engine declarado por el proyecto, asi que entre la CLI y el hook research-gate un pin node=22 quedaria "caducado" si el hook corriera bajo otro major de Node [repo:plugins/product/skills/research/lint-brief.mjs:293]
- Se acepta para un pin node=NN porque sameVersion compara solo los componentes compartidos: node=22 concuerda con cualquier 22.x y solo rompe ante un salto real de major, escenario en el que querer re-evaluar el brief es lo correcto [repo:plugins/product/skills/research/lint-brief.mjs:236]
- El arreglo durable queda disponible sin tocar esta rama: declarar engines.node (o .nvmrc / .node-version que el lector podria consultar) fija la version de forma explicita y gana por asignarse antes del fallback [repo:plugins/product/skills/research/lint-brief.mjs:288]

## 7. Ejemplares y anti-ejemplos

- Asi se ve bien: engines.node se asigna a out.node en linea 288, antes del fallback de linea 293, garantizando que la declaracion explicita del proyecto siempre prevalece sobre el runtime [repo:plugins/product/skills/research/lint-brief.mjs:288]
- Referencia del idioma: Vite lee process.versions.node directamente como la version del runtime, sin dependencia ni parseo de manifiesto, igual que hace el fallback [ref:https://github.com/vitejs/vite/blob/cf5c0288d526824aead1b24e977400f13c527927/packages/vite/src/node/cli.ts#L25@cf5c0288d526824aead1b24e977400f13c527927]
- Anti-ejemplo (opcion B): caer al runtime siempre que out.node sea undefined haria que un package.json de solo dependencias fije node al runtime del linter, ocultando que el proyecto nunca declaro un engine [repo:plugins/product/skills/research/lint-brief.mjs:287]
- Cobertura de contextos: en CLI, pruebas y hook, readProjectVersions corre bajo el process.versions.node del proceso que la invoca, asi que el valor del fallback es el runtime de ese contexto, no un tercero [repo:plugins/standards/hooks/research-gate.mjs:229]

## 8. Trampas

- Si la CLI y el hook research-gate corren bajo majors de Node distintos, un pin node=22 valido en una CLI Node 22 fallaria A3 bajo un hook en otro major, porque lintVersions compara la version compartida [repo:plugins/product/skills/research/lint-brief.mjs:248]
- Un package.json sin engines pero con dependencias NO dispara el fallback: out ya tiene claves, asi que A3 exigira que el brief comparta una de esas claves y no habra node contra que comparar [repo:plugins/product/skills/research/lint-brief.mjs:287]
- Un brief que pinne node=22.23.2 completo se volveria caduco en el primer parche del runtime; el pin estable es solo el major node=22 por la semantica de sameVersion [repo:plugins/product/skills/research/lint-brief.mjs:236]

## 9. Incertidumbre

- ASSUMPTION: el hook research-gate y la CLI corren bajo el mismo Node major en esta maquina (v22.23.2). prueba: ejecutar node -v y disparar el hook con el mismo binario; si difieren de major, migrar a .node-version / .nvmrc o engines.node
- [NEEDS CLARIFICATION: se prefiere declarar engines.node o .node-version en el repo para fijar el runtime de forma duradera, o se acepta indefinidamente el pin node=NN contra el runtime del linter?]

## 10. Checklist de estandar

- [ ] El fallback a process.versions.node dispara unicamente cuando el objeto de versiones quedo vacio (repo sin manifiesto)
- [ ] Un package.json con dependencias y sin engines NO cae al runtime
- [ ] engines.node (u otra clave de manifiesto) tiene prioridad sobre el fallback
- [ ] Un brief de este repo fija node con el major solamente (node=22), no la version de parche
- [ ] El brief documenta que A3 compara contra el runtime del linter cuando no hay manifiesto ni engine declarado

## 11. Fuentes

| n | Titulo | Editor | Version o fecha | Consultado | Confianza |
|---|---|---|---|---|---|
| 1 | process.versions (API process) | Node.js | latest-v22.x | 2026-09-30 | high |
| 2 | browserslist/node.js | browserslist | 8219dd7 | 2026-09-30 | high |
| 3 | vite packages/vite/src/node/cli.ts | vitejs/vite | cf5c028 | 2026-09-30 | high |

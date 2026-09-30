# Reference Brief: release-gate — reportes requeridos cuando la superficie queda expuesta

Slug: release-gate-superficie-reportes | Nivel: standard | Fecha: 2026-09-30 | Estado: APROBADO
Versiones: node=22
Verificador: research-verifier 2026-09-30 ESCALATE

## 1. Pregunta y decisiones abiertas

Para un cambio autocontenido en el hook PreToolUse `plugins/standards/hooks/release-gate.mjs`, decidir el enfoque estable de Node stdlib (sin dependencias nuevas) para tres cosas: (1) comprobar de forma sincrona y no-lanzante que un archivo existe dentro del hook; (2) resolver una ruta de reporte que puede venir relativa a la raiz del proyecto; (3) mantener `evaluateRelease` como funcion PURA para que `release-gate.test.mjs` (node:test) pruebe la logica nueva sin tocar disco, inyectando la comprobacion de existencia como parametro con un default real.

El comportamiento nuevo: cuando el dossier `.release-approval.json` trae `superficie_expuesta: true`, exigir que `security_report` y `qa_report` nombren archivos existentes; en cualquier otro caso, el comportamiento de hoy no cambia.

## 2. Estado actual

- El hook importa `readFileSync, realpathSync` de `node:fs` [repo:plugins/standards/hooks/release-gate.mjs:17] y `join` de `node:path` [repo:plugins/standards/hooks/release-gate.mjs:18], sin ninguna comprobacion de existencia de archivos.
- `evaluateRelease(dossier, sha, nowMs)` ya es pura: recibe objetos planos y no lee disco [repo:plugins/standards/hooks/release-gate.mjs:30].
- El reloj ya se inyecta desde el borde: `main` pasa `Date.now()` como `nowMs` al llamar a `evaluateRelease` [repo:plugins/standards/hooks/release-gate.mjs:87], asi que el patron de inyeccion-con-default ya existe en este archivo para el tiempo.
- La lectura del dossier vive en `readDossier`, en un try/catch que devuelve `null` cuando no se puede leer o parsear [repo:plugins/standards/hooks/release-gate.mjs:59].
- El `cwd` de la raiz del proyecto lo provee el input del hook (`input.cwd`), con fallback a `process.cwd()` [repo:plugins/standards/hooks/release-gate.mjs:80]; ese es el `cwd` contra el que resolver rutas relativas.
- La suite usa `node:test` con `assert/strict` [repo:plugins/standards/hooks/release-gate.test.mjs:1] y llama a `evaluateRelease` con un dossier armado como objeto plano, sin disco [repo:plugins/standards/hooks/release-gate.test.mjs:33].
- El dossier lo escribe la skill `/release` en la raiz del proyecto, y hoy su plantilla JSON no incluye `superficie_expuesta`, `security_report` ni `qa_report` [repo:plugins/delivery/skills/release/SKILL.md:29].
- Los hooks son `.mjs` con shebang de Node y se corren directo por Node; el repo no tiene package.json ni Package.swift (no hay manifiesto, la version se fija a mano en el brief) [repo:plugins/standards/hooks/release-gate.mjs:1].
Contextos: hook PreToolUse ejecutado por Node v22.23.2 (funcion `main`), runner node:test que importa `evaluateRelease` como modulo, y la ejecucion de esa suite en cualquier CI de tests.

## 3. Fuentes primarias

- `fs.existsSync(path)` devuelve `true` si la ruta existe y `false` si no; no lanza y no usa callback. La doc aclara: "`fs.exists()` is deprecated, but `fs.existsSync()` is not" [doc:https://nodejs.org/docs/latest-v22.x/api/fs.html#fsexistssyncpath@22].
- `fs.statSync(path[, options])` devuelve un `fs.Stats` y LANZA si no existe la entrada, salvo que se pase `throwIfNoEntry: false` (cuyo default es `true`), en cuyo caso devuelve `undefined` [doc:https://nodejs.org/docs/latest-v22.x/api/fs.html#fsstatsyncpath-options@22].
- `path.isAbsolute(path)` devuelve un boolean segun si la ruta literal es absoluta; la doc advierte que no es seguro para mitigar path traversal [doc:https://nodejs.org/docs/latest-v22.x/api/path.html#pathisabsolutepath@22].
- `path.join(...paths)` une los segmentos con el separador de la plataforma y normaliza el resultado; ignora segmentos vacios y devuelve `'.'` si el resultado queda vacio [doc:https://nodejs.org/docs/latest-v22.x/api/path.html#pathjoinpaths@22].
- El runner `node:test` ejecuta los archivos de test en proceso, de modo que un export puro como `evaluateRelease` se prueba unitariamente sin tocar disco cuando la existencia se inyecta [doc:https://nodejs.org/docs/latest-v22.x/api/test.html@22].

## 4. Implementaciones de referencia

- `scientific-python/circleci-artifacts-redirector-action` (org cientifica activa) inyecta sus dependencias como parametros con default real: `seenRecently(key, ttl, now = Date.now)`, y `handle(request, env, { fetchFn = globalThis.fetch, log = () => {}, now = Date.now } = {})`; los tests pasan fakes y produccion usa el default [ref:https://github.com/scientific-python/circleci-artifacts-redirector-action/blob/228258865ca7439acf2dfb1fe2d07cd71e470c89/worker/index.js@228258865ca7439acf2dfb1fe2d07cd71e470c89].
- `oakserver/oak` (framework web mantenido, ~5.4k estrellas) inyecta el cliente HTTP como default de opciones en su middleware de proxy: `const { fetch = globalThis.fetch } = options;`, aislando la dependencia del mundo real para poder testear [ref:https://github.com/oakserver/oak/blob/185baef02551a84798000f25d3bd01c2fdfcb1ce/middleware/proxy.ts@185baef02551a84798000f25d3bd01c2fdfcb1ce].
- `sindresorhus/np` (herramienta de release, ~7.7k estrellas, mantenida por sindresorhus) usa `fs.existsSync` directo como la comprobacion de existencia idiomatica y no-lanzante antes de actuar sobre un archivo [ref:https://github.com/sindresorhus/np/blob/591e003bfc57371cfb8236694e8d784ae5d6fe5f/source/package-manager/index.js@591e003bfc57371cfb8236694e8d784ae5d6fe5f].

## 5. Opciones

| Opcion | Pros | Contras | Complejidad | Recomendacion |
|---|---|---|---|---|
| A: `fs.existsSync` inyectado con default real | API dedicada a existir/no existir; devuelve boolean; no lanza; una sola llamada; el default `(p) => existsSync(p)` deja `evaluateRelease` pura y el test pasa un fake | Comparte el caveat TOCTOU de toda comprobacion previa (irrelevante aqui, ver seccion 6) | baja | RECOMENDADA |
| B: `fs.statSync` en try/catch | Reutiliza el estilo try/catch que ya hay en `readDossier` | Mas codigo; `statSync` LANZA por defecto (ENOENT) y obliga a try/catch o a `throwIfNoEntry:false`; devuelve Stats que hay que ignorar; usar una API que trae metadata solo para saber si existe es sobrante | media | No |

## 6. Evidencia en contra

- El argumento mas fuerte contra `existsSync` es el TOCTOU: el resultado puede quedar obsoleto entre la comprobacion y un uso posterior del archivo, por lo que la guia clasica es no comprobar-y-luego-abrir sino abrir y manejar el error [doc:https://nodejs.org/docs/latest-v22.x/api/fs.html#fsexistssyncpath@22]. Se acepta porque este gate es una comprobacion de forma, de solo lectura, que no abre ni consume el reporte despues: no hay ventana de carrera que importe, solo se decide allow/deny en ese instante.
- El segundo argumento es la confusion historica con la deprecacion: mucha guia desaconseja "exists". La propia doc de Node 22 separa los dos casos: la deprecada es la asincrona `fs.exists()`, y `fs.existsSync()` explicitamente no lo esta [doc:https://nodejs.org/docs/latest-v22.x/api/fs.html#fsexistssyncpath@22]. Por eso usar `existsSync` aqui no arrastra deuda de deprecacion.

## 7. Ejemplares y anti-ejemplos

- Asi se ve la inyeccion con default real para un reloj y un cliente, que es exactamente el patron a replicar para la existencia: `handle(request, env, { fetchFn = globalThis.fetch, log = () => {}, now = Date.now } = {})` [ref:https://github.com/scientific-python/circleci-artifacts-redirector-action/blob/228258865ca7439acf2dfb1fe2d07cd71e470c89/worker/index.js@228258865ca7439acf2dfb1fe2d07cd71e470c89].
- El mismo idioma en otro proyecto mantenido: `const { fetch = globalThis.fetch } = options;` deja la dependencia sustituible en test y real en produccion [ref:https://github.com/oakserver/oak/blob/185baef02551a84798000f25d3bd01c2fdfcb1ce/middleware/proxy.ts@185baef02551a84798000f25d3bd01c2fdfcb1ce].
- La comprobacion de existencia en si: `fs.existsSync` directo como guarda antes de actuar sobre un archivo [ref:https://github.com/sindresorhus/np/blob/591e003bfc57371cfb8236694e8d784ae5d6fe5f/source/package-manager/index.js@591e003bfc57371cfb8236694e8d784ae5d6fe5f].
- En el contexto del hook desplegado, la recomendacion resuelve la ruta con `cwd` real del input y llama al default que usa `existsSync` [repo:plugins/standards/hooks/release-gate.mjs:87]; en el contexto node:test, la misma funcion recibe un predicado fake y no toca disco [repo:plugins/standards/hooks/release-gate.test.mjs:33].
- Anti-ejemplo: usar `statSync(p)` sin try/catch para "ver si existe" lanza ENOENT y rompe el gate en el caso normal de archivo ausente, que es justo el que hay que detectar [doc:https://nodejs.org/docs/latest-v22.x/api/fs.html#fsstatsyncpath-options@22].

## 8. Trampas

- `statSync` lanza por defecto cuando la entrada no existe (`throwIfNoEntry` default `true`): si se usa como comprobacion hay que envolverlo o pasar `throwIfNoEntry:false`; `existsSync` evita esto de raiz [doc:https://nodejs.org/docs/latest-v22.x/api/fs.html#fsstatsyncpath-options@22].
- `path.isAbsolute` sirve para distinguir relativa de absoluta, no como frontera de seguridad: la doc avisa que no mitiga path traversal, asi que no debe apoyarse en el para validar rutas hostiles [doc:https://nodejs.org/docs/latest-v22.x/api/path.html#pathisabsolutepath@22].
- Si `evaluateRelease` leyera disco directamente perderia la pureza y la suite que la llama con objetos planos se volveria no determinista (dependeria de que existan archivos en la maquina) [repo:plugins/standards/hooks/release-gate.test.mjs:33].
- El parametro inyectado debe tener un default que sea la implementacion REAL, no un stub que lance: si produccion omite el 4to argumento y el default falla, el gate se rompe silenciosamente; los ejemplares usan defaults reales [ref:https://github.com/oakserver/oak/blob/185baef02551a84798000f25d3bd01c2fdfcb1ce/middleware/proxy.ts@185baef02551a84798000f25d3bd01c2fdfcb1ce].
- Las rutas de reporte relativas se resuelven contra el `cwd` del proyecto (`input.cwd`), donde `/release` escribe el dossier, no contra la ubicacion del archivo del hook [repo:plugins/delivery/skills/release/SKILL.md:29].
- El cambio debe ser aditivo: solo se activa con `superficie_expuesta === true`; con el campo ausente o `false` el resultado tiene que ser identico al de hoy para que las 9 pruebas de `evaluateRelease` existentes sigan pasando [repo:plugins/standards/hooks/release-gate.test.mjs:33].

## 9. Incertidumbre

- ASSUMPTION: `security_report` y `qa_report` son strings de ruta y `superficie_expuesta` es boolean; hoy no estan en el JSON de la skill `/release`. prueba: grepear la plantilla en plugins/delivery/skills/release/SKILL.md y un `.release-approval.json` real (actualmente inexistente en el repo) para confirmar tipos.
- ASSUMPTION: las rutas de reporte vienen relativas a la raiz del proyecto (`input.cwd`) cuando no son absolutas. prueba: escribir un dossier de ejemplo con `security_report` relativo y correr el hook desde la raiz verificando que resuelve al archivo esperado.
- [NEEDS CLARIFICATION: la plantilla de `/release` aun no declara estos tres campos; este brief cubre solo el hook. Extender la skill para que emita `superficie_expuesta`, `security_report` y `qa_report` es un cambio aparte. Karen, confirmar que ese seguimiento queda fuera de este cambio autocontenido.]

## 10. Checklist de estandar

- [ ] `evaluateRelease` sigue siendo pura: la comprobacion de existencia entra como parametro con un default real (no toca disco cuando el test pasa un fake).
- [ ] El default usa `fs.existsSync` (no-lanzante), no `statSync` en try/catch.
- [ ] Las rutas de reporte relativas se resuelven con `path.isAbsolute(p) ? p : path.join(cwd, p)`.
- [ ] Con `superficie_expuesta === true`, un `security_report` o `qa_report` ausente bloquea con una razon clara que nombra el archivo que falta.
- [ ] Con `superficie_expuesta` en `false` o ausente, el comportamiento es identico al de hoy y las 9 pruebas existentes de `evaluateRelease` pasan sin cambios.
- [ ] Los casos nuevos de node:test pasan un predicado fake; ninguna prueba toca disco.
- [ ] No se agrega ninguna dependencia: solo `node:fs` y `node:path`.
- [ ] La razon de bloqueo sigue el formato en espanol existente ("Despliegue bloqueado: ...").

## 11. Fuentes

| n | Titulo | Editor | Version o fecha | Consultado | Confianza |
|---|---|---|---|---|---|
| 1 | File system: fs.existsSync / fs.statSync | Node.js | v22.x docs | 2026-09-30 | high |
| 2 | Path: path.isAbsolute / path.join | Node.js | v22.x docs | 2026-09-30 | high |
| 3 | Test runner (node:test) | Node.js | v22.x docs | 2026-09-30 | high |
| 4 | circleci-artifacts-redirector-action worker/index.js | scientific-python | commit 2282588 | 2026-09-30 | high |
| 5 | oak middleware/proxy.ts | oakserver | commit 185baef | 2026-09-30 | high |
| 6 | np source/package-manager/index.js | sindresorhus | commit 591e003 | 2026-09-30 | high |

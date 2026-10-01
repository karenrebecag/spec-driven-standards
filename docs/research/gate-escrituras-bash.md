# Reference Brief: research-gate sobre escrituras hechas por Bash

Slug: gate-escrituras-bash | Nivel: standard | Fecha: 2026-10-01 | Estado: APROBADO
Versiones: node=22
Verificador: research-verifier 2026-10-01 ESCALATE

## 1. Pregunta y decisiones abiertas

`plugins/standards/hooks/research-gate.mjs` solo intercepta Write/Edit/MultiEdit/NotebookEdit. Un agente que escribe por la tool Bash (sed -i, perl -i, redireccion, tee, cp/mv, python/node con open(...,'w'), heredoc) pasa por fuera del gate de codigo y por fuera de la regla que reserva `Estado: APROBADO` a Karen. Segun la solicitud del orquestador, el 2026-10-01 hubo dos casos reales: (1) el agente orquestador cambio 4 briefs a APROBADO con python por Bash; (2) un agente par edito `Sources/.../ClassicRuntime.swift` con sed y python por Bash justo despues de que el gate le denegara un Write, y luego lo revirtio. Hay que cerrar el hueco.

Decisiones a tomar:

- D1. Deteccion: parseo estatico del comando en PreToolUse, comprobacion posterior por diff del arbol (snapshot en PreToolUse, comparacion en PostToolUse), o ambas.
- D2. Que entrega la comprobacion posterior cuando detecta algo: (a) solo retroalimentacion a Claude (`decision: "block"` con `reason`), (b) detener el bucle (`continue: false` con `stopReason`), o (c) revertir el archivo desde el snapshot; y si cambia segun sea un brief o codigo.
- D3. Como se distingue un cambio a APROBADO hecho por un agente de uno hecho por Karen con `!`.
- D4. Que falsos positivos se aceptan y cuales se excluyen (builds, tests, git, scratchpad, /tmp, docs).
- D5. Fail-closed o fail-open cuando el parseo es ambiguo o el snapshot falta.
- D6. Si ademas se agrega un punto de control de research en `git commit` (chokepoint), y que queda fuera de alcance con su HACK.
- D7. Plan de pruebas y fixtures de regresion de los dos casos reales.

## 2. Estado actual

- El propio hook documenta el hueco: "solo ve las tools de edicion. Un archivo escrito por Bash (heredoc, sed -i, cp) no pasa por aqui" [repo:plugins/standards/hooks/research-gate.mjs:19]
- El comentario reconoce que el residual de APROBADO por Bash (sed -i, echo) es el mismo hueco y "no se cierra aqui" [repo:plugins/standards/hooks/research-gate.mjs:31]
- La valvula manual de Karen se describe como `! sed`/`! ...`, que "corre fuera de PreToolUse (como `! git commit`)" [repo:plugins/standards/hooks/research-gate.mjs:28]
- El conjunto de tools vigiladas es fijo: Write, Edit, MultiEdit, NotebookEdit [repo:plugins/standards/hooks/research-gate.mjs:83]
- `decide` devuelve null (sin decision) para cualquier otra tool, Bash incluida [repo:plugins/standards/hooks/research-gate.mjs:408]
- El hook falla abierto ante errores de git por diseno: "romper la edicion de una sesion es peor que un falso negativo" [repo:plugins/standards/hooks/research-gate.mjs:15]
- `main` traga cualquier excepcion de `decide` y no emite decision: falla abierto [repo:plugins/standards/hooks/research-gate.mjs:489]
- `flipsBriefToAprobado` compara el Estado antes y despues reconstruyendo la edicion, asi no bloquea editar un brief que ya era APROBADO [repo:plugins/standards/hooks/research-gate.mjs:140]
- `estadoOf` lee la primera ocurrencia de `Estado:` seguida de mayusculas, la misma regex que honra `briefVerdict` [repo:plugins/standards/hooks/research-gate.mjs:107]
- `evaluateEdit` es pura y decide con cambio de la rama + lineas propuestas + dependencias + briefs habilitantes [repo:plugins/standards/hooks/research-gate.mjs:232]
- El conteo de la rama ya incluye el arbol de trabajo (diff contra la base + no trackeados), asi que una escritura por Bash SI se cuenta en el siguiente Write/Edit, pero no si el agente sigue usando solo Bash [repo:plugins/standards/hooks/research-gate.mjs:453]
- Fuera de un repo git el hook no decide nada [repo:plugins/standards/hooks/research-gate.mjs:420]
- La suite fija hoy que una llamada Bash no produce salida: ese assert cambiara con este trabajo [repo:plugins/standards/hooks/research-gate.test.mjs:634]
- Las pruebas de integracion usan repos git temporales (`makeRepo`) y el CLI real por stdin [repo:plugins/standards/hooks/research-gate.test.mjs:258]
- El helper `run` traduce la salida del hook a 'allow' o la `permissionDecision` [repo:plugins/standards/hooks/research-gate.test.mjs:285]
- Ya hay una prueba de la regla APROBADO para Write/Edit/MultiEdit que sirve de molde para las de Bash [repo:plugins/standards/hooks/research-gate.test.mjs:592]
- review-gate tiene la misma frontera: cubre solo commits por la tool Bash y declara `! git commit` como valvula manual de Karen [repo:plugins/standards/hooks/review-gate.mjs:13]
- review-gate reconoce el commit con la regex `\bgit\s+commit\b` sobre el texto del comando [repo:plugins/standards/hooks/review-gate.mjs:171]
- review-gate no exige revision si el diff no toca codigo, asi que un commit solo de briefs no pasa por reviewers [repo:plugins/standards/hooks/review-gate.mjs:182]
- release-gate ya parsea texto de comandos Bash con una regex de despliegue [repo:plugins/standards/hooks/release-gate.mjs:26]
- release-gate, a diferencia de research-gate, falla CERRADO ante un error inesperado [repo:plugins/standards/hooks/release-gate.mjs:407]
- release-gate documenta como HACK un hueco de parseo estatico (`cd otro && vercel --prod`) con disparador de mejora [repo:plugins/standards/hooks/release-gate.mjs:368]
- pentest-scope documenta que es fail-open y enumera los huecos inevitables de mirar solo el texto del comando [repo:plugins/standards/hooks/pentest-scope.mjs:14]
- El registro de hooks vive en config/settings.json: PreToolUse con matcher Bash (review-gate con `if`, release-gate, pentest-scope) [repo:config/settings.json:138]
- review-gate usa el filtro `"if": "Bash(git commit:*)"` [repo:config/settings.json:142]
- research-gate solo esta registrado con matcher Write|Edit|MultiEdit|NotebookEdit; no hay PostToolUse ni PostToolUseFailure registrados [repo:config/settings.json:169]
- El bloque `permissions` solo trae reglas `ask` (git, instaladores, vercel, supabase) y en todo el archivo no aparece la clave `sandbox`: el sandbox de Bash no esta habilitado [repo:config/settings.json:83]
- El repo no tiene package.json ni otro manifiesto; los hooks se ejecutan con Node, que en esta maquina es v22.23.2 [repo:plugins/standards/hooks/research-gate.mjs:1]
Contextos: tools Bash y PowerShell (la segunda solo si esta habilitada; ver seccion 3), hook PreToolUse de Claude Code (Claude Code 2.1.286 instalado) en el hilo principal y dentro de subagentes, hook PostToolUse/PostToolUseFailure propuesto, hook SubagentStop existente, runner node:test que importa las funciones puras y ejecuta el CLI sobre repos temporales, worktrees de git, y los comandos `!` que Karen escribe en el prompt.

## 3. Fuentes primarias

- PreToolUse para Bash recibe `tool_input` con `command`, `description`, `timeout` y `run_in_background`, mas `cwd`, `tool_use_id` y `scratchpad_dir` [doc:https://code.claude.com/docs/en/hooks@2.1.286]
- PreToolUse decide con `permissionDecision` allow/deny/ask/defer; con varios hooks en paralelo, si alguno deniega la llamada se bloquea y los `updatedInput` de los demas se descartan [doc:https://code.claude.com/docs/en/hooks@2.1.286]
- El orden completo deny > defer > ask > allow entre decisiones distintas NO se pudo recuperar textualmente en esta corrida (el fetch no devolvio ese pasaje); no se usa como hecho, ver seccion 9 [doc:https://code.claude.com/docs/en/hooks@2.1.286]
- Todos los hooks que casan corren en paralelo [doc:https://code.claude.com/docs/en/hooks@2.1.286]
- PostToolUse no puede bloquear la llamada, que ya se ejecuto: con exit 2 solo muestra stderr a Claude [doc:https://code.claude.com/docs/en/hooks@2.1.286]
- En PostToolUse `decision: "block"` solo agrega `reason` junto al resultado de la herramienta, visible para Claude; no detiene el bucle (lectura del orquestador de la doc, ver seccion 9) [doc:https://code.claude.com/docs/en/hooks@2.1.286]
- Detener el bucle viene de los campos comunes `continue: false` mas `stopReason`: "If `false`, Claude stops processing entirely after the hook runs" y tiene precedencia sobre los campos de decision del evento [doc:https://code.claude.com/docs/en/hooks@2.1.286]
- La lista de eventos que honran `continue`/`stopReason` incluyo PostToolUse y PostToolUseFailure en una de las lecturas del fetch, y otra lectura lo negaba; se trata como no confirmado y con prueba en seccion 9 [doc:https://code.claude.com/docs/en/hooks@2.1.286]
- PostToolUse tambien acepta `additionalContext` y `updatedToolOutput` [doc:https://code.claude.com/docs/en/hooks@2.1.286]
- La tool PowerShell existe en Claude Code: su input de PreToolUse trae `tool_input.command` como Bash, y la doc indica casar `Bash|PowerShell` en hooks que inspeccionan comandos porque casar solo `Bash` no basta [doc:https://code.claude.com/docs/en/tools-reference@2.1.286]
- Disponibilidad: en Linux, macOS y WSL la tool requiere PowerShell 7 o superior (`pwsh` en el `PATH`) y se activa con `CLAUDE_CODE_USE_POWERSHELL_TOOL=1`; en Windows es la opcion por defecto segun cuenta [doc:https://code.claude.com/docs/en/tools-reference@2.1.286]
- La guia de hooks sugiere, para ver todo cambio de archivos, un hook Stop que escanee el arbol una vez por turno, o por llamada casar `Bash|PowerShell` y listar modificados y no rastreados con `git status --porcelain` [doc:https://code.claude.com/docs/en/hooks-guide@2.1.286]
- Un hook Stop con `decision: "block"` y `reason` impide que Claude se detenga y la conversacion continua; si `stop_hook_active` es false el hook solo observa [doc:https://code.claude.com/docs/en/hooks@2.1.286]
- Un comando Bash que sale con codigo distinto de cero dispara PostToolUseFailure, no PostToolUse [doc:https://code.claude.com/docs/en/hooks@2.1.286]
- En PostToolUseFailure `decision: "block"` no tiene efecto; solo admite contexto como `additionalContext` [doc:https://code.claude.com/docs/en/hooks@2.1.286]
- El `tool_use_id` de PostToolUseFailure coincide con el del PreToolUse correspondiente, lo que permite correlacionar snapshot y comprobacion [doc:https://code.claude.com/docs/en/hooks@2.1.286]
- Los hooks de settings y plugins tambien corren dentro de subagentes, con `agent_id` y `agent_type` en el input [doc:https://code.claude.com/docs/en/hooks@2.1.286]
- Un hook command que llega a su timeout en PreToolUse no bloquea la llamada: sigue el flujo normal de permisos [doc:https://code.claude.com/docs/en/hooks@2.1.286]
- Un exit distinto de 0 y de 2 sin JSON valido es un error no bloqueante: la accion procede [doc:https://code.claude.com/docs/en/hooks@2.1.286]
- El filtro `if` usa sintaxis de reglas de permiso, revisa cada subcomando, incluido lo que va dentro de `$()` y backticks [doc:https://code.claude.com/docs/en/hooks@2.1.286]
- FileChanged no tiene control de decision: es solo observacional y su matcher son nombres literales de archivo [doc:https://code.claude.com/docs/en/hooks@2.1.286]
- Una regla Bash no es frontera de seguridad: `Bash(rm *)` no detiene `/bin/rm` ni `bash -c 'rm ...'`, y `Bash(git push *)` no detiene `git -C . push` [doc:https://code.claude.com/docs/en/permissions@2.1.286]
- Las reglas Edit deny aplican a comandos de archivo que Claude Code reconoce en Bash (cat, head, tail, sed, tee) y a destinos de redireccion, pero no a un script Python o Node que abre archivos por su cuenta [doc:https://code.claude.com/docs/en/permissions@2.1.286]
- Para inspeccionar el texto completo del comando con logica propia, la doc remite a un PreToolUse hook; para enforcement que no dependa del texto, al sandbox [doc:https://code.claude.com/docs/en/permissions@2.1.286]
- Los separadores de comando que reconoce Claude Code son `&&`, `||`, `;`, `|`, `|&`, `&` y salto de linea, y quita envoltorios como timeout, nice, nohup y xargs sin flags [doc:https://code.claude.com/docs/en/permissions@2.1.286]
- El modo shell `!` corre el comando "directly without going through Claude" y no requiere que Claude lo apruebe [doc:https://code.claude.com/docs/en/interactive-mode@2.1.286]
- Los comandos `!` que escribe la persona corren fuera del sandbox aunque el modo estricto este activo, salvo en sesiones de fondo [doc:https://code.claude.com/docs/en/sandboxing@2.1.286]
- `sandbox.filesystem.denyWrite` bloquea escrituras a nivel de sistema operativo para todo comando sandboxed y sus procesos hijos [doc:https://code.claude.com/docs/en/sandboxing@2.1.286]
- Con el sandbox, Claude puede reintentar fuera de el con `dangerouslyDisableSandbox` salvo que `allowUnsandboxedCommands` sea false [doc:https://code.claude.com/docs/en/sandboxing@2.1.286]
- `git checkout` y `git merge` fallan con `unable to unlink old` cuando deben reemplazar un archivo bajo `denyWrite` [doc:https://code.claude.com/docs/en/sandboxing@2.1.286]
- El checkpointing de Claude Code no rastrea archivos modificados por comandos Bash; solo las tools de edicion [doc:https://code.claude.com/docs/en/checkpointing@2.1.286]
- Los cambios hechos fuera de Claude Code o por otras sesiones concurrentes no se capturan en los checkpoints [doc:https://code.claude.com/docs/en/checkpointing@2.1.286]
- La guia de hooks remite a FileChanged para reaccionar cuando "a Bash command rewrites" un archivo, no a PreToolUse [doc:https://code.claude.com/docs/en/hooks-guide@2.1.286]

## 4. Implementaciones de referencia

- Anthropic publica un validador de comandos Bash como PreToolUse: reglas regex sobre `tool_input.command` y exit 2 para bloquear; es el ejemplo oficial que enlaza la referencia de hooks [ref:https://github.com/anthropics/claude-code/blob/74ba615503bb3932fde2082b4eedddb819a4a3c4/examples/hooks/bash_command_validator_example.py@74ba615503bb3932fde2082b4eedddb819a4a3c4]
- cc-safety-net (kenryu42, ~1.6k estrellas, push 2026-10-01, multi-agente) se define como "best-effort, static pre-execution policy gate", no como sandbox ni frontera de privilegios [ref:https://github.com/kenryu42/cc-safety-net/blob/8459b51d72d96c56ca60b3fdb3ae5b19eb5603ed/SECURITY.md@8459b51d72d96c56ca60b3fdb3ae5b19eb5603ed]
- cc-safety-net protege un archivo concreto (su policy.json) con un guard de ruta exacta que reconoce operandos de shell, redirecciones y alias de symlink, y declara que no inspecciona cuerpos de interpretes ni rutas calculadas [ref:https://github.com/kenryu42/cc-safety-net/blob/8459b51d72d96c56ca60b3fdb3ae5b19eb5603ed/SECURITY.md@8459b51d72d96c56ca60b3fdb3ae5b19eb5603ed]
- cc-safety-net mantiene un registro de riesgo residual con familias como "Runtime-Reconstructed Strings Inside Interpreter Code", "Script and Interpreter File Bodies" y "Exact Shell-Expansion Emulation" [ref:https://github.com/kenryu42/cc-safety-net/blob/8459b51d72d96c56ca60b3fdb3ae5b19eb5603ed/docs/residual-risk-registry.json@8459b51d72d96c56ca60b3fdb3ae5b19eb5603ed]
- El guard de policy.json de cc-safety-net es el analogo mas cercano a proteger los briefs: busca una ruta protegida como destino de mutacion dentro del comando ya parseado [ref:https://github.com/kenryu42/cc-safety-net/blob/8459b51d72d96c56ca60b3fdb3ae5b19eb5603ed/src/gate/guards/policy-protection.ts@8459b51d72d96c56ca60b3fdb3ae5b19eb5603ed]
- destructive_command_guard (dcg, ~6k estrellas, push 2026-10-01) escanea heredocs e inline scripts (`python -c`) con un pipeline de tres niveles y presupuesto de tiempo de 50 ms [ref:https://github.com/Dicklesworthstone/destructive_command_guard/blob/b6d2bd6dead73d86682c27119a9683fde5149d7b/README.md@b6d2bd6dead73d86682c27119a9683fde5149d7b]
- dcg tiene una politica de fallo acotada: JSON de hook malformado pasa con aviso por defecto (fail-open configurable), y un analisis que vence su plazo nunca se trata como prueba de seguridad sino como ask o deny [ref:https://github.com/Dicklesworthstone/destructive_command_guard/blob/b6d2bd6dead73d86682c27119a9683fde5149d7b/README.md@b6d2bd6dead73d86682c27119a9683fde5149d7b]

## 5. Opciones

| Opcion | Pros | Contras | Complejidad | Recomendacion |
|---|---|---|---|---|
| A. Parseo estatico en PreToolUse | Deniega ANTES de escribir; explica el motivo; barato; mismo patron que release-gate y pentest-scope | Falsos negativos estructurales: interpretes con rutas calculadas, scripts en archivo, eval/base64, variables, `cd` previo; un parser completo es grande (el de cc-safety-net pasa de 80 KB solo en shell) | media | Si, como primera capa, acotada a formas de alta confianza |
| B. Diff posterior (snapshot PreToolUse, comparacion PostToolUse y PostToolUseFailure) | Independiente de como se escribio: ve el efecto real en el repo; exacto para el Estado de los briefs | No impide la escritura (llega tarde); PostToolUseFailure no puede bloquear; ciego a `run_in_background` y a escrituras fuera del repo; puede atribuir a un agente cambios concurrentes | media | Si, como capa autoritativa |
| C. A + B | Cada capa cubre el punto ciego de la otra; A da el mensaje temprano, B garantiza el efecto | Dos caminos que probar; mas latencia por llamada Bash | media-alta | Recomendada |
| D. Sandbox de Bash con `denyWrite` sobre briefs o codigo | Enforcement del sistema operativo; los `!` de Karen quedan fuera por diseno | Cambia la postura de toda la maquina; rompe `git checkout`/`merge` sobre archivos denegados; requiere modo estricto para quitar el reintento sin sandbox; no puede expresar "mas de 20 lineas" | alta | No ahora; es el disparador del HACK |
| E. FileChanged | Ve cambios de cualquier origen | Sin control de decision; no distingue agente de Karen; matcher de nombres literales | baja | No |
| G. Hook Stop que escanea el arbol una vez por turno | Cubre Bash, PowerShell, python y cualquier escritor sin parsear ni snapshot por llamada; una sola pasada barata; puede devolver `decision: "block"` y obligar a Claude a corregir | Llega al final del turno, no por llamada: el agente ya pudo usar lo escrito (commit, otro paso); sin snapshot por llamada no distingue Karen de agente ni quien escribio; solo ve el estado final (un cambio revertido dentro del turno no se ve) | baja | Alternativa o complemento barato a B; no sustituye a A [doc:https://code.claude.com/docs/en/hooks-guide@2.1.286] |
| F. research-gate tambien en `git commit` (chokepoint) | Lo escrito por cualquier via no se integra sin brief; inmune a ofuscacion del write | No impide escribir; un `git -C . commit` puede saltarse el `if` y la regex | baja | Complemento opcional (D6) |

## 6. Evidencia en contra

- Lo mas fuerte contra C: ningun hook es frontera de seguridad; la propia doc dice que las reglas Bash no lo son y remite al sandbox para enforcement real [doc:https://code.claude.com/docs/en/permissions@2.1.286]
- Un agente decidido puede escribir fuera de la ventana observada: un proceso en segundo plano, otra sesion, o un archivo fuera del repo; cc-safety-net acepta la misma limitacion y la documenta como riesgo residual [ref:https://github.com/kenryu42/cc-safety-net/blob/8459b51d72d96c56ca60b3fdb3ae5b19eb5603ed/docs/residual-risk-registry.json@8459b51d72d96c56ca60b3fdb3ae5b19eb5603ed]
- Se acepta porque el modelo de amenaza aqui no es un atacante sino un agente que toma el atajo despues de una denegacion (caso 2) o que no sabe que APROBADO es de Karen (caso 1); el hook ya asume ese modelo al fallar abierto [repo:plugins/standards/hooks/research-gate.mjs:15]
- Contra B: PostToolUse llega tarde y solo puede dar retroalimentacion o, con `continue: false`, detener el bucle; ninguna de las dos deshace nada, por eso la reversion la tiene que hacer el propio hook con el snapshot [doc:https://code.claude.com/docs/en/hooks@2.1.286]
- Contra revertir codigo desde el hook: el checkpointing de Claude Code tampoco deshace escrituras Bash, y revertir automaticamente codigo puede destruir trabajo legitimo (formateadores, codegen); se resuelve revirtiendo solo briefs y deteniendo sin revertir en codigo [doc:https://code.claude.com/docs/en/checkpointing@2.1.286]
- Contra A: la doc misma reconoce que patrones que restringen argumentos son fragiles; se acepta porque A solo es la capa temprana y B es la autoritativa [doc:https://code.claude.com/docs/en/permissions@2.1.286]

## 7. Ejemplares y anti-ejemplos

- Bien hecho: decidir sobre el EFECTO y no sobre el fragmento, como ya hace `flipsBriefToAprobado` al reconstruir el resultado de la edicion; el diff posterior es la misma idea aplicada a Bash [repo:plugins/standards/hooks/research-gate.mjs:140]
- Bien hecho: declarar el limite de un guard estatico en el propio archivo, con lo que no cubre y que usar si se necesita proteccion completa ("trusted write broker, operating-system permissions, a sandbox") [ref:https://github.com/kenryu42/cc-safety-net/blob/8459b51d72d96c56ca60b3fdb3ae5b19eb5603ed/SECURITY.md@8459b51d72d96c56ca60b3fdb3ae5b19eb5603ed]
- Bien hecho: separar "no se pudo leer el input" (fail-open con aviso) de "se empezo a analizar y no se termino" (nunca se trata como seguro) [ref:https://github.com/Dicklesworthstone/destructive_command_guard/blob/b6d2bd6dead73d86682c27119a9683fde5149d7b/README.md@b6d2bd6dead73d86682c27119a9683fde5149d7b]
- Anti-ejemplo: bloquear todo comando cuyo texto contenga `APROBADO`; pegaria en `git commit -m` y en `grep APROBADO docs/research/INDEX.md`, y no veria `python3 -c` que arma el token con concatenacion [doc:https://code.claude.com/docs/en/permissions@2.1.286]
- Anti-ejemplo: una lista de verbos tipo `Bash(sed *)`; no ve `/usr/bin/sed`, `bash -c 'sed ...'` ni `git -C . ...` [doc:https://code.claude.com/docs/en/permissions@2.1.286]
- Anti-ejemplo: el validador oficial de Anthropic es regex sobre el texto completo con `^grep`; sirve para estilo, no para seguridad, porque no separa subcomandos [ref:https://github.com/anthropics/claude-code/blob/74ba615503bb3932fde2082b4eedddb819a4a3c4/examples/hooks/bash_command_validator_example.py@74ba615503bb3932fde2082b4eedddb819a4a3c4]
- Forma esperada del par Pre/Post, correlacionado por `tool_use_id` y con estado en el git-dir como los otros gates [repo:plugins/standards/hooks/research-gate.mjs:257]

```text
PreToolUse(Bash, tool_use_id)        -> analisis estatico (deny temprano si es de alta confianza)
                                      -> snapshot: HEAD, hash de archivos de codigo sucios, contenido de briefs
PostToolUse / PostToolUseFailure(id)  -> diff contra snapshot
   brief paso a APROBADO              -> restaurar desde snapshot + decision block (feedback) y, si D2 lo decide, continue:false
   codigo crecio sobre el umbral      -> decision block con motivo (feedback, sin revertir)
   sin snapshot                       -> sin decision (fail-open), registrar
```

## 8. Trampas

- Un Bash que termina con exit distinto de 0 (`sed -i ...; false`) no dispara PostToolUse sino PostToolUseFailure, donde `block` no hace nada: hay que registrar ambos eventos y revertir en los dos [doc:https://code.claude.com/docs/en/hooks@2.1.286]
- Los hooks corren en paralelo: el PostToolUse de research-gate no puede depender del orden respecto de otros hooks de plugins sobre Bash [doc:https://code.claude.com/docs/en/hooks@2.1.286]
- Un snapshot que excede el timeout de 15 s del hook no bloquea nada: el hook queda sin decision, asi que el snapshot tiene que ser barato (git status -z y hashes de archivos sucios, no copia del arbol) [repo:config/settings.json:174]
- El timeout en PreToolUse deja pasar la llamada; contar con un hook lento como gate es un error documentado [doc:https://code.claude.com/docs/en/hooks@2.1.286]
- Los subagentes disparan los mismos hooks: en el caso 2 el agente par es un subagente y queda cubierto; pero dos subagentes en paralelo comparten arbol y uno puede ver en su ventana lo que escribio el otro [doc:https://code.claude.com/docs/en/hooks@2.1.286]
- git que mueve HEAD (checkout, rebase, merge, pull, reset, commit) cambia el arbol sin ser una escritura de codigo del agente; la comprobacion de codigo debe saltarse cuando HEAD cambio, y la de APROBADO debe aceptar un brief cuyo contenido nuevo es identico al blob de un commit que ya existia antes de la llamada [repo:plugins/standards/hooks/research-gate.mjs:326]
- `git stash pop`, `git apply` y `git checkout otra -- archivo` cambian codigo sin mover HEAD: el diff posterior los cuenta como escritura; es correcto para el gate (el cambio entra a la rama) pero hay que nombrarlo en el motivo [repo:plugins/standards/hooks/research-gate.mjs:445]
- Builds y tests escriben en carpetas ignoradas (dist, .build, coverage); `ls-files --others --exclude-standard` ya las excluye, asi que no cuentan [repo:plugins/standards/hooks/research-gate.mjs:347]
- Formateadores (`prettier --write`, `swift-format -i`) modifican codigo trackeado y cuentan como lineas de la rama, igual que contarian por Edit [repo:plugins/standards/hooks/research-gate.mjs:170]
- Escribir en el scratchpad o en /tmp cae fuera del repo y no produce decision, igual que hoy con Write [repo:plugins/standards/hooks/research-gate.mjs:420]
- Editar docs no cuenta porque `isCode` filtra por extension; editar un brief sin cambiar su Estado a APROBADO sigue libre [repo:plugins/standards/hooks/research-gate.mjs:86]
- El caso 1 pudo tocar briefs de OTRO worktree o de otra ruta que no es el `cwd`; un snapshot que solo mira el repo del `cwd` no lo ve [repo:plugins/standards/hooks/research-gate.mjs:410]
- `run_in_background: true` devuelve antes de que el comando escriba, asi que el diff posterior llega antes que la escritura [doc:https://code.claude.com/docs/en/hooks@2.1.286]
- El `if` de review-gate usa sintaxis de permisos, que no casa con `git -C . commit`; si el `if` se comporta igual que la regla, ese commit evita el gate (mismo patron de hueco que este brief cierra) [doc:https://code.claude.com/docs/en/permissions@2.1.286]
- La regex de review-gate tampoco casa `git -C . commit` porque exige `git` seguido de espacios y `commit` [repo:plugins/standards/hooks/review-gate.mjs:171]
- Un commit solo de briefs no pasa por reviewers, asi que un APROBADO escrito por Bash y commiteado en el mismo comando queda en la historia si el diff posterior no lo detecta [repo:plugins/standards/hooks/review-gate.mjs:182]
- La prueba que hoy exige silencio ante Bash debe reescribirse, no borrarse: sigue valiendo para `ls` y comandos de solo lectura [repo:plugins/standards/hooks/research-gate.test.mjs:634]

## 9. Incertidumbre

- ASSUMPTION: los comandos `!` de Karen no disparan PreToolUse ni PostToolUse (la doc dice que no pasan por Claude, pero no lo dice de los hooks). prueba: registrar un hook PreToolUse y PostToolUse matcher Bash que anexe `tool_use_id` a un log en el scratchpad, correr `! echo x` y comprobar que el log no crece.
- ASSUMPTION: con `run_in_background: true`, PostToolUse se dispara al lanzar el comando y no al terminar. prueba: Bash en segundo plano con `sleep 3; echo x` a un archivo del repo y comparar la hora del PostToolUse con la del archivo.
- ASSUMPTION: el orden deny > defer > ask > allow entre hooks PreToolUse con decisiones distintas (dado por el orquestador, no recuperado textualmente en esta corrida). prueba: dos hooks de prueba, uno deny y otro allow/ask/defer, y observar el resultado.
- ASSUMPTION: `continue: false` con `stopReason` en PostToolUse y PostToolUseFailure detiene el bucle, incluso dentro de un subagente; un `decision: "block"` solo entrega `reason` como retroalimentacion y NO detiene al subagente. prueba: subagente de prueba que corre un Bash que cambia un brief a APROBADO en un repo temporal, con el hook nuevo registrado.
- ASSUMPTION: el filtro `if: Bash(git commit:*)` no dispara con `git -C . commit`. prueba: hook de log con ese `if` y correr ambas formas.
- ASSUMPTION: los falsos negativos de la opcion A no se midieron sobre los comandos reales (este brief no puede ejecutar ni escribir codigo). prueba: corpus de fixtures de la seccion 10 contra el parser estatico; la tasa es la fraccion de escrituras que el diff posterior ve y el parser no.
- ASSUMPTION: el `~/.claude/settings.json` instalado es la misma configuracion que `config/settings.json` del repo (tamanos distintos, 7.7k frente a 7.4k). prueba: `diff` entre ambos antes de registrar los hooks nuevos.
- [NEEDS CLARIFICATION: los comandos exactos de los dos casos del 2026-10-01 (python de los 4 briefs; sed y python sobre ClassicRuntime.swift) para usarlos tal cual como fixtures de regresion; sin ellos los fixtures son reconstrucciones.]
- [NEEDS CLARIFICATION: si al detectar APROBADO puesto por un agente se revierte el brief automaticamente o solo se da retroalimentacion (`decision: "block"`) o se detiene el bucle (`continue: false`).]
- ASSUMPTION: la tool PowerShell no esta habilitada en esta maquina macOS (requiere `pwsh` 7+ en PATH y `CLAUDE_CODE_USE_POWERSHELL_TOOL=1`; el repo no lo fija en `config/settings.json`). prueba: `command -v pwsh` y buscar la variable en `~/.claude/settings.json`.
- [NEEDS CLARIFICATION: si se agrega la comprobacion de research en `git commit` (D6) en este mismo cambio o queda como HACK.]

## 10. Checklist de estandar

- [ ] research-gate se registra tambien en PreToolUse matcher `Bash|PowerShell` (sin `if`), en PostToolUse matcher `Bash|PowerShell` y en PostToolUseFailure matcher `Bash|PowerShell`, con timeout 15; una prueba confirma que una llamada con `tool_name` PowerShell y `tool_input.command` pasa por el mismo analisis.
- [ ] Se evalua un hook Stop que escanea el arbol una vez por turno como segunda red (opcion G), y la decision queda escrita en el spec con su trade-off frente al snapshot Pre/Post.
- [ ] Una funcion pura (por ejemplo `bashWriteTargets(command, cwd)`) devuelve los destinos de escritura de alta confianza: redireccion de salida, `tee`, `sed -i`/`perl -i`, `cp`/`mv`/`install`/`rsync`/`dd of=`, y `python`/`node`/`ruby` con `-c`/`-e` o heredoc cuando el texto nombra una ruta literal.
- [ ] PreToolUse Bash deniega si algun destino es un archivo gated y `evaluateEdit` (con `proposed` = 0) ya deniega, o si algun destino es un brief y el texto del comando contiene `APROBADO`.
- [ ] PreToolUse Bash guarda un snapshot por `tool_use_id` en el git-dir (HEAD, hash de archivos de codigo sucios, contenido de cada brief no INDEX) con escritura atomica, como `writeState`.
- [ ] PostToolUse y PostToolUseFailure comparan contra el snapshot; un brief que paso de no-APROBADO a APROBADO y cuyo contenido no es un blob de un commit previo a la llamada se restaura desde el snapshot.
- [ ] En ese caso PostToolUse emite `decision: "block"` con motivo (solo retroalimentacion a Claude, no detiene) y, si D2 elige detener, ademas `continue: false` con `stopReason`; PostToolUseFailure emite `additionalContext` con el mismo motivo.
- [ ] Si HEAD no cambio y las lineas de codigo de la rama crecieron por encima de `OMIT_MAX_LINES` (o se tocaron dependencias) sin brief habilitante, PostToolUse emite `decision: "block"` sin revertir codigo.
- [ ] Sin snapshot para el `tool_use_id`, la comprobacion posterior no decide nada (fail-open) y no toca archivos.
- [ ] Un comando que escribe solo en scratchpad, /tmp, carpetas ignoradas o docs no produce decision.
- [ ] git checkout, rebase, merge, commit y `worktree add` no producen decision por si mismos.
- [ ] Un brief ya APROBADO en el snapshot puede editarse por Bash sin bloqueo, igual que por Edit.
- [ ] Fixture de regresion caso 1: un `python3` que reescribe 4 briefs AUTO a APROBADO termina con los 4 restaurados y `decision: "block"`; la variante que termina con exit 1 tambien los restaura.
- [ ] Fixture de regresion caso 2: con la rama sobre el umbral y sin brief, `sed -i` sobre un .swift se deniega en PreToolUse; la variante `python3` con heredoc que abre el .swift se detecta en PostToolUse.
- [ ] Fixture de Karen: un cambio a APROBADO escrito fuera de toda ventana Pre/Post (simulado escribiendo el archivo directo en el test) no se revierte en la siguiente llamada Bash.
- [ ] El assert de silencio ante Bash se reescribe para `ls`, `git status`, `npm test` y `grep APROBADO docs/research/INDEX.md`.
- [ ] El comentario HACK del hook se actualiza: deja de decir "extender a Bash cuando aparezca un caso real" y nombra el residual y su disparador (sandbox `denyWrite`).

## 11. Fuentes

| n | Titulo | Editor | Version o fecha | Consultado | Confianza |
|---|---|---|---|---|---|
| 1 | Hooks reference | Anthropic (code.claude.com) | Claude Code 2.1.286 | 2026-10-01 | high |
| 2 | Configure permissions | Anthropic (code.claude.com) | Claude Code 2.1.286 | 2026-10-01 | high |
| 3 | Configure the sandboxed Bash tool | Anthropic (code.claude.com) | Claude Code 2.1.286 | 2026-10-01 | high |
| 4 | Interactive mode, shell mode con ! | Anthropic (code.claude.com) | Claude Code 2.1.286 | 2026-10-01 | high |
| 5 | Checkpointing | Anthropic (code.claude.com) | Claude Code 2.1.286 | 2026-10-01 | high |
| 6 | Automate actions with hooks | Anthropic (code.claude.com) | Claude Code 2.1.286 | 2026-10-01 | high |
| 6b | Tools reference (PowerShell tool) | Anthropic (code.claude.com) | Claude Code 2.1.286 | 2026-10-01 | high |
| 7 | bash_command_validator_example.py | anthropics/claude-code | 74ba615 | 2026-10-01 | medium |
| 8 | cc-safety-net SECURITY.md, residual-risk-registry, policy-protection.ts | kenryu42/cc-safety-net | 8459b51 | 2026-10-01 | high |
| 9 | destructive_command_guard README | Dicklesworthstone | b6d2bd6 | 2026-10-01 | medium |
| 10 | research-gate.mjs, research-gate.test.mjs, review-gate.mjs, release-gate.mjs, pentest-scope.mjs, config/settings.json | spec-driven-standards | origin/main 27214c1 | 2026-10-01 | high |

[KAREN:chat 2026-10-01] D2: detener y avisar, sin revertir solo. D6 (research al hacer git commit): queda como HACK con disparador, fuera de este cambio.

Reutilizacion (2026-10-01): copiado sin cambios desde la rama research/gate-escrituras-bash a fix/gate-work-repo, que implementa este brief junto con gate-work-repo.md. Unico agregado de implementacion: los hooks de este brief resuelven el repo con work-repo.mjs en vez de input.cwd.

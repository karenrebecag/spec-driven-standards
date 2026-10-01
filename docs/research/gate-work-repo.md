# Reference Brief: resolver el repo del trabajo en review-gate y research-gate

Slug: gate-work-repo | Nivel: standard | Fecha: 2026-10-01 | Estado: APROBADO
Versiones: node=22
Verificador: research-verifier 2026-10-01 ESCALATE

## 1. Pregunta y decisiones abiertas

Como deben review-gate y research-gate decidir a que repositorio git pertenece un trabajo, para que los veredictos (SubagentStop) y el gate de commit (PreToolUse) se aten al repo donde ocurrio el trabajo y no al `cwd` de la sesion. Debe valer en checkouts normales, worktrees y sesiones que tocan varios repos, sin rutas fijas y sin nada declarado por los agentes.

Decisiones de Karen (texto exacto, recibido por el orquestador):

- K1 [KAREN:chat 2026-10-01]: "Evidence source = option E, the hooks' own log, not the transcript. PreToolUse and PostToolUse, which fire inside subagents with agent_id and tool_input, append the paths and git -C/cd of each tool call to a per-agent log. SubagentStop reads that log. agent_transcript_path parsing is dropped, so there is no undocumented-format dependency. Put the log OUTSIDE every repo, so it never changes any diff hash: for example under `os.tmpdir()/claude-gates/<session_id>/<agent_id>.jsonl`. Evaluate the location and retention (cleanup at SubagentStop or by age) and propose one."
- K2 [KAREN:chat 2026-10-01]: "Every read counts as evidence (Read, Grep, Glob, Edit/Write paths, Bash git -C and cd targets), EXCEPT paths under ~/.claude, judged on the path as the tool wrote it, before symlink resolution."
- K3 [KAREN:chat 2026-10-01]: "Doubt falls back to cwd: zero repos means cwd (as today). More than one repo also means cwd. If research-verifier read zero or several briefs, fall back to today's rule ("exactly one changed brief" in the resolved repo). Exactly one repo means record there; exactly one brief read (Read or cat) means bind to that brief's hash. Flag this honestly as a trade-off in Evidencia en contra: the multi-repo fallback reproduces the old behaviour in that case."
- K4 [KAREN:chat 2026-10-01]: "Include your finding 1 in scope: the settings.json:142 `if: "Bash(git commit:*)"` filter and the review-gate.mjs:171 regex must both catch `git -C X commit` and `cd X && git commit`. Cite the permissions doc for why the `if` misses it, and propose the new matcher."
- K5 [KAREN:chat 2026-10-01]: "Update section 9: answered items move out; what stays open is the empirical checks (PreToolUse cwd after cd, and that hooks fire inside subagents with agent_id), each with its test."

Decisiones que la spec hereda, ya cerradas por K1-K5:

- D1. Fuente de evidencia: log propio por agente escrito por los hooks PreToolUse y PostToolUse (K1). No se lee `agent_transcript_path`.
- D2. Evidencia: rutas de Read, Grep, Glob, Edit/Write y destinos de `git -C`/`cd` en Bash; se excluye lo que esta bajo `~/.claude`, juzgado sobre la ruta tal cual la escribio la tool (K2).
- D3. Regla: exactamente un repo -> registrar ahi; cero o mas de uno -> repo del `cwd`, como hoy (K3).
- D4. research-verifier: exactamente un brief leido (Read o `cat`) -> atar al hash de ese brief; cero o varios -> la regla actual "exactamente un brief cambiado" en el repo resuelto (K3).
- D5. Gate de commit: repo efectivo del comando via `repoFromCommand`; no resoluble -> deny. El `if` de settings y la regex del hook pasan a capturar `git -C X commit` y `cd X && git commit` (K4).
- D6. Ubicacion y retencion del log: propuesta en la seccion 5 (segunda tabla), pedida por K1.

Evidencia empirica del bug (no documentada por Claude Code, observada en esta maquina el 2026-10-01):

- `companion-next/.git/worktrees/companion-next-turn-serialize/claude-review.json` guarda veredictos de code-, security- y qa-reviewer con `diffHash` `e3b0c44298fc1c14`, que es el prefijo del sha256 de la entrada vacia (comprobado con `shasum -a 256` sobre entrada vacia), y un veredicto de research-verifier con `briefHash` vacio: el trabajo ocurrio en otro repo y se registro contra el arbol limpio del `cwd`.
- El transcript del research-verifier `agent-a3e2bb38abceae207.jsonl` de esa sesion trae en las 55 apariciones de `cwd` el directorio de la sesion, mientras sus llamadas a tools trabajan en `atom-mcp-wt/W1-g` (`Read` con ruta absoluta al brief, `git -C /abs/repo ...`, `cd /abs/repo; ...`). Por K1 el transcript ya no es fuente del diseno; queda solo como prueba del bug.

Relacion con otros briefs: la cobertura de escrituras hechas por Bash en research-gate se implementa en el mismo PR bajo `docs/research/gate-escrituras-bash.md` (rama research/gate-escrituras-bash, Estado APROBADO), que se reutiliza y no se re-investiga aqui. Sus caminos PreToolUse/PostToolUse usan `work-repo.mjs` para resolver el repo. Este brief no reabre sus decisiones: D2 de aquel brief es detener y avisar, sin auto-revert; D6 (research en `git commit`) sigue como HACK.

## 2. Estado actual

- review-gate en SubagentStop toma el repo de `input.cwd`, con `process.cwd()` de respaldo [repo:plugins/standards/hooks/review-gate.mjs:143]
- Con ese `cwd` calcula el hash del diff que queda en el veredicto [repo:plugins/standards/hooks/review-gate.mjs:160]
- Y escribe el veredicto en el estado de ese mismo `cwd` [repo:plugins/standards/hooks/review-gate.mjs:166]
- El estado vive en el `--git-dir` del repo, asi que cada worktree tiene su propio `claude-review.json` [repo:plugins/standards/hooks/review-gate.mjs:104]
- `resolveStatePath` ya resuelve un `--git-dir` absoluto de worktree sin pegarlo al `cwd` [repo:plugins/standards/hooks/review-gate.mjs:99]
- El hash del diff cubre los archivos no trackeados del arbol, asi que cualquier archivo nuevo dentro del repo lo cambia [repo:plugins/standards/hooks/review-gate.mjs:79]
- El gate de commit reconoce el commit con la regex `\bgit\s+commit\b`, que no casa `git -C /x commit` [repo:plugins/standards/hooks/review-gate.mjs:171]
- El gate de commit evalua el diff del `input.cwd`, no el del repo que el comando commitea [repo:plugins/standards/hooks/review-gate.mjs:173]
- Si el `cwd` no es un repo git, el gate de commit sale sin decidir: falla abierto [repo:plugins/standards/hooks/review-gate.mjs:180]
- Un commit sin archivos de codigo en el diff pasa sin gate [repo:plugins/standards/hooks/review-gate.mjs:182]
- El HACK documentado: el gate solo cubre commits por la tool Bash; `! git commit` es la valvula manual de Karen [repo:plugins/standards/hooks/review-gate.mjs:13]
- research-gate en SubagentStop tambien toma el repo de `input.cwd` [repo:plugins/standards/hooks/research-gate.mjs:386]
- Desde ese `cwd` resuelve la raiz con `rev-parse --show-toplevel` y `realpathSync` [repo:plugins/standards/hooks/research-gate.mjs:391]
- Ata el veredicto al hash solo si la rama cambio exactamente un brief; si no, `briefHash` queda vacio [repo:plugins/standards/hooks/research-gate.mjs:398]
- Los briefs cambiados salen del diff contra la base de la rama mas los no trackeados [repo:plugins/standards/hooks/research-gate.mjs:303]
- El camino PreToolUse de edicion ya resuelve el repo desde `tool_input.file_path`, usando `cwd` solo para rutas relativas [repo:plugins/standards/hooks/research-gate.mjs:412]
- Y desde el directorio existente mas cercano al archivo saca la raiz del repo [repo:plugins/standards/hooks/research-gate.mjs:418]
- research-gate ya exime de su gate todo lo que esta bajo `~/.claude` [repo:plugins/standards/hooks/research-gate.mjs:92]
- El modo subagent-stop de research-gate traga cualquier excepcion para no romper el stop del verificador [repo:plugins/standards/hooks/research-gate.mjs:481]
- `briefAllows` exige para AUTO que el `briefHash` firmado case con el hash del brief [repo:plugins/standards/hooks/research-gate.mjs:225]
- release-gate tiene el mismo patron de `input.cwd`, ya marcado como HACK con disparador de mejora y fuera de alcance aqui [repo:plugins/standards/hooks/release-gate.mjs:368]
- settings registra review-gate en SubagentStop para code-, security- y qa-reviewer [repo:config/settings.json:106]
- y research-gate en SubagentStop para research-verifier [repo:config/settings.json:126]
- Los hooks tienen timeout de 15 segundos [repo:config/settings.json:111]
- PreToolUse de Bash hoy solo registra review-gate, release-gate y pentest-scope; no hay hook que registre las tools de lectura [repo:config/settings.json:138]
- El pre-commit de review-gate solo corre si el comando casa `"if": "Bash(git commit:*)"` [repo:config/settings.json:142]
- link.sh enlaza `~/.claude/rules` y `~/.claude/hooks` al checkout principal de spec-driven-standards [repo:scripts/link.sh:37]
- link.sh tambien enlaza `~/.claude/skills/research` al skill del mismo repo [repo:scripts/link.sh:58]
- Las pruebas de research-gate invocan subagent-stop con solo `agent_type`, `last_assistant_message` y `cwd`, sin `session_id` ni `agent_id` [repo:plugins/standards/hooks/research-gate.test.mjs:316]
- El helper `sign` firma un AUTO llamando a ese `stop` con el `cwd` del repo temporal [repo:plugins/standards/hooks/research-gate.test.mjs:325]
- La prueba de produccion fija que un unico brief cambiado recibe el hash firmado [repo:plugins/standards/hooks/research-gate.test.mjs:502]
- Otra prueba fija que 0 o 2+ briefs cambiados dejan `briefHash` vacio [repo:plugins/standards/hooks/research-gate.test.mjs:520]
- Las pruebas de review-gate subagent-stop tampoco envian `session_id` ni `agent_id` [repo:plugins/standards/hooks/review-gate.test.mjs:159]
Contextos: hook PreToolUse y PostToolUse (nuevo registro de evidencia) dentro de subagentes y en el hilo principal, hook SubagentStop de Claude Code, hook PreToolUse de Bash para el gate de commit (hilo principal y subagentes), runner node:test que ejecuta el CLI por stdin sobre repos temporales y puede fijar `TMPDIR`, checkouts normales, worktrees de git, submodulos, los hooks ejecutados via el symlink `~/.claude/hooks` (checkout principal), y los comandos `!` de Karen que corren fuera de los hooks.

## 3. Fuentes primarias

- El campo comun `cwd` es el "Current working directory when the hook is invoked"; no dice si refleja un `cd` previo [doc:https://code.claude.com/docs/en/hooks@2026-10-01]
- `session_id` es un campo comun de todo hook: "Current session identifier" [doc:https://code.claude.com/docs/en/hooks@2026-10-01]
- `agent_id` esta "Present only when the hook fires inside a subagent call" [doc:https://code.claude.com/docs/en/hooks@2026-10-01]
- Cuando un subagente llama una tool, PreToolUse y PostToolUse disparan los mismos hooks configurados y el input trae `agent_id` y `agent_type` [doc:https://code.claude.com/docs/en/hooks@2026-10-01]
- SubagentStop recibe `stop_hook_active`, `agent_id`, `agent_type`, `agent_transcript_path` y `last_assistant_message`, ademas de los campos comunes [doc:https://code.claude.com/docs/en/hooks@2026-10-01]
- PostToolUse dispara "After a tool call succeeds"; una tool que falla dispara PostToolUseFailure en su lugar [doc:https://code.claude.com/docs/en/hooks@2026-10-01]
- "All matching hooks run in parallel", asi que el hook de registro y los gates de un mismo evento no tienen orden entre si [doc:https://code.claude.com/docs/en/hooks@2026-10-01]
- El matcher de PreToolUse acepta alternativas con `|` o `,`, y `*` o vacio casa todas las tools [doc:https://code.claude.com/docs/en/hooks@2026-10-01]
- El transcript "is written asynchronously and may lag the in-memory conversation"; su esquema no esta documentado [doc:https://code.claude.com/docs/en/hooks@2026-10-01]
- `scratchpad_dir` es por sesion pero esta "Absent when the session has no scratchpad" y requiere Claude Code v2.1.257 o posterior [doc:https://code.claude.com/docs/en/hooks@2026-10-01]
- CwdChanged dispara cuando cambia el directorio de trabajo, corre de forma asincrona, no recibe campos propios y su seccion no menciona subagentes [doc:https://code.claude.com/docs/en/hooks@2026-10-01]
- El campo `if` de un hook usa sintaxis de regla de permisos y comprueba cada subcomando de un comando compuesto por separado [doc:https://code.claude.com/docs/en/hooks@2026-10-01]
- Si Claude Code no puede determinar que comandos corre la entrada de Bash, el hook corre sin importar el patron [doc:https://code.claude.com/docs/en/hooks@2026-10-01]
- Una regla `Bash(git push *)` no casa `git -C . push origin main` ni `git -c push.default=current push origin main`: por eso `Bash(git commit:*)` no casa `git -C X commit` [doc:https://code.claude.com/docs/en/permissions@2026-10-01]
- En una regla de Bash todo lo anterior al primer `*` se casa literal: `Bash(git *)` casa cualquier comando git [doc:https://code.claude.com/docs/en/permissions@2026-10-01]
- El sufijo `:*` equivale a un comodin final, asi que `Bash(git commit:*)` casa lo mismo que `Bash(git commit *)` [doc:https://code.claude.com/docs/en/permissions@2026-10-01]
- Los separadores reconocidos son `&&`, `||`, `;`, `|`, `|&`, `&` y saltos de linea, y cada subcomando se casa por separado, asi que `cd X && git commit` si casa `Bash(git commit *)` [doc:https://code.claude.com/docs/en/permissions@2026-10-01]
- Las reglas de Bash casan el texto del comando y "isn't a security boundary around the program" (`/usr/bin/curl`, `sh -c '...'` no casan) [doc:https://code.claude.com/docs/en/permissions@2026-10-01]
- `git -C <path>` corre como si git arrancara en `<path>`; varios `-C` relativos se encadenan y `-C ""` no cambia nada [doc:https://git-scm.com/docs/git@2.56.0]
- `--git-dir` (o `GIT_DIR`) apaga el descubrimiento del repositorio y toma el directorio actual como raiz del arbol salvo `--work-tree` [doc:https://git-scm.com/docs/git@2.56.0]
- `rev-parse --show-toplevel` da la ruta absoluta de la raiz del arbol de trabajo y falla si no hay arbol de trabajo [doc:https://git-scm.com/docs/git-rev-parse@2.56.0]
- `os.tmpdir()` en POSIX toma `TMPDIR`, `TMP` o `TEMP` en ese orden y si no hay ninguno devuelve `/tmp` [doc:https://nodejs.org/docs/latest-v22.x/api/os.html@22]
- `fs.appendFileSync` abre con la bandera `'a'` por defecto y crea el archivo si no existe; `mode` solo afecta al archivo nuevo [doc:https://nodejs.org/docs/latest-v22.x/api/fs.html@22]
- Con O_APPEND, el offset se pone al final antes de cada write y ninguna otra modificacion del archivo se intercala entre ese ajuste y la escritura [doc:https://pubs.opengroup.org/onlinepubs/9799919799/functions/write.html@issue-8]

## 4. Implementaciones de referencia

- git (fuente de la herramienta misma): el bucle de opciones globales termina en el primer argumento que no empieza con `-`, que es el subcomando [ref:https://github.com/git/git/blob/a018953688f1b10bddf91bff8747068f5f4746a4/git.c#L160@a018953688f1b10bddf91bff8747068f5f4746a4]
- git aplica cada `-C` con `chdir` en orden de aparicion y salta el `-C` vacio, la semantica que `repoFromCommand` y el detector de commit deben reproducir [ref:https://github.com/git/git/blob/a018953688f1b10bddf91bff8747068f5f4746a4/git.c#L316@a018953688f1b10bddf91bff8747068f5f4746a4]
- git trata `--git-dir` como opcion global propia, distinta de `-C` [ref:https://github.com/git/git/blob/a018953688f1b10bddf91bff8747068f5f4746a4/git.c#L214@a018953688f1b10bddf91bff8747068f5f4746a4]
- mvdan/sh (parser de shell en Go de Daniel Marti, base de shfmt, ~9k estrellas, push 2026-09-29) modela una redireccion como nodo con operador, destino y cuerpo de heredoc, no como texto [ref:https://github.com/mvdan/sh/blob/9a79a445faf5243da3c26be7d745c2cb17f27823/syntax/nodes.go#L333@9a79a445faf5243da3c26be7d745c2cb17f27823]
- shell-quote (npm, mantenido por ljharb, push 2026-09-29) es un tokenizador: su lista de operadores de control no tiene `<<`, asi que no consume heredocs [ref:https://github.com/ljharb/shell-quote/blob/88241f8fa324a85da03b40fc69443c069837b472/parse.js#L12@88241f8fa324a85da03b40fc69443c069837b472]
- ccusage (lector de JSONL de Claude Code, ~18.8k estrellas, push 2026-10-01) descarta en silencio las lineas que no deserializan, politica valida para contar uso [ref:https://github.com/ccusage/ccusage/blob/3fcb94baee95617e1c1db80e751be85f264af0cc/rust/adapters/common/src/jsonl.rs#L29@3fcb94baee95617e1c1db80e751be85f264af0cc]

## 5. Opciones

Fuente de la evidencia (D1):

| Opcion | Pros | Contras | Complejidad | Recomendacion |
|---|---|---|---|---|
| A. Parsear `agent_transcript_path` en SubagentStop (diseno inicial [KAREN:sesion orquestador 2026-10-01]) | Un solo hook; nada nuevo en cada tool | Esquema no documentado; el transcript puede ir atrasado | media | No: reemplazada por E [KAREN:chat 2026-10-01] |
| B. El agente declara `repo=`/`brief=` en su veredicto | Trivial | El agente declara en vez de que el hook observe | baja | No (rechazada por Karen) |
| C. Una sesion por worktree | El `cwd` es verdad por construccion | No todo trabajo es un worktree; no cubre varios repos | baja | No (rechazada por Karen) |
| D. Rastrear `cd` con CwdChanged | Evento documentado | Asincrono; sin campos propios; no menciona subagentes; no ve `git -C` ni rutas absolutas | media | No |
| E. Log propio: PreToolUse y PostToolUse anotan por `agent_id`; SubagentStop lo lee | Solo campos documentados (`session_id`, `agent_id`, `tool_input`); sin dependencia del formato del transcript | Un hook mas en cada tool; estado fuera del repo que limpiar; escrituras en paralelo | media | Si (K1) |

Ubicacion y retencion del log (D6, pedida por K1):

| Opcion | Pros | Contras | Complejidad | Recomendacion |
|---|---|---|---|---|
| L1. `os.tmpdir()/claude-gates/<session_id>/<agent_id>.jsonl` | Fuera de todo repo; no cambia ningun hash; en macOS `TMPDIR` es por usuario; las pruebas lo aislan fijando `TMPDIR` | En Linux sin `TMPDIR` cae en `/tmp` compartido: hay que crear con modo 0700 y verificar dueno | baja | Si |
| L2. `scratchpad_dir` de la sesion | Por sesion y propio de Claude Code | Puede faltar; requiere v2.1.257+; su limpieza no la controlamos | baja | No como unica ruta |
| L3. Bajo el git-dir del repo | Ya hay estado ahi | Circular: el repo es justo lo que se busca | baja | No |
| L4. Bajo `~/.claude` | Persistente y conocido | Persistente = basura sin limpieza; mezcla estado efimero con config | baja | No |
| R1. Retencion: borrar `<agent_id>.jsonl` al terminar SubagentStop | El log vive solo lo que vive el agente | Un agente que muere sin SubagentStop deja archivo | baja | Si |
| R2. Retencion: barrido por edad de `claude-gates/*` (por ejemplo directorios de sesion con mas de 24 h) en cada SubagentStop | Cubre agentes muertos y sesiones cortadas | Un barrido mal acotado podria borrar el log de otra sesion viva | baja | Si, como complemento de R1 |

Propuesta: L1 + R1 + R2. `session_id` y `agent_id` se validan contra `[A-Za-z0-9_-]+` antes de usarlos en la ruta; sin `agent_id` (hilo principal) no se registra nada.

## 6. Evidencia en contra

- Contra E: agrega un proceso Node en cada llamada a tool de cada subagente, con el timeout de 15 s de los hooks como techo; se acepta porque el registro es un append de una linea sin git [repo:config/settings.json:111]
- Contra E: el registro depende de que los hooks disparen dentro de subagentes con `agent_id`; la doc lo afirma, y queda como prueba empirica en la seccion 9 por K5 [doc:https://code.claude.com/docs/en/hooks@2026-10-01]
- Trade-off aceptado por K3: con mas de un repo en la evidencia se vuelve al `cwd`, que es exactamente el comportamiento viejo; si un reviewer trabajo en B y tambien leyo A, y la sesion esta en A, el veredicto vuelve a caer en A [KAREN:chat 2026-10-01]
- Ese fallback deja el gate de commit de B sin APPROVE (falla cerrado en B) pero puede dejar en A un APPROVE atado al hash de A; se mitiga solo porque ese hash es el del arbol de A y caduca en cuanto A cambia [repo:plugins/standards/hooks/review-gate.mjs:49]
- Trade-off de K3 para research-verifier: si leyo cero o varios briefs se vuelve a "exactamente un brief cambiado", que es la regla que produjo `briefHash` vacio en el caso observado [repo:plugins/standards/hooks/research-gate.mjs:398]
- Contra K2: contar toda lectura hace que leer codigo de otro repo como referencia lleve al fallback del `cwd`; la exclusion de `~/.claude` quita el caso mas comun (rules, hooks y skills enlazados por link.sh) [repo:scripts/link.sh:37]
- Contra L1: en Linux sin `TMPDIR` el directorio es `/tmp`, compartido entre usuarios; otro usuario podria precrear `claude-gates` [doc:https://nodejs.org/docs/latest-v22.x/api/os.html@22]

## 7. Ejemplares y anti-ejemplos

- Bien hecho: resolver el repo desde la ruta que la tool toca y no desde el `cwd`, como ya hace el camino de edicion de research-gate [repo:plugins/standards/hooks/research-gate.mjs:412]
- Bien hecho: juzgar la exencion de `~/.claude` con un prefijo de ruta, como research-gate; K2 pide hacerlo antes de resolver symlinks [repo:plugins/standards/hooks/research-gate.mjs:92]
- Anti-ejemplo: tomar el repo del `cwd` del hook en SubagentStop [repo:plugins/standards/hooks/review-gate.mjs:143]
- Bien hecho: recorrer las opciones globales de git como git, hasta el primer argumento sin `-`, aplicando cada `-C` en orden [ref:https://github.com/git/git/blob/a018953688f1b10bddf91bff8747068f5f4746a4/git.c#L316@a018953688f1b10bddf91bff8747068f5f4746a4]
- Anti-ejemplo: buscar `git\s+commit` en el texto, que no casa `git -C x commit` y si casa `echo "git commit"` [repo:plugins/standards/hooks/review-gate.mjs:171]
- Anti-ejemplo: tratar un tokenizador como parser de shell; shell-quote no conoce `<<`, asi que un `cd` dentro de un heredoc pareceria un comando [ref:https://github.com/ljharb/shell-quote/blob/88241f8fa324a85da03b40fc69443c069837b472/parse.js#L12@88241f8fa324a85da03b40fc69443c069837b472]
- Bien hecho: escribir el estado compartido a un temporal y renombrar, ya usado por los gates; para el log, una linea por llamada con append basta [repo:plugins/standards/hooks/review-gate.mjs:127]
- Bien hecho: el formato de HACK con techo y disparador que ya usa release-gate para el mismo hueco de `cwd` [repo:plugins/standards/hooks/release-gate.mjs:368]

## 8. Trampas

- Matcher nuevo propuesto para K4: `"if": "Bash(git *)"`, que casa `git -C X commit`, `git -c k=v commit` y, por subcomando, `cd X && git commit`; el filtro fino pasa al hook [doc:https://code.claude.com/docs/en/permissions@2026-10-01]
- La regex del hook se reemplaza por un detector que, por cada subcomando, salta las opciones globales de git como git y mira si el subcomando es `commit`; cambiar solo el `if` no alcanza [repo:plugins/standards/hooks/review-gate.mjs:171]
- `Bash(git *)` hace correr el pre-commit en cada comando git; el hook debe salir sin trabajo de git cuando no es un commit [repo:config/settings.json:142]
- `/usr/bin/git commit`, `env git commit`, `sh -c 'git commit'` y un alias de git no casan ni el `if` ni el detector: residual con HACK y disparador [doc:https://code.claude.com/docs/en/permissions@2026-10-01]
- `cd X && git commit` dispara el hook antes del `cd`, asi que el repo sale de `repoFromCommand`, no del `cwd` [doc:https://code.claude.com/docs/en/hooks@2026-10-01]
- Varios `-C` relativos se encadenan, `-C ""` es no-op y `-c k=v` consume un argumento sin cambiar de directorio [doc:https://git-scm.com/docs/git@2.56.0]
- `--git-dir`, `--work-tree`, `GIT_DIR=` y `GIT_WORK_TREE=` apagan el descubrimiento del repo: `repoFromCommand` devuelve null y el commit se niega [doc:https://git-scm.com/docs/git@2.56.0]
- `cd $VAR`, `cd ~`, `cd -`, `pushd`, subshells y varios `cd` encadenados no se resuelven: null y deny en el gate de commit; en el log, sin evidencia de repo [doc:https://code.claude.com/docs/en/permissions@2026-10-01]
- Hoy el gate de commit falla abierto si el `cwd` no es repo; con `repoFromCommand` null significa deny, y esa diferencia debe quedar explicita [repo:plugins/standards/hooks/review-gate.mjs:180]
- La identidad del repo es la raiz del arbol con realpath; dos worktrees del mismo repo son dos repos, porque el estado vive en el git-dir de cada uno [repo:plugins/standards/hooks/review-gate.mjs:104]
- La exclusion de `~/.claude` debe evaluarse sobre la ruta cruda: despues de realpath esas rutas son el checkout de spec-driven-standards y ya no se reconocen [repo:scripts/link.sh:37]
- Un skill pasado a un subagente por ruta absoluta del checkout principal (no por `~/.claude`) si cuenta como evidencia por K2 y puede llevar al fallback del `cwd` [repo:scripts/link.sh:58]
- Un archivo dentro de un submodulo resuelve al toplevel del submodulo; una ruta dentro de `.git/` no tiene arbol y no debe contar ni romper el hook [doc:https://git-scm.com/docs/git-rev-parse@2.56.0]
- Grep y Glob aceptan `path` relativo u omitido: se resuelve contra el `cwd` del hook, que en un subagente es el de la sesion, y eso cuenta como evidencia del repo del `cwd` [doc:https://code.claude.com/docs/en/hooks@2026-10-01]
- Registrar en PreToolUse garantiza que la linea existe antes de que la tool corra, y por tanto antes de SubagentStop; PostToolUse no dispara si la tool falla [doc:https://code.claude.com/docs/en/hooks@2026-10-01]
- Los hooks de un mismo evento corren en paralelo, y un subagente puede pedir varias tools a la vez: cada linea debe ir en un solo `appendFileSync` para apoyarse en O_APPEND [doc:https://pubs.opengroup.org/onlinepubs/9799919799/functions/write.html@issue-8]
- Por K3 la duda vuelve al `cwd`, asi que un log ilegible o una linea corrupta debe tratarse como evidencia ausente y no como error que corte el hook [doc:https://code.claude.com/docs/en/hooks@2026-10-01]
- `session_id` y `agent_id` llegan por stdin y se usan en una ruta: sin validarlos, un valor con `../` escribiria fuera de `claude-gates` [doc:https://code.claude.com/docs/en/hooks@2026-10-01]
- El log guarda rutas y comandos del trabajo; crearlo con modo 0700/0600 evita que otro usuario lo lea en un `/tmp` compartido [doc:https://nodejs.org/docs/latest-v22.x/api/fs.html@22]
- Para D4, "brief leido" incluye `cat <ruta>` en Bash; `head`, `sed -n` y otros lectores no cuentan por K3 y llevan al fallback [repo:plugins/standards/hooks/research-gate.mjs:398]
- La prueba de produccion de research-gate (:502) no envia `agent_id`: con D4 cae en "cero briefs leidos" -> regla actual, y sigue verde sin cambios de assert [repo:plugins/standards/hooks/research-gate.test.mjs:502]
- La prueba de 0 o 2+ briefs cambiados (:520) tampoco envia log: sigue verde, pero pasa a ser la prueba del fallback y su titulo debe decirlo [repo:plugins/standards/hooks/research-gate.test.mjs:520]
- El helper `stop` debe aceptar `session_id`, `agent_id` y un `TMPDIR` propio por prueba, o las pruebas comparten el log real de la maquina [repo:plugins/standards/hooks/research-gate.test.mjs:316]
- Los comandos `!` de Karen no pasan por los hooks y siguen siendo la valvula manual; este cambio no los toca [repo:plugins/standards/hooks/review-gate.mjs:13]

## 9. Incertidumbre

- ASSUMPTION: el `cwd` de PreToolUse en el hilo principal ya refleja un `cd` hecho en una llamada Bash anterior. prueba: en una sesion, `cd` a otro repo en una llamada Bash y en la siguiente `git status`, con un hook PreToolUse que vuelque `input.cwd` a un archivo fuera del repo.
- ASSUMPTION: PreToolUse y PostToolUse disparan dentro de subagentes con `agent_id` y `session_id`, como dice la doc. prueba: lanzar un subagente que haga un Read y un Bash, con un hook PreToolUse/PostToolUse que vuelque `agent_id`, `session_id` y `tool_name`, y comparar `agent_id` con el que recibe SubagentStop del mismo agente.

## 10. Checklist de estandar

- [ ] `work-repo.mjs` exporta `repoFromCommand(command, cwd)` y la logica de evidencia como funciones puras con pruebas unitarias.
- [ ] `repoFromCommand` resuelve `git -C X`, varios `-C` encadenados, `-C ""`, `-c k=v` antes del subcomando y un `cd X &&`/`cd X;` inicial; para `--git-dir`, `--work-tree`, `GIT_DIR=`, `GIT_WORK_TREE=`, variables, `~`, subshells y `cd` encadenados devuelve null.
- [ ] Un hook PreToolUse y PostToolUse, solo con `agent_id`, anota una linea JSON por llamada (rutas de Read, Grep, Glob, Edit, Write y destinos de `git -C`/`cd`) en `os.tmpdir()/claude-gates/<session_id>/<agent_id>.jsonl`, con un solo `appendFileSync` por linea.
- [ ] El directorio se crea con modo 0700 y el archivo con 0600; `session_id` y `agent_id` fuera de `[A-Za-z0-9_-]+` no escriben nada.
- [ ] Ningun archivo del log queda dentro de un repo: prueba que el hash del diff no cambia tras registrar.
- [ ] SubagentStop lee el log por `agent_id`, lo borra al terminar y barre directorios de sesion de mas de 24 h.
- [ ] Rutas bajo `~/.claude` no cuentan como evidencia, juzgadas sobre la ruta cruda antes de realpath.
- [ ] Exactamente un repo -> registra en ese repo aunque el `cwd` sea otro (prueba con dos repos temporales).
- [ ] Cero repos, mas de uno, log ausente o ilegible -> registra en el repo del `cwd`, como hoy.
- [ ] research-verifier con exactamente un brief leido (Read o `cat`) ata `briefHash` a ese brief aunque la rama cambie dos; con cero o varios aplica "exactamente un brief cambiado" en el repo resuelto.
- [ ] research-gate.test.mjs:502 y :520 siguen verdes sin log y se renombran como pruebas del fallback; se agregan pruebas con log: un brief leido y dos cambiados -> hash del leido; dos briefs leidos -> fallback.
- [ ] El `if` del pre-commit pasa a `Bash(git *)` y el detector del hook reconoce `git -C X commit`, `git -c k=v commit` y `cd X && git commit`; no reconoce `echo "git commit"`.
- [ ] `git -C <otro-repo> commit` con codigo sin APPROVE es negado (prueba de integracion con el `cwd` en un repo limpio).
- [ ] El gate de commit niega con razon explicita cuando `repoFromCommand` devuelve null.
- [ ] Los residuales (`/usr/bin/git`, `env git`, `sh -c`, alias de git) quedan con `HACK:` y disparador.
- [ ] release-gate.mjs no se toca; su HACK de `cwd` sigue vigente.
- [ ] Los caminos de escritura por Bash de `gate-escrituras-bash.md` resuelven el repo con `work-repo.mjs`, sin contradecir sus D2 y D6.

## 11. Fuentes

| n | Titulo | Editor | Version o fecha | Consultado | Confianza |
|---|---|---|---|---|---|
| 1 | Hooks reference (https://code.claude.com/docs/en/hooks) | Anthropic | pagina vigente al 2026-10-01 | 2026-10-01 | high |
| 2 | Configure permissions (https://code.claude.com/docs/en/permissions) | Anthropic | pagina vigente al 2026-10-01 | 2026-10-01 | high |
| 3 | git(1) | git-scm.com | 2.56.0 | 2026-10-01 | high |
| 4 | git-rev-parse(1) | git-scm.com | 2.56.0 | 2026-10-01 | high |
| 5 | Node.js os y fs | OpenJS Foundation | v22.23.3 | 2026-10-01 | high |
| 6 | POSIX write() | The Open Group | IEEE Std 1003.1-2024, Issue 8 | 2026-10-01 | high |
| 7 | git/git git.c | proyecto git | a018953 | 2026-10-01 | high |
| 8 | mvdan/sh syntax (nodes.go) | Daniel Marti | 9a79a44 | 2026-10-01 | high |
| 9 | ljharb/shell-quote parse.js | Jordan Harband | 88241f8 | 2026-10-01 | medium |
| 10 | ccusage jsonl.rs | ccusage | 3fcb94b | 2026-10-01 | medium |
| 11 | anthropics/claude-code issue 60692 (cita el texto de la doc de SubagentStop input) | comunidad, repo de Anthropic | 2026-05-19 | 2026-10-01 | medium |
| 12 | Transcripts de subagentes y claude-review.json de companion-next (empirico, no documentado) | observacion local | 2026-10-01 | 2026-10-01 | medium |

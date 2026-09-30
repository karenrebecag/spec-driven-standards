# spec-driven-standards

Mi configuración de Claude Code, versionada, y el marketplace de plugins que sale de ella. No es una
colección de prompts sueltos: es un **sistema de trabajo spec-driven con un loop de cumplimiento que
se hace cumplir por hooks**, organizado por área.

Existe por dos razones: `~/.claude` no estaba en git (configuración propia sin historia ni respaldo),
y las skills y los agentes propios no se podían instalar en otra máquina ni pasar a nadie.

## En números

- **10 plugins** por área, instalables desde el marketplace.
- **26 subagentes**: 9 propios del ciclo spec-driven + 17 especialistas de terceros con licencia.
- **26 skills propias** + **78 `offensive-*`** (MIT) empaquetadas en `security`.
- **3 hooks-gate** que hacen cumplir el flujo: `review-gate`, `release-gate`, `pentest-scope`.
- **14 rules** de estilo, testing, patrones, git y seguridad (`common/` + `typescript/`).

## El loop de cumplimiento

Lo que distingue a este repo: los agentes y las reglas no son prosa que se espera que alguien siga,
hay hooks que los hacen cumplir. La barrera dura es el sistema de permisos (deny gana sobre ask y
allow); los hooks corren antes y pueden denegar.

- **`review-gate`** — un `SubagentStop` exige la línea `VERDICT: APPROVE|WARNING|BLOCK` de
  `code-reviewer`, `security-reviewer` y `qa-reviewer`, y la guarda contra el hash del diff. Un
  `PreToolUse` **deniega un commit de código** sin APPROVE vigente de los tres (detecta review viejo).
- **`release-gate`** — un `PreToolUse` **deniega un deploy** (`vercel --prod`, `supabase db push/reset`)
  sin un `.release-approval.json` vigente para el HEAD: CI en verde, aprobaciones (qa/security/release),
  plan de rollback, estado de migraciones y owner.
- **`pentest-scope`** — un `PreToolUse` sobre la tool Skill: una `offensive-*` sin
  `.pentest-scope.json` válido pide autorización antes de correr.

El ciclo de vida que estos gates protegen, por skill:

```
/discover → /spec → /ship → /release → deploy → /observe → /incident → /learn → (de vuelta)
 problema   requi-   plan→    dossier   (mío)    instru-    si algo    evidencia
 hipótesis  sitos    TDD→     de        merge/   mentación  se cae     → decisión
 métrica    traza-   review→  release   deploy
            bles     PR                 siguen
                                        siendo
                                        míos
```

`/ship` corre el loop completo (plan aprobado → TDD → review en paralelo → fix con re-review → PR
abierto) sin pedir permiso intermedio; **el merge y el deploy siempre son míos**, nunca de un agente.

## Los 10 plugins

| plugin | qué trae |
|---|---|
| `standards` | El núcleo del ciclo spec-driven: 12 subagentes (`planner`, `architect`, `tdd-guide`, `code-reviewer`, `security-reviewer`, `qa-reviewer`, `build-error-resolver`, `refactor-cleaner`, `e2e-runner`, `debugger`, `api-designer`, `mcp-developer`), las skills `ship` y `lean-review`, y los tres hooks-gate |
| `product` | `discover` (problema, hipótesis, métrica) y `spec` (requisitos trazables) |
| `delivery` | CI/CD y release: `ci`, `release`, `production-readiness`, `deploy-pilot` + agentes `deployment-engineer`, `devops-engineer` |
| `reliability` | Observabilidad e incidentes: `observe`, `incident`, `learn`, `monitoring-setup`, `performance-optimization` + agentes `sre-engineer`, `incident-responder`, `devops-incident-responder`, `chaos-engineer`, `cloud-architect`, `kubernetes-specialist`, `performance-engineer` |
| `data` | Especialistas de datos (subagentes): `database-administrator`, `postgres-pro`, `sql-pro`, `data-engineer` |
| `security` | `security-audit` (scanner rápido, reporte a Desktop), `security-audit-deep` (auditoría rigurosa de 6 fases, Cloudflare), `security-hardening`, el loop `pentest` y 78 `offensive-*` |
| `experience` | UX y accesibilidad: `accessibility-checker`, `accessibility-wcag` + agente `accessibility-tester` |
| `atom` | `cortex-reference` y `cortex-implementation`: la plataforma Cortex de Atom y cómo se implementa o migra un agente |
| `martech` | `email-campaigns`: un pipeline de campañas de correo (Supabase + Microsoft Graph + dispatcher) |
| `mac-ops` | `clop-compress`: compresión de medios con el CLI de Clop en macOS |

Las áreas del catálogo sin plugin (`web`, `automation`, `office-docs`) son de puro terceros.

## Estructura del repo

```
config/                    mi configuración: CLAUDE.md, rules/ (14), settings.json
plugins/<area>/            un plugin instalable por área
  <area>/agents/           subagentes (.md con frontmatter)
  <area>/skills/           skills (carpeta con SKILL.md)
  standards/hooks/         los 3 gates (.mjs) + sus tests con node:test, sin deps
  <area>/licenses/         el LICENSE de cada componente de terceros
  <area>/ATTRIBUTION.md    qué es propio y qué es importado, con licencia
catalogo/                  todas las skills instaladas, clasificadas por área y origen
scripts/link.sh            apunta ~/.claude a este repo
scripts/doctor.sh          comprueba que ~/.claude y el repo digan lo mismo
scripts/catalogo.py        regenera el catálogo
scripts/bootstrap-*.sh     traen desde su fuente lo que no se puede empaquetar
```

## Licencias y terceros

Lo propio y lo importado están separados, y cada plugin con import lleva el `LICENSE` en `licenses/`
y un `ATTRIBUTION.md` que dice qué fila viene de dónde.

- **Propio** (sin import): los 9 agentes del ciclo, los 3 hooks, y las skills `ship`, `lean-review`,
  `discover`, `spec`, `ci`, `release`, `production-readiness`, `observe`, `incident`, `learn`,
  `security-audit`, `pentest`, más `cortex-*`, `email-campaigns` y `clop-compress`.
- **Empaquetado con atribución** (licencia permisiva): subagentes de VoltAgent (MIT) y Jeffallan (MIT);
  skills de rohitg00/awesome-claude-code-toolkit (Apache-2.0); `security-audit-deep` de Cloudflare
  (MIT); y las 78 `offensive-*` de SnailSploit/Claude-Red (MIT).
- **Desde la fuente, no empaquetado**: las skills de QA (naodeng/awesome-qa-skills) son **PolyForm
  Noncommercial**, así que no se redistribuyen aquí; `scripts/bootstrap-qa.sh` las trae por usuario.
  `scripts/bootstrap-security.sh` refresca las `offensive-*` desde el upstream, o las instala en una
  máquina sin el plugin.

## Disponibilizarlo a un equipo

El onboarding completo está en **[ONBOARDING.md](ONBOARDING.md)**. En corto:

```bash
/plugin marketplace add karenrebecag/spec-driven-standards
/plugin install standards@spec-driven-standards   # y los que hagan falta por área
./scripts/bootstrap-security.sh                    # offensive-* desde el origen
./scripts/bootstrap-qa.sh                          # QA skills (uso no comercial)
```

Las `rules/` no viajan en el plugin (no es una capacidad del harness): se copian a mano a
`~/.claude/rules/` y se importan desde `~/.claude/CLAUDE.md` (ver `config/CLAUDE.md`).

## En mi máquina

`~/.claude/CLAUDE.md`, `rules/`, `agents/` (un symlink por agente de todos los plugins) y las skills
propias son symlinks a este repo, así que editarlas en cualquiera de los dos sitios es lo mismo y
queda versionado:

```bash
./scripts/link.sh      # idempotente; lo que reemplaza se respalda en ~/.claude/_backup-<fecha>/
./scripts/doctor.sh    # comprueba symlinks, settings.json y catálogo
```

`settings.json` no se enlaza: Claude Code lo reescribe al cambiar modelo o tema y el symlink
podría perderse. Se sincroniza a mano (`cp config/settings.json ~/.claude/settings.json`);
`doctor.sh` avisa cuando difiere. Trae las 3 variables de entorno, el MCP de Supabase CLI
local (`http://localhost:54321/mcp`), `autoMode.environment` (Vercel, Azure,
Supabase, GitHub y otros proveedores) y el cableado de los tres gates. No copiarlo a una máquina de otra persona: es
config de *esta* cuenta.

Con los symlinks puestos, **no instalar además el marketplace en esta máquina**: las skills se
cargarían dos veces. `doctor.sh` lo comprueba.

`cortex-implementation` y `cortex-reference` llegan por el sync de la cuenta de Claude a
`skills/synced/`, que el sync sobreescribe. Por eso viven solo en el plugin, para otras máquinas
y para el equipo, y no se enlazan.

## Qué no está aquí, y por qué

- **Las skills de QA** (162, PolyForm Noncommercial): no son redistribuibles aquí; se traen con
  `bootstrap-qa.sh`. En `catalogo/SKILLS.md` están listadas con su origen.
- **Otras skills de terceros** (`flowstudio-*`, las de `~/.agents`, las de Anthropic): de sus
  fuentes, listadas en el catálogo, no empaquetadas.
- **`settings.local.json`**: reglas de `permissions.allow` y rutas de mi máquina.
- **`projects/`, cachés**: los GB de transcripts y paquetes instalados.
- **Secretos**: ninguno. No hay `.env` en este repo.
- **MCP de usuario** (`~/.mcp.json`, `~/.claude.json`): paths de esta máquina y auth por sesión.
  Inventario abajo; no versionar esos archivos.

## MCP (fuera de este repo)

Hay dos Supabase a propósito. El de `settings.json` es el CLI local; el de `~/.mcp.json` es
la cuenta cloud (org `karenrebecag`). El resto no se copia a git.

| dónde | servidores |
|---|---|
| `config/settings.json` | `supabase` local: `http://localhost:54321/mcp` (Supabase CLI; solo si `supabase start` está corriendo) |
| `~/.mcp.json` (no versionado) | Salesforce DX (`npx @salesforce/mcp`); Supabase cloud (`mcp.supabase.com`); Flow Studio (bridge local); Power Automate (MCP local) |
| `~/.claude.json` (no versionado) | Relume, Asana, Webflow, `analytics.atomchat.io`, Monday, Atom knowledge |

## Pendientes

- Añadir `repository` a los `plugin.json` (el remoto ya existe: `karenrebecag/spec-driven-standards`).
- `linkedin-post-writer` queda fuera de los plugins: no tiene marca de autoría y no pude verificar
  su origen. En el catálogo como `sin-determinar`. Si resulta ser mía, entra a `martech`.
- Migrar a sus repos las memorias `reference_*` más grandes de
  `~/.claude/projects/-Users-karenrebecaog/memory/`, que hoy solo cargan cuando la sesión arranca
  en `~`.

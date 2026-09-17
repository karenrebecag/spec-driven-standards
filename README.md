# spec-driven-standards

Fuente de verdad de mi configuración de Claude Code y marketplace de los plugins que salen de
ella, clasificados por área.

Existe por dos razones: `~/.claude` no estaba en git (664 KB de contenido propio sin historia ni
respaldo), y las skills propias no se podían instalar en otra máquina ni pasar a nadie.

## Estructura

```
config/                 mi configuración: CLAUDE.md, rules/ (14), settings.json
plugins/<area>/         un plugin instalable por área, con sus skills y agentes
catalogo/               las 114 skills instaladas, clasificadas por área y por origen
scripts/link.sh         apunta ~/.claude a este repo
scripts/doctor.sh       comprueba que ~/.claude y el repo digan lo mismo
scripts/catalogo.py     regenera el catálogo
```

## Las 5 áreas con plugin

| plugin | qué trae |
|---|---|
| `standards` | los 8 agentes del ciclo spec-driven (planner, architect, tdd-guide, code-reviewer, security-reviewer, build-error-resolver, refactor-cleaner, e2e-runner) y `lean-review` |
| `atom` | `cortex-reference` y `cortex-implementation`: la plataforma Cortex de Atom y cómo se implementa o migra un agente |
| `martech` | `email-campaigns`: el pipeline CampaignSender de ATFX |
| `security` | `security-audit`: auditoría de proyecto completo, read-only, con reporte priorizado |
| `mac-ops` | `clop-compress`: compresión de medios con el CLI de Clop |

Las otras tres áreas del catálogo (`web`, `automation`, `office-docs`) no tienen plugin porque
todo lo que hay en ellas es de terceros.

## Disponibilizarlo a un equipo

El onboarding completo está en **[ONBOARDING.md](ONBOARDING.md)**: los 5 plugins instalables, la
capa de seguridad desde origen (`scripts/bootstrap-security.sh`) y el catálogo como mapa.

Resumen: lo redistribuible se instala como plugin; lo de terceros sin licencia (las `offensive-*`)
cada quien lo trae de su fuente pública con el bootstrap, sin que este repo lo redistribuya.

```bash
/plugin marketplace add <url-del-repo>
/plugin install standards@spec-driven-standards
./scripts/bootstrap-security.sh        # capa de seguridad desde origen
```

Las `rules/` no viajan en el plugin: no es una capacidad del harness. Se copian a mano a
`~/.claude/rules/` y se importan desde `~/.claude/CLAUDE.md` (ver `config/CLAUDE.md`).

## En mi máquina

`~/.claude/CLAUDE.md`, `rules/`, `agents/` y las 4 skills propias son symlinks a este repo, así
que editarlas en cualquiera de los dos sitios es lo mismo y queda versionado:

```bash
./scripts/link.sh      # idempotente; lo que reemplaza se respalda en ~/.claude/_backup-<fecha>/
./scripts/doctor.sh    # comprueba symlinks, settings.json y catálogo
```

`settings.json` no se enlaza: Claude Code lo reescribe al cambiar modelo o tema y el symlink
podría perderse. Se sincroniza a mano; `doctor.sh` avisa cuando difiere.

Con los symlinks puestos, **no instalar además el marketplace en esta máquina**: las skills se
cargarían dos veces. `doctor.sh` lo comprueba.

`cortex-implementation` y `cortex-reference` llegan por el sync de la cuenta de Claude a
`skills/synced/`, que el sync sobreescribe. Por eso viven solo en el plugin, para otras máquinas
y para el equipo, y no se enlazan.

## Qué no está aquí, y por qué

- **Las 107 skills de terceros** (78 `offensive-*`, 5 `flowstudio-*`, las 11 de `~/.agents`, las 8
  de Anthropic y el resto). No son mías para redistribuir y varias no traen licencia. Están en
  `catalogo/SKILLS.md` con su origen y de dónde salen. Las 34 `offensive-*` que trazan a un repo
  público las trae `scripts/bootstrap-security.sh` desde la fuente, en cada máquina; las 44 de
  origen sin identificar quedan solo listadas.
- **`settings.local.json`**: 1,554 reglas de `permissions.allow` y rutas de mi máquina.
- **`projects/`, `plugins/`, cachés**: los 2 GB de transcripts y paquetes instalados.
- **Secretos**: ninguno. `settings.json` solo trae 3 variables de entorno y un MCP a localhost.

## Pendientes

- Crear el remoto y añadir `repository` a los `plugin.json`.
- `linkedin-post-writer` queda fuera de los plugins: no tiene marca de autoría y no pude verificar
  su origen. En el catálogo como `sin-determinar`. Si resulta ser mía, entra a `martech`.
- Las 44 `offensive-*` de origen sin identificar (wireless, AD, cloud, k8s) no las cubre el
  bootstrap. Si alguien reconoce su repo, se añade a `FUENTE_OFENSIVA` en `scripts/catalogo.py` y
  al bootstrap.
- Migrar a sus repos las 9 memorias `reference_*` y las 12 más grandes de
  `~/.claude/projects/-Users-karenrebecaog/memory/`, que hoy solo cargan cuando la sesión arranca
  en `~`.

# QA skills externas (dependencia del qa-reviewer)

El `qa-reviewer` no trae su propia checklist: conduce el sistema **awesome-qa-skills** de naodeng.
Esas skills **no viven en este repo** y no se redistribuyen desde aquí.

## De dónde salen

- Repo: https://github.com/naodeng/awesome-qa-skills (autor: naodeng)
- Sitio: https://inaodeng.com/qaskills/
- Licencia: **PolyForm Noncommercial 1.0.0** — permite usar, estudiar, modificar y copiar para
  fines **no comerciales**. Por eso este repo no las empaqueta: cada quien las clona/instala desde
  la fuente en su propia máquina.

## Cómo instalarlas

Con el helper de este repo (recomendado — instala planas, que es lo que Claude Code registra):

```bash
scripts/install-qa-skills.sh            # set completo EN, plano en ~/.claude/skills
scripts/install-qa-skills.sh --workflows-only   # solo routers + engineering (versión ligera)
scripts/install-qa-skills.sh --lang zh  # en chino
```

O directo desde la fuente (una de estas):

```bash
# el instalador del propio repo de origen
git clone https://github.com/naodeng/awesome-qa-skills
bash awesome-qa-skills/scripts/install-skills-mac.sh --tool claude --lang en

# o la CLI de skills.sh
npx skills add https://github.com/naodeng/awesome-qa-skills/tree/main/skills/en -g -a claude-code -y
```

## Detalle importante (por qué el helper existe)

El instalador de origen deja las skills **anidadas** (`~/.claude/skills/en/testing-types/...`).
Claude Code solo descubre skills **un nivel** bajo `~/.claude/skills/`, así que ese layout queda
inerte. `install-qa-skills.sh` las instala **planas** (`~/.claude/skills/<nombre>/`), que sí se
registran. Si usas el instalador de origen, verifica que las skills aparezcan (`/` en la sesión);
si no, usa el helper.

## Qué necesita el qa-reviewer

Como mínimo el router `discover-testing` y los `testing-types` que este rutee. Sin ellas, el
`qa-reviewer` lo dice y cae a `~/.claude/rules/common/testing.md` en vez de inventar una checklist.

Reversión y procedencia quedan registradas en `~/.claude/skills/.qa-skills-manifest.txt`.

#!/usr/bin/env bash
# Trae/actualiza las skills de QA desde su fuente, instaladas PLANAS en ~/.claude/skills/.
#
# Fuente: naodeng/awesome-qa-skills. LICENCIA PolyForm Noncommercial 1.0.0: uso no comercial
# (interno, personal, investigacion, org sin fines de lucro). Por eso NO se empaquetan dentro de
# este repo; cada persona las trae de la fuente a su propia maquina, que si esta permitido.
#
# El repo de origen las anida en skills/en/<categoria>/<nombre>/SKILL.md; Claude Code solo
# descubre un nivel (~/.claude/skills/<nombre>/), asi que aqui se aplanan. Solo el set en ingles.
set -euo pipefail

FUENTE_URL="https://github.com/naodeng/awesome-qa-skills"
CLAUDE="${CLAUDE_HOME:-$HOME/.claude}"
SRC_DIR="$CLAUDE/skills-sources/awesome-qa-skills"
SKILLS_DIR="$CLAUDE/skills"
MANIFEST="$SKILLS_DIR/.qa-skills-manifest.txt"

echo "origen:  $FUENTE_URL (PolyForm Noncommercial — solo uso no comercial)"
echo "destino: $SKILLS_DIR/  (plano, set en ingles)"
echo

command -v git >/dev/null || { echo "falta git"; exit 1; }
command -v rsync >/dev/null || { echo "falta rsync"; exit 1; }

if [ -d "$SRC_DIR/.git" ]; then
  echo "actualizando la fuente ya clonada..."
  git -C "$SRC_DIR" pull --ff-only --quiet
else
  echo "clonando la fuente..."
  mkdir -p "$(dirname "$SRC_DIR")"
  git clone --depth 1 --quiet "$FUENTE_URL" "$SRC_DIR"
fi

{
  echo "# QA skills instaladas planas en ~/.claude/skills/"
  echo "# Fuente: $FUENTE_URL"
  echo "# Licencia: PolyForm Noncommercial 1.0.0 — SOLO uso no comercial."
  echo "# Refrescadas $(date +%Y-%m-%d) por bootstrap-qa.sh"
  echo "#"
} > "$MANIFEST"

BASE="$SRC_DIR/skills/en"
[ -d "$BASE" ] || { echo "no existe $BASE (revisa la estructura del repo de origen)"; exit 1; }

n=0
while IFS= read -r skilldir; do
  [ -f "$skilldir/SKILL.md" ] || continue
  name="$(basename "$skilldir")"
  rsync -a "$skilldir/" "$SKILLS_DIR/$name/"
  echo "$name" >> "$MANIFEST"
  n=$((n + 1))
done < <(find "$BASE" -type d -mindepth 2 -maxdepth 2 2>/dev/null | sort)

echo
echo "listo. $n skills de QA en $SKILLS_DIR, se cargan al arrancar la sesion."
echo "Recordatorio de licencia: uso no comercial unicamente."

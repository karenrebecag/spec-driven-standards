#!/usr/bin/env bash
# Trae/actualiza las 78 skills ofensivas (offensive-*) desde su fuente upstream MIT.
# El plugin `security` ya incluye un snapshot; este script sirve para refrescar a la ultima
# version desde el origen, o para instalarlas en una maquina sin el plugin.
#
# Fuente: SnailSploit/Claude-Red (MIT). Antes se apuntaba a SnailSploit/offensive-checklist,
# que no declaraba licencia; claude-red es el mismo material con licencia MIT, asi que se puede
# redistribuir con atribucion (ver plugins/security/skills/ATTRIBUTION-offensive.md).
#
# Instala PLANO en ~/.claude/skills/<nombre>/, que es lo que Claude Code descubre (el layout
# anidado del repo de origen, ~/.claude/skills/claude-red/..., quedaria inerte).
set -euo pipefail

FUENTE_URL="https://github.com/SnailSploit/Claude-Red"
CLAUDE="${CLAUDE_HOME:-$HOME/.claude}"
SRC_DIR="$CLAUDE/skills-sources/claude-red"
SKILLS_DIR="$CLAUDE/skills"
MANIFEST="$SKILLS_DIR/.offensive-skills-manifest.txt"

echo "origen:  $FUENTE_URL (MIT, SnailSploit / Kai Aizen)"
echo "destino: $SKILLS_DIR/offensive-*  (plano)"
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
  echo "# offensive-* instaladas planas en ~/.claude/skills/"
  echo "# Fuente: $FUENTE_URL (SnailSploit / Kai Aizen)"
  echo "# Licencia: MIT — redistribuible con atribucion; el LICENSE viaja en el plugin security."
  echo "# Refrescadas $(date +%Y-%m-%d) por bootstrap-security.sh"
  echo "#"
} > "$MANIFEST"

n=0
while IFS= read -r skilldir; do
  [ -f "$skilldir/SKILL.md" ] || continue
  name="$(basename "$skilldir")"
  case "$name" in offensive-*) ;; *) continue ;; esac
  rsync -a "$skilldir/" "$SKILLS_DIR/$name/"
  echo "$name" >> "$MANIFEST"
  n=$((n + 1))
done < <(find "$SRC_DIR/Skills" -type d -name 'offensive-*' 2>/dev/null | sort)

echo
echo "listo. $n skills offensive-* en $SKILLS_DIR, se cargan al arrancar la sesion."
echo "Uso solo para pruebas autorizadas; el loop /pentest exige alcance en .pentest-scope.json."

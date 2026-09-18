#!/usr/bin/env bash
# Trae a ESTA maquina las skills de QA que usa el qa-reviewer, desde su repo publico de origen.
# Cada persona lo corre en su equipo: el material se adquiere desde la fuente, NO se redistribuye
# desde este repo. La licencia de origen es PolyForm Noncommercial 1.0.0 (permite uso, estudio y
# copia para fines NO comerciales; empaquetarlas aqui seria redistribucion, clonarlas uno mismo no).
#
# Ojo con el layout: el instalador del repo de origen deja las skills anidadas
# (~/.claude/skills/en/testing-types/...), pero Claude Code solo descubre skills UN nivel bajo
# ~/.claude/skills/. Por eso aqui se instalan PLANAS (~/.claude/skills/<nombre>/), que es la ruta
# que Claude Code si registra.
set -euo pipefail

FUENTE_URL="https://github.com/naodeng/awesome-qa-skills"
LANG_DIR="en"                    # en | zh (instala un idioma; los nombres coinciden entre idiomas)
SOLO_WORKFLOWS=0                 # 1 = solo los entry points (routers + engineering), version ligera
CLAUDE="${CLAUDE_HOME:-$HOME/.claude}"
SRC_DIR="$CLAUDE/skills-sources/awesome-qa-skills"
SKILLS_DIR="$CLAUDE/skills"
MANIFEST="$SKILLS_DIR/.qa-skills-manifest.txt"

while [ $# -gt 0 ]; do
  case "$1" in
    --lang) LANG_DIR="${2:-en}"; shift 2 ;;
    --workflows-only) SOLO_WORKFLOWS=1; shift ;;
    -h|--help) echo "uso: $0 [--lang en|zh] [--workflows-only]"; exit 0 ;;
    *) echo "argumento desconocido: $1" >&2; exit 1 ;;
  esac
done

echo "origen:  $FUENTE_URL (PolyForm Noncommercial 1.0.0; uso propio no comercial)"
echo "destino: $SKILLS_DIR/<skill>  (plano; idioma: $LANG_DIR)"
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

if [ "$SOLO_WORKFLOWS" -eq 1 ]; then
  SECCIONES="testing-workflows skill-engineering"
  echo "instalando solo entry points (routers + engineering)..."
else
  SECCIONES="testing-types testing-workflows skill-engineering"
  echo "instalando el set completo..."
fi

{
  echo "# awesome-qa-skills instaladas planas en ~/.claude/skills/"
  echo "# Fuente: $FUENTE_URL (autor: naodeng)"
  echo "# Licencia: PolyForm Noncommercial 1.0.0 — uso propio, NO redistribuidas."
  echo "# Instaladas $(date +%Y-%m-%d) desde $SRC_DIR/skills/$LANG_DIR"
  echo "# Revertir: grep -v '^#' este_archivo | xargs -I{} rm -rf $SKILLS_DIR/{}"
  echo "#"
} > "$MANIFEST"

n=0
for sec in $SECCIONES; do
  src="$SRC_DIR/skills/$LANG_DIR/$sec"
  [ -d "$src" ] || continue
  for d in "$src"/*/; do
    [ -d "$d" ] && [ -f "$d/SKILL.md" ] || continue
    name="$(basename "$d")"
    rsync -a --delete "$d" "$SKILLS_DIR/$name/"
    echo "$name" >> "$MANIFEST"
    n=$((n + 1))
  done
done

echo
echo "listo. $n skills de QA en $SKILLS_DIR, se cargan al arrancar la sesion."
echo "el qa-reviewer arranca por 'discover-testing'. Manifest y como revertir: $MANIFEST"
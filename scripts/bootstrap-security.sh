#!/usr/bin/env bash
# Trae a ESTA maquina las skills ofensivas de auditoria desde su repo publico de origen y las
# convierte a skills en el sitio. Cada persona lo corre en su equipo: el material se adquiere
# desde la fuente, no se redistribuye desde este repo (el repo de origen no declara licencia,
# asi que redistribuirlo empaquetado no estaria permitido; clonarlo uno mismo si).
#
# Cubre solo lo que traza a una fuente publica conocida. Las ~40 skills de wireless, Active
# Directory, cloud y k8s que hay en la maquina original tienen origen sin identificar y NO se
# tocan aqui: no puedo apuntarte a una fuente que no conozco. Ver catalogo/SKILLS.md.
set -euo pipefail

FUENTE_URL="https://github.com/SnailSploit/offensive-checklist"
FUENTE_RAW="https://github.com/SnailSploit/offensive-checklist/blob/main"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLAUDE="${CLAUDE_HOME:-$HOME/.claude}"
SRC_DIR="$CLAUDE/skills-sources/offensive-checklist"
SKILLS_DIR="$CLAUDE/skills"

echo "origen:  $FUENTE_URL (sin licencia declarada; uso interno para auditoria autorizada)"
echo "destino: $SKILLS_DIR/offensive-*"
echo

command -v git >/dev/null || { echo "falta git"; exit 1; }
command -v python3 >/dev/null || { echo "falta python3"; exit 1; }

if [ -d "$SRC_DIR/.git" ]; then
  echo "actualizando la fuente ya clonada..."
  git -C "$SRC_DIR" pull --ff-only --quiet
else
  echo "clonando la fuente..."
  mkdir -p "$(dirname "$SRC_DIR")"
  git clone --depth 1 --quiet "$FUENTE_URL" "$SRC_DIR"
fi

echo "convirtiendo checklists a skills..."
python3 "$REPO/scripts/convertir-checklist.py" "$SRC_DIR" "$SKILLS_DIR" "$FUENTE_RAW"

echo
echo "listo. Las skills offensive-* estan en $SKILLS_DIR y se cargan al arrancar la sesion."
echo "Se actualizan volviendo a correr este script."

#!/usr/bin/env bash
# Apunta ~/.claude a este repo: lo que edites en cualquiera de los dos lados queda versionado.
# Idempotente. Lo que reemplaza se guarda antes en ~/.claude/_backup-<fecha>/.
#
# settings.json NO se enlaza a proposito: Claude Code lo reescribe al cambiar modelo o tema, y
# algunos escritores reemplazan el archivo en vez de escribir dentro, lo que romperia el symlink.
# Ese se sincroniza a mano y doctor.sh avisa cuando difiere.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLAUDE="$HOME/.claude"
BACKUP="$CLAUDE/_backup-$(date +%Y%m%d-%H%M%S)"

enlazar() {
  local destino="$1" origen="$2"
  if [ ! -e "$origen" ]; then
    echo "  omitida  $destino  (no existe $origen en el repo)"
    return
  fi
  if [ -L "$destino" ] && [ "$(readlink "$destino")" = "$origen" ]; then
    echo "  ya ok    ${destino#$HOME/}"
    return
  fi
  if [ -e "$destino" ] || [ -L "$destino" ]; then
    mkdir -p "$BACKUP/$(dirname "${destino#$CLAUDE/}")"
    mv "$destino" "$BACKUP/${destino#$CLAUDE/}"
    echo "  respaldo ${destino#$HOME/}  ->  ${BACKUP#$HOME/}/${destino#$CLAUDE/}"
  fi
  mkdir -p "$(dirname "$destino")"
  ln -s "$origen" "$destino"
  echo "  enlazada ${destino#$HOME/}  ->  ${origen#$REPO/}"
}

echo "repo:   $REPO"
echo "config:"
enlazar "$CLAUDE/CLAUDE.md" "$REPO/config/CLAUDE.md"
enlazar "$CLAUDE/rules" "$REPO/config/rules"
enlazar "$CLAUDE/agents" "$REPO/plugins/standards/agents"
enlazar "$CLAUDE/hooks" "$REPO/plugins/standards/hooks"

echo "skills propias:"
enlazar "$CLAUDE/skills/ship" "$REPO/plugins/standards/skills/ship"
enlazar "$CLAUDE/skills/pentest" "$REPO/plugins/security/skills/pentest"
enlazar "$CLAUDE/skills/lean-review" "$REPO/plugins/standards/skills/lean-review"
enlazar "$CLAUDE/skills/email-campaigns" "$REPO/plugins/martech/skills/email-campaigns"
enlazar "$CLAUDE/skills/security-audit" "$REPO/plugins/security/skills/security-audit"
enlazar "$CLAUDE/skills/clop-compress" "$REPO/plugins/mac-ops/skills/clop-compress"

# cortex-* llegan por el sync de la cuenta a skills/synced/, que el sync sobreescribe: enlazarlas
# ahi seria pelearse con el. Se quedan solo en el plugin, para otras maquinas y para el equipo.

echo
echo "listo. En ESTA maquina las skills propias vienen de los symlinks; no instales ademas"
echo "los plugins del marketplace aqui o se cargarian dos veces. doctor.sh lo comprueba."
[ -d "$BACKUP" ] && echo "respaldo en ${BACKUP#$HOME/}"
exit 0

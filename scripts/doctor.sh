#!/usr/bin/env bash
# Comprueba que ~/.claude y el repo digan lo mismo. Solo lee: no arregla nada.
# Salida 0 todo en orden, 1 hay algo que revisar.
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLAUDE="$HOME/.claude"
FALLOS=0

aviso() { echo "  AVISO  $*"; FALLOS=$((FALLOS + 1)); }
ok() { echo "  ok     $*"; }

echo "symlinks:"
for par in \
  "$CLAUDE/CLAUDE.md:$REPO/config/CLAUDE.md" \
  "$CLAUDE/rules:$REPO/config/rules" \
  "$CLAUDE/agents:$REPO/plugins/standards/agents" \
  "$CLAUDE/skills/lean-review:$REPO/plugins/standards/skills/lean-review" \
  "$CLAUDE/skills/email-campaigns:$REPO/plugins/martech/skills/email-campaigns" \
  "$CLAUDE/skills/security-audit:$REPO/plugins/security/skills/security-audit" \
  "$CLAUDE/skills/clop-compress:$REPO/plugins/mac-ops/skills/clop-compress"; do
  destino="${par%%:*}"
  origen="${par#*:}"
  if [ -L "$destino" ] && [ "$(readlink "$destino")" = "$origen" ]; then
    ok "${destino#$HOME/}"
  elif [ -e "$destino" ]; then
    aviso "${destino#$HOME/} existe pero no apunta al repo: corre scripts/link.sh"
  else
    aviso "${destino#$HOME/} no existe: corre scripts/link.sh"
  fi
done

echo "settings.json (se sincroniza a mano):"
if diff -q "$CLAUDE/settings.json" "$REPO/config/settings.json" >/dev/null 2>&1; then
  ok "identico"
else
  aviso "difiere. Diferencias:"
  diff "$REPO/config/settings.json" "$CLAUDE/settings.json" | sed 's/^/         /' | head -20
fi

echo "doble carga de skills propias (symlink + plugin instalado):"
INSTALADOS="$CLAUDE/plugins/installed_plugins.json"
if [ -f "$INSTALADOS" ] && grep -q "spec-driven-standards" "$INSTALADOS" 2>/dev/null; then
  aviso "este marketplace esta instalado en esta maquina y ademas hay symlinks: elige uno"
else
  ok "sin doble carga"
fi

echo "catalogo al dia:"
ANTES=$(shasum "$REPO/catalogo/skills.json" 2>/dev/null | cut -d' ' -f1)
python3 "$REPO/scripts/catalogo.py" >/dev/null 2>&1
DESPUES=$(shasum "$REPO/catalogo/skills.json" 2>/dev/null | cut -d' ' -f1)
if [ "$ANTES" = "$DESPUES" ]; then
  ok "sin cambios"
else
  aviso "el catalogo cambio al regenerarlo: revisa el diff y commitealo"
fi

echo
[ "$FALLOS" -eq 0 ] && { echo "todo en orden"; exit 0; }
echo "$FALLOS avisos"
exit 1

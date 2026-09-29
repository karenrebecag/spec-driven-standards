#!/usr/bin/env bash
# Apaga KaliLab pidiendoselo al sistema invitado; forzar solo si no responde, para no dejar el
# ext4 con el journal sucio.
set -euo pipefail

VM="${KALI_VM:-KaliLab}"
UTMCTL="/Applications/UTM.app/Contents/MacOS/utmctl"
TIMEOUT="${KALI_STOP_TIMEOUT:-60}"

status="$("$UTMCTL" status "$VM" 2>&1 || true)"
case "$status" in
  stopped) echo "kali-down: $VM ya estaba apagada"; exit 0 ;;
  started|paused|suspended) ;;
  *) echo "kali-down: estado inesperado de $VM: $status" >&2; exit 1 ;;
esac

"$UTMCTL" stop "$VM" --request >/dev/null
deadline=$(( $(date +%s) + TIMEOUT ))
until [ "$("$UTMCTL" status "$VM" 2>&1)" = "stopped" ]; do
  if [ "$(date +%s)" -ge "$deadline" ]; then
    echo "kali-down: no se apago en ${TIMEOUT}s, forzando" >&2
    "$UTMCTL" stop "$VM" --force >/dev/null
    break
  fi
  sleep 2
done
echo "kali-down: $VM apagada"

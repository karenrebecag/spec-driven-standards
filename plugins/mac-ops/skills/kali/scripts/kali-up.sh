#!/usr/bin/env bash
# Deja KaliLab encendida y alcanzable por SSH. Idempotente: si ya responde, no toca nada.
set -euo pipefail

VM="${KALI_VM:-KaliLab}"
HOST="${KALI_HOST:-kalilab}"
UTMCTL="/Applications/UTM.app/Contents/MacOS/utmctl"
BOOT_TIMEOUT="${KALI_BOOT_TIMEOUT:-120}"

fail() { echo "kali-up: $*" >&2; exit 1; }

[ -x "$UTMCTL" ] || fail "no encuentro utmctl en $UTMCTL (UTM instalado?)"
# awk compara literal (un grep -E trataria el punto de "kalilab.local" como comodin) y acepta varios alias por linea Host.
awk -v h="$HOST" 'tolower($1) == "host" { for (i = 2; i <= NF; i++) if ($i == h) found = 1 } END { exit !found }' "$HOME/.ssh/config" 2>/dev/null || fail "no hay alias '$HOST' en ~/.ssh/config"

ssh_ok() { ssh -o BatchMode=yes -o ConnectTimeout=3 -- "$HOST" true 2>/dev/null; }

if ssh_ok; then
  echo "kali-up: $VM ya estaba lista"
else
  status="$("$UTMCTL" status "$VM" 2>&1 || true)"
  case "$status" in
    started) echo "kali-up: $VM encendida, esperando SSH" ;;
    stopped|paused|suspended)
      echo "kali-up: $VM estaba '$status', arrancando"
      "$UTMCTL" start "$VM" --hide >/dev/null 2>&1 || "$UTMCTL" start "$VM" >/dev/null ;;
    *) fail "estado inesperado de $VM: $status" ;;
  esac

  deadline=$(( $(date +%s) + BOOT_TIMEOUT ))
  until ssh_ok; do
    [ "$(date +%s)" -lt "$deadline" ] || fail "SSH no respondio en ${BOOT_TIMEOUT}s. Revisa la ventana de UTM (puede estar en GRUB o pidiendo login)."
    sleep 3
  done
fi

ssh -o BatchMode=yes -- "$HOST" 'printf "kali-up: OK  host=%s  user=%s  ip=%s  kernel=%s\n" "$(hostname)" "$(whoami)" "$(hostname -I | cut -d" " -f1)" "$(uname -r)"'

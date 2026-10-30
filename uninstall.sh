#!/bin/sh
# lokal uninstaller: removes everything lokAl put on this machine, so the next install starts from scratch.
#   curl -fsSL https://raw.githubusercontent.com/jesuscbm/lokAl/main/uninstall.sh | sh            # keep model + login
#   curl -fsSL https://raw.githubusercontent.com/jesuscbm/lokAl/main/uninstall.sh | sh -s -- --all
# Options:
#   --models   also delete downloaded Ollama models (~/.ollama/models; they are 1-5 GB each to re-download)
#   --logout   also sign the Sokosumi CLI out (the next run asks for the browser login again)
#   --all      both of the above, plus the postgres:16 Docker image
# Env: LOKAL_HOME (default ~/.local/share/lokal), LOKAL_DB_CONTAINER (default lokal-mps-db).
# Not touched: anything on Sokosumi or Cardano preprod (Vendor, Coworker, registry entry, transactions),
# and an Ollama or Docker you installed yourself.
set -u
LOKAL_HOME="${LOKAL_HOME:-$HOME/.local/share/lokal}"
DB="${LOKAL_DB_CONTAINER:-lokal-mps-db}"
BIN_DIR="$HOME/.local/bin"
MODELS=0; LOGOUT=0; IMAGE=0
for a in "$@"; do case "$a" in
  --models) MODELS=1 ;; --logout) LOGOUT=1 ;; --all) MODELS=1; LOGOUT=1; IMAGE=1 ;;
  -h|--help) sed -n '2,13p' "$0" 2>/dev/null || echo "options: --models --logout --all"; exit 0 ;;
  *) echo "unknown option: $a" >&2; exit 2 ;;
esac; done

if [ -t 1 ]; then V='\033[38;2;167;139;250m'; G='\033[32m'; D='\033[2m'; N='\033[0m'; else V=''; G=''; D=''; N=''; fi
ok()   { printf "  ${G}✔${N} %s\n" "$1"; }
skip() { printf "  ${D}· %s${N}\n" "$1"; }
printf "\n${V}◆ lokAl${N} uninstall\n\n"

# 0. lokald (the background service) stops its own children cleanly; the systemd unit, if any, goes too.
UNIT="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user/lokald.service"
if [ -f "$UNIT" ]; then
  systemctl --user disable --now lokald.service >/dev/null 2>&1; rm -f "$UNIT"; systemctl --user daemon-reload >/dev/null 2>&1
  ok "Removed the lokald systemd unit"
fi
PLIST="$HOME/Library/LaunchAgents/network.lokal.lokald.plist"
if [ -f "$PLIST" ]; then
  launchctl bootout "gui/$(id -u)/network.lokal.lokald" >/dev/null 2>&1 || launchctl unload "$PLIST" >/dev/null 2>&1; rm -f "$PLIST"
  ok "Removed the lokald launchd agent"
fi
[ -x "$BIN_DIR/lokal" ] && "$BIN_DIR/lokal" down >/dev/null 2>&1 && ok "Stopped lokald and its services"

# 1. Stop everything lokal started (all of it runs from inside LOKAL_HOME).
#    Skip this script and its parent (`lokal uninstall` runs it from inside LOKAL_HOME).
others() { pgrep -f "$LOKAL_HOME/" 2>/dev/null | grep -vxE "$$|$PPID" ; }
PIDS=$(others)
if [ -n "$PIDS" ]; then
  kill -TERM $PIDS 2>/dev/null; sleep 3; PIDS=$(others); [ -n "$PIDS" ] && kill -KILL $PIDS 2>/dev/null
  ok "Stopped lokAl processes (UI, agent, worker, payment service, private Ollama)"
else skip "No lokAl processes running"; fi

# 2. Payment database: the native cluster (stopped here, deleted with LOKAL_HOME below), or the container.
if [ -f "$LOKAL_HOME/pgdata/postmaster.pid" ]; then
  PGPID=$(head -1 "$LOKAL_HOME/pgdata/postmaster.pid"); kill -INT "$PGPID" 2>/dev/null && sleep 2 && ok "Stopped the payment database (PostgreSQL)"
fi
if command -v docker >/dev/null 2>&1 && docker ps -a --format '{{.Names}}' 2>/dev/null | grep -qx "$DB"; then
  docker rm -f -v "$DB" >/dev/null 2>&1 && ok "Removed Docker container $DB (payment database)"
else skip "No payment database container"; fi
if [ "$IMAGE" = 1 ] && command -v docker >/dev/null 2>&1 && docker image inspect postgres:16 >/dev/null 2>&1; then
  docker image rm postgres:16 >/dev/null 2>&1 && ok "Removed Docker image postgres:16" || skip "postgres:16 image in use elsewhere; kept"
fi

# 3. Sokosumi login (before its CLI is deleted).
if [ "$LOGOUT" = 1 ] && command -v sokosumi >/dev/null 2>&1; then
  sokosumi --preprod auth logout >/dev/null 2>&1 && ok "Signed the Sokosumi CLI out" || skip "Sokosumi logout failed (maybe already signed out)"
fi

# 4. Models: only Ollama's model store; the Ollama binary is removed below only if lokal installed it.
if [ "$MODELS" = 1 ]; then
  if [ -d "$HOME/.ollama/models" ]; then rm -rf "$HOME/.ollama/models" && ok "Deleted Ollama models (~/.ollama/models)"; else skip "No Ollama models"; fi
fi

# 5. lokAl's own folder: private Node, private Ollama, payment service, coworker config + wallets state, extra
#    Coworkers, the file vault used on machines without a keyring (Sokosumi login + runtime keys), logs.
if [ -d "$LOKAL_HOME" ]; then rm -rf "$LOKAL_HOME" && ok "Deleted $LOKAL_HOME"; else skip "$LOKAL_HOME not found"; fi

# 6. Commands, but only the ones that point into lokal.
if [ -e "$BIN_DIR/lokal" ] || [ -L "$BIN_DIR/lokal" ]; then rm -f "$BIN_DIR/lokal" && ok "Removed $BIN_DIR/lokal"; fi
if [ -L "$BIN_DIR/sokosumi" ]; then
  case "$(readlink "$BIN_DIR/sokosumi")" in "$LOKAL_HOME"/*) rm -f "$BIN_DIR/sokosumi" && ok "Removed $BIN_DIR/sokosumi (lokAl's copy)" ;; esac
fi

# 7. PATH lines the installer added.
for rc in "$HOME/.profile" "$HOME/.bashrc" "$HOME/.zshrc"; do
  if [ -f "$rc" ] && grep -q '# added by lokal' "$rc"; then
    grep -v '# added by lokal' "$rc" > "$rc.lokal-tmp" && cat "$rc.lokal-tmp" > "$rc" && rm -f "$rc.lokal-tmp" && ok "Removed lokAl's PATH line from $rc"
  fi
done

printf "\n${G}Done.${N} ${D}Sokosumi and Cardano records (Vendor, Coworker, registry entry) stay online; a reinstall reuses them.${N}\n"
[ "$MODELS" = 0 ] && printf "${D}Kept downloaded models (use --models or --all to delete them).${N}\n"
[ "$LOGOUT" = 0 ] && printf "${D}Kept the Sokosumi login (use --logout or --all).${N}\n"
printf "\n"

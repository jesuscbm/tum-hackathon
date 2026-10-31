#!/bin/sh
# Clean-room smoke test: install lokal from this checkout into an empty HOME and exercise it
# without any accounts, models or keys. Used by CI; safe to run on any machine.
set -eu
ROOT=$(cd "$(dirname "$0")/.." && pwd)
T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT
echo "== install into $T"
HOME="$T" LOKAL_SRC="$ROOT" LOKAL_NO_START=1 LOKAL_DOCKER=no sh "$ROOT/install.sh"
L="$T/.local/bin/lokal"
echo "== lokal --help";        HOME="$T" "$L" --help >/dev/null
echo "== lokal status --mock"; HOME="$T" "$L" status --mock | grep -q "Your machine & model"
echo "== lokal info/coworker --mock"; HOME="$T" "$L" info --mock | grep -q "Network: Preprod"; HOME="$T" "$L" coworker list --mock | grep -q main
echo "== lokald start/status/down (nothing to run yet)"
HOME="$T" "$L" daemon start | grep -q "lokald running"
HOME="$T" "$L" daemon status | grep -q "lokald running"
HOME="$T" "$L" down | grep -q "stopped"
echo "== lokal verify"
printf '%s' '{"check":{"pass":true,"reasons":[],"type":"none"},"digest":null,"model":"m","output":"hi","promptHash":"sha256:00","template":"freeform","v":1}' > "$T/r.json"
H=$(HOME="$T" "$L" verify "$T/r.json")
HOME="$T" "$L" verify "$T/r.json" "$H" | grep -q "hash matches"
echo "== unit tests with the installed Node"
APP="$T/.local/share/lokal/app"
NODE=$(sed -n 's/^exec "\([^"]*\)".*/\1/p' "$L")
(cd "$APP" && "$NODE" --test test/*.test.mjs >/dev/null)
echo "== uninstall"
echo 'export FOO=1' > "$T/.bashrc"
HOME="$T" LOKAL_DB_CONTAINER=lokal-smoke-none sh "$ROOT/uninstall.sh" >/dev/null
[ ! -e "$T/.local/share/lokal" ] && [ ! -e "$L" ] || { echo "uninstall left files behind"; exit 1; }
! grep -q 'added by lokal' "$T/.profile" "$T/.bashrc" 2>/dev/null || { echo "uninstall left PATH lines"; exit 1; }
grep -q 'export FOO=1' "$T/.bashrc" || { echo "uninstall damaged .bashrc"; exit 1; }
echo "smoke OK"

#!/bin/sh
# Clean-room smoke test: install lokal from this checkout into an empty HOME and exercise it
# without any accounts, models or keys. Used by CI; safe to run on any machine.
set -eu
ROOT=$(cd "$(dirname "$0")/.." && pwd)
T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT
echo "== install into $T"
HOME="$T" LOKAL_SRC="$ROOT" sh "$ROOT/install.sh"
L="$T/.local/bin/lokal"
echo "== lokal --help";        HOME="$T" "$L" --help >/dev/null
echo "== lokal status --mock"; HOME="$T" "$L" status --mock | grep -q "Your machine & model"
echo "== lokal verify"
printf '%s' '{"check":{"pass":true,"reasons":[],"type":"none"},"digest":null,"model":"m","output":"hi","promptHash":"sha256:00","template":"freeform","v":1}' > "$T/r.json"
H=$(HOME="$T" "$L" verify "$T/r.json")
HOME="$T" "$L" verify "$T/r.json" "$H" | grep -q "hash matches"
echo "== unit tests with the installed Node"
APP="$T/.local/share/lokal/app"
NODE=$(sed -n 's/^exec "\([^"]*\)".*/\1/p' "$L")
(cd "$APP" && "$NODE" --test test/*.test.mjs >/dev/null)
echo "smoke OK"

#!/bin/sh
# lokal installer: no npm for you to run. Everything lives in ~/.local/share/lokal.
# sudo is used only to install or start Docker for the payment database, and only after you agree.
#   curl -fsSL https://raw.githubusercontent.com/jesuscbm/lokAl/main/install.sh | sh
# Options (env): LOKAL_HOME, LOKAL_REPO (owner/name), LOKAL_REF (branch/tag/sha, default main),
#                LOKAL_SRC (install from a local checkout instead of GitHub),
#                LOKAL_DOCKER=yes (install/start Docker without asking) | no (never touch Docker).
set -eu
export NPM_CONFIG_UPDATE_NOTIFIER=false NPM_CONFIG_FUND=false

NODE_VERSION="v24.22.1"   # pinned; the Masumi payment service needs >= 24.22.1 < 25
SOKOSUMI_VERSION="1.1.0"  # pinned; the coworker imports its runtime adapter (1.0.4 calls a Core route that is gone)
REPO="${LOKAL_REPO:-jesuscbm/lokAl}"
REF="${LOKAL_REF:-main}"
LOKAL_HOME="${LOKAL_HOME:-$HOME/.local/share/lokal}"
BIN_DIR="$HOME/.local/bin"

if [ -t 1 ]; then V='\033[38;2;167;139;250m'; G='\033[32m'; Y='\033[33m'; R='\033[31m'; D='\033[2m'; N='\033[0m'; else V=''; G=''; Y=''; R=''; D=''; N=''; fi
say()  { printf "${V}◆${N} %s\n" "$1"; }
ok()   { printf "  ${G}✔${N} %s\n" "$1"; }
warn() { printf "  ${Y}!${N} %s\n" "$1"; }
die()  { printf "  ${R}✖ %s${N}\n" "$1" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "$1 is required. Install it and run the installer again."; }
have() { command -v "$1" >/dev/null 2>&1; }
# Yes/no on the terminal (works under curl … | sh). LOKAL_DOCKER=yes|no answers it; no terminal means no.
agree() {
  case "${LOKAL_DOCKER:-}" in yes) return 0 ;; no) return 1 ;; esac
  (exec </dev/tty) 2>/dev/null || return 1
  printf "  ${V}?${N} %s [Y/n] " "$1" >/dev/tty; read -r a </dev/tty || return 1
  case "$a" in n*|N*) return 1 ;; esac
}

printf "\n${V}◆ lokAl${N} ${D}your local LLM, hired and paid on Cardano${N}\n\n"
need curl; need tar
mkdir -p "$LOKAL_HOME" "$BIN_DIR"

# --- platform -----------------------------------------------------------------
case "$(uname -s)" in Linux) OS=linux ;; Darwin) OS=darwin ;; *) die "lokAl supports Linux and macOS. On Windows, use WSL." ;; esac
case "$(uname -m)" in x86_64|amd64) ARCH=x64 ;; arm64|aarch64) ARCH=arm64 ;; *) die "Unsupported CPU: $(uname -m)" ;; esac
ok "Platform: $OS-$ARCH"

# --- node: use the system one if it is 24.x, else a private pinned copy ----------
NODE=""
if command -v node >/dev/null 2>&1; then
  MAJOR=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
  [ "$MAJOR" = "24" ] && NODE="$(command -v node)"
fi
if [ -z "$NODE" ]; then
  NODE_DIR="$LOKAL_HOME/node"
  if [ ! -x "$NODE_DIR/bin/node" ] || [ "$("$NODE_DIR/bin/node" -v)" != "$NODE_VERSION" ]; then
    say "Downloading Node $NODE_VERSION (private copy, used only by lokAl)"
    TARBALL="node-$NODE_VERSION-$OS-$ARCH.tar.gz"
    TMP=$(mktemp -d)
    curl -fsSL "https://nodejs.org/dist/$NODE_VERSION/$TARBALL" -o "$TMP/$TARBALL" || die "Node download failed"
    curl -fsSL "https://nodejs.org/dist/$NODE_VERSION/SHASUMS256.txt" -o "$TMP/SHASUMS256.txt" || die "Checksum download failed"
    EXPECTED=$(grep " $TARBALL\$" "$TMP/SHASUMS256.txt" | cut -d' ' -f1)
    if command -v sha256sum >/dev/null 2>&1; then ACTUAL=$(sha256sum "$TMP/$TARBALL" | cut -d' ' -f1); else ACTUAL=$(shasum -a 256 "$TMP/$TARBALL" | cut -d' ' -f1); fi
    [ -n "$EXPECTED" ] && [ "$EXPECTED" = "$ACTUAL" ] || die "Node checksum mismatch; refusing to install"
    rm -rf "$NODE_DIR"; mkdir -p "$NODE_DIR"
    tar -xzf "$TMP/$TARBALL" -C "$NODE_DIR" --strip-components=1
    rm -rf "$TMP"
  fi
  NODE="$NODE_DIR/bin/node"
  ok "Node $("$NODE" -v) (sha256 verified)"
else
  ok "Node $("$NODE" -v) (system)"
fi
NODE_BIN_DIR=$(dirname "$NODE")
export PATH="$NODE_BIN_DIR:$LOKAL_HOME/npm-global/bin:$PATH"
NPM="$NODE_BIN_DIR/npm"; [ -x "$NPM" ] || NPM=npm

# --- lokal itself ---------------------------------------------------------------
APP="$LOKAL_HOME/app"
say "Installing lokAl ($REF)"
STAGE=$(mktemp -d)
if [ -n "${LOKAL_SRC:-}" ]; then
  (cd "$LOKAL_SRC" && tar --exclude=node_modules --exclude=.git --exclude=.local --exclude=.env --exclude=.eve -cf - .) | tar -xf - -C "$STAGE"
else
  curl -fsSL "https://codeload.github.com/$REPO/tar.gz/$REF" | tar -xzf - -C "$STAGE" --strip-components=1 || die "Download of lokAl failed (is the repo public?)"
fi
# Keep the user's coworker state (.env, .local, docs/*.json) across reinstalls.
if [ -d "$APP/coworker" ]; then
  for f in .env .local docs agent/instructions.md; do
    [ -e "$APP/coworker/$f" ] && mkdir -p "$(dirname "$STAGE/coworker/$f")" && rm -rf "$STAGE/coworker/$f" && cp -R "$APP/coworker/$f" "$STAGE/coworker/$f"
  done
fi
rm -rf "$APP"; mv "$STAGE" "$APP"
(cd "$APP" && "$NPM" ci --omit=dev --no-audit --no-fund --loglevel=error) >/dev/null || die "Installing lokAl's dependencies failed"
(cd "$APP/coworker" && "$NPM" ci --no-audit --no-fund --loglevel=error) >/dev/null || die "Installing the agent's dependencies failed"
[ -f "$APP/coworker/.env" ] || { cp "$APP/coworker/.env.example" "$APP/coworker/.env"; chmod 600 "$APP/coworker/.env"; }
ok "lokAl installed in $APP"

# --- Sokosumi CLI (pinned) --------------------------------------------------------
if command -v sokosumi >/dev/null 2>&1 && sokosumi --version 2>/dev/null | grep -q "$SOKOSUMI_VERSION"; then
  ok "Sokosumi CLI $SOKOSUMI_VERSION (already installed)"
else
  say "Installing Sokosumi CLI $SOKOSUMI_VERSION"
  # From our lockfile (sokosumi-cli/), not `npm i -g`: a global install resolves the newest dependency versions,
  # and one bad upstream release (cli-truncate 6.2.0, a 404 on 2026-10-31) breaks every fresh install.
  CLI_DIR="$LOKAL_HOME/sokosumi-cli"
  rm -rf "$CLI_DIR"; mkdir -p "$CLI_DIR" "$LOKAL_HOME/npm-global/bin"
  cp "$APP/sokosumi-cli/package.json" "$APP/sokosumi-cli/package-lock.json" "$CLI_DIR/"
  (cd "$CLI_DIR" && "$NPM" ci --omit=dev --no-audit --no-fund --loglevel=error) >/dev/null || die "Sokosumi CLI install failed"
  ln -sf "$CLI_DIR/node_modules/.bin/sokosumi" "$LOKAL_HOME/npm-global/bin/sokosumi"
  ln -sf "$LOKAL_HOME/npm-global/bin/sokosumi" "$BIN_DIR/sokosumi"
  ok "Sokosumi CLI $SOKOSUMI_VERSION"
fi

# --- the lokal command ---------------------------------------------------------------
cat > "$BIN_DIR/lokal" <<EOF
#!/bin/sh
export LOKAL_HOME="$LOKAL_HOME"
export PATH="$NODE_BIN_DIR:$LOKAL_HOME/npm-global/bin:\$PATH"
exec "$NODE" "$APP/bin/lokal.mjs" "\$@"
EOF
chmod +x "$BIN_DIR/lokal"
ok "Command: $BIN_DIR/lokal"

# --- payment database: Docker (installed if missing), or the machine's own PostgreSQL --------------
# Step 4 needs Postgres. Docker is the default; a native PostgreSQL works too (no Docker needed).
docker_ok() { docker info >/dev/null 2>&1; }
has_pg() { have pg_ctl || [ -x /opt/homebrew/opt/postgresql@16/bin/pg_ctl ] || [ -x /usr/local/opt/postgresql@16/bin/pg_ctl ] || ls /usr/lib/postgresql/*/bin/pg_ctl >/dev/null 2>&1; }
# Running, and usable without sudo: start the service, add the user to the docker group, and grant the socket
# right away (group membership only applies after the next login).
docker_ready() {
  docker_ok && return 0
  sudo -n true 2>/dev/null || say "Docker needs sudo once to start and to let $(id -un) use it"
  if have systemctl; then sudo systemctl enable --now docker >/dev/null 2>&1 || sudo systemctl start docker || true
  elif have rc-service; then sudo rc-update add docker default >/dev/null 2>&1; sudo rc-service docker start || true
  elif have service; then sudo service docker start || true; fi
  i=0; while [ $i -lt 20 ] && [ ! -S /var/run/docker.sock ]; do sleep 1; i=$((i+1)); done
  docker_ok && return 0
  getent group docker >/dev/null 2>&1 || sudo groupadd docker 2>/dev/null || true
  sudo usermod -aG docker "$(id -un)" 2>/dev/null || true
  have setfacl && sudo setfacl -m "user:$(id -un):rw" /var/run/docker.sock 2>/dev/null || true
  docker_ok
}
install_docker() {
  if have pacman; then sudo pacman -S --needed --noconfirm docker
  elif have apk; then sudo apk add docker
  elif have zypper; then sudo zypper --non-interactive install docker
  else curl -fsSL https://get.docker.com | sudo sh; fi   # Debian, Ubuntu, Fedora, CentOS, RHEL, Raspberry Pi OS
}
if [ "${LOKAL_DOCKER:-}" = no ]; then :
elif have docker; then
  if docker_ok; then ok "Docker found (used for the payment database)"
  elif [ "$OS" = darwin ]; then warn "Docker is installed but not running: open Docker Desktop before step 4 (or: brew install postgresql@16)"
  elif agree "Docker is installed but not running (or not usable by you). Start it and set it up now (sudo)?" && docker_ready; then ok "Docker running (used for the payment database)"
  else warn "Docker is not usable yet: start it (sudo systemctl start docker) and add yourself to the docker group before step 4"; fi
elif has_pg; then ok "PostgreSQL found (used for the payment database, no Docker needed)"
elif [ "$OS" = darwin ]; then
  # Docker Desktop is a GUI app that must be opened by hand; Homebrew's PostgreSQL needs nothing else.
  if have brew && agree "Payments need a database. Install PostgreSQL with Homebrew (brew install postgresql@16)?"; then
    brew install postgresql@16 >/dev/null && ok "PostgreSQL 16 installed (used for the payment database, no Docker needed)" || warn "brew install postgresql@16 failed; install it (or Docker Desktop) before step 4"
  else warn "For payments (step 4) install PostgreSQL: brew install postgresql@16  (or Docker Desktop)"; fi
elif agree "Payments need Docker for their database, and it is not installed. Install it now (sudo)?"; then
  say "Installing Docker"
  if install_docker && docker_ready; then ok "Docker $(docker version --format '{{.Server.Version}}' 2>/dev/null) installed and running"
  else warn "Docker could not be installed or started. Install it (https://docs.docker.com/engine/install/) or PostgreSQL before step 4"; fi
else warn "For payments (step 4) install Docker (https://docs.docker.com/engine/install/) or PostgreSQL (e.g. sudo apt install postgresql)"; fi
[ "$OS" = linux ] && ! command -v zstd >/dev/null 2>&1 && ! command -v ollama >/dev/null 2>&1 && warn "zstd not found: needed to unpack Ollama (sudo apt install zstd), or install Ollama yourself"

# --- PATH for future shells (marked so uninstall.sh can remove it) ---------------------
case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *) for rc in "$HOME/.profile" "$HOME/.bashrc" "$HOME/.zshrc"; do
       { [ -f "$rc" ] || [ "$rc" = "$HOME/.profile" ]; } || continue
       grep -q '# added by lokal' "$rc" 2>/dev/null || printf '\nexport PATH="$HOME/.local/bin:$PATH" # added by lokal\n' >> "$rc"
     done
     ok "Added ~/.local/bin to PATH for new terminals" ;;
esac

# --- one command for the full ride: start the wizard now ---------------------------------
# curl … | sh has the script on stdin, so the UI reads the keyboard from /dev/tty instead.
if [ -z "${LOKAL_NO_START:-}" ] && [ -t 1 ] && (exec </dev/tty) 2>/dev/null; then
  printf "\n${G}Installed.${N} Starting lokAl… ${D}(next time just type: lokal)${N}\n\n"
  sleep 1
  exec "$BIN_DIR/lokal" </dev/tty
fi
printf "\n${G}Done.${N} Run: ${V}%s${N}  ${D}(or open a new terminal and type: lokal)${N}\n\n" "$BIN_DIR/lokal"

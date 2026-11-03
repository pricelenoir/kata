#!/usr/bin/env bash
# Sets up a judge runner on a fresh Ubuntu 22.04/24.04 or Debian 12 server:
# Docker, gVisor as the "runsc" runtime, the sandbox images, and the worker.
# Safe to run again; it skips what's already done and rebuilds the rest.
#
#   sudo git clone https://github.com/pricelenoir/kata /opt/kata
#   sudo /opt/kata/judge/deploy/setup-runner.sh
#
# It asks for the judge_worker connection string unless JUDGE_DATABASE_URL is
# set or judge/.env already has one; a hand-edited JUDGE_CONCURRENCY in
# judge/.env is kept too. See judge/deploy/README.md.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="$REPO/judge/.env"
COMPOSE=(docker compose -f "$REPO/judge/compose.yaml")

step() { printf '\n==> %s\n' "$*"; }
die() { printf 'error: %s\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "run as root (sudo $0)"
[[ -r /etc/os-release ]] || die "can't identify the OS"
# shellcheck source=/dev/null
. /etc/os-release
case "$ID" in
  ubuntu|debian) ;;
  *) die "this script supports Ubuntu and Debian; found $ID" ;;
esac
ARCH="$(dpkg --print-architecture)"
case "$ARCH" in
  amd64|arm64) ;;
  *) die "gVisor supports amd64 and arm64; found $ARCH" ;;
esac

# ---- sizing ----
# A judging job holds up to ~2.4 GB (compile sandbox, or a sanitizer run) and
# up to 2 CPUs, so concurrency is capped by whichever runs out first.
CPUS="$(nproc)"
MEM_GB="$(awk '/MemTotal/ { printf "%d", $2 / 1024 / 1024 }' /proc/meminfo)"
CONCURRENCY=$(( CPUS / 2 < MEM_GB / 3 ? CPUS / 2 : MEM_GB / 3 ))
(( CONCURRENCY >= 1 )) || CONCURRENCY=1
if (( MEM_GB < 4 )); then
  echo "warning: ${MEM_GB} GB of RAM; sanitizer runs need ~2.4 GB each. 8 GB is recommended." >&2
fi

step "Packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -yq ca-certificates curl gnupg git

step "Docker"
if ! command -v docker >/dev/null || ! docker compose version >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL "https://download.docker.com/linux/$ID/gpg" | gpg --dearmor --yes -o /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$ARCH signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$ID $VERSION_CODENAME stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -q
  apt-get install -yq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker
docker --version

step "gVisor"
if ! command -v runsc >/dev/null; then
  curl -fsSL https://gvisor.dev/archive.key | gpg --dearmor --yes -o /usr/share/keyrings/gvisor-archive-keyring.gpg
  echo "deb [arch=$ARCH signed-by=/usr/share/keyrings/gvisor-archive-keyring.gpg] https://storage.googleapis.com/gvisor/releases release main" \
    > /etc/apt/sources.list.d/gvisor.list
  apt-get update -q
  apt-get install -yq runsc
fi
if ! docker info --format '{{json .Runtimes}}' | grep -q '"runsc"'; then
  runsc install
  systemctl restart docker
fi
runsc --version | head -1

step "Worker configuration ($ENV_FILE)"
existing() { [[ -f "$ENV_FILE" ]] && sed -n "s/^$1=//p" "$ENV_FILE" || true; }
existing_url="$(existing JUDGE_DATABASE_URL)"
existing_concurrency="$(existing JUDGE_CONCURRENCY)"
DB_URL="${JUDGE_DATABASE_URL:-$existing_url}"
if [[ -z "$DB_URL" ]]; then
  echo "Paste the judge_worker connection string (session mode, port 5432)."
  read -r -s -p "JUDGE_DATABASE_URL: " DB_URL < /dev/tty
  echo
fi
[[ "$DB_URL" == postgres*://judge_worker* ]] || die "expected a postgresql://judge_worker… URL"
[[ "$DB_URL" != *":6543/"* ]] || die "port 6543 is the transaction pooler; the worker needs LISTEN, so use the session pooler (5432) or a direct connection"

umask 077
cat > "$ENV_FILE" <<EOF
# Written by judge/deploy/setup-runner.sh. Holds a database password: keep it 600.
JUDGE_DATABASE_URL=$DB_URL
JUDGE_RUNTIME=runsc
JUDGE_CONCURRENCY=${JUDGE_CONCURRENCY:-${existing_concurrency:-$CONCURRENCY}}
JUDGE_WORKER_ID=${JUDGE_WORKER_ID:-$(hostname -s)}
DOCKER_GID=$(getent group docker | cut -d: -f3)
EOF
chmod 600 "$ENV_FILE"
echo "concurrency $(sed -n 's/^JUDGE_CONCURRENCY=//p' "$ENV_FILE") (${CPUS} CPUs, ${MEM_GB} GB)"

step "Sandbox images and worker"
"${COMPOSE[@]}" --profile images build
"${COMPOSE[@]}" up -d --build worker

step "Smoke test: compile and run C++ and Rust under gVisor, and catch a race with TSan"
SANDBOX=(docker run --rm -i --runtime="${SMOKE_RUNTIME:-runsc}" --network none)
"${SANDBOX[@]}" kata-judge-cpp sh -eu <<'SH'
cat > /tmp/t.cpp <<'CPP'
#include "kata_prelude.h"
int main() { std::puts("cpp ok"); }
CPP
g++ -std=gnu++23 -O2 -I/opt/kata -o /tmp/t /tmp/t.cpp
/tmp/t
SH
"${SANDBOX[@]}" kata-judge-rust sh -eu <<'SH'
cat > /tmp/t.rs <<'RS'
fn main() { println!("rust ok"); }
RS
rustc -o /tmp/t /tmp/t.rs
/tmp/t
SH
"${SANDBOX[@]}" kata-judge-cpp sh -eu <<'SH'
cat > /tmp/r.cpp <<'CPP'
#include <thread>
int x;
int main() { std::thread t([] { x = 1; }); x = 2; t.join(); }
CPP
g++ -O1 -g -fsanitize=thread -o /tmp/r /tmp/r.cpp
if TSAN_OPTIONS=exitcode=66 /tmp/r 2>/dev/null; then echo "tsan: missed the race" >&2; exit 1; fi
echo "tsan ok"
SH

step "Worker log"
sleep 5
"${COMPOSE[@]}" logs --tail 15 worker
cat <<EOF

Done. The worker restarts on its own after reboots (restart: unless-stopped).
  logs:    docker compose -f $REPO/judge/compose.yaml logs -f worker
  update:  sudo $REPO/judge/deploy/update-runner.sh
Running code stays off until both switches are on: judge.settings enabled = 1
and JUDGE_ENABLED=true in Vercel (step 5 of judge/deploy/README.md).
EOF

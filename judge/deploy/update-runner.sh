#!/usr/bin/env bash
# Updates a runner set up by setup-runner.sh to the latest main: pulls,
# rebuilds the sandbox images and the worker, and restarts the worker. The
# old worker gets 90 s (stop_grace_period) to finish the jobs it holds;
# anything it can't finish is re-queued when its lease expires.
#
#   sudo /opt/kata/judge/deploy/update-runner.sh
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE=(docker compose -f "$REPO/judge/compose.yaml")

[[ $EUID -eq 0 ]] || { echo "run as root (sudo $0)" >&2; exit 1; }
[[ -f "$REPO/judge/.env" ]] || { echo "no judge/.env; run setup-runner.sh first" >&2; exit 1; }

git -C "$REPO" pull --ff-only
git -C "$REPO" log --oneline -1
"${COMPOSE[@]}" --profile images build
"${COMPOSE[@]}" up -d --build worker
# Superseded image layers; the precompiled headers make each build ~1 GB.
docker image prune -f >/dev/null
sleep 5
"${COMPOSE[@]}" logs --tail 10 worker

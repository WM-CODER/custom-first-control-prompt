#!/usr/bin/env bash
# restart-web.sh - kill the web process on port 3080 and restart it.
#
# Usage:
#   ./restart-web.sh
#   ./restart-web.sh --dsh-home /path/.dsh --profile web

set -euo pipefail

dsh_home=""
profile_name="web"

while [[ $# -gt 0 ]]; do
  case $1 in
    --dsh-home) dsh_home="$2"; shift 2 ;;
    --profile) profile_name="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

if [[ -z "$dsh_home" ]]; then
  dsh_home="$HOME/.dsh"
fi

profile_dir="$dsh_home/profiles/$profile_name"
dsh_bin="$dsh_home/profiles/node_modules/@deepseek-ai/dsh/lib/bin.js"
port=3080

log() { echo "[restart-web] $*"; }

# ---- 1. Kill existing process on port ----
if command -v lsof >/dev/null 2>&1; then
  pid=$(lsof -ti :"$port" 2>/dev/null || true)
elif command -v ss >/dev/null 2>&1; then
  pid=$(ss -tlnp 2>/dev/null | grep ":$port " | grep -oP 'pid=\K[0-9]+' | head -1 || true)
else
  pid=""
fi

if [[ -n "$pid" ]]; then
  log "killing PID $pid on port $port"
  kill "$pid" 2>/dev/null || true
  sleep 1
  kill -9 "$pid" 2>/dev/null || true
else
  log "no process on port $port"
fi

# ---- 2. Start web ----
if [[ ! -f "$dsh_bin" ]]; then
  log "ERROR: dsh CLI not found at $dsh_bin"
  exit 1
fi

log "starting web in $profile_dir"
cd "$profile_dir"
nohup node "$dsh_bin" web > /tmp/dsh-web.log 2>&1 &
web_pid=$!
log "web PID: $web_pid"

# ---- 3. Health check (max 90 seconds) ----
log "waiting for http://127.0.0.1:$port/ ..."
for i in $(seq 1 90); do
  if curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$port/" 2>/dev/null | grep -q 200; then
    log "web is up (took ${i}s)"
    exit 0
  fi
  sleep 1
done

log "ERROR: web did not come up within 90s"
log "If the failure is plugin related, run escape.sh then retry."
log "Log: /tmp/dsh-web.log"
exit 1

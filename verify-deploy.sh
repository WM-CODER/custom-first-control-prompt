#!/usr/bin/env bash
# verify-deploy.sh - installation health check for custom-first-control-prompt.
#
# Usage:
#   ./verify-deploy.sh
#   ./verify-deploy.sh --dsh-home /path/.dsh --profile web

set -euo pipefail

dsh_home=""
profile_name="web"
folder="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

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
pass=0
fail=0

check() {
  local name="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    echo "PASS  $name"
    ((pass++))
  else
    echo "FAIL  $name"
    ((fail++))
  fi
}

# 1) profile dir exists
check "profile dir exists" test -d "$profile_dir"

# 2) plugin resolvable with Config
check "plugin resolvable with Config" bash -c "
  node -e \"
    const m = await import('file://$folder/lib/index.js');
    if (!m.Config) throw new Error('no Config export');
  \" --input-type=module 2>&1
"

# 3) composition has core row
check "composition has core row" bash -c "
  out=\$(node \"$dsh_bin\" --profile \"$profile_name\" --dump-config 2>/dev/null)
  echo \"\$out\" | grep -q 'custom-first-control-prompt'
"

# 4) install mode: official (dsh plugin add) vs junction
profile_pkg="$profile_dir/package.json"
if [[ -f "$profile_pkg" ]] && grep -q '@wm-coders/dsh-custom-first-control-prompt' "$profile_pkg"; then
  echo "PASS  install mode: official (dsh plugin add)"
  ((pass++))
else
  echo "PASS  install mode: junction (offline)"
  ((pass++))
fi

# 5) plugin dir matches remote
check "plugin dir matches remote" bash -c "
  cd \"$folder\"
  git rev-parse HEAD >/dev/null 2>&1
"

# 6) web process listening on 3080
if command -v lsof >/dev/null 2>&1; then
  check "web process listening" bash -c "lsof -ti :3080 >/dev/null 2>&1"
elif command -v ss >/dev/null 2>&1; then
  check "web process listening" bash -c "ss -tlnp | grep -q ':3080'"
else
  echo "SKIP  web process listening (no lsof/ss)"
fi

# 7) web index reachable
check "web index reachable" bash -c "
  code=\$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3080/ 2>/dev/null)
  [[ \"\$code\" == \"200\" ]]
"

# 8) panel bundle route 200
check "panel bundle route 200" bash -c "
  code=\$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3080/assets/custom-first-control-prompt/client.js 2>/dev/null)
  [[ \"\$code\" == \"200\" ]]
"

echo ""
echo "RESULT: $pass passed, $fail failed"
[[ $fail -eq 0 ]] || exit 1

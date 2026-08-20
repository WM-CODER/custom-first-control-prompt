#!/usr/bin/env bash
# escape.sh - emergency soft-disable: neutralize the plugin's patch rows
# without uninstalling, so the web app can boot while the user investigates.
#
# C-only mode: the plugin's only footprint is its bundle-layer rows in
# cordis.patch.yml. This script appends `disabled: true` overrides for both
# rows (core + panel), leaving the original configuration untouched. To
# re-enable, delete the appended section.
#
# Usage:
#   ./escape.sh
#   ./escape.sh --dsh-home /path/.dsh --profile web

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
  if [[ ! -d "$dsh_home/profiles" ]]; then
    echo "ERROR: cannot locate DSH_HOME (tried $dsh_home). Pass --dsh-home <DSH_HOME>."
    exit 1
  fi
fi

profile_dir="$dsh_home/profiles/$profile_name"
if [[ ! -d "$profile_dir" ]]; then
  echo "ERROR: profile directory missing: $profile_dir"
  exit 1
fi
echo "== home=$dsh_home profile=$profile_name"

# ---- soft-disable plugin rows ----
patch_path="$profile_dir/cordis.patch.yml"
if [[ ! -f "$patch_path" ]]; then
  echo "WARN: cordis.patch.yml missing: $patch_path"
else
  if grep -qE '^- id: custom-first-control-prompt' "$patch_path" && \
     grep -A1 '^- id: custom-first-control-prompt' "$patch_path" | grep -q 'disabled: true'; then
    echo "== plugin rows already disabled; no change"
  else
    echo "== appending disabled overrides to cordis.patch.yml (backup: cordis.patch.yml.escape.bak)"
    if [[ ! -f "$patch_path.escape.bak" ]]; then
      cp "$patch_path" "$patch_path.escape.bak"
    fi
    cat >> "$patch_path" <<'YAML'

# ---- escape.sh appended section: disable plugin rows (delete to re-enable) ----
- id: custom-first-control-prompt
  disabled: true
- id: ui-custom-first-control-prompt
  disabled: true
YAML
    echo "  disabled custom-first-control-prompt + ui-custom-first-control-prompt"
  fi
fi

# ---- restart guidance ----
echo "== next steps"
echo "  1) Restart the web process. Find it with:"
echo "       lsof -ti :3080"
echo "     then kill the owning PID (kill <pid>) and start the deployment"
echo "     the same way it was originally launched, e.g.:"
echo "       node \"$dsh_home/profiles/node_modules/@deepseek-ai/dsh/lib/bin.js\" web"
echo "  2) Verify http://127.0.0.1:3080 comes up (plugin rows disabled, base frame intact)."
echo "  3) To re-enable: delete the escape.sh appended section from $patch_path."
echo "DONE"

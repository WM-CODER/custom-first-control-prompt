#!/usr/bin/env bash
# uninstall.sh - remove the plugin from a dsh profile (macOS/Linux).
#
# Primary path (official): dsh plugin --profile web remove <folder>
#   pnpm unlinks the package, and the CLI's reconciliation removes this
#   package's dsh.bundle patch layer. The browser panel (auto-discovered
#   via dsh.client) disappears with it.
# Offline path (-o): remove symlink + strip the plugin row from the
#   profile patch.
#
# Usage:
#   bash uninstall.sh
#   bash uninstall.sh -d /path/.dsh -p web -o
#
# Safe to run repeatedly (idempotent).

set -euo pipefail

dsh_home=""
profile_name="web"
folder="$(cd "$(dirname "$0")" && pwd)"
offline=false

while getopts "d:p:f:o" opt; do
  case $opt in
    d) dsh_home="$OPTARG" ;;
    p) profile_name="$OPTARG" ;;
    f) folder="$OPTARG" ;;
    o) offline=true ;;
    *) echo "Usage: $0 [-d DSH_HOME] [-p PROFILE] [-f FOLDER] [-o]"; exit 1 ;;
  esac
done

echo "== home=${dsh_home:-<auto>} profile=$profile_name"

# ---- resolve home ----
if [ -z "$dsh_home" ]; then
  candidate="$HOME/.dsh"
  if [ -d "$candidate/profiles" ]; then
    dsh_home="$candidate"
  else
    echo "ERROR: cannot locate DSH_HOME (tried $candidate). Pass -d <DSH_HOME>."
    exit 1
  fi
fi
profile_dir="$dsh_home/profiles/$profile_name"
if [ ! -d "$profile_dir" ]; then
  echo "ERROR: profile directory missing: $profile_dir"
  exit 1
fi

# ---- package dir ----
if [ ! -f "$folder/package.json" ]; then
  echo "ERROR: package.json missing in $folder"
  exit 1
fi

# ---- dependency chain ----
dep_link="$folder/node_modules"
if [ -L "$dep_link" ]; then
  target=$(readlink "$dep_link")
  rm "$dep_link"
  echo "== dependency chain removed: $dep_link (was -> $target)"
elif [ -e "$dep_link" ]; then
  echo "== dependency chain not a symlink (skip): $dep_link"
else
  echo "== dependency chain absent (skip): $dep_link"
fi

if [ "$offline" = false ]; then
  # ---- official path: dsh plugin remove ----
  dsh_bin="$dsh_home/profiles/node_modules/@deepseek-ai/dsh/lib/bin.js"
  if [ ! -f "$dsh_bin" ]; then
    echo "ERROR: dsh CLI not found at $dsh_bin. Re-run with -o for the symlink fallback."
    exit 1
  fi
  node "$dsh_bin" plugin --profile "$profile_name" remove "$folder"
  echo "== dsh plugin remove done (bundle layer reconciled: core row removed, client auto-removed)"
else
  # ---- offline path: remove symlink + strip patch row ----
  for scope in "$profile_dir/node_modules/@wm-coders" "$profile_dir/node_modules/@wm-coder" "$profile_dir/node_modules/@deepseek-ai"; do
    if [ ! -d "$scope" ]; then continue; fi
    for entry in "$scope"/*custom-first-control-prompt*; do
      if [ -L "$entry" ]; then
        rm "$entry"
        echo "== symlink removed: $entry"
      fi
    done
  done

  patch_path="$profile_dir/cordis.patch.yml"
  if [ -f "$patch_path" ]; then
    if grep -q 'id: custom-first-control-prompt' "$patch_path"; then
      python3 -c "
import re, sys
with open('$patch_path', 'r') as f:
    content = f.read()
pattern = r'(?ms)^- insert:\s*\n\s*- id: custom-first-control-prompt\s*\n(?:(?:\s{4,}.*\n)*)'
stripped = re.sub(pattern, '', content).strip()
with open('$patch_path', 'w') as f:
    f.write(stripped + '\n' if stripped else '')
"
      echo "== profile patch row stripped (custom-first-control-prompt)"
    else
      echo "== profile patch has no custom-first-control-prompt row (skip)"
    fi
  else
    echo "== profile patch absent (skip)"
  fi
fi

echo ""
echo "Uninstalled. Restart the web app and hard-refresh the browser"
echo "(Ctrl+Shift+R) to drop the plugin from the running tree and"
echo "client-modules list."

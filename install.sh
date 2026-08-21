#!/usr/bin/env bash
# install.sh - one-command plugin install into a dsh profile (macOS/Linux).
#
# Primary path (official): dsh plugin --profile web add <folder>
#   pnpm links the package into the profile, and the CLI's reconciliation
#   activates this package's dsh.bundle patch layer — the core loader row
#   appears with neutral sample defaults. The browser panel is auto-discovered
#   via this package's dsh.client declaration. No profile-patch editing needed.
# Offline path (-o): profile symlink + the same row appended to
#   the profile patch.
#
# Usage:
#   bash install.sh
#   bash install.sh -d /path/.dsh -p web -o
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
dep_target="$dsh_home/profiles/node_modules"
if [ -e "$dep_link" ]; then
  echo "== dependency chain exists (skip): $dep_link"
elif [ -d "$dep_target" ]; then
  ln -s "$dep_target" "$dep_link"
  echo "== dependency chain: $dep_link -> $dep_target"
else
  echo "ERROR: deployment node_modules missing: $dep_target"
  exit 1
fi

if [ "$offline" = false ]; then
  # ---- official path: dsh plugin add ----
  dsh_bin="$dsh_home/profiles/node_modules/@deepseek-ai/dsh/lib/bin.js"
  if [ ! -f "$dsh_bin" ]; then
    echo "ERROR: dsh CLI not found at $dsh_bin. Re-run with -o for the symlink fallback."
    exit 1
  fi
  node "$dsh_bin" plugin --profile "$profile_name" add "$folder"
  echo "== dsh plugin add done (bundle layer reconciled: core row active, client auto-discovered)"
else
  # ---- offline path: symlink + profile patch row ----
  nm_root="$profile_dir/node_modules/@wm-coders"
  mkdir -p "$nm_root"
  link="$nm_root/dsh-custom-first-control-prompt"
  if [ -e "$link" ]; then
    echo "== symlink exists (skip): $(basename "$link")"
  else
    ln -s "$folder" "$link"
    echo "== symlink created: $(basename "$link") -> $folder"
  fi

  patch_path="$profile_dir/cordis.patch.yml"
  if [ -f "$patch_path" ] && grep -q 'id: custom-first-control-prompt' "$patch_path"; then
    echo "== profile patch already has the core row (skip)"
  else
    cat >> "$patch_path" << 'ROWS'
- insert:
    - id: custom-first-control-prompt
      name: '@wm-coders/dsh-custom-first-control-prompt'
      config:
        sections:
          - name: "system"
            order: -50
            text: "这是测试提示词"
        history:
          - user: "用户测试提示词1"
            assistant: "助手提示词1"
          - user: "用户测试提示词2"
            assistant: "助手提示词2"
        includeSubagents: false
ROWS
    echo "== profile patch row appended (offline mode)"
  fi
fi

echo ""
echo "Installed. Restart the web app, then verify:"
echo "  bash verify-deploy.sh"
echo "Customize: settings page panel, or an id-targeted override per cordis.patch.yml.template."

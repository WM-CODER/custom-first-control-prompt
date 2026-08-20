#!/usr/bin/env bash
# install.sh - one-command plugin install into a dsh profile.
#
# Primary path (official): dsh plugin --profile web add <folder> <folder>/client-ui
#   pnpm links both packages into the profile, and the CLI's reconciliation
#   activates this package's dsh.bundle patch layer — both loader rows (core +
#   panel) appear with neutral sample defaults. No profile-patch editing needed.
# Offline path (--offline): profile symlinks + the same two rows appended to
#   the profile patch (bundle reconciliation only runs inside dsh plugin add,
#   so the symlink-only path must carry its own rows).
#
# Usage:
#   ./install.sh
#     # installs into $HOME/.dsh profile "web" from this folder
#   ./install.sh --dsh-home /path/.dsh --offline
#     # explicit home / offline symlink mode
#
# Safe to run repeatedly (idempotent): existing symlinks and an existing
# plugin row are left untouched.

set -euo pipefail

dsh_home=""
profile_name="web"
folder="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
offline=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --dsh-home) dsh_home="$2"; shift 2 ;;
    --profile) profile_name="$2"; shift 2 ;;
    --offline) offline=true; shift ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

# ---- resolve home ----
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

# ---- package dirs ----
plugin_pkg="$folder"
client_pkg="$folder/client-ui"
for p in "$plugin_pkg" "$client_pkg"; do
  if [[ ! -f "$p/package.json" ]]; then
    echo "ERROR: package.json missing in $p (folder must contain plugin + client-ui)"
    exit 1
  fi
done

# ---- dependency chain ----
# Local installs are link: dependencies; Node resolves the plugin's imports
# (@deepseek-ai/schemastery, zod, ...) from the linked folder's own
# node_modules, not the profile's. Symlink it to the deployment's shared
# node_modules root. client-ui needs nothing (browser bundle).
dep_link="$plugin_pkg/node_modules"
dep_target="$dsh_home/profiles/node_modules"
if [[ -e "$dep_link" ]]; then
  echo "== dependency chain exists (skip): $dep_link"
elif [[ -d "$dep_target" ]]; then
  ln -sfn "$dep_target" "$dep_link"
  echo "== dependency chain: $dep_link -> $dep_target"
else
  echo "ERROR: deployment node_modules missing: $dep_target"
  echo "       find the node_modules root your deployment resolves @deepseek-ai/dsh-* from and symlink it to $dep_link"
  exit 1
fi

if [[ "$offline" == false ]]; then
  # ---- official path: dsh plugin add ----
  dsh_bin="$dsh_home/profiles/node_modules/@deepseek-ai/dsh/lib/bin.js"
  if [[ ! -f "$dsh_bin" ]]; then
    echo "ERROR: dsh CLI not found at $dsh_bin (is this a 0.1.x deployment?). Re-run with --offline for the symlink fallback."
    exit 1
  fi
  node "$dsh_bin" plugin --profile "$profile_name" add "$plugin_pkg" "$client_pkg"
  echo "== dsh plugin add done (bundle layer reconciled: core + panel rows active)"
else
  # ---- offline path: symlinks + profile patch rows ----
  nm_root="$profile_dir/node_modules/@wm-coder"
  mkdir -p "$nm_root"

  declare -a junctions=(
    "dsh-custom-first-control-prompt:$plugin_pkg"
    "dsh-client-ui-custom-first-control-prompt:$client_pkg"
  )
  for j in "${junctions[@]}"; do
    name="${j%%:*}"
    target="${j##*:}"
    link="$nm_root/$name"
    if [[ -e "$link" ]]; then
      echo "== symlink exists (skip): $name -> $(readlink "$link" 2>/dev/null || echo "$target")"
    else
      ln -sfn "$target" "$link"
      echo "== symlink created: $name -> $target"
    fi
  done

  patch_path="$profile_dir/cordis.patch.yml"
  if [[ -f "$patch_path" ]] && grep -qE '^\s*- id: custom-first-control-prompt\s*$' "$patch_path"; then
    echo "== profile patch already has the core row (skip)"
  else
    if [[ -f "$patch_path" ]]; then
      stamp=$(date +%Y%m%d%H%M%S)
      cp "$patch_path" "$patch_path.bak-$stamp"
      echo "== backed up existing patch to $patch_path.bak-$stamp"
    fi
    # The offline path has no bundle reconciliation, so the profile patch must
    # carry the two rows itself. Same content as this package's bundle layer.
    rows=$(cat <<'YAML'

- insert:
    - id: custom-first-control-prompt
      name: '@wm-coder/dsh-custom-first-control-prompt'
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

    - id: ui-custom-first-control-prompt
      name: '@wm-coder/dsh-client-ui-custom-first-control-prompt'
YAML
)
    existing=""
    if [[ -f "$patch_path" ]]; then
      existing=$(cat "$patch_path")
    fi
    if [[ -z "$(echo "$existing" | tr -d '[:space:]')" ]]; then
      echo "# Your patch layer for this dsh profile, applied after every bundle layer:" > "$patch_path"
    fi
    printf '%s\n' "$rows" >> "$patch_path"
    echo "== profile patch rows appended (offline mode)"
  fi
fi

echo ""
echo "Installed. Restart the web app, then verify:"
echo "  ./verify-deploy.sh"
echo "Customize: settings page panel, or an id-targeted override per cordis.patch.yml.template."
echo "Escape hatch if anything breaks:"
echo "  pnpm dsh --profile web-safe web"

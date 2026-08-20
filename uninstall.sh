#!/usr/bin/env bash
# uninstall.sh - one-command plugin removal from a dsh profile.
#
# Official path: dsh plugin --profile web remove (pnpm drops both linked
# packages; reconciliation removes the bundle layer). Then, regardless of how
# the plugin was installed: legacy symlinks under both scopes are removed and
# this plugin's rows are stripped surgically from the profile patch — every
# other entry, comment, and override stays untouched. The plugin folder itself
# is never touched.
#
# Usage:
#   ./uninstall.sh
#   ./uninstall.sh --dsh-home /path/.dsh --profile web

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

# ---- official removal (only when the packages are pnpm-managed deps) ----
managed=false
profile_pkg="$profile_dir/package.json"
if [[ -f "$profile_pkg" ]] && grep -q '@wm-coder/dsh-custom-first-control-prompt' "$profile_pkg"; then
  managed=true
fi
dsh_bin="$dsh_home/profiles/node_modules/@deepseek-ai/dsh/lib/bin.js"
if [[ "$managed" == true && -f "$dsh_bin" ]]; then
  if node "$dsh_bin" plugin --profile "$profile_name" remove \
      '@wm-coder/dsh-custom-first-control-prompt' \
      '@wm-coder/dsh-client-ui-custom-first-control-prompt' 2>/dev/null; then
    echo "== dsh plugin remove done (deps + bundle layer)"
  else
    echo "== dsh plugin remove exited non-zero (continuing with symlink cleanup)"
  fi
else
  echo "== packages not pnpm-managed (symlink/manual install) - skip official remove"
fi

# ---- symlinks (legacy/manual installs) ----
# Current product scope @wm-coder, plus the legacy @deepseek-ai symlinks from
# pre-rename installs so upgrades clean up both.
for scope in "$profile_dir/node_modules/@wm-coder" "$profile_dir/node_modules/@deepseek-ai"; do
  for name in dsh-custom-first-control-prompt dsh-client-ui-custom-first-control-prompt; do
    link="$scope/$name"
    if [[ -L "$link" || -d "$link" ]]; then
      rm -f "$link"
      echo "== symlink removed: $(basename "$scope")/$name"
    fi
  done
done

# ---- profile patch: strip only this plugin's rows ----
# Handles both shapes: legacy `- insert:` list rows and targeted overrides.
# A `- insert:` wrapper left empty by the strip is removed with it.
patch_path="$profile_dir/cordis.patch.yml"
if [[ ! -f "$patch_path" ]]; then
  echo "== patch absent (skip)"
else
  raw=$(cat "$patch_path")
  # Pass 1: remove plugin rows and their indented children
  stripped=$(awk '
    {
      t = $0; sub(/^[[:space:]]+/, "", t); ind = length($0) - length(t)
      if (skip >= 0) {
        if (t == "") next
        if (t ~ /^- / && ind <= skip) { skip = -1; print; next }
        next
      }
      if (t == "- id: custom-first-control-prompt" || t == "- id: ui-custom-first-control-prompt") {
        skip = ind; next
      }
      print
    }
  ' BEGIN'{skip=-1}' "$patch_path")

  # Pass 2: remove empty - insert: wrappers
  stripped=$(echo "$stripped" | awk '
    {
      lines[NR] = $0
      t = $0; sub(/^[[:space:]]+/, "", t); ind = length($0) - length(t)
      if (t == "- insert:") {
        # peek next non-empty line
        next_i = NR + 1
        while (next_i in lines && lines[next_i] ~ /^[[:space:]]*$/) next_i++
        if (!(next_i in lines)) { next }  # EOF
        next_t = lines[next_i]; sub(/^[[:space:]]+/, "", next_t)
        next_ind = length(lines[next_i]) - length(next_t)
        if (next_t == "" || next_t ~ /^#/ || (next_t ~ /^- / && next_ind <= ind)) { next }
      }
      print
    }
  ')

  # Check if any real entries remain
  has_entry=false
  while IFS= read -r line; do
    t="${line#"${line%%[![:space:]]*}"}"
    [[ -n "$t" && ! "$t" =~ ^# ]] && has_entry=true && break
  done <<< "$stripped"

  if [[ "$has_entry" == false ]]; then
    stripped="$(echo "$stripped" | sed -e '${/^$/d}')"$'\n'"]"$'\n'
  fi

  if [[ "$stripped" != "$raw" ]]; then
    stamp=$(date +%Y%m%d%H%M%S)
    cp "$patch_path" "$patch_path.bak-$stamp"
    printf '%s' "$stripped" > "$patch_path"
    echo "== plugin rows stripped from patch (backup: cordis.patch.yml.bak-$stamp)"
  else
    echo "== patch has no plugin rows (skip)"
  fi
fi

echo ""
echo "Uninstalled. Restart the web app to drop the plugin from the running tree."

# escape.ps1 - emergency soft-disable: neutralize the plugin's patch rows
# without uninstalling, so the web app can boot while the user investigates.
#
# C-only mode: the plugin's only footprint is its bundle-layer rows in
# cordis.patch.yml. This script appends `disabled: true` overrides for both
# rows (core + panel), leaving the original configuration untouched. To
# re-enable, delete the appended section.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File escape.ps1
#   powershell -ExecutionPolicy Bypass -File escape.ps1 -DshHome C:\path\.dsh -ProfileName web

param(
  [string]$DshHome = '',
  [string]$ProfileName = 'web'
)

$ErrorActionPreference = 'Stop'

function Write-Step([string]$msg) { Write-Output "== $msg" }

# ---- 1. Locate DSH_HOME ----
if ($DshHome -eq '') {
  $candidate = Join-Path $env:USERPROFILE '.dsh'
  if (-not (Test-Path (Join-Path $candidate 'profiles'))) {
    Write-Output "ERROR: cannot locate DSH_HOME (tried $candidate). Pass -DshHome <DSH_HOME>."
    exit 1
  }
  $DshHome = $candidate
}
$profileDir = Join-Path $DshHome (Join-Path 'profiles' $ProfileName)
if (-not (Test-Path $profileDir)) {
  Write-Output "ERROR: profile directory missing: $profileDir"
  exit 1
}
Write-Step "home=$DshHome profile=$ProfileName"

# ---- 2. Soft-disable plugin rows (append disabled overrides) ----
$patchPath = Join-Path $profileDir 'cordis.patch.yml'
if (-not (Test-Path $patchPath)) {
  Write-Output "WARN: cordis.patch.yml missing: $patchPath"
} else {
  $content = Get-Content $patchPath -Raw
  if ($content -match '(?m)^- id: custom-first-control-prompt\s*\r?\n\s*disabled: true') {
    Write-Step "plugin rows already disabled; no change"
  } else {
    Write-Step "appending disabled overrides to cordis.patch.yml (backup: cordis.patch.yml.escape.bak)"
    if (-not (Test-Path "$patchPath.escape.bak")) {
      Copy-Item $patchPath "$patchPath.escape.bak" -Force
    }
    $override = @'

# ---- escape.ps1 appended section: disable plugin rows (delete to re-enable) ----
- id: custom-first-control-prompt
  disabled: true
- id: ui-custom-first-control-prompt
  disabled: true
'@
    Add-Content -Path $patchPath -Value $override -Encoding utf8
    Write-Output "  disabled custom-first-control-prompt + ui-custom-first-control-prompt"
  }
}

# ---- 3. Restart guidance ----
Write-Step "next steps"
Write-Output "  1) Restart the web process. Find it with:"
Write-Output "       netstat -ano | findstr :3080"
Write-Output "     then kill the owning PID (taskkill /PID <pid> /F) and start the deployment"
Write-Output "     the same way it was originally launched, e.g.:"
$modulesDir = Join-Path $DshHome 'profiles\node_modules'
Write-Output "       node `"$modulesDir\@deepseek-ai\dsh\lib\bin.js`" web"
Write-Output "  2) Verify http://127.0.0.1:3080 comes up (plugin rows disabled, base frame intact)."
Write-Output "  3) To re-enable: delete the escape.ps1 appended section from $patchPath."
Write-Output "DONE"

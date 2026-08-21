# uninstall.ps1 - remove the plugin from a dsh profile.
#
# Primary path (official): dsh plugin --profile web remove <pkg>
#   pnpm unlinks the package, and the CLI's reconciliation removes this
#   package's dsh.bundle patch layer — the core loader row disappears.
#   The browser panel (auto-discovered via dsh.client) disappears with it.
# Offline path (-Offline): remove junction + strip the plugin row from
#   the profile patch.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File uninstall.ps1
#   powershell -ExecutionPolicy Bypass -File uninstall.ps1 -DshHome C:\path\.dsh -Offline
#
# Safe to run repeatedly (idempotent): missing junctions and absent rows
# are reported but do not fail the script.

param(
  [string]$DshHome = '',
  [string]$ProfileName = 'web',
  [string]$Folder = $PSScriptRoot,
  [switch]$Offline
)

$ErrorActionPreference = 'Stop'

function Write-Step([string]$msg) { Write-Output "== $msg" }

# ---- resolve home ----
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

# ---- package dir ----
$pluginPkg = $Folder
if (-not (Test-Path (Join-Path $pluginPkg 'package.json'))) {
  Write-Output "ERROR: package.json missing in $pluginPkg"
  exit 1
}

# ---- dependency chain ----
$depLink = Join-Path $pluginPkg 'node_modules'
if (Test-Path $depLink) {
  $t = (Get-Item $depLink).Target
  if ($t) {
    Remove-Item $depLink -Force
    Write-Step "dependency chain removed: $depLink (was -> $t)"
  } else {
    Write-Step "dependency chain not a junction (skip): $depLink"
  }
} else {
  Write-Step "dependency chain absent (skip): $depLink"
}

if (-not $Offline) {
  # ---- official path: dsh plugin remove ----
  $dshBin = Join-Path $DshHome 'profiles\node_modules\@deepseek-ai\dsh\lib\bin.js'
  if (-not (Test-Path $dshBin)) {
    Write-Output "ERROR: dsh CLI not found at $dshBin (is this a 0.1.x deployment?). Re-run with -Offline for the junction fallback."
    exit 1
  }
  & node $dshBin plugin --profile $ProfileName remove $pluginPkg
  if ($LASTEXITCODE -ne 0) {
    Write-Output "ERROR: dsh plugin remove failed (exit $LASTEXITCODE). Check pnpm availability, or re-run with -Offline."
    exit $LASTEXITCODE
  }
  Write-Step 'dsh plugin remove done (bundle layer reconciled: core row removed, client auto-removed)'
} else {
  # ---- offline path: remove junction + strip patch row ----
  $scopes = @(
    (Join-Path $profileDir 'node_modules\@wm-coders'),
    (Join-Path $profileDir 'node_modules\@wm-coder'),
    (Join-Path $profileDir 'node_modules\@deepseek-ai')
  )
  foreach ($scope in $scopes) {
    if (-not (Test-Path $scope)) { continue }
    $entries = Get-ChildItem $scope -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -like '*custom-first-control-prompt*' }
    foreach ($entry in $entries) {
      $t = (Get-Item $entry.FullName).Target
      Remove-Item $entry.FullName -Force -Recurse
      Write-Step "junction removed: $($entry.FullName)$(if ($t) { " (was -> $t)" })"
    }
  }

  $patchPath = Join-Path $profileDir 'cordis.patch.yml'
  if (Test-Path $patchPath) {
    $content = Get-Content $patchPath -Raw
    $pattern = '(?ms)^- insert:\s*\n\s*- id: custom-first-control-prompt\s*\n(?:(?:\s{4,}.*\n)*)'
    if ($content -match $pattern) {
      $stripped = [regex]::Replace($content, $pattern, '')
      $stripped = $stripped.TrimEnd() + "`n"
      if ($stripped -eq "`n" -or $stripped -eq '') {
        Set-Content $patchPath '' -NoNewline
        Write-Step 'profile patch emptied (was only the plugin row)'
      } else {
        Set-Content $patchPath $stripped -NoNewline
        Write-Step 'profile patch row stripped (custom-first-control-prompt)'
      }
    } else {
      Write-Step 'profile patch has no custom-first-control-prompt row (skip)'
    }
  } else {
    Write-Step 'profile patch absent (skip)'
  }
}

Write-Output ''
Write-Output 'Uninstalled. Restart the web app and hard-refresh the browser'
Write-Output '(Ctrl+Shift+R) to drop the plugin from the running tree and'
Write-Output 'client-modules list.'

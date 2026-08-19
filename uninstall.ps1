# uninstall.ps1 - one-command plugin removal from a dsh profile.
#
# Removes the two profile junctions and the profile patch (restoring the last
# automatic backup if one exists, otherwise deleting the patch). Everything is
# reversible: the plugin folder itself is never touched.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File uninstall.ps1
#   powershell -ExecutionPolicy Bypass -File uninstall.ps1 -Home C:\path\.dsh -ProfileName web

param(
  [string]$DshHome = '',
  [string]$ProfileName = 'web'
)

$ErrorActionPreference = 'Stop'

function Write-Step([string]$msg) { Write-Output "== $msg" }

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

# ---- junctions ----
# Current product scope @wm-coder, plus the legacy @deepseek-ai junctions from
# pre-rename installs so upgrades clean up both.
$scopes = @(
  (Join-Path $profileDir 'node_modules\@wm-coder'),
  (Join-Path $profileDir 'node_modules\@deepseek-ai')
)
foreach ($scope in $scopes) {
  foreach ($name in @('dsh-custom-first-control-prompt', 'dsh-client-ui-custom-first-control-prompt')) {
    $link = Join-Path $scope $name
    if (Test-Path $link) {
      # Directory.Delete removes the junction reparse point itself and never
      # follows it into the target (PowerShell's Remove-Item mishandles junctions
      # on older PS5 runtimes).
      [System.IO.Directory]::Delete($link, $false)
      Write-Step "junction removed: $(Join-Path (Split-Path $scope -Leaf) $name)"
    }
  }
}

# ---- profile patch ----
$patchPath = Join-Path $profileDir 'cordis.patch.yml'
$backups = @(Get-ChildItem (Split-Path $patchPath) -Filter 'cordis.patch.yml.bak-*' -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending)
if (Test-Path $patchPath) {
  if ($backups.Count -gt 0) {
    Copy-Item $backups[0].FullName $patchPath -Force
    Write-Step "patch restored from $($backups[0].Name)"
  } else {
    Remove-Item $patchPath -Force
    Write-Step "patch removed (no backup found)"
  }
} else {
  Write-Step "patch absent (skip)"
}

Write-Output ''
Write-Output 'Uninstalled. Restart the web app to drop the plugin from the running tree.'

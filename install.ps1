# install.ps1 - one-command plugin install into a dsh profile.
#
# Creates the two profile junctions (plugin package + client-ui panel package),
# backs up any existing profile patch, and writes the plugin rows into
# <profile>/cordis.patch.yml.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File install.ps1
#     - installs into $env:USERPROFILE\.dsh profile "web" from this folder
#   powershell -ExecutionPolicy Bypass -File install.ps1 -Home C:\path\.dsh -ProfileName web -ConfigFile my-patch.yml
#     - explicit home / profile / custom patch content
#
# Safe to run repeatedly (idempotent): existing junctions and an existing
# plugin row are left untouched.

param(
  [string]$DshHome = '',
  [string]$ProfileName = 'web',
  [string]$Folder = $PSScriptRoot,
  [string]$ConfigFile = ''
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

# ---- package dirs ----
$pluginPkg = $Folder
$clientPkg = Join-Path $Folder 'client-ui'
foreach ($p in @($pluginPkg, $clientPkg)) {
  if (-not (Test-Path (Join-Path $p 'package.json'))) {
    Write-Output "ERROR: package.json missing in $p (folder must contain plugin + client-ui)"
    exit 1
  }
}

# ---- junctions ----
# Product scope @wm-coder (framework deps stay @deepseek-ai, installed by dsh).
$nmRoot = Join-Path $profileDir 'node_modules\@wm-coder'
New-Item -ItemType Directory -Force -Path $nmRoot | Out-Null
$junctions = @(
  @{ Name = 'dsh-custom-first-control-prompt'; Target = $pluginPkg },
  @{ Name = 'dsh-client-ui-custom-first-control-prompt'; Target = $clientPkg }
)
foreach ($j in $junctions) {
  $link = Join-Path $nmRoot $j.Name
  if (Test-Path $link) {
    $t = (Get-Item $link).Target
    Write-Step "junction exists (skip): $($j.Name) -> $t"
  } else {
    New-Item -ItemType Junction -Path $link -Target $j.Target | Out-Null
    Write-Step "junction created: $($j.Name) -> $($j.Target)"
  }
}

# ---- profile patch ----
$patchPath = Join-Path $profileDir 'cordis.patch.yml'
if (Test-Path $patchPath) {
  $stamp = Get-Date -Format 'yyyyMMddHHmmss'
  $bak = "$patchPath.bak-$stamp"
  Copy-Item $patchPath $bak -Force
  Write-Step "backed up existing patch to $bak"
}
if ($ConfigFile -ne '') {
  Copy-Item $ConfigFile $patchPath -Force
  Write-Step "patch written from $ConfigFile"
} else {
  $template = Join-Path $Folder 'cordis.patch.yml.template'
  if (-not (Test-Path $template)) {
    Write-Output "ERROR: no cordis.patch.yml.template and no -ConfigFile given"
    exit 1
  }
  Copy-Item $template $patchPath -Force
  Write-Step "patch written from template ($template)"
}

Write-Output ''
Write-Output 'Installed. Restart the web app. Escape hatch if anything breaks:'
Write-Output "  pnpm dsh --profile web-safe web"

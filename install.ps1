# install.ps1 - one-command plugin install into a dsh profile.
#
# Primary path (official): dsh plugin --profile web add <folder> <folder>/client-ui
#   pnpm links both packages into the profile, and the CLI's reconciliation
#   activates this package's dsh.bundle patch layer — both loader rows (core +
#   panel) appear with neutral sample defaults. No profile-patch editing needed.
# Offline path (-Offline): profile junctions + the same two rows appended to
#   the profile patch (bundle reconciliation only runs inside dsh plugin add,
#   so the junction-only path must carry its own rows).
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File install.ps1
#     - installs into $env:USERPROFILE\.dsh profile "web" from this folder
#   powershell -ExecutionPolicy Bypass -File install.ps1 -DshHome C:\path\.dsh -Offline
#     - explicit home / offline junction mode
#
# Safe to run repeatedly (idempotent): existing junctions and an existing
# plugin row are left untouched.

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

# ---- package dirs ----
$pluginPkg = $Folder
$clientPkg = Join-Path $Folder 'client-ui'
foreach ($p in @($pluginPkg, $clientPkg)) {
  if (-not (Test-Path (Join-Path $p 'package.json'))) {
    Write-Output "ERROR: package.json missing in $p (folder must contain plugin + client-ui)"
    exit 1
  }
}

# ---- dependency chain ----
# Local installs are link: dependencies; Node resolves the plugin's imports
# (@deepseek-ai/schemastery, zod, ...) from the linked folder's own
# node_modules, not the profile's. Junction it to the deployment's shared
# node_modules root (standard pnpm deployments have it; 0.1.x carries every
# dependency this plugin needs). client-ui needs nothing (browser bundle).
$depLink = Join-Path $pluginPkg 'node_modules'
$depTarget = Join-Path $DshHome 'profiles\node_modules'
if (Test-Path $depLink) {
  Write-Step "dependency chain exists (skip): $depLink"
} elseif (Test-Path $depTarget) {
  New-Item -ItemType Junction -Path $depLink -Target $depTarget | Out-Null
  Write-Step "dependency chain: $depLink -> $depTarget"
} else {
  Write-Output "ERROR: deployment node_modules missing: $depTarget"
  Write-Output "       find the node_modules root your deployment resolves @deepseek-ai/dsh-* from and junction it to $depLink"
  exit 1
}

if (-not $Offline) {
  # ---- official path: dsh plugin add ----
  $dshBin = Join-Path $DshHome 'profiles\node_modules\@deepseek-ai\dsh\lib\bin.js'
  if (-not (Test-Path $dshBin)) {
    Write-Output "ERROR: dsh CLI not found at $dshBin (is this a 0.1.x deployment?). Re-run with -Offline for the junction fallback."
    exit 1
  }
  & node $dshBin plugin --profile $ProfileName add $pluginPkg $clientPkg
  if ($LASTEXITCODE -ne 0) {
    Write-Output "ERROR: dsh plugin add failed (exit $LASTEXITCODE). Check pnpm availability/network, or re-run with -Offline."
    exit $LASTEXITCODE
  }
  Write-Step 'dsh plugin add done (bundle layer reconciled: core + panel rows active)'
} else {
  # ---- offline path: junctions + profile patch rows ----
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

  $patchPath = Join-Path $profileDir 'cordis.patch.yml'
  $existing = if (Test-Path $patchPath) { Get-Content $patchPath -Raw } else { '' }
  if ($existing -match '(?m)^\s*- id: custom-first-control-prompt\s*$') {
    Write-Step 'profile patch already has the core row (skip)'
  } else {
    if (Test-Path $patchPath) {
      $stamp = Get-Date -Format 'yyyyMMddHHmmss'
      Copy-Item $patchPath "$patchPath.bak-$stamp" -Force
      Write-Step "backed up existing patch to $patchPath.bak-$stamp"
    }
    # The offline path has no bundle reconciliation, so the profile patch must
    # carry the two rows itself. Same content as this package's bundle layer.
    $rows = @'
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

    - id: ui-custom-first-control-prompt
      name: '@wm-coders/dsh-client-ui-custom-first-control-prompt'
'@
    $header = ''
    if ($existing.Trim() -eq '') {
      $header = "# Your patch layer for this dsh profile, applied after every bundle layer:`n"
    }
    $sep = if ($existing -ne '' -and -not $existing.EndsWith("`n")) { "`n" } else { '' }
    [System.IO.File]::WriteAllText($patchPath, $header + $existing + $sep + $rows + "`n", [System.Text.UTF8Encoding]::new($false))
    Write-Step 'profile patch rows appended (offline mode)'
  }
}

Write-Output ''
Write-Output 'Installed. Restart the web app, then verify:'
Write-Output '  powershell -ExecutionPolicy Bypass -File verify-deploy.ps1'
Write-Output 'Customize: settings page panel, or an id-targeted override per cordis.patch.yml.template.'
Write-Output 'Escape hatch if anything breaks:'
Write-Output "  pnpm dsh --profile web-safe web"

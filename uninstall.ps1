# uninstall.ps1 - one-command plugin removal from a dsh profile.
#
# Official path: dsh plugin --profile web remove (pnpm drops both linked
# packages; reconciliation removes the bundle layer). Then, regardless of how
# the plugin was installed: legacy junctions under both scopes are removed and
# this plugin's rows are stripped surgically from the profile patch — every
# other entry, comment, and override stays untouched. The plugin folder itself
# is never touched.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File uninstall.ps1
#   powershell -ExecutionPolicy Bypass -File uninstall.ps1 -DshHome C:\path\.dsh -ProfileName web

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

# ---- official removal (only when the packages are pnpm-managed deps) ----
# Detect first: pnpm remove fails hard on absent deps, and under
# $ErrorActionPreference='Stop' a 2>&1 stderr record would abort the script.
$managed = $false
$profilePkg = Join-Path $profileDir 'package.json'
if (Test-Path $profilePkg) {
  $managed = (Get-Content $profilePkg -Raw) -match '@wm-coders/dsh-custom-first-control-prompt'
}
$dshBin = Join-Path $DshHome 'profiles\node_modules\@deepseek-ai\dsh\lib\bin.js'
if ($managed -and (Test-Path $dshBin)) {
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $null = & node $dshBin plugin --profile $ProfileName remove '@wm-coders/dsh-custom-first-control-prompt' '@wm-coders/dsh-client-ui-custom-first-control-prompt' 2>$null
    if ($LASTEXITCODE -eq 0) {
      Write-Step 'dsh plugin remove done (deps + bundle layer)'
    } else {
      Write-Step "dsh plugin remove exited $LASTEXITCODE (continuing with junction cleanup)"
    }
  } finally {
    $ErrorActionPreference = $prev
  }
} else {
  Write-Step 'packages not pnpm-managed (junction/manual install) - skip official remove'
}

# ---- junctions (legacy/manual installs) ----
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

# ---- profile patch: strip only this plugin's rows ----
# Handles both shapes: legacy `- insert:` list rows and targeted overrides.
# A `- insert:` wrapper left empty by the strip is removed with it.
$patchPath = Join-Path $profileDir 'cordis.patch.yml'
if (Test-Path $patchPath) {
  $raw = [System.IO.File]::ReadAllText($patchPath)
  $lines = $raw -split "`r?`n"
  $out = New-Object System.Collections.Generic.List[string]
  $skipIndent = -1
  foreach ($line in $lines) {
    $trim = $line.Trim()
    $indent = $line.Length - $line.TrimStart().Length
    if ($skipIndent -ge 0) {
      if ($trim.StartsWith('- ') -and $indent -le $skipIndent) { $skipIndent = -1 }
      elseif ($trim -eq '' ) { continue }
      else { continue }
    }
    if ($trim -eq '- id: custom-first-control-prompt' -or $trim -eq '- id: ui-custom-first-control-prompt') {
      $skipIndent = $indent
      continue
    }
    $out.Add($line)
  }
  # Drop `- insert:` wrappers whose entire list was stripped: an insert line
  # directly followed by a same-or-lower-indent entry, a comment, or EOF.
  $final = New-Object System.Collections.Generic.List[string]
  for ($i = 0; $i -lt $out.Count; $i++) {
    $line = $out[$i]
    if ($line.Trim() -eq '- insert:') {
      $indent = $line.Length - $line.TrimStart().Length
      $next = if ($i + 1 -lt $out.Count) { $out[$i + 1] } else { '' }
      $nextTrim = $next.Trim()
      $nextIndent = $next.Length - $next.TrimStart().Length
      if ($nextTrim -eq '' -or $nextTrim.StartsWith('#') -or ($nextTrim.StartsWith('- ') -and $nextIndent -le $indent)) { continue }
    }
    $final.Add($line)
  }
  $stripped = ($final -join "`n")
  # A comment-only file parses to null, and the loader requires a top-level
  # YAML array — append an explicit empty list when no entries remain.
  $hasEntry = $final | Where-Object { $t = $_.Trim(); $t -ne '' -and -not $t.StartsWith('#') } | Select-Object -First 1
  if ($null -eq $hasEntry) {
    $stripped = $stripped.TrimEnd() + "`n[]`n"
  }
  if ($stripped -ne $raw) {
    $stamp = Get-Date -Format 'yyyyMMddHHmmss'
    Copy-Item $patchPath "$patchPath.bak-$stamp" -Force
    [System.IO.File]::WriteAllText($patchPath, $stripped, [System.Text.UTF8Encoding]::new($false))
    Write-Step "plugin rows stripped from patch (backup: cordis.patch.yml.bak-$stamp)"
  } else {
    Write-Step 'patch has no plugin rows (skip)'
  }
} else {
  Write-Step 'patch absent (skip)'
}

Write-Output ''
Write-Output 'Uninstalled. Restart the web app to drop the plugin from the running tree.'

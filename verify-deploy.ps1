# verify-deploy.ps1 - deployment health check for custom-first-control-prompt
#
# One-shot diagnostics over a dsh web profile:
#   plugin resolvable (with Config) / composition rows /
#   boot manifest panel package / panel bundle route / web process /
#   plugin dir git state / restart-needed hint.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File verify-deploy.ps1
#   powershell -ExecutionPolicy Bypass -File verify-deploy.ps1 -DshHome C:\path\.dsh -Port 3080

param(
  [string]$DshHome = '',
  [string]$ProfileName = 'web',
  [string]$PluginDir = '',
  [int]$Port = 3080
)

$ErrorActionPreference = 'Continue'
$script:pass = 0
$script:fail = 0

function Check([string]$Name, [bool]$Ok, [string]$Detail, [string]$Fix) {
  if ($Ok) {
    $script:pass++
    Write-Host "  [PASS] $Name" -ForegroundColor Green
  } else {
    $script:fail++
    Write-Host "  [FAIL] $Name" -ForegroundColor Red
    if ($Detail) { Write-Host "         $Detail" -ForegroundColor Yellow }
    if ($Fix) { Write-Host "         fix: $Fix" -ForegroundColor Cyan }
  }
}

if ($DshHome -eq '') { $DshHome = Join-Path $env:USERPROFILE '.dsh' }
if ($PluginDir -eq '') { $PluginDir = Split-Path -Parent $MyInvocation.MyCommand.Path }
$profileDir = Join-Path $DshHome (Join-Path 'profiles' $ProfileName)
$modulesDir = Join-Path $DshHome (Join-Path 'profiles' 'node_modules')
$base = "http://127.0.0.1:$Port"
Write-Host "== verify-deploy: home=$DshHome profile=$ProfileName port=$Port plugin=$PluginDir"

# 0. profile + web process
Check "profile dir exists" (Test-Path $profileDir) "profileDir=$profileDir" "verify DSH_HOME / profile name"
$listener = netstat -ano | Select-String ":$Port" | Select-String 'LISTENING' | Select-Object -First 1
if ($listener) {
  $pp = ($listener.Line -split '\s+') | Where-Object { $_ -match '^\d+$' } | Select-Object -Last 1
  Check "web process listening (PID $pp)" $true "" ""
} else {
  Check "web process listening" $false "no LISTENING on :$Port" "run restart-web.ps1 and re-check"
}

# 1. plugin resolvable + Config
$resolve = ''
$code = 1
if (Test-Path $profileDir) {
  Push-Location $profileDir
  $resolve = node -e "import('@wm-coder/dsh-custom-first-control-prompt').then(m => { const p = m.default ?? m; console.log('keys=' + Object.keys(p).sort().join(',') + ';hasConfig=' + !!(p.Config && p.Config['~standard'])) }).catch(e => { console.error(e.message); process.exit(1) })" 2>&1 | Out-String
  $code = $LASTEXITCODE
  Pop-Location
}
if ($code -eq 0 -and $resolve -match 'hasConfig=true') {
  Check "plugin resolvable with Config schema" $true ($resolve.Trim()) ""
} else {
  Check "plugin resolvable with Config schema" $false $resolve.Trim() "junction present? plugin lib intact?"
}

# 2. composition rows + install mode
$dump = ''
if (Test-Path "$modulesDir\@deepseek-ai\dsh\lib\bin.js") {
  Push-Location $profileDir
  $dump = node "$modulesDir\@deepseek-ai\dsh\lib\bin.js" --profile $ProfileName --dump-config 2>&1 | Out-String
  Pop-Location
}
Check "composition has core row" ($dump -match '(?m)- id: custom-first-control-prompt') "" "core row missing: dsh plugin add activates the bundle layer; offline installs need the profile rows (install.ps1)"
Check "composition has panel row" ($dump -match '(?m)- id: ui-custom-first-control-prompt') "" "panel row missing: same layer as the core row (bundle patch or offline profile rows)"
$profilePkg = Join-Path $profileDir 'package.json'
if (Test-Path $profilePkg) {
  $managed = (Get-Content $profilePkg -Raw) -match '@wm-coder/dsh-custom-first-control-prompt'
  if ($managed) {
    Write-Host "         install mode: official (dsh plugin add, bundle layer active)"
  } else {
    Write-Host "         install mode: junction/manual (legacy; consider dsh plugin add)"
  }
}

# 3. boot manifest + panel bundle
try {
  $html = (Invoke-WebRequest -Uri "$base/" -UseBasicParsing -TimeoutSec 10).Content
  Check "boot manifest has panel package" ($html.Contains('dsh-client-ui-custom-first-control-prompt')) "" "panel row missing or client-modules not re-composed (restart web after dir update)"
} catch {
  Check "web index reachable" $false ($_.Exception.Message) "web not up or hung"
}

try {
  $b = Invoke-WebRequest -Uri "$base/plugins/@wm-coder/dsh-client-ui-custom-first-control-prompt/client.js" -UseBasicParsing -TimeoutSec 10
  Check "panel bundle route 200" ($b.StatusCode -eq 200) "HTTP $($b.StatusCode)" "panel package/junction intact?"
} catch {
  Check "panel bundle route 200" $false ($_.Exception.Message) "panel row/package issue"
}

# 4. plugin dir git state
if (Test-Path (Join-Path $PluginDir '.git')) {
  $dirty = git -C $PluginDir status --short 2>$null
  $dirtyText = if ($dirty) { "local changes/untracked: $($dirty.Count) items" } else { '' }
  Check "plugin dir has no local diff (matches remote)" ([string]::IsNullOrEmpty($dirtyText)) $dirtyText "back up before reset --hard"
  $head = (git -C $PluginDir log --oneline -1 2>$null) -join ''
  if ($head) { Write-Host "         HEAD: $head" }
} else {
  Write-Host "  (skip) plugin dir has no .git"
}

# 5. summary
Write-Host ""
Write-Host "== result: PASS=$script:pass FAIL=$script:fail"
if ($script:fail -gt 0) {
  Write-Host "== $script:fail failed. If you just updated the plugin dir, run restart-web.ps1 first, then re-check." -ForegroundColor Yellow
  exit 1
} else {
  Write-Host "== all passed." -ForegroundColor Green
  exit 0
}

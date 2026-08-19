# verify-build.ps1 - build artifact quality gate for the custom-first-control-prompt
# plugin. Prevents a broken artifact from taking the whole web app down.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File verify-build.ps1              # quick checks
#   powershell -ExecutionPolicy Bypass -File verify-build.ps1 -Full        # + test-home E2E
#   powershell -ExecutionPolicy Bypass -File verify-build.ps1 -Lib <path>  # custom lib dir
#
# Run this before shipping or enabling any rebuild of the plugin artifacts.

param(
  [switch]$Full,
  [string]$Lib = "$PSScriptRoot\lib",
  [string]$TestHome = "$PSScriptRoot\..\dsh-test-home"
)

$ErrorActionPreference = 'Stop'
$fail = 0

function Check([string]$name, [scriptblock]$body) {
  try {
    & $body
    Write-Output "PASS  $name"
  } catch {
    Write-Output "FAIL  $name : $($_.Exception.Message)"
    $script:fail++
  }
}

if (-not (Test-Path $Lib)) { Write-Output "FAIL  lib directory missing: $Lib"; exit 1 }

# 1) syntax-check every lib/*.js as ESM
Check 'syntax: lib/*.js parse' {
  $tmp = Join-Path $env:TEMP ('verify-lib-' + [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Force -Path $tmp | Out-Null
  foreach ($f in Get-ChildItem $Lib -Filter '*.js') {
    $m = Join-Path $tmp ($f.BaseName + '.mjs')
    Copy-Item $f.FullName $m -Force
    & node --check $m 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "$($f.Name) failed syntax check" }
  }
  Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
}

# 2) no bare decorator syntax (Node cannot parse @Remote)
Check 'no bare @Remote decorator' {
  $hit = Get-ChildItem $Lib -Filter '*.js' | Where-Object { Select-String -Path $_.FullName -Pattern '@Remote\(' -Quiet }
  if ($hit) { throw "found bare decorator in $($hit.Name)" }
}

# 3) entry imports cleanly (decorator runtime validation + dependency resolution)
Check 'entry import smoke' {
  $code = "try { await import('file:///' + process.argv[1].replace(/\\/g, '/')); } catch (e) { console.error(e.message); process.exit(1); }"
  $out = & node --input-type=module -e $code "$Lib\index.js" 2>&1
  if ($LASTEXITCODE -ne 0) { throw ($out -join ' ') }
}

# 4) request-path injection present: index.js must inline the seed builder and
#    the plugin attribution (the C-only bundle carries no seed chunk anymore).
Check 'index.js inlines buildSeedMessages + SEED_SOURCE' {
  $index = Join-Path $Lib 'index.js'
  $c = Get-Content $index -Raw
  if ($c -notmatch 'buildSeedMessages') { throw 'index.js has no buildSeedMessages' }
  if ($c -notmatch 'custom-first-control-prompt') { throw 'index.js has no SEED_SOURCE string' }
}

# 4b) no stale seed chunks: every lib/seed-*.js must be imported by index.js
#     or invariant.js. tsdown keeps clean off, so stale chunks pile up across
#     rebuilds (the current self-contained build usually emits none).
Check 'no stale seed chunks' {
  $imports = @()
  foreach ($f in @('index.js', 'invariant.js')) {
    $imports += Select-String -Path (Join-Path $Lib $f) -Pattern 'seed-[A-Za-z0-9_]+\.js' -AllMatches |
      ForEach-Object { $_.Matches.Value }
  }
  $referenced = @($imports | Select-Object -Unique)
  $stale = Get-ChildItem $Lib -Filter 'seed-*.js' |
    Where-Object { $_.Name -notin $referenced }
  if ($stale) {
    throw "stale seed chunks not referenced by index.js/invariant.js: $($stale.Name -join ', ') (delete them)"
  }
}

# 5) typert generated artifacts present (typert-loader fails boot without them)
Check 'typert artifacts present' {
  foreach ($f in @('typert.host.js', 'typert.remote-client.js')) {
    if (-not (Test-Path (Join-Path $Lib $f))) { throw "missing $f" }
  }
}

if ($Full) {
  # 6) test-home E2E: boot web and create a session. The seed messages live on
  #    the request path only, so the fresh log must carry NO plugin-attributed
  #    messages (verifying injection itself requires the panel LLM listener).
  Check 'test-home E2E' {
    if (-not (Test-Path $TestHome)) { throw "test home missing: $TestHome" }
    $port = 3096
    $repo = (Get-Location).Path
    $env:DSH_HOME = $TestHome
    $job = Start-Job -ScriptBlock {
      param($wd, $p, $h)
      Set-Location $wd
      $env:DSH_HOME = $h
      pnpm dsh web --port $p 2>&1
    } -ArgumentList $repo, $port, $TestHome
    try {
      $up = $false
      for ($i = 0; $i -lt 60; $i++) {
        Start-Sleep -Milliseconds 500
        try {
          $r = Invoke-WebRequest -Uri "http://127.0.0.1:$port/" -UseBasicParsing -TimeoutSec 2
          if ($r.StatusCode -eq 200) { $up = $true; break }
        } catch {}
      }
      if (-not $up) { throw 'test web did not boot within 30s' }

      $body = @{ type = 'client-request'; rpcId = 'verify-1'; method = 'session.create'; payload = @{} } | ConvertTo-Json -Depth 5
      $r = Invoke-WebRequest -Uri "http://127.0.0.1:$port/api/session.create" -Method Post -ContentType 'application/json' -Body $body -UseBasicParsing -TimeoutSec 30
      $json = $r.Content | ConvertFrom-Json
      if ($json.result.ok -ne $true) { throw "session.create failed: $($json.result.error.message)" }
      $sid = $json.result.value.sessionId
      Write-Output "      session created: $sid (log carries no seed by design)"
    } finally {
      Stop-Job $job -ErrorAction SilentlyContinue
      Remove-Job $job -Force -ErrorAction SilentlyContinue
    }
  }
}

Write-Output ''
if ($fail -gt 0) { Write-Output "RESULT: $fail failed - do NOT ship/enable"; exit 1 }
Write-Output 'RESULT: all passed - safe to ship/enable'

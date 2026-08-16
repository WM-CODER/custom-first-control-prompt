# restart-web.ps1 - 重启 dsh web 进程（框架/插件产物变更后生效）
#
# 独立进程执行：本脚本不依赖调用方的进程树——即使原 web 进程被杀，
# 它仍会完成 kill -> 启动 -> 健康检查，并把结果写入日志文件。
#
# 用法（从任意 shell）：
#   powershell -ExecutionPolicy Bypass -File restart-web.ps1
# 或通过 Start-Process 独立启动：
#   Start-Process pwsh -ArgumentList '-ExecutionPolicy','Bypass','-File','<path>\restart-web.ps1' -WindowStyle Hidden

param(
  [string]$DshHome = '',
  [int]$Port = 3080
)

$ErrorActionPreference = 'Continue'

if ($DshHome -eq '') { $DshHome = Join-Path $env:USERPROFILE '.dsh' }
$bin = Join-Path $DshHome (Join-Path 'profiles' (Join-Path 'node_modules' (Join-Path '@deepseek-ai' (Join-Path 'dsh' 'lib\bin.js'))))
$logsDir = Join-Path $DshHome 'logs'
New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
$log = Join-Path $logsDir ("web-restart-{0:yyyyMMdd-HHmmss}.log" -f (Get-Date))
function Log([string]$msg) { $line = "[{0:HH:mm:ss}] {1}" -f (Get-Date), $msg; $line | Tee-Object -FilePath $log -Append }

Log "restart-web: home=$DshHome port=$Port bin=$bin"

# ---- 1. kill 当前 web 进程 ----
$listener = netstat -ano | Select-String ":$Port\s" | Select-String "LISTENING" | Select-Object -First 1
if ($listener) {
  $pidStr = ($listener.Line -split '\s+') | Where-Object { $_ -match '^\d+$' } | Select-Object -Last 1
  if ($pidStr) {
    Log "killing web process PID $pidStr"
    taskkill /PID $pidStr /F 2>&1 | Out-String | ForEach-Object { Log $_.Trim() }
    Start-Sleep -Seconds 3
  }
} else {
  Log "no listener on port $Port; skipping kill"
}

# ---- 2. 启动新 web ----
if (-not (Test-Path $bin)) { Log "ERROR: bin not found: $bin"; exit 1 }
$outLog = Join-Path $logsDir 'web.stdout.log'
$errLog = Join-Path $logsDir 'web.stderr.log'
Log "starting: node $bin web"
$proc = Start-Process -FilePath 'node.exe' -ArgumentList @($bin, 'web') `
  -WorkingDirectory (Join-Path $DshHome (Join-Path 'profiles' 'web')) `
  -RedirectStandardOutput $outLog -RedirectStandardError $errLog -WindowStyle Hidden -PassThru
Log "started PID $($proc.Id)"

# ---- 3. 健康检查（最多 90 秒）----
$ok = $false
for ($i = 0; $i -lt 45; $i++) {
  Start-Sleep -Seconds 2
  try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/" -UseBasicParsing -TimeoutSec 3
    if ($r.StatusCode -eq 200) { Log "HEALTHY: http://127.0.0.1:$Port/ -> 200 (after $([int](($i+1)*2))s)"; $ok = $true; break }
  } catch {
    if ($i % 5 -eq 4) { Log "waiting... ($([int](($i+1)*2))s, last: $($_.Exception.Message))" }
  }
}
if (-not $ok) {
  Log "FAILED: web did not become healthy within 90s. stderr tail:"
  Get-Content $errLog -Tail 30 -ErrorAction SilentlyContinue | ForEach-Object { Log "  $_" }
  Log "If the failure is plugin/framework related, run escape.ps1 then retry."
}
Log "DONE. log=$log"

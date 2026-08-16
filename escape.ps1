# escape.ps1 - 逃生脚本：web 起不来时，一键恢复可启动状态
#
# 适用场景：custom-first-control-prompt 完全版改造（框架补丁 + 插件行）后
# web fail-loud 起不来（插件加载失败 / 框架修改异常 / 配置错误）。
#
# 本脚本做三件事（均幂等，可重复执行）：
#   1. 还原框架产物：把 dsh-agent-loop / dsh-session 的 lib 恢复为改造前
#      备份（backup-rc5-lib-*，由实施时创建）；
#   2. 屏蔽插件行：在 cordis.patch.yml 末尾追加 disabled 覆盖（保留原配置，
#      不破坏文件；恢复时删掉追加段即可）；
#   3. 输出重启命令（不自动杀进程/启动——由部署方确认端口与启动方式）。
#
# 用法：
#   powershell -ExecutionPolicy Bypass -File escape.ps1
#   powershell -ExecutionPolicy Bypass -File escape.ps1 -DshHome C:\path\.dsh -ProfileName web
#
# 恢复完全版（重新启用）：删除 cordis.patch.yml 末尾追加的 disabled 段，
# 重新执行框架改造步骤（打 framework-planA-rc5.patch + 重建 + 同步产物）。

param(
  [string]$DshHome = '',
  [string]$ProfileName = 'web'
)

$ErrorActionPreference = 'Stop'

function Write-Step([string]$msg) { Write-Output "== $msg" }

# ---- 1. 定位 DSH_HOME ----
if ($DshHome -eq '') {
  $candidate = Join-Path $env:USERPROFILE '.dsh'
  if (-not (Test-Path (Join-Path $candidate 'profiles'))) {
    Write-Output "ERROR: cannot locate DSH_HOME (tried $candidate). Pass -DshHome <DSH_HOME>."
    exit 1
  }
  $DshHome = $candidate
}
$profileDir = Join-Path $DshHome (Join-Path 'profiles' $ProfileName)
$modulesDir = Join-Path $DshHome (Join-Path 'profiles' 'node_modules')
if (-not (Test-Path $profileDir)) {
  Write-Output "ERROR: profile directory missing: $profileDir"
  exit 1
}
Write-Step "home=$DshHome profile=$ProfileName"

# ---- 2. 还原框架产物 ----
# 备份目录由实施时的备份脚本创建（约定 backup-<版本>-lib-<时间戳>，如
# backup-rc5-lib-20260816-120000）；这里按前缀通配取最新一份，适配任意版本。
$backup = Get-ChildItem (Join-Path $DshHome 'profiles') -Directory -Filter 'backup-*-lib-*' |
  Sort-Object Name -Descending | Select-Object -First 1
if ($backup -eq $null) {
  Write-Output "WARN: no backup-*-lib-* found under profiles\; framework rollback skipped (nothing to restore)."
} else {
  Write-Step "restoring framework artifacts from $($backup.Name)"
  foreach ($pkg in @('dsh-agent-loop', 'dsh-session')) {
    $srcPkg = Join-Path $backup.FullName $pkg
    $dstPkg = Join-Path $modulesDir (Join-Path '@deepseek-ai' $pkg)
    if (-not (Test-Path $srcPkg)) {
      Write-Output "WARN: backup missing $pkg; skipped"
      continue
    }
    Copy-Item (Join-Path $srcPkg 'package.json') (Join-Path $dstPkg 'package.json') -Force
    $libDst = Join-Path $dstPkg 'lib'
    New-Item -ItemType Directory -Path $libDst -Force | Out-Null
    Get-ChildItem (Join-Path $srcPkg 'lib') -File | ForEach-Object {
      Copy-Item $_.FullName $libDst -Force
    }
    Write-Output "  restored: $pkg/lib"
  }
}

# ---- 3. 屏蔽插件行（追加 disabled 覆盖，保留原配置）----
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

# ---- escape.ps1 追加段：屏蔽本插件行（恢复时删除以下 4 行即可重新启用）----
- id: custom-first-control-prompt
  disabled: true
- id: ui-custom-first-control-prompt
  disabled: true
'@
    Add-Content -Path $patchPath -Value $override -Encoding utf8
    Write-Output "  disabled custom-first-control-prompt + ui-custom-first-control-prompt"
  }
}

# ---- 4. 重启指引 ----
Write-Step "next steps"
Write-Output "  1) Restart the web process. Find it with:"
Write-Output "       netstat -ano | findstr :3080"
Write-Output "     then kill the owning PID (taskkill /PID <pid> /F) and start the deployment"
Write-Output "     the same way it was originally launched, e.g.:"
Write-Output "       node `"$modulesDir\@deepseek-ai\dsh\lib\bin.js`" web"
Write-Output "  2) Verify http://127.0.0.1:3080 comes up WITHOUT the plugin (base frame mode gone too)."
Write-Output "  3) To re-enable the full version later: delete the escape.ps1 appended section"
Write-Output "     from $patchPath and re-apply the framework change (framework-planA-rc5.patch)."
Write-Output "DONE"

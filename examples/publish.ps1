# 用本机 OmniPost 把一篇 Markdown 建成多平台草稿（Windows PowerShell）。
# 用法：.\publish.ps1 .\article.md zhihu,csdn,cnblogs
param(
  [Parameter(Mandatory = $true)] [string] $Doc,
  [Parameter(Mandatory = $true)] [string] $Platforms,
  [string] $Mode = 'draft'
)
$ErrorActionPreference = 'Stop'

# 1. 端口来自 ~/.omnipost/server.json
$serverJson = Join-Path $env:USERPROFILE '.omnipost\server.json'
$port = if (Test-Path $serverJson) { (Get-Content $serverJson -Raw | ConvertFrom-Json).port } else { 8787 }
$base = "http://127.0.0.1:$port"

# 2. /api/health 给出这台机器的 CLI 命令（Windows 上是 omnipost.cmd；同目录另有 omnipost.ps1）
try { $health = Invoke-RestMethod "$base/api/health" } catch { Write-Error 'OmniPost 没在运行，请先打开它'; exit 1 }
$cli = $health.data.cli.shell

# 3. 分发前先看告警
& $cli alerts

# 4. 建草稿 / 发布。注意：参数里若含 & 的 URL，请改用 --json 文件传参
$title = (Get-Content $Doc | Where-Object { $_ -match '^# ' } | Select-Object -First 1) -replace '^# ', ''
& $cli publish --doc $Doc --platforms $Platforms --mode $Mode --title $title --baseDir (Split-Path -Parent (Resolve-Path $Doc))

# 5. 看结果：拿返回的 recordId 对账
& $cli posts --limit 5

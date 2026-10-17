$ErrorActionPreference = 'Stop'
$appRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$appUrl = 'http://127.0.0.1:8765/'

function Test-ShiyouReady {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $appUrl -TimeoutSec 2
    return $response.StatusCode -eq 200 -and $response.Content -match '<title>拾游'
  } catch {
    return $false
  }
}

function Find-NodeRuntime {
  $fromPath = Get-Command node -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($fromPath) { return $fromPath.Source }

  $candidates = @(
    (Join-Path $env:ProgramFiles 'nodejs\node.exe'),
    (Join-Path $env:LOCALAPPDATA 'Programs\nodejs\node.exe'),
    (Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'),
    (Join-Path $env:LOCALAPPDATA 'OpenAI\Codex\runtimes\codex-primary-runtime\dependencies\node\bin\node.exe')
  )
  $runtimePattern = Join-Path $env:USERPROFILE '.cache\codex-runtimes\*\dependencies\node\bin\node.exe'
  $candidates += Get-ChildItem -Path $runtimePattern -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -ExpandProperty FullName
  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path -LiteralPath $candidate -PathType Leaf)) { return $candidate }
  }
  throw '没有在 PATH、Node.js 常见安装目录或 Codex 本地运行环境中找到 node.exe。请安装 Node.js 后重试。'
}

try {
  if (-not (Test-ShiyouReady)) {
    Write-Host '正在启动拾游本地服务，请稍候...'
    $nodePath = Find-NodeRuntime
    Write-Host "使用 Node.js：$nodePath"
    Start-Process -FilePath $nodePath -ArgumentList 'server.mjs' -WorkingDirectory $appRoot -WindowStyle Minimized | Out-Null
    $deadline = (Get-Date).AddSeconds(20)
    do {
      Start-Sleep -Milliseconds 500
      if (Test-ShiyouReady) { break }
    } while ((Get-Date) -lt $deadline)
  }

  if (-not (Test-ShiyouReady)) {
    throw '拾游服务在 20 秒内没有就绪。请检查最小化的服务窗口；确认 Node.js 已安装且 8765 端口未被占用。'
  }

  Write-Host "拾游已就绪：$appUrl"
} catch {
  Write-Host $_.Exception.Message -ForegroundColor Red
  exit 1
}

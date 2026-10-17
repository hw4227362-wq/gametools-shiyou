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

try {
  if (-not (Test-ShiyouReady)) {
    Write-Host '正在启动拾游本地服务，请稍候...'
    Start-Process -FilePath $env:ComSpec -ArgumentList '/k', 'node server.mjs' -WorkingDirectory $appRoot -WindowStyle Minimized | Out-Null
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

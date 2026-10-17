@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo 未找到 Node.js。请安装 Node.js，或直接用浏览器打开 index.html。
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0启动拾游.ps1"
if errorlevel 1 (
  echo.
  pause
  exit /b 1
)
start "" "http://127.0.0.1:8765"
endlocal

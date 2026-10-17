@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0启动拾游.ps1"
if errorlevel 1 (
  echo.
  pause
  exit /b 1
)
start "" "http://127.0.0.1:8765"
endlocal

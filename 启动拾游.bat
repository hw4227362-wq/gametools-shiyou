@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if not %errorlevel%==0 (
  echo 未找到 Node.js。请安装 Node.js，或直接用浏览器打开 index.html。
  pause
  exit /b 1
)
start "拾游本地服务" /min cmd /c "node server.mjs"
timeout /t 1 /nobreak >nul
start "" "http://127.0.0.1:8765"
endlocal

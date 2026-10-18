@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
set "ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/"

where node >nul 2>nul
if errorlevel 1 (
  echo 未找到 Node.js。构建桌面软件需要安装 Node.js 24 或更新的 LTS 版本。
  echo 下载地址：https://nodejs.org/
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo 未找到 npm。请重新安装 Node.js，并勾选 npm 包管理器。
  pause
  exit /b 1
)

if not exist "node_modules\@electron\packager\package.json" (
  echo 正在安装桌面打包依赖...
  call npm install
  if errorlevel 1 goto :failed
)

if not exist "node_modules\electron\dist\electron.exe" (
  echo 正在安装桌面打包依赖...
  call npm install
  if errorlevel 1 goto :failed
)

echo 正在生成 Windows 桌面版...
call npm run pack:win
if errorlevel 1 goto :failed

echo.
echo 构建完成。双击 release\拾游-win32-x64\拾游.exe 即可运行。
pause
exit /b 0

:failed
echo.
echo 构建失败。请检查上方错误信息与网络连接。
pause
exit /b 1

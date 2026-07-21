@echo off
chcp 65001 >nul
title Boss直聘自动化 - Chrome调试浏览器

echo ============================================
echo   Boss直聘自动化 - Chrome 调试浏览器启动
echo ============================================
echo.

:: 调试端口（与后端 browser.ts 中一致）
set DEBUG_PORT=9222
:: 独立用户数据目录（与日常 Chrome 隔离，避免冲突）
set USER_DATA_DIR=%USERPROFILE%\boss-chrome-profile

:: 查找 Chrome 可执行文件
set "CHROME_PATH="

:: 1. 先查注册表（最可靠）
for /f "tokens=2*" %%A in ('reg query "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" /v Path 2^>nul') do set "CHROME_PATH=%%B\chrome.exe"
if not defined CHROME_PATH (
  for /f "tokens=2*" %%A in ('reg query "HKEY_CURRENT_USER\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" /v Path 2^>nul') do set "CHROME_PATH=%%B\chrome.exe"
)

:: 2. 回退：常见安装路径
if not defined CHROME_PATH (
  if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME_PATH=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
)
if not defined CHROME_PATH (
  if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME_PATH=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
)
if not defined CHROME_PATH (
  if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" set "CHROME_PATH=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
)

:: 3. 回退：Edge 浏览器（基于 Chromium，同样支持 CDP）
if not defined CHROME_PATH (
  if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "CHROME_PATH=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
  if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "CHROME_PATH=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
)

if not defined CHROME_PATH (
  echo [错误] 未找到 Chrome 或 Edge 浏览器，请先安装 Google Chrome。
  echo.
  pause
  exit /b 1
)

echo 找到浏览器: %CHROME_PATH%
echo 调试端口:   %DEBUG_PORT%
echo 数据目录:   %USER_DATA_DIR%
echo.

:: 检查端口是否已被占用（可能已经启动了调试 Chrome）
netstat -ano | findstr ":%DEBUG_PORT% " | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
  echo [提示] 端口 %DEBUG_PORT% 已有进程监听，可能调试浏览器已在运行。
  echo        如需重启，请先关闭已有的调试浏览器窗口，再运行本脚本。
  echo.
  pause
  exit /b 0
)

echo 正在启动调试浏览器...
echo.
echo [重要] 启动后请：
echo   1. 在浏览器中访问 https://www.zhipin.com 并登录 Boss直聘
echo   2. 登录成功后，回到代招助手网页点击"连接 Chrome"
echo.
echo 按任意键启动浏览器...
pause >nul

start "" "%CHROME_PATH%" --remote-debugging-port=%DEBUG_PORT% --user-data-dir="%USER_DATA_DIR%" --no-first-run --no-default-browser-check https://www.zhipin.com

echo.
echo 浏览器已启动。请不要关闭此窗口，关闭浏览器后可按任意键退出。
pause >nul

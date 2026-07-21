@echo off
chcp 65001 >nul
title Boss自动化 - 本地 Agent

echo ============================================
echo   Boss自动化 - 本地 Agent 启动器
echo ============================================
echo.

:: 进入脚本所在目录
cd /d "%~dp0\.."

:: 1. 检查 config.json
if not exist "agent\config.json" (
  echo [错误] 未找到 agent\config.json 配置文件
  echo        请复制 agent\config.example.json 为 agent\config.json
  echo        并填写服务器地址、用户名、密码
  echo.
  pause
  exit /b 1
)

:: 2. 检查 node_modules
if not exist "node_modules\ws" (
  echo [错误] 未找到依赖，请先在项目根目录执行 npm install
  echo.
  pause
  exit /b 1
)

:: 3. 提示先启动 Chrome
echo [步骤1] 启动带调试端口的 Chrome 浏览器
echo         如果还没启动，请先双击 chrome-debug.bat
echo         并在浏览器里登录 Boss 直聘
echo.
echo [步骤2] 启动本地 Agent 连接服务器
echo.
pause

:: 4. 用 tsx 运行 Agent（支持直接运行 .ts，自动解析 .js→.ts）
echo [Agent] 正在启动...
echo [Agent] 按 Ctrl+C 可停止
echo.
npx tsx agent/agent.ts

echo.
echo [Agent] 已停止
pause

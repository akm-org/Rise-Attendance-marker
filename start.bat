@echo off
setlocal
title EnderShards Control Panel
cd /d "%~dp0"
echo ==========================================
echo        ENDER SHARDS CONTROL PANEL v18
echo ==========================================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js is not installed.
  echo Install Node.js 20+ or 24 LTS/current.
  pause
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo ERROR: npm is not available.
  pause
  exit /b 1
)
echo Node:
node --version
echo.
echo Installing/updating Minecraft + Discord dependencies...
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo.
  echo npm install failed.
  pause
  exit /b 1
)
echo.
echo Starting panel: http://localhost:3000
echo.
node server.js
echo.
pause
endlocal

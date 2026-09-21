@echo off
cd /d "%~dp0"
echo Installing required packages...
call npm install mineflayer ws dotenv
if errorlevel 1 (
  echo Installation failed.
  pause
  exit /b 1
)
echo.
echo Dependencies installed successfully.
pause

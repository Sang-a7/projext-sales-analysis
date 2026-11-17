@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Run install-local.bat first.
  pause
  exit /b 1
)
call npm run setup
if errorlevel 1 exit /b 1
if not exist .next\BUILD_ID (
  call npm run build
  if errorlevel 1 exit /b 1
)
echo Open http://127.0.0.1:3005 in your browser.
call npm start

@echo off
cd /d "%~dp0"
call npm ci
if errorlevel 1 goto failed
call npm run setup
if errorlevel 1 goto failed
call npm run build
if errorlevel 1 goto failed
echo Ready. Run start-local.bat to open the application.
pause
exit /b 0
:failed
echo Setup failed. Review the error above.
pause
exit /b 1

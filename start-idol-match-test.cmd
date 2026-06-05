@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\open-when-ready.ps1"
if errorlevel 1 (
  echo.
  echo Startup failed. Check the messages above, or open these logs:
  echo   %~dp0dev-server.out.log
  echo   %~dp0dev-server.err.log
  echo.
  pause
  exit /b 1
)
exit /b 0

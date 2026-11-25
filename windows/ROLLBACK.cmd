@echo off
setlocal
if not exist "%LOCALAPPDATA%\N360 Support\updater.ps1" (
  echo N360: updater.ps1 not found. Extract the ZIP and run INSTALL.cmd first.
  pause
  exit /b 1
)
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%LOCALAPPDATA%\N360 Support\updater.ps1" -Mode Rollback
set "RC=%ERRORLEVEL%"
if not "%RC%"=="0" echo N360: command returned error %RC%. See the message above.
pause
exit /b %RC%

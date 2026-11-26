@echo off
setlocal
if not exist "%~dp0updater.ps1" (
  echo N360: Extract all files before running this repair.
  pause
  exit /b 1
)
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0updater.ps1" -Mode Repair
set "RC=%ERRORLEVEL%"
if "%RC%"=="0" (echo N360: Repair completed.) else (echo N360: Repair failed with code %RC%. Read the message above.)
pause
exit /b %RC%

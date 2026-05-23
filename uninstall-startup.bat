@echo off
setlocal
cd /d "%~dp0"

if /I "%~1"=="gemini" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall-startup.ps1" -Target Gemini
) else if /I "%~1"=="all" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall-startup.ps1" -Target All
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall-startup.ps1" -Target Default
)

pause

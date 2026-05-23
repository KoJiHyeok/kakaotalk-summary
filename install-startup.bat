@echo off
setlocal
cd /d "%~dp0"

if /I "%~1"=="gemini" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-startup.ps1" -Gemini
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-startup.ps1"
)

pause

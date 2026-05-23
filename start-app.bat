@echo off
setlocal
cd /d "%~dp0"
set GEMINI_ENABLED=false
echo Starting KakaoTalk stock summary app...
echo Server: http://localhost:3000
start "" "http://localhost:3000"
npm start
pause

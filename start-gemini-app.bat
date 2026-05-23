@echo off
setlocal
cd /d "%~dp0"
set GEMINI_ENABLED=true
echo Starting KakaoTalk stock summary app with Gemini enabled...
echo API keys are not stored in this script. Set GEMINI_API_KEY in .env or Windows environment variables.
echo Server: http://localhost:3000
start "" "http://localhost:3000"
npm start
pause

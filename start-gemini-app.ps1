Set-Location -LiteralPath $PSScriptRoot
$env:GEMINI_ENABLED = "true"
Write-Host "Starting KakaoTalk stock summary app with Gemini enabled..."
Write-Host "API keys are not stored in this script. Set GEMINI_API_KEY in .env or Windows environment variables."
Write-Host "Server: http://localhost:3000"
Start-Process "http://localhost:3000"
npm start

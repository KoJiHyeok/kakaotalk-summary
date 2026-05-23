Set-Location -LiteralPath $PSScriptRoot
$env:GEMINI_ENABLED = "false"
Write-Host "Starting KakaoTalk stock summary app..."
Write-Host "Server: http://localhost:3000"
Start-Process "http://localhost:3000"
npm start

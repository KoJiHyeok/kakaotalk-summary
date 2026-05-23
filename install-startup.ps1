param(
  [switch]$Gemini,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$projectDir = $PSScriptRoot
$startupDir = [Environment]::GetFolderPath("Startup")
$targetScript = if ($Gemini) { "start-gemini-app.bat" } else { "start-app.bat" }
$shortcutName = if ($Gemini) { "KakaoTalk Stock Summary Gemini.lnk" } else { "KakaoTalk Stock Summary.lnk" }
$targetPath = Join-Path $projectDir $targetScript
$shortcutPath = Join-Path $startupDir $shortcutName

if (-not (Test-Path -LiteralPath $targetPath)) {
  throw "Target script not found: $targetPath"
}

Write-Host "Startup folder: $startupDir"
Write-Host "Target script: $targetPath"
Write-Host "Shortcut: $shortcutPath"

if ($DryRun) {
  Write-Host "Dry run only. No shortcut was created."
  exit 0
}

if (Test-Path -LiteralPath $shortcutPath) {
  Remove-Item -LiteralPath $shortcutPath -Force
  Write-Host "Existing shortcut was replaced."
}

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $targetPath
$shortcut.WorkingDirectory = $projectDir
$shortcut.Description = if ($Gemini) {
  "Start KakaoTalk Stock Summary with Gemini enabled"
} else {
  "Start KakaoTalk Stock Summary"
}
$shortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll,220"
$shortcut.Save()

Write-Host "Startup shortcut installed."

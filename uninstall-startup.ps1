param(
  [ValidateSet("Default", "Gemini", "All")]
  [string]$Target = "Default",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$startupDir = [Environment]::GetFolderPath("Startup")
$names = switch ($Target) {
  "Default" { @("KakaoTalk Stock Summary.lnk") }
  "Gemini" { @("KakaoTalk Stock Summary Gemini.lnk") }
  "All" { @("KakaoTalk Stock Summary.lnk", "KakaoTalk Stock Summary Gemini.lnk") }
}

Write-Host "Startup folder: $startupDir"

foreach ($name in $names) {
  $shortcutPath = Join-Path $startupDir $name
  Write-Host "Shortcut: $shortcutPath"

  if ($DryRun) {
    Write-Host "Dry run only. No shortcut was removed."
    continue
  }

  if (Test-Path -LiteralPath $shortcutPath) {
    Remove-Item -LiteralPath $shortcutPath -Force
    Write-Host "Removed: $name"
  } else {
    Write-Host "Shortcut not found, nothing to remove: $name"
  }
}

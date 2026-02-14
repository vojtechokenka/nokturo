# Nokturo – Spuštění v DEV režimu (rychlé, pro vývoj)
# Aplikace se načte z localhost:5173 – mělo by to jet rychle
# Spusť: .\scripts\run-dev.ps1

$ProjectRoot = $PSScriptRoot + "\.."
$ProjectRoot = (Resolve-Path $ProjectRoot).Path

Set-Location $ProjectRoot

if (-not (Test-Path "$ProjectRoot\package.json")) {
    Write-Host "CHYBA: Spusť z kořene projektu" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== Nokturo DEV režim ===" -ForegroundColor Cyan
Write-Host "Aplikace poběží na http://127.0.0.1:5173 (port 5173 pevný)" -ForegroundColor Gray
Write-Host "Pro ukončení: Ctrl+C`n" -ForegroundColor Gray

npm run electron:dev

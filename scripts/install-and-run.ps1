# Nokturo – Install dependencies and run app (dev mode on port 5173)
# Spusť: .\scripts\install-and-run.ps1

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot + "\.."
$ProjectRoot = (Resolve-Path $ProjectRoot).Path

Set-Location $ProjectRoot

if (-not (Test-Path "$ProjectRoot\package.json")) {
    Write-Host "CHYBA: Spusť z kořene projektu" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== Nokturo Install & Run ===" -ForegroundColor Cyan
Write-Host "Port: 5173 (pevný)" -ForegroundColor Gray
Write-Host "Aplikace poběží na http://127.0.0.1:5173" -ForegroundColor Gray
Write-Host "Pro ukončení: Ctrl+C`n" -ForegroundColor Gray

# 1. npm install
Write-Host "--- npm install ---" -ForegroundColor Cyan
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "CHYBA: npm install selhal" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Závislosti nainstalovány`n" -ForegroundColor Green

# 2. Spustit aplikaci na portu 5173 (pevný)
npm run electron:dev

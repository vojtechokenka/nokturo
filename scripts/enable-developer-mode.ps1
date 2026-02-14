# Zapne Režim vývojáře ve Windows (umožňuje vytvářet symbolické odkazy bez admin práv)
# Spusť tento skript jako správce: pravý klik na PowerShell -> Spustit jako správce

$registryPath = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock"
$name = "AllowDevelopmentWithoutDevLicense"
$value = 1

if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "Tento skript musí být spuštěn jako správce." -ForegroundColor Red
    Write-Host "Pravý klik na PowerShell -> Spustit jako správce" -ForegroundColor Yellow
    exit 1
}

if (!(Test-Path $registryPath)) {
    New-Item -Path $registryPath -Force | Out-Null
}

Set-ItemProperty -Path $registryPath -Name $name -Value $value -Type DWord -Force
Write-Host "Režim vývojáře byl zapnut." -ForegroundColor Green
Write-Host "Můžeš nyní spustit: npm run electron:build" -ForegroundColor Cyan

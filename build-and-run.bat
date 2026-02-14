@echo off
cd /d "%~dp0"

if not exist "scripts\build-and-run.ps1" (
    echo Chyba: scripts\build-and-run.ps1 nenalezen.
    pause
    exit /b 1
)

powershell -ExecutionPolicy Bypass -File ".\scripts\build-and-run.ps1"
if errorlevel 1 (
    echo.
    echo Build selhal. Zkuste spustit jako Administrator nebo zapnout Developer Mode.
    pause
    exit /b 1
)
pause

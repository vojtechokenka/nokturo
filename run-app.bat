@echo off
cd /d "%~dp0"

set "EXE=dist-electron\win-unpacked\Nokturo.exe"

if exist "%EXE%" (
    start "" "%EXE%"
) else (
    echo Nokturo.exe nebyl nalezen.
    echo Nejdřív spusť build-and-run.bat pro sestavení aplikace.
    pause
)

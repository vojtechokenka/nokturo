# Nokturo - Build and Run
# Run from project root. Use "Run as Administrator" if build fails on symlinks.
# Forces clean build (no cache) so you always get the latest code from src/.

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot + "\.."
$ProjectRoot = (Resolve-Path $ProjectRoot).Path

$BuildTimestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

Write-Host ""
Write-Host "=== Nokturo Build & Run ===" -ForegroundColor Cyan
Write-Host "Build started: $BuildTimestamp" -ForegroundColor Yellow
Write-Host "Project: $ProjectRoot" -ForegroundColor Gray
Write-Host ""

# 1. Check directory
if (-not (Test-Path "$ProjectRoot\package.json")) {
    Write-Host "ERROR: Run from project root (where package.json is)" -ForegroundColor Red
    exit 1
}
Set-Location $ProjectRoot
Write-Host "[OK] Project directory" -ForegroundColor Green

# 2. Git – commit and push all changes
$gitPath = Get-Command git -ErrorAction SilentlyContinue
if ($gitPath) {
    Write-Host ""
    Write-Host "--- Git push ---" -ForegroundColor Cyan
    git add -A
    $status = git status --porcelain
    if ($status) {
        git commit -m "Build: $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
        git push
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] Changes pushed" -ForegroundColor Green
        } else {
            Write-Host "WARNING: git push failed (continue with build)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "[OK] No changes to push" -ForegroundColor Green
    }
    Write-Host ""
} else {
    Write-Host "WARNING: git not found, skipping push" -ForegroundColor Yellow
}

# 3. Check Node.js
try {
    $nodeVersion = node --version 2>$null
    if (-not $nodeVersion) { throw "Node not found" }
    Write-Host "[OK] Node.js $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Node.js not installed. Download from https://nodejs.org" -ForegroundColor Red
    exit 1
}

# 4. Check .env
if (-not (Test-Path "$ProjectRoot\.env")) {
    Write-Host "WARNING: .env file missing!" -ForegroundColor Yellow
    if (Test-Path "$ProjectRoot\.env.example") {
        Copy-Item "$ProjectRoot\.env.example" "$ProjectRoot\.env"
        Write-Host "Created .env from .env.example. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY." -ForegroundColor Yellow
    } else {
        Write-Host "ERROR: .env.example not found." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[OK] .env file" -ForegroundColor Green
}

# 5. Stop running Nokturo
$nokturo = Get-Process -Name "Nokturo" -ErrorAction SilentlyContinue
if ($nokturo) {
    Write-Host "Stopping Nokturo..." -ForegroundColor Yellow
    $nokturo | Stop-Process -Force
    Start-Sleep -Seconds 2
}
Write-Host "[OK] No running instance" -ForegroundColor Green

# 6. Clean build outputs and caches (forces fresh build from src/)
$cleanTargets = @(
    @{ Path = "dist"; Name = "dist (Vite output)" },
    @{ Path = "dist-electron"; Name = "dist-electron" },
    @{ Path = "node_modules\.vite"; Name = "Vite cache" }
)
foreach ($t in $cleanTargets) {
    $fullPath = Join-Path $ProjectRoot $t.Path
    if (Test-Path $fullPath) {
        Remove-Item -Recurse -Force $fullPath -ErrorAction SilentlyContinue
        if (Test-Path $fullPath) {
            if ($t.Path -eq "dist-electron") {
                Write-Host "WARNING: Could not delete dist-electron. Close Nokturo and try again." -ForegroundColor Yellow
            }
        } else {
            Write-Host "[OK] $($t.Name) cleaned" -ForegroundColor Green
        }
    }
}

# 7. npm install
Write-Host ""
Write-Host "--- npm install ---" -ForegroundColor Cyan
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: npm install failed" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Dependencies installed" -ForegroundColor Green
Write-Host ""

# 8. Build
Write-Host "--- npm run electron:build ---" -ForegroundColor Cyan
npm run electron:build
$buildOk = ($LASTEXITCODE -eq 0)

# 9. Result and run
$unpackedExe = "$ProjectRoot\dist-electron\win-unpacked\Nokturo.exe"
$installerExe = Get-ChildItem "$ProjectRoot\dist-electron\Nokturo Setup*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1

if ($buildOk) {
    Write-Host ""
    Write-Host "=== BUILD SUCCESS ===" -ForegroundColor Green
    Write-Host "Build time: $BuildTimestamp" -ForegroundColor Yellow
    if ($installerExe) {
        Write-Host "Installer: $($installerExe.FullName)" -ForegroundColor Gray
    }
    Write-Host "App:       $unpackedExe" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "=== BUILD FAILED ===" -ForegroundColor Red
    if (Test-Path $unpackedExe) {
        Write-Host "But older Nokturo.exe exists - you can try running it." -ForegroundColor Yellow
        Write-Host ""
    } else {
        Write-Host "Run this script as Administrator or enable Developer Mode." -ForegroundColor Yellow
        Write-Host ""
        exit 1
    }
}

# Run app or installer
if (Test-Path $unpackedExe) {
    Write-Host "Options:" -ForegroundColor Cyan
    Write-Host "  1 = Run app (no install)"
    Write-Host "  2 = Run installer (if exists)"
    Write-Host "  n = Do nothing"
    $run = Read-Host "Choice (1/2/n, default 1)"
    if ($run -eq "2" -and $installerExe) {
        Write-Host "Starting installer..." -ForegroundColor Cyan
        Start-Process $installerExe.FullName
    } elseif ($run -ne "n" -and $run -ne "N") {
        Write-Host "Starting Nokturo..." -ForegroundColor Cyan
        Start-Process $unpackedExe
    }
} else {
    Write-Host "Nokturo.exe not found. Build probably failed completely." -ForegroundColor Red
}

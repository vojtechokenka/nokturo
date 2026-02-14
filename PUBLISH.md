# Publikování a automatické aktualizace

## 1. GitHub repozitář

Repozitář: `github.com/vojtechokenka/nokturo`

## 2. Nastavení proměnných (PowerShell)

Před buildem nastavte:

```powershell
$env:GITHUB_OWNER = "vojtechokenka"
$env:GITHUB_REPO = "nokturo"
```

Pro **publikování** na GitHub Releases navíc potřebujete token:

```powershell
$env:GH_TOKEN = "ghp_xxxxxxxxxxxx"   # Personal Access Token
```

Token vytvoříte: GitHub → Settings → Developer settings → Personal access tokens → Generate new token (scope: `repo`).

## 3. Build a publikování

```powershell
# Lokální build (bez publikování)
npm run electron:build

# Build + upload na GitHub Releases
npm run electron:build:publish
```

## 4. Automatické aktualizace

Po publikování na GitHub Releases aplikace sama kontroluje nové verze při startu. Stačí zvýšit `version` v `package.json` před dalším buildem.

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$frontendPath = Join-Path $projectRoot "frontend"
$backendPath = Join-Path $projectRoot "backend"
$distPath = Join-Path $frontendPath "dist"
$backendStaticPath = Join-Path $backendPath "static"
$backendTemplatesPath = Join-Path $backendPath "templates"

Write-Host "Building frontend..."
Push-Location $frontendPath
try {
    npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "Frontend build failed with exit code $LASTEXITCODE."
    }
}
finally {
    Pop-Location
}

if (-not (Test-Path $distPath)) {
    throw "Frontend build output not found at: $distPath"
}

New-Item -ItemType Directory -Force -Path $backendStaticPath | Out-Null
New-Item -ItemType Directory -Force -Path $backendTemplatesPath | Out-Null

$indexSourcePath = Join-Path $distPath "index.html"
$indexDestinationPath = Join-Path $backendTemplatesPath "index.html"

# Clean previous static build output.
if (Test-Path $backendStaticPath) {
    Get-ChildItem -Path $backendStaticPath -Force | Remove-Item -Recurse -Force
}

# Copy all build artifacts except index.html into backend/static.
Get-ChildItem -Path $distPath -Force | Where-Object { $_.Name -ne "index.html" } | ForEach-Object {
    Copy-Item -Path $_.FullName -Destination $backendStaticPath -Recurse -Force
}

Copy-Item -Path $indexSourcePath -Destination $indexDestinationPath -Force

# Vite output references /assets by default; Flask serves static files from /static.
$indexContent = Get-Content -Path $indexDestinationPath -Raw
$indexContent = $indexContent -replace '"/assets/', '"/static/assets/'
$indexContent = $indexContent -replace "'/assets/", "'/static/assets/"
Set-Content -Path $indexDestinationPath -Value $indexContent

Write-Host "Frontend build copied successfully."
Write-Host "Template: $indexDestinationPath"
Write-Host "Static:   $backendStaticPath"

$activateScriptPath = Join-Path $projectRoot "env\Scripts\Activate.ps1"
if (-not (Test-Path $activateScriptPath)) {
    throw "Virtual environment activation script not found at: $activateScriptPath"
}

Write-Host "Activating virtual environment..."
. $activateScriptPath

Write-Host "Starting backend from $backendPath ..."
Push-Location $backendPath
try {
    python app.py
}
finally {
    Pop-Location
}

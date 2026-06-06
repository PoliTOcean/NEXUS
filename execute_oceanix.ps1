# Windows equivalent of execute_oceanix.sh.
# Clones/builds Oceanix and ensures the Mosquitto broker is running.
# Note: Oceanix build tooling targets Linux; on Windows this script only clones
# the repo and reports whether a prebuilt executable is available.
$ErrorActionPreference = "Stop"

$RepoUrl = "https://github.com/PoliTOcean/Oceanix.git"
$LocalDir = "Oceanix"
$Executable = "Oceanix.exe"

if (-not (Test-Path $LocalDir)) {
    Write-Host "Cloning the repository..."
    git clone $RepoUrl
} else {
    Write-Host "Repository already cloned."
}

# Ensure Mosquitto is running.
$mosqProc = Get-Process -Name mosquitto -ErrorAction SilentlyContinue
if ($mosqProc) {
    Write-Host "Mosquitto is already running."
} elseif (Get-Service -Name mosquitto -ErrorAction SilentlyContinue) {
    Write-Host "Starting Mosquitto service..."
    Start-Service -Name mosquitto
} elseif (Get-Command mosquitto -ErrorAction SilentlyContinue) {
    Write-Host "Starting Mosquitto directly..."
    Start-Process mosquitto
} else {
    Write-Host "Mosquitto not found. Please install it from https://mosquitto.org/download/."
}

$ExePath = Join-Path $LocalDir "build\$Executable"
if (Test-Path $ExePath) {
    Write-Host "Found $Executable. Executing in test mode..."
    & $ExePath test
} else {
    Write-Host "$Executable not found in $LocalDir\build. Oceanix must be built on a supported (Linux) platform."
    exit 1
}

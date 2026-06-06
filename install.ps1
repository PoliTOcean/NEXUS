# Windows equivalent of install.sh.
# Creates the Python virtualenv, installs backend deps, then builds the frontend.
$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $RootDir

python -m venv venv
& "$RootDir\venv\Scripts\python.exe" -m pip install --no-warn-script-location -r requirements.txt

Set-Location "$RootDir\frontend"
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    if (Get-Command corepack -ErrorAction SilentlyContinue) {
        corepack enable
    } else {
        Write-Error "pnpm is required but was not found. Install pnpm or enable corepack."
        exit 1
    }
}
pnpm install --frozen-lockfile
pnpm build:apps

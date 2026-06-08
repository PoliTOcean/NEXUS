# Windows equivalent of install.sh.
# Creates the Python virtualenv, installs backend deps, then builds the frontend.
$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $RootDir

# Python 3.12 is required: some native dependencies (numpy/contourpy/matplotlib)
# ship Windows wheels only up to 3.12, so 3.13 would force a source build and fail.
# Select 3.12 explicitly through the Python launcher (py) so the version installed
# as default (e.g. 3.13) is not picked up.
# `py` may exist but lack 3.12: a missing launcher throws, while a present
# launcher without 3.12 exits non-zero without throwing. Handle both.
$py312Ok = $false
try {
    & py -3.12 --version | Out-Null
    $py312Ok = ($LASTEXITCODE -eq 0)
} catch {
    $py312Ok = $false
}
if (-not $py312Ok) {
    Write-Error "Python 3.12 not found. Install it from https://www.python.org/downloads/release/python-3128/ (Python 3.13 is not supported because some native dependencies have no 3.13 wheels). It can be installed alongside other versions."
    exit 1
}

py -3.12 -m venv venv
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

# Run from a normal PowerShell terminal. Applies only monthly reporting, no build.
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$docker = Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\resources\bin\docker.exe'
if (!(Test-Path -LiteralPath $docker)) { $docker = 'docker' }
function Invoke-Docker {
    & $docker @args
    if ($LASTEXITCODE -ne 0) { throw "Docker command failed: $($args -join ' ')" }
}
$ids = @(& $docker ps --filter 'publish=8000' --filter 'label=com.docker.compose.service=backend' --format '{{.ID}}')
if ($LASTEXITCODE -ne 0) { throw 'Docker access denied. Run in your normal PowerShell terminal.' }
$ids = @($ids | Where-Object { $_.Trim() })
if ($ids.Count -ne 1) { throw 'Expected one running Compose backend publishing port 8000. No files changed.' }
$backend = $ids[0].Trim()
# The existing live backend has the authenticated daily API; preserve its routes.
$schema = Invoke-RestMethod 'http://localhost:8000/openapi.json' -TimeoutSec 5
if (!$schema.paths.'/api/auth/me'.get -or !$schema.paths.'/api/sync/latest'.get) {
    throw 'This container lacks the existing authenticated API. No container files changed; use this folder backend source for a separate local setup.'
}
$backup = Join-Path $repo ('backups/monthly-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $backup | Out-Null
Invoke-Docker cp "${backend}:/app/app" (Join-Path $backup 'app')
$files = @('models/schemas.py','services/analytics.py','services/comparison.py','api/comparison.py','migrations/v002_monthly_reports.py','migrations/__init__.py','migrate.py')
foreach ($relativeFile in $files) {
    Invoke-Docker cp (Join-Path $repo ('backend/app/' + $relativeFile)) "${backend}:/app/app/$relativeFile"
}
# Extend the container's own main.py instead of overwriting its existing handlers.
$registerCode = @"
from pathlib import Path
p = Path('/app/app/main.py')
s = p.read_text()
if 'from app.api import comparison as monthly_comparison_api' not in s and 'comparison.router' not in s:
    s += '\nfrom app.api import comparison as monthly_comparison_api\napp.include_router(monthly_comparison_api.router, prefix=\"/api/sync\", tags=[\"monthly comparison\"])\n'
    compile(s, str(p), 'exec')
    p.write_text(s)
"@
# File edits need root when Docker cp creates root-owned application files.
# Only this maintenance command is privileged; normal runtime user is unchanged.
Invoke-Docker exec --user 0 $backend python -c $registerCode
Invoke-Docker exec $backend python -m app.migrate
Invoke-Docker restart $backend
$ready = $false
for ($attempt=0; $attempt -lt 20; $attempt++) {
    try {
        $health = Invoke-RestMethod 'http://localhost:8000/health' -TimeoutSec 3
        $schema = Invoke-RestMethod 'http://localhost:8000/openapi.json' -TimeoutSec 3
        if ($health.status -eq 'ok' -and $schema.paths.'/api/sync/compare'.get -and $schema.paths.'/api/sync/monthly'.post) { $ready=$true; break }
    } catch { Start-Sleep -Seconds 1 }
}
if (!$ready) { throw "Activation health check failed. Inspect container logs. Source backup: $backup" }
Write-Host "Monthly comparison activated. No rebuild. Daily routes preserved. Backup: $backup"
Write-Host 'Refresh the currently running frontend. This script does not modify or restart it.'
Write-Host 'Open http://localhost:5173/#monthly and sign in.'



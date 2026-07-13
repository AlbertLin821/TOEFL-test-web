# Start Docker infrastructure + API + Worker + Web in separate windows.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "Starting Docker services..." -ForegroundColor Cyan
docker compose up -d

if (-not (Test-Path "$Root\.env")) {
  Write-Host "Warning: .env not found. Copy .env.example to .env first." -ForegroundColor Yellow
}

Write-Host "Launching API, Worker, and Web..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$Root'; Write-Host 'TOEFL API' -ForegroundColor Blue; pnpm dev:api"
Start-Sleep -Milliseconds 500
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$Root'; Write-Host 'TOEFL Grading Worker' -ForegroundColor Magenta; pnpm dev:worker"
Start-Sleep -Milliseconds 500
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$Root'; Write-Host 'TOEFL Web' -ForegroundColor Green; pnpm dev:web"

Write-Host ""
Write-Host "Done. Open http://localhost:5173 in your browser." -ForegroundColor Green
Write-Host "Mailpit: http://localhost:8025 | MinIO: http://localhost:9001" -ForegroundColor DarkGray

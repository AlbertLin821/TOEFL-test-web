@echo off
cd /d "%~dp0"
echo Starting Docker services...
docker compose up -d
echo.
echo Starting API, Worker, and Web in this window...
echo Web: http://localhost:5173
echo.
pnpm dev
pause

@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 24.x, then reopen this script.
  pause
  exit /b 1
)
node -e "if(process.versions.node.split('.')[0] !== '24'){console.error('Please use Node.js 24.x');process.exit(1)}"
if errorlevel 1 (
  pause
  exit /b 1
)
if not exist node_modules (
  call npm ci
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
call npm run dev
pause

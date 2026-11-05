@echo off
setlocal
cd /d "%~dp0"
node -e "if(process.versions.node.split('.')[0] !== '24'){console.error('Please install Node.js 24.x');process.exit(1)}"
if errorlevel 1 (
  pause
  exit /b 1
)
call npm ci
if errorlevel 1 (
  pause
  exit /b 1
)
echo Installation complete. Run start-windows.bat to open the editor.
pause

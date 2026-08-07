@echo off
echo.
echo 🚀 Starting Absolute Website Dev Server
echo.
echo Killing any existing Node processes...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo.
echo Starting dev server...
npm run dev

echo.
echo ✓ Dev server running on http://localhost:3173
echo.
pause

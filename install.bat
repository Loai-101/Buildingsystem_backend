@echo off
cd /d "%~dp0"
echo Installing backend dependencies...
call npm install
if %ERRORLEVEL% equ 0 (
  echo.
  echo Done. Run the backend with: npm run dev
) else (
  echo npm install failed.
  pause
)

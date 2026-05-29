@echo off
set PATH=C:\Program Files\nodejs;%PATH%
cd /d "C:\Users\user\Desktop\ESP32\marauder-ui"

echo ============================================
echo   Building Marauder UI...
echo ============================================
call npx vite build

echo.
echo ============================================
echo   Starting server on http://localhost:3000
echo   Open in Chrome/Edge
echo ============================================
npx serve dist --port 3000 --no-clipboard
pause

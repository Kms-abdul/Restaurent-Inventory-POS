@echo off
title Restaurant POS - 2nd Floor Cloud Printer Bridge
echo ========================================================
echo   Restaurant POS - Cloud-to-LAN 2nd Floor Printer Bridge
echo   (Relays orders from Ground / 1st Floor to 2nd Floor)
echo ========================================================
cd /d "%~dp0print-agent"

if not exist "node_modules" (
    echo [INFO] First time setup: Installing print bridge dependencies...
    call npm install
)

echo.
echo [STATUS] Cloud Print Bridge is ACTIVE!
echo Orders booked from Ground / 1st Floor phones will print directly
echo to the 2nd Floor Ethernet Printer. Keep this window running!
echo ========================================================
echo.
call npm run dev
pause

@echo off
title Restaurant POS - Silent Printing Launcher
echo =======================================================
echo   Launching Restaurant POS in Silent Printing Mode
echo   (No Print Dialog / Direct Thermal Print to QX300)
echo =======================================================

set POS_URL=http://localhost:3000/staff/pos

:: Check 64-bit Chrome
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk-printing --app="%POS_URL%"
    goto :done
)

:: Check 32-bit Chrome
if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --kiosk-printing --app="%POS_URL%"
    goto :done
)

:: Check Edge if Chrome not found
if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --kiosk-printing --app="%POS_URL%"
    goto :done
)

:: Fallback
start chrome --kiosk-printing --app="%POS_URL%"

:done
echo POS launched successfully!

@echo off
title Chinese Nawab POS - Local Thermal Print Agent
echo ====================================================
echo  Chinese Nawab POS - Local Direct Thermal Print Agent
echo ====================================================
echo  Default Printer: POSIO QX300
echo  Local Direct Bridge: http://127.0.0.1:8080/print
echo  Cloud Queue: Active (Supabase)
echo ----------------------------------------------------
echo  Starting Print Agent...
echo  (Keep this window open during business hours)
echo ====================================================
cd /d "%~dp0print-agent"
:loop
call npm run build && call npm start
echo.
echo  Print agent stopped. Restarting in 5 seconds... (close this window to stop)
timeout /t 5 /nobreak >nul
goto loop


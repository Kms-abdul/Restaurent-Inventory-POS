@echo off
title Chinese Nawab POS - Local Thermal Print Bridge
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0bridge.ps1"
pause


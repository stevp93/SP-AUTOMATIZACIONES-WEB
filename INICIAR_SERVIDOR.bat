@echo off
chcp 65001 >nul
title SP Automatizaciones - Servidor Local
cd /d "%~dp0"

echo ============================================================
echo   SP AUTOMATIZACIONES - Servidor local
echo ============================================================
echo.
echo  Carpeta: %CD%
echo  URL:     http://localhost:8000/sp_automatizaciones.html
echo.
echo  Abriendo navegador...
start "" "http://localhost:8000/sp_automatizaciones.html"

echo.
echo  Iniciando servidor Python en puerto 8000
echo  (Ctrl+C para detener)
echo.

where python >nul 2>nul
if %errorlevel%==0 (
    python -m http.server 8000
    goto :eof
)

where py >nul 2>nul
if %errorlevel%==0 (
    py -m http.server 8000
    goto :eof
)

echo  [ERROR] Python no fue encontrado en PATH.
pause

@echo off
chcp 65001 >nul
title SP Automatizaciones - Servidor Local
cd /d "%~dp0"

echo ============================================================
echo   SP AUTOMATIZACIONES - Servidor local
echo ============================================================
echo.
echo  Carpeta: %CD%
echo  URL:     http://localhost:8000/index.html
echo.
echo  Paginas: index.html / servicios.html / casos.html
echo           nosotros.html / contacto.html
echo.
echo  Abriendo navegador...
start "" "http://localhost:8000/index.html"

echo.
echo  Iniciando servidor Python en puerto 8000
rem  Tipos MIME forzados: Windows a veces sirve .js como text/plain y el
rem  navegador se niega a cargarlo como modulo (el 3D no apareceria).
echo  (Ctrl+C para detener)
echo.

where python >nul 2>nul
if %errorlevel%==0 (
    python -c "import mimetypes,http.server as h; mimetypes.add_type('text/javascript','.js'); mimetypes.add_type('font/woff2','.woff2'); mimetypes.add_type('application/manifest+json','.webmanifest'); h.test(HandlerClass=h.SimpleHTTPRequestHandler, port=8000)"
    goto :eof
)

where py >nul 2>nul
if %errorlevel%==0 (
    py -c "import mimetypes,http.server as h; mimetypes.add_type('text/javascript','.js'); mimetypes.add_type('font/woff2','.woff2'); mimetypes.add_type('application/manifest+json','.webmanifest'); h.test(HandlerClass=h.SimpleHTTPRequestHandler, port=8000)"
    goto :eof
)

echo  [ERROR] Python no fue encontrado en PATH.
pause

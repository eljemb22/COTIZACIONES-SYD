@echo off
title Generador de Instalador Windows - SYD Colombia
color 0B
cls
echo ================================================================
echo      GENERADOR DE INSTALADOR OFICIAL SYD COLOMBIA (WINDOWS)
echo ================================================================
echo.
echo 1. Verificando dependencias...

call npm install electron electron-builder electron-packager --save-dev

echo.
echo 2. Empaquetando la aplicacion para Windows 64-bit...
call npx electron-packager . "SYD Colombia" --platform=win32 --arch=x64 --out=instalador-windows --overwrite --prune=true

echo.
echo ================================================================
echo   LISTO: Tu nuevo programa esta en la carpeta:
echo   instalador-windows\SYD Colombia-win32-x64\SYD Colombia.exe
echo ================================================================
pause

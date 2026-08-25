@echo off
title SYD Colombia - Instalador de Acceso Directo
color 0A
cls

echo ================================================================
echo         INSTALADOR DE ACCESO DIRECTO - SYD COLOMBIA
echo ================================================================
echo.
echo Creando acceso directo en el Escritorio de Windows...
echo.

set PRIMARY_URL=https://ais-dev-2plx7bzxumro3jeiuifpc3-795278050657.us-east1.run.app
set VBS_SCRIPT="%TEMP%\create_syd_desktop_shortcut.vbs"

echo Set oWS = WScript.CreateObject("WScript.Shell") > %VBS_SCRIPT%
echo sLinkFile = oWS.SpecialFolders("Desktop") ^& "\SYD Colombia.lnk" >> %VBS_SCRIPT%
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> %VBS_SCRIPT%
echo Dim edgePath, chromePath, targetExe, targetArgs >> %VBS_SCRIPT%
echo Dim fso >> %VBS_SCRIPT%
echo Set fso = CreateObject("Scripting.FileSystemObject") >> %VBS_SCRIPT%
echo edgePath = oWS.ExpandEnvironmentStrings("%%ProgramFiles(x86)%%\Microsoft\Edge\Application\msedge.exe") >> %VBS_SCRIPT%
echo If Not fso.FileExists(edgePath) Then >> %VBS_SCRIPT%
echo   edgePath = oWS.ExpandEnvironmentStrings("%%ProgramFiles%%\Microsoft\Edge\Application\msedge.exe") >> %VBS_SCRIPT%
echo End If >> %VBS_SCRIPT%
echo chromePath = oWS.ExpandEnvironmentStrings("%%ProgramFiles%%\Google\Chrome\Application\chrome.exe") >> %VBS_SCRIPT%
echo If Not fso.FileExists(chromePath) Then >> %VBS_SCRIPT%
echo   chromePath = oWS.ExpandEnvironmentStrings("%%ProgramFiles(x86)%%\Google\Chrome\Application\chrome.exe") >> %VBS_SCRIPT%
echo End If >> %VBS_SCRIPT%
echo If fso.FileExists(edgePath) Then >> %VBS_SCRIPT%
echo   oLink.TargetPath = edgePath >> %VBS_SCRIPT%
echo   oLink.Arguments = "--app=""%PRIMARY_URL%"" --window-size=1440,920" >> %VBS_SCRIPT%
echo ElseIf fso.FileExists(chromePath) Then >> %VBS_SCRIPT%
echo   oLink.TargetPath = chromePath >> %VBS_SCRIPT%
echo   oLink.Arguments = "--app=""%PRIMARY_URL%"" --window-size=1440,920" >> %VBS_SCRIPT%
echo Else >> %VBS_SCRIPT%
echo   oLink.TargetPath = "%PRIMARY_URL%" >> %VBS_SCRIPT%
echo End If >> %VBS_SCRIPT%
echo oLink.Description = "SYD Colombia - Software de Cotizaciones y Licitaciones" >> %VBS_SCRIPT%
echo oLink.Save >> %VBS_SCRIPT%

cscript //nologo %VBS_SCRIPT%
if exist %VBS_SCRIPT% del %VBS_SCRIPT%

echo.
echo ================================================================
echo   [EXITO] ACCESO DIRECTO CREADO CORRECTAMENTE EN EL ESCRITORIO
echo.
echo   - Busca el icono "SYD Colombia" en tu Escritorio.
echo   - Al hacer doble clic se abrira en una ventana independiente.
echo   - Todos los datos que ingreses o elimines se sincronizan
echo     automaticamente en tiempo real con la nube.
echo ================================================================
echo.
pause

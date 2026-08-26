@echo off
chcp 936 >nul
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 goto :no_node

if not exist "node_modules\" goto :need_install
goto :start_server

:need_install
echo [INFO] First run: installing dependencies...
call npm install
if errorlevel 1 goto :install_fail
goto :start_server

:no_node
echo [ERROR] Node.js not found.
echo Install from: https://nodejs.org/
pause
exit /b 1

:install_fail
echo [ERROR] npm install failed.
pause
exit /b 1

:start_server
echo [INFO] Starting dev server...
echo Browser will open shortly: http://localhost:5173
echo Close this window to stop the server.
echo.
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:5173/"
call npm run dev
pause
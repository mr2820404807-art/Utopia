@echo off
rem Utopia local launcher - starts a tiny http server and opens the game
rem (ES modules cannot load over file:// in Chrome/Edge, http is required)
cd /d "%~dp0"
echo Starting Utopia local server on http://127.0.0.1:8792 ...
start "Utopia-Server" /min cmd /c "python -m http.server 8792"
timeout /t 1 /nobreak >nul
start "" "http://127.0.0.1:8792/index.html"
echo.
echo Game opened in your browser. Keep the minimized server window running.
echo To quit: close the "Utopia-Server" window in taskbar.
pause

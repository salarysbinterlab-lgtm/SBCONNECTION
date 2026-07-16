@echo off
echo SB Connect Stable Clean Run
cd /d D:\Projectsbconnect_app
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del /f /q package-lock.json
npm install
npm run dev
pause

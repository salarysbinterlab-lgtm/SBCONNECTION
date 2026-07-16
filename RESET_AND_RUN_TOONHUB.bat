@echo off
echo ================================================
echo SB Connect TOONHUB clean install and run
echo ================================================
cd /d D:\Projectsbconnect_app
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del /f /q package-lock.json
if exist postcss.config.cjs del /f /q postcss.config.cjs
echo Installing pinned Vite 5 + Tailwind 3 dependencies...
npm install
echo Starting dev server...
npm run dev
pause

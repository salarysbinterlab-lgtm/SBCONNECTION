@echo off
echo Removing Visual Low-code Editor files that caused blank page...
cd /d D:\Projectsbconnect_app
if exist public\app\assets\dev\devVisualEditor.js del /f /q public\app\assets\dev\devVisualEditor.js
if exist public\app\assets\dev\devVisualEditor.css del /f /q public\app\assets\dev\devVisualEditor.css
if exist public\app\assets\dev\visual-editor-state.json del /f /q public\app\assets\dev\visual-editor-state.json
if exist public\app\assets\dev\visual-overrides.css del /f /q public\app\assets\dev\visual-overrides.css
if exist dev-preview.html del /f /q dev-preview.html
if exist dev-editor rmdir /s /q dev-editor
npm run dev
pause

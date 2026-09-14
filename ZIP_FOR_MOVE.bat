@echo off
setlocal enabledelayedexpansion

REM ============================================================
REM  SB Connect - zip the project into one file to take home
REM  Skips node_modules and other rebuildable folders.
REM  Keeps .git (history) and .env (connection settings).
REM  ASCII only on purpose. Thai text breaks cmd.exe batch parsing.
REM ============================================================

cd /d "%~dp0"

set "SRC=%CD%"
set "STAGE=%TEMP%\sbconnect_pack"
set "OUT=%USERPROFILE%\Desktop\sbconnect_move.zip"

echo.
echo ============================================================
echo  SB Connect - Zip for move
echo ============================================================
echo.
echo  Source   : %SRC%
echo  Zip file : %OUT%
echo.
echo  Excluded : node_modules, dist, .wrangler, .wrangler-config, outputs
echo  Included : .git (history), .env (connection settings), sql, src, docs, apps_script
echo.

set "ANS="
set /p ANS=Type YES then Enter to start:
if /i not "%ANS%"=="YES" (
  echo Cancelled.
  goto :end
)

echo.
echo [1/4] Preparing temp folder ...
if exist "%STAGE%" rmdir /s /q "%STAGE%"
mkdir "%STAGE%" 2>nul

echo [2/4] Copying files (skipping rebuildable stuff) ...
robocopy "%SRC%" "%STAGE%" /E /R:1 /W:1 /NFL /NDL /NJH /NJS ^
  /XD node_modules dist .wrangler .wrangler-config outputs ^
  /XF vite-dev.log vite-dev.err.log "vite.config.ts.timestamp-*.mjs" >nul

if %ERRORLEVEL% GEQ 8 (
  echo.
  echo  Copy failed. robocopy returned %ERRORLEVEL%
  goto :cleanup
)

REM .git is a hidden folder. Unhide it or some machines drop it when zipping.
if exist "%STAGE%\.git" attrib -h "%STAGE%\.git" >nul 2>&1

echo [3/4] Creating the zip ...
if exist "%OUT%" del /q "%OUT%"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Compress-Archive -Path '%STAGE%\*' -DestinationPath '%OUT%' -CompressionLevel Optimal -Force"

if not exist "%OUT%" (
  echo.
  echo  Zip failed. Fallback command:
  echo    tar -a -c -f "%OUT%" -C "%TEMP%" sbconnect_pack
  goto :cleanup
)

echo [4/4] Cleaning up ...

:cleanup
if exist "%STAGE%" rmdir /s /q "%STAGE%"

echo.
if exist "%OUT%" (
  for %%A in ("%OUT%") do set SIZE=%%~zA
  set /a SIZEMB=!SIZE! / 1048576
  echo ============================================================
  echo  Done
  echo ============================================================
  echo.
  echo  File : %OUT%
  echo  Size : !SIZEMB! MB
  echo.
  echo  At home:
  echo    1. Extract the zip to D: so you get D:\Projectsbconnect_app
  echo    2. Install Node.js LTS 22.x and Git, then close and reopen cmd
  echo    3. cd /d D:\Projectsbconnect_app
  echo    4. APPLY_CHANGES.bat     (type YES)
  echo    5. npm install
  echo    6. npm run check
  echo    7. npm run dev
  echo.
  echo  Note: the zip contains .env with your Supabase settings.
  echo        Do not send this file outside the company.
)

:end
echo.
pause
endlocal

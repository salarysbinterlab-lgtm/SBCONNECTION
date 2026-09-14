@echo off
setlocal

REM ============================================================
REM  SB Connect - copy the project to another machine (USB / external drive)
REM  Skips folders that can be rebuilt, so the copy is fast and clean.
REM  ASCII only on purpose. Thai text breaks cmd.exe batch parsing.
REM ============================================================

cd /d "%~dp0"

echo.
echo ============================================================
echo  SB Connect - Pack for move
echo  Source: %CD%
echo ============================================================
echo.
echo Copies everything EXCEPT
echo   node_modules\      (run npm install on the target machine)
echo   dist\              (rebuild with npm run build)
echo   .wrangler\         (Cloudflare cache)
echo   .wrangler-config\  (cache)
echo   outputs\           (temporary output files)
echo.
echo Included: .git (history), .env (connection settings), sql, src, docs, apps_script
echo.

set "DEST="
set /p DEST=Destination, for example E:\sbconnect, then Enter:

if "%DEST%"=="" (
  echo No destination given. Cancelled.
  goto :end
)

echo.
echo Copying to "%DEST%" ...
echo.

robocopy "%CD%" "%DEST%" /E /R:1 /W:1 /NFL /NDL /NJH ^
  /XD node_modules dist .wrangler .wrangler-config outputs ^
  /XF vite-dev.log vite-dev.err.log "vite.config.ts.timestamp-*.mjs"

set RC=%ERRORLEVEL%
echo.
if %RC% GEQ 8 (
  echo ============================================================
  echo  Copy failed. robocopy returned %RC%
  echo  Check free space on the target drive and write protection.
  echo ============================================================
  goto :end
)

echo ============================================================
echo  Copy finished
echo ============================================================
echo.

if exist "%DEST%\.env" (
  echo   [OK] .env came along
) else (
  echo   [!!] .env missing at destination. Create it on the new machine:
  echo        copy .env.example to .env and fill in the 3 real values.
)

if exist "%DEST%\.git" (
  echo   [OK] git history came along
) else (
  echo   [!!] .git missing at destination. No history and no branches there.
)

echo.
echo On the target machine:
echo   1. Install Node.js LTS 22.x from https://nodejs.org  (npm is included)
echo   2. Install Git from https://git-scm.com
echo   3. Open cmd:  cd /d "project folder"
echo   4. npm install
echo   5. npm run check
echo   6. npm run dev      then open http://127.0.0.1:5175/
echo.

:end
pause
endlocal

@echo off
setlocal

REM ============================================================
REM  SB Connect - safe push
REM  Runs the checks first, refuses to push if anything fails.
REM  ASCII only on purpose. Thai text breaks cmd.exe batch parsing.
REM ============================================================

cd /d "%~dp0"

echo.
echo ============================================================
echo  SB Connect - Push to GitHub
echo ============================================================
echo.

for /f "delims=" %%B in ('git rev-parse --abbrev-ref HEAD') do set "BRANCH=%%B"
echo  Current branch : %BRANCH%
echo.
if /i not "%BRANCH%"=="main" (
  echo  NOTE: Cloudflare auto-deploy only runs on branch "main".
  echo        Pushing "%BRANCH%" will NOT put the app online.
  echo.
)

echo [1/7] git status
git status --short
echo.

echo [2/7] Checking that .env is ignored ...
git check-ignore -v .env
if errorlevel 1 (
  echo.
  echo  STOP. .env is NOT ignored by git. It must never be committed.
  echo  Fix .gitignore first.
  goto :fail
)
echo    OK    .env is ignored
echo.

echo [3/7] npm run check ...
call npm run check
if errorlevel 1 (
  echo.
  echo  STOP. npm run check failed. Fix the errors, then run this again.
  goto :fail
)
echo    OK    all checks passed
echo.

echo [4/7] Staging and committing ...
git add -A
git status --short
echo.
set "MSG="
set /p MSG=Commit message (Enter for the default):
if "%MSG%"=="" set "MSG=security: lockdown anon grants, shared first-login password, forgot-password flow, admin audit log"
git commit -m "%MSG%"
if errorlevel 1 (
  echo    Nothing to commit, continuing to push.
)
echo.

echo [5/7] Pushing ...
git push -u origin %BRANCH%
if errorlevel 1 goto :fail

echo.
echo [6/7] Backing up to Google Drive ...
if exist "%~dp0BACKUP_TO_GDRIVE.bat" (
  call "%~dp0BACKUP_TO_GDRIVE.bat" /yes < nul
  if errorlevel 1 (
    echo    WARN  Drive backup did not finish. The push itself is fine.
    echo          Run BACKUP_TO_GDRIVE.bat by hand to see why.
  ) else (
    echo    OK    code copied to Google Drive ^(sql and apps_script stay here^)
  )
) else (
  echo    SKIP  BACKUP_TO_GDRIVE.bat not found
)
echo.

echo [7/7] Backing up to the company server ...
if exist "%~dp0BACKUP_TO_SERVER.bat" (
  call "%~dp0BACKUP_TO_SERVER.bat" /yes < nul
  if errorlevel 1 (
    echo    WARN  server backup did not finish. The push itself is fine.
    echo          Usually this means you are off the office network.
    echo          Run BACKUP_TO_SERVER.bat by hand when you are back on it.
  ) else (
    echo    OK    complete copy on the server, sql and apps_script included
  )
) else (
  echo    SKIP  BACKUP_TO_SERVER.bat not found
)
echo.

echo.
echo ============================================================
echo  Pushed
echo ============================================================
echo.
echo  Watch the build here: GitHub repo -^> Actions -^> Deploy Cloudflare
echo.
echo  The build FAILS unless these are set in the GitHub repo:
echo    Settings -^> Secrets and variables -^> Actions -^> Variables
echo      VITE_SUPABASE_URL
echo      VITE_SUPABASE_ANON_KEY
echo      VITE_DRIVE_UPLOAD_ENDPOINT
echo    Settings -^> Secrets and variables -^> Actions -^> Secrets
echo      CLOUDFLARE_API_TOKEN
echo      CLOUDFLARE_ACCOUNT_ID
echo.
goto :end

:fail
echo.
echo ============================================================
echo  Stopped. Nothing was pushed.
echo ============================================================

:end
echo.
pause
endlocal

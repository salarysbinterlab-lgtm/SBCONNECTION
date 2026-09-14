@echo off
setlocal

REM ============================================================
REM  SB Connect - throw away ALL git history and push one clean commit
REM
REM  WHY: the employee data and the shared password are inside OLD commits.
REM       Deleting the files in a NEW commit does not remove them - anyone
REM       can still open the old commit and read everything.
REM       The only fix is to replace the history entirely.
REM
REM  DESTRUCTIVE: every past commit in this repo is gone afterwards.
REM               Your working files are NOT touched.
REM
REM  DO THIS FIRST, in the browser:
REM    1. GitHub repo -> Settings -> Danger Zone -> Change visibility
REM       -> make it PRIVATE.  This stops the bleeding in 30 seconds.
REM    2. Only after that, run this file.
REM
REM  IMPORTANT: force-pushing hides the old commits but GitHub can still
REM  serve them by their commit SHA for a while, and any fork keeps them.
REM  If the repo was public with real employee data, the safest move is to
REM  DELETE the repository on GitHub and create a new PRIVATE one with the
REM  same name, then run this file to push the clean history into it.
REM
REM  ASCII only on purpose. Thai text breaks cmd.exe batch parsing.
REM ============================================================

cd /d "%~dp0"

if not exist ".git" (
  echo No .git folder here. Run this from the project folder.
  goto :end
)

echo.
echo ============================================================
echo  Replace git history with one clean commit
echo ============================================================
echo.
git remote -v
echo.
echo  Every past commit will be gone. Your files stay.
echo  Make the repo PRIVATE (or delete + recreate it) BEFORE running this.
echo.

set "ANS="
set /p ANS=Type DELETE-HISTORY then Enter:
if /i not "%ANS%"=="DELETE-HISTORY" (
  echo Cancelled. Nothing changed.
  goto :end
)

echo.
echo [1/6] Checking that sensitive paths are ignored ...
git check-ignore -q sql && echo    OK    sql\ is ignored || (echo    STOP  sql\ is NOT ignored. Fix .gitignore first. & goto :fail)
git check-ignore -q app && echo    OK    app\ is ignored || echo    note  app\ not present or not ignored
git check-ignore -q .env && echo    OK    .env is ignored || (echo    STOP  .env is NOT ignored. & goto :fail)

echo.
echo [2/6] npm run check ...
call npm run check
if errorlevel 1 (
  echo    STOP  checks failed. Fix them first.
  goto :fail
)

echo.
echo [3/6] Creating a fresh branch with no parents ...
git checkout --orphan clean-main
if errorlevel 1 goto :fail

echo.
echo [4/6] Staging the current files ...
git add -A
git status --short
echo.
echo    ^^^ read that list. If you see sql/ or app/ or .env, press Ctrl+C NOW.
echo.
set "ANS2="
set /p ANS2=List looks clean? Type YES then Enter:
if /i not "%ANS2%"=="YES" (
  echo Cancelled. Returning to your previous branch.
  git checkout -f main
  git branch -D clean-main
  goto :fail
)

git commit -m "SB Connect production release (history reset: employee data and credentials removed)"
if errorlevel 1 goto :fail

echo.
echo [5/6] Making it the new main ...
git branch -D main
git branch -m main

echo.
echo [6/6] Force pushing ...
git push -f origin main
if errorlevel 1 goto :fail

echo.
echo ============================================================
echo  Done. The remote now has ONE commit and no employee data.
echo ============================================================
echo.
echo  Still to do, in this order:
echo    1. Supabase: change the shared first-login password and close the
echo       first-login window, or anyone who read the old repo can log in
echo       as any employee who has not set their own password yet.
echo    2. Supabase: rotate the anon / publishable key, then update .env
echo       and the GitHub repository Variables to the new value.
echo    3. Check Supabase logs for requests you do not recognise.
echo    4. Keep the repo PRIVATE.
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

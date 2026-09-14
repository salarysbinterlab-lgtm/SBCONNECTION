@echo off
setlocal

REM ============================================================
REM  SB Connect - stop tracking the files that must never be on GitHub
REM
REM  Removes them from git's index ONLY. Your local files are NOT deleted.
REM  This does NOT erase them from past commits - history still has them.
REM  See CLEAN_PUSH_NEW_HISTORY.bat for that.
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
echo  Untrack sensitive files
echo ============================================================
echo.
echo  Will stop tracking (files stay on your disk):
echo    sql\                311 employee emails + names + the shared password
echo    app\                old app with Supabase URL and anon key inside
echo    public\app\
echo    _env_to_apply.txt
echo    docs\*.docx  docs\*.pdf
echo.
echo  .gitignore has already been updated to keep them out from now on.
echo.

set "ANS="
set /p ANS=Type YES then Enter:
if /i not "%ANS%"=="YES" (
  echo Cancelled.
  goto :end
)

echo.
echo Removing from the git index ...
git rm -r --cached --ignore-unmatch sql               >nul 2>&1 && echo    sql\
git rm -r --cached --ignore-unmatch app               >nul 2>&1 && echo    app\
git rm -r --cached --ignore-unmatch public/app        >nul 2>&1 && echo    public\app\
git rm    --cached --ignore-unmatch _env_to_apply.txt >nul 2>&1 && echo    _env_to_apply.txt
git rm    --cached --ignore-unmatch docs/*.docx       >nul 2>&1 && echo    docs\*.docx
git rm    --cached --ignore-unmatch docs/*.pdf        >nul 2>&1 && echo    docs\*.pdf

echo.
echo Files still on disk? (should all say EXISTS)
if exist "sql\22_NEWS_DAILY_OTP_AND_FAILPATH_FIXES.sql" (echo    EXISTS  sql\) else (echo    MISSING sql\  ^<-- STOP, restore from backup)
if exist "docs\RUNBOOK.md"                              (echo    EXISTS  docs\) else (echo    MISSING docs\)

echo.
echo What git will commit now:
git status --short
echo.
echo ============================================================
echo  Next: run CLEAN_PUSH_NEW_HISTORY.bat
echo        (a normal commit+push would still leave the old
echo         commits, and the leaked data lives in those)
echo ============================================================

:end
echo.
pause
endlocal

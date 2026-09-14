@echo off
setlocal

REM ============================================================
REM  SB Connect - tidy the sql folder
REM  Nothing is deleted. Files are moved to sql\_unused and sql\_dev_only
REM  Delete those two folders yourself later if you want them gone.
REM  ASCII only on purpose. Thai text breaks cmd.exe batch parsing.
REM ============================================================

cd /d "%~dp0"

if not exist "sql" (
  echo sql folder not found. Run this file from the project folder.
  goto :end
)

echo.
echo ============================================================
echo  Tidy the sql folder
echo ============================================================
echo.
echo  Move to sql\_unused (superseded)
echo    12_ADMIN_BOOTSTRAP_DEV.sql                      old test admin, replaced by 21_
echo    94_EMP_ID_FIRST_LOGIN_PASSWORD.sql              password = emp_id, guessable
echo    93_OPTIONAL_RESET_PASSWORD_FIRST_LOGIN_MODE.sql wipes credentials, dangerous
echo    sbconnect_FINAL_all_in_one.sql                  old bundle, replaced by sql\setup\
echo.
echo  Move to sql\_dev_only (testing only, never run on production)
echo    00_FULL_RESET_PUBLIC_SCHEMA_DEV_ONLY.sql        drops the whole schema
echo    98_CLEAR_DATA_ONLY.sql                          wipes data
echo    99_drop_all_dev_only.sql                        drops tables
echo.
echo  What stays: the 20 real migration files + the setup\ folder
echo.

set "ANS="
set /p ANS=Type YES then Enter to tidy up:
if /i not "%ANS%"=="YES" (
  echo Cancelled. Nothing moved.
  goto :end
)

if not exist "sql\_unused"   mkdir "sql\_unused"
if not exist "sql\_dev_only" mkdir "sql\_dev_only"

echo.
echo Moving superseded files ...
for %%F in (
  "12_ADMIN_BOOTSTRAP_DEV.sql"
  "93_OPTIONAL_RESET_PASSWORD_FIRST_LOGIN_MODE.sql"
  "94_EMP_ID_FIRST_LOGIN_PASSWORD.sql"
  "sbconnect_FINAL_all_in_one.sql"
) do (
  if exist "sql\%%~F" ( move /y "sql\%%~F" "sql\_unused\" >nul && echo    MOVED  %%~F )
)

echo.
echo Moving DEV-only files ...
for %%F in (
  "00_FULL_RESET_PUBLIC_SCHEMA_DEV_ONLY.sql"
  "98_CLEAR_DATA_ONLY.sql"
  "99_drop_all_dev_only.sql"
) do (
  if exist "sql\%%~F" ( move /y "sql\%%~F" "sql\_dev_only\" >nul && echo    MOVED  %%~F )
)

if exist "scripts\generate-sql-bundle.mjs" (
  if not exist "scripts\_unused" mkdir "scripts\_unused"
  move /y "scripts\generate-sql-bundle.mjs" "scripts\_unused\" >nul && echo    MOVED  scripts\generate-sql-bundle.mjs
)

echo.
echo ============================================================
echo  Done - files left in sql\
echo ============================================================
dir /b "sql\*.sql"
echo.
echo  sql\setup\ holds the files you paste into Supabase:
dir /b "sql\setup" 2>nul
echo.
echo  Run order: SETUP_1 -^> SETUP_2 -^> SETUP_3, then sql\18_VERIFY_SECURITY.sql
echo.

:end
pause
endlocal

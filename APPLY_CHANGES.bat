@echo off
setlocal

REM ============================================================
REM  SB Connect - Apply Changes
REM  Does the things remote tools cannot do:
REM    create .env, copy workflows, delete legacy folders
REM  ASCII only on purpose. Thai text breaks cmd.exe batch parsing.
REM  Run from the project folder:  APPLY_CHANGES.bat
REM ============================================================

cd /d "%~dp0"

echo.
echo ============================================================
echo  SB Connect - Apply Changes
echo  Folder: %CD%
echo ============================================================
echo.
echo This script will:
echo   1. Create .env from _env_to_apply.txt
echo   2. Copy new workflows into .github\workflows
echo   3. Delete legacy folders: app, public\app, dist
echo   4. Delete leftover dev tools and old .bat files
echo.
echo Everything is in git already. Restore with:  git checkout -- .
echo.
set "CONFIRM="
set /p CONFIRM=Type YES then Enter to continue:
if /i not "%CONFIRM%"=="YES" (
  echo Cancelled. Nothing changed.
  goto :end
)

echo.
echo [1/4] Creating .env ...
if exist ".env" (
  echo    SKIP  .env already exists, not overwriting
) else (
  if exist "_env_to_apply.txt" (
    copy /y "_env_to_apply.txt" ".env" >nul && echo    OK    .env created
  ) else (
    echo    WARN  _env_to_apply.txt not found, create .env manually
  )
)
if exist "_env_to_apply.txt" ( del /q "_env_to_apply.txt" )

echo.
echo [2/4] Copying workflows ...
if exist "_workflows_to_apply\deploy-cloudflare.yml" (
  if not exist ".github\workflows" mkdir ".github\workflows"
  copy /y "_workflows_to_apply\deploy-cloudflare.yml"   ".github\workflows\deploy-cloudflare.yml"   >nul && echo    OK    deploy-cloudflare.yml
  copy /y "_workflows_to_apply\deploy-github-pages.yml" ".github\workflows\deploy-github-pages.yml" >nul && echo    OK    deploy-github-pages.yml
  rmdir /s /q "_workflows_to_apply"
) else (
  echo    SKIP  _workflows_to_apply not found, probably already copied
)

echo.
echo [3/4] Deleting legacy folders ...
if exist "app"        ( rmdir /s /q "app"        && echo    DEL   app\ )
if exist "public\app" ( rmdir /s /q "public\app" && echo    DEL   public\app\ )
if exist "dist"       ( rmdir /s /q "dist"       && echo    DEL   dist\ )

echo.
echo [4/4] Deleting dev leftovers ...
for %%F in (
  "dev-preview.html"
  "DEV_EDITOR_RUN.bat"
  "REMOVE_VISUAL_EDITOR_AND_RUN.bat"
  "RESET_AND_RUN_TOONHUB.bat"
  "RUN_STABLE_CLEAN.bat"
  "BUILD_GITHUB.bat"
  "vite-dev.log"
  "vite-dev.err.log"
  "README_FIX_PUBLIC_SCRIPT.md"
  "README_PATCH.md"
  "README_STABLE_CLEAN.md"
) do ( if exist %%F ( del /q %%F && echo    DEL   %%F ) )

for %%F in ("vite.config.ts.timestamp-*.mjs") do ( if exist %%F ( del /q %%F && echo    DEL   %%F ) )

if exist "dev-editor" ( rmdir /s /q "dev-editor" && echo    DEL   dev-editor\ )
if exist "src\dev"    ( rmdir /s /q "src\dev"    && echo    DEL   src\dev\ )

echo.
echo ============================================================
echo  Done
echo ============================================================
echo.
echo Next steps:
echo   1. Open .env and check VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
echo      They must match the Supabase project you actually run the SQL on.
echo   2. npm install
echo   3. npm run check          (must pass)
echo   4. In Supabase SQL Editor run, in this order:
echo        sql\setup\SETUP_1_SCHEMA.sql
echo        sql\setup\SETUP_2_EMPLOYEES.sql
echo        sql\setup\SETUP_3_SECURITY.sql
echo        sql\18_VERIFY_SECURITY.sql     (all checks must return 0 rows)
echo   5. Set Variables / Secrets in GitHub
echo   6. git push
echo.

:end
pause
endlocal

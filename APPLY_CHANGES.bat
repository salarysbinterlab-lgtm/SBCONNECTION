@echo off
chcp 65001 >nul
setlocal

REM ============================================================
REM  SB Connect - สคริปต์เก็บกวาดหลังแก้ security
REM  ทำเฉพาะสิ่งที่เครื่องมือระยะไกลทำให้ไม่ได้ (ก๊อป workflow + ลบไฟล์)
REM  รันจากโฟลเดอร์โปรเจกต์:  APPLY_CHANGES.bat
REM ============================================================

cd /d "%~dp0"

echo.
echo ============================================================
echo  SB Connect - Apply Changes
echo  โฟลเดอร์: %CD%
echo ============================================================
echo.
echo สคริปต์นี้จะ:
echo   1. สร้างไฟล์ .env จาก _env_to_apply.txt
echo   2. ก๊อป workflow ใหม่เข้า .github\workflows
echo   3. ลบโฟลเดอร์ legacy: app, public\app, dist
echo   4. ลบเศษเครื่องมือ dev และไฟล์ .bat เก่า
echo.
echo ไฟล์ทั้งหมดอยู่ใน git อยู่แล้ว กู้คืนได้ด้วย  git checkout -- .
echo.
set /p CONFIRM=พิมพ์ YES แล้วกด Enter เพื่อดำเนินการต่อ:
if /i not "%CONFIRM%"=="YES" (
  echo ยกเลิก ไม่มีอะไรถูกเปลี่ยน
  goto :end
)

echo.
echo [1/4] สร้างไฟล์ .env...
if exist ".env" (
  echo    ข้าม มี .env อยู่แล้ว ไม่เขียนทับ
) else (
  if exist "_env_to_apply.txt" (
    copy /y "_env_to_apply.txt" ".env" >nul && echo    OK  สร้าง .env แล้ว
  ) else (
    echo    เตือน ไม่พบ _env_to_apply.txt ต้องสร้าง .env เอง
  )
)
if exist "_env_to_apply.txt" ( del /q "_env_to_apply.txt" )

echo.
echo [2/4] ก๊อป workflow...
if exist "_workflows_to_apply\deploy-cloudflare.yml" (
  copy /y "_workflows_to_apply\deploy-cloudflare.yml"   ".github\workflows\deploy-cloudflare.yml"   >nul && echo    OK  deploy-cloudflare.yml
  copy /y "_workflows_to_apply\deploy-github-pages.yml" ".github\workflows\deploy-github-pages.yml" >nul && echo    OK  deploy-github-pages.yml
  rmdir /s /q "_workflows_to_apply"
) else (
  echo    ข้าม ไม่พบ _workflows_to_apply (อาจก๊อปไปแล้ว)
)

echo.
echo [3/4] ลบโฟลเดอร์ legacy...
if exist "app"        ( rmdir /s /q "app"        && echo    ลบแล้ว  app\ )
if exist "public\app" ( rmdir /s /q "public\app" && echo    ลบแล้ว  public\app\ )
if exist "dist"       ( rmdir /s /q "dist"       && echo    ลบแล้ว  dist\ )

echo.
echo [4/4] ลบเศษเครื่องมือ dev...
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
) do ( if exist %%F ( del /q %%F && echo    ลบแล้ว  %%F ) )

for %%F in ("vite.config.ts.timestamp-*.mjs") do ( if exist %%F ( del /q %%F && echo    ลบแล้ว  %%F ) )

if exist "dev-editor" ( rmdir /s /q "dev-editor" && echo    ลบแล้ว  dev-editor\ )
if exist "src\dev"    ( rmdir /s /q "src\dev"    && echo    ลบแล้ว  src\dev\ )

echo.
echo ============================================================
echo  เสร็จแล้ว
echo ============================================================
echo.
echo ขั้นต่อไป:
echo   1. npm run check          (ต้องผ่านทั้งหมด)
echo   2. รัน sql\17_ แล้ว sql\19_ แล้วตรวจด้วย sql\18_ ใน Supabase
echo   3. ตั้ง Variables/Secrets ใน GitHub
echo   4. ค่อย git push
echo.

:end
pause
endlocal

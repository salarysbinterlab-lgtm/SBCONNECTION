cd /d D:\Projectsbconnect_app

REM --- 1. สำรองไว้ก่อน ---
git status
git checkout -b security-hardening-2026-08

REM --- 2. เก็บกวาด + สร้าง .env + ก๊อป workflow (พิมพ์ YES ตอนถาม) ---
APPLY_CHANGES.bat

REM --- 3. ติดตั้งและตรวจ ต้องผ่านทั้งหมด ---
npm install
npm run check

REM --- 4. เช็คว่า .env ไม่ติดไปด้วย (ต้องมีข้อความตอบกลับมา) ---
git check-ignore -v .env

REM --- 5. commit ---
git add -A
git status
git commit -m "security: lockdown anon grants, shared first-login password, forgot-password flow"

REM --- 6. push ---
git push -u origin security-hardening-2026-08
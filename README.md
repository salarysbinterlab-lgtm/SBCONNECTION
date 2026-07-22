# SB Connect TOONHUB Login Full Assets Final

ชุดนี้คือ full package:
- หน้าแรก TOONHUB React/Vite/Tailwind
- Login อยู่หน้าแรก
- รูปหมุนเองทุก 3 วิ
- assets/js legacy + Supabase modules ครบ
- assets/css legacy ครบ
- pages HTML legacy ครบ
- sql final ครบ
- Apps Script Drive upload ถ้ามีในฐานก่อนหน้า

## ใช้งาน

1. ติดตั้ง dependencies ด้วย `npm install`
2. ตรวจ config ที่ `public/app/assets/js/sbConfig.js` ซึ่งเป็น source of truth สำหรับไฟล์ที่ deploy
3. รัน `npm run check`
4. เปิด dev server ด้วย `npm run dev`

สำหรับทดสอบ UI ด้วยข้อมูลจำลองบนเครื่องเท่านั้น เปิด `http://127.0.0.1:5175/?mock=1`
โหมดนี้ทำงานเฉพาะ Vite development บน `localhost`/`127.0.0.1` และไม่ถูกเปิดใน production build

หรือ:

```bat
cd /d D:\Projectsbconnect_app
rmdir /s /q node_modules
del package-lock.json
npm install
npm run dev
```

เปิด:

```text
http://127.0.0.1:5173/
```

## Login

บัญชีใหม่ต้องถูกสร้างพร้อมรหัสผ่านชั่วคราวโดย Admin หรือ trusted provisioning job และระบบจะบังคับเปลี่ยนรหัสผ่านในการเข้าใช้ครั้งแรก

## Build GitHub

```bat
npm run check
```

ใช้ `dist/` deploy

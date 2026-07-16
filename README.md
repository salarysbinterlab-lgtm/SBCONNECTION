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

1. แตก ZIP ทับ `D:\Projectsbconnect_app`
2. แก้ Supabase:
   `public/app/assets/js/sbConfig.js`
3. รัน:
   `RESET_AND_RUN_TOONHUB.bat`

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

หลังรัน SQL:
- Admin: `ADMIN / Admin123`
- User: `emp_id / 1234` แล้วตั้งรหัสใหม่ครั้งแรก

## Build GitHub

```bat
npm run build
```

ใช้ `dist/` deploy

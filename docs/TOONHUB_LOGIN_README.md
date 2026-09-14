# TOONHUB Login Hero - SB Connect

## สิ่งที่สร้างให้

หน้าแรก `index.html` เป็น React + TypeScript + Vite + Tailwind CSS + lucide-react

- Carousel รูป 4 tone
- เปลี่ยนรูปอัตโนมัติทุก 3 วินาที
- ไม่มีปุ่มกดหมุนรูป
- Background / panel color เปลี่ยนตาม active image
- Login อยู่หน้าแรก
- หลัง login:
  - Admin → `app/pages/homeAdmin.html`
  - User → `app/pages/home.html`
- App ด้านในยังใช้ HTML/CSS legacy เดิม

## รูปภาพ

รูป local fallback อยู่ที่:

```text
public/toonhub/toon-1-orange.png
public/toonhub/toon-2-green.png
public/toonhub/toon-3-pink.png
public/toonhub/toon-4-blue.png
```

ใน code ใช้ URL จาก prompt เป็นหลัก และ fallback เป็นรูป local ที่คุณส่งมา

## ตั้งค่า Supabase

แก้ไฟล์เดียว:

```text
public/app/assets/js/sbConfig.js
```

ใส่:

```js
supabaseUrl: "https://xxxx.supabase.co",
supabaseAnonKey: "anon หรือ publishable key"
```

ไฟล์นี้ถูกโหลดในหน้า React root ด้วย จึงไม่ต้องแก้ซ้ำใน src

## วิธีรันแบบไม่พัง

แนะนำรัน:

```bat
RESET_AND_RUN_TOONHUB.bat
```

หรือทำเอง:

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

## SQL

SQL อยู่ในโฟลเดอร์ `sql/`

ใช้ตัวหลัก:

```text
sql/11_public_session_rpc_FINAL.sql
```

ไม่ใช้ไฟล์ 11 ตัวเก่าที่ซ้ำกัน

## Build GitHub

```bat
npm run build
```

ผลลัพธ์อยู่ที่:

```text
dist/
```

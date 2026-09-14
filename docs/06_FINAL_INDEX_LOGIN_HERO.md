# Final Index Login Hero

## 1. หน้าแรกคือไฟล์ไหน

ใช้:

```text
index.html
```

หน้าที่:
- แสดง video background เต็มจอ
- แสดง hero text ด้านซ้าย
- แสดง login card ในหน้าแรก
- ใช้ `rootIndexAuth.js` เพื่อ login ผ่าน Supabase RPC

## 2. Login ใช้ JS ไหน

ใช้:

```text
public/app/assets/js/rootIndexAuth.js
```

ไฟล์นี้ import ฟังก์ชันเดิมจาก:

```text
public/app/assets/js/sessionService.js
public/app/assets/js/sbClient.js
public/app/assets/js/uiHelpers.js
```

## 3. หลัง Login ไปหน้าไหน

Admin:

```text
public/app/pages/homeAdmin.html
```

User:

```text
public/app/pages/home.html
```

## 4. SQL ใช้ชุดไหน

รัน SQL จากโฟลเดอร์:

```text
sql/
```

ใช้ตัว RPC หลัก:

```text
11_public_session_rpc_FINAL.sql
```

ไม่ใช้ไฟล์ 11 ตัวเก่าที่ซ้ำกัน

## 5. GitHub

โปรเจกต์นี้ใช้ Vite serve static + public assets:

```bat
npm install
npm run dev
npm run build
```

`vite.config.ts` ใช้ `base: './'` เพื่อให้ deploy GitHub Pages ได้ง่าย

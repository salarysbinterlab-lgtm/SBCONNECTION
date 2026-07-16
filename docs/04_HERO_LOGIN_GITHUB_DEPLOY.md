# 04 - Hero UI + Legacy Login + GitHub Deploy

## คำตอบเรื่องรูป/วิดีโอ
ไม่ต้องเลือกรูปเพิ่ม เพราะ Hero ใช้ video background ตาม URL ที่กำหนดไว้แล้ว:

`https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260403_050628_c4e32401-fab4-4a27-b7a8-6e9291cd5959.mp4`

วิดีโอถูกใส่แบบ raw video ไม่มี overlay, ไม่มี gradient, ไม่มี layer ทับ ตามคำสั่ง

## 1. ไฟล์ Hero ที่แก้

```text
index.html
src/App.tsx
src/index.css
tailwind.config.ts
vite.config.ts
package.json
```

หน้าหลัก `/` เป็น React + TypeScript + Tailwind + Vite Hero
ปุ่ม `Start a Chat` และ `Explore Now` ไปที่:

```text
./app/index.html
```

## 2. ไฟล์ Legacy Login / App ที่ไม่ให้พัง

Legacy app อยู่ที่:

```text
public/app/index.html
public/app/pages/home.html
public/app/pages/homeAdmin.html
public/app/pages/admin_*.html
public/app/pages/news.html
public/app/pages/mission.html
public/app/pages/rewards.html
public/app/pages/ranking.html
```

CSS เดิมอยู่ที่:

```text
public/app/assets/css/legacy/*.css
public/app/assets/css/pages/*-legacy.css
```

JS function อยู่ที่:

```text
public/app/assets/js/authLegacy.js
public/app/assets/js/sessionService.js
public/app/assets/js/homeLegacy.js
public/app/assets/js/pagesLegacy.js
public/app/assets/js/adminLegacy.js
public/app/assets/js/adminModulesLegacy.js
```

## 3. แก้ Supabase ตรงไหน

แก้ไฟล์เดียว:

```text
public/app/assets/js/sbConfig.js
```

ใส่ค่า:

```js
supabaseUrl: "https://xxxx.supabase.co",
supabaseAnonKey: "ใส่ anon/publishable key",
driveUploadEndpoint: "Apps Script Web App URL",
driveUploadToken: "token ให้ตรงกับ Apps Script"
```

## 4. SQL ที่ต้องรัน

รันจากโฟลเดอร์:

```text
sql/
```

ลำดับหลัก:

```text
00_FULL_RESET_PUBLIC_SCHEMA_DEV_ONLY.sql   เฉพาะ dev reset
01_extensions.sql
02_types.sql
03_core_schema.sql
04_content_schema.sql
05_points_rewards_schema.sql
06_chat_notifications_schema.sql
07_it_requests_schema.sql
08_views.sql
09_functions_triggers.sql
10_rls_policies.sql
11_public_session_rpc_FINAL.sql
12_ADMIN_BOOTSTRAP_DEV.sql
90_seed_app_settings.sql
91_seed_from_xlsx_FIXED_V3_empid_normalized.sql
92_post_seed_fixes.sql
```

ห้ามใช้ไฟล์ 11 เดิมที่ซ้ำกันเป็นหลัก:

```text
11_public_test_login_rpc.sql
11_real_auth_first_login_rpc.sql
```

ให้ใช้ตัว final เท่านั้น:

```text
11_public_session_rpc_FINAL.sql
```

## 5. ทดสอบ Local

```bash
npm install
npm run dev
```

เปิด:

```text
http://127.0.0.1:5173/
```

กด `Start a Chat` จะไป:

```text
http://127.0.0.1:5173/app/index.html
```

## 6. ทดสอบ Login จริง

หลังจากรัน SQL และแก้ `sbConfig.js` แล้ว ทดสอบ:

```text
ADMIN / Admin123
```

หรือ user จาก seed:

```text
emp_id / 1234
```

กรณี user seed จะขึ้น first-login overlay ให้ตั้งรหัสใหม่ 8 ตัว A-Z/a-z/0-9

## 7. Build เพื่อดันขึ้น GitHub Pages

```bash
npm run build
```

ไฟล์ออกที่:

```text
dist/
```

เอา `dist/` ไป deploy GitHub Pages หรือใช้ GitHub Actions ก็ได้

เพราะ `vite.config.ts` ตั้ง `base: './'` แล้ว จึงเหมาะกับ GitHub Pages แบบ repo subpath

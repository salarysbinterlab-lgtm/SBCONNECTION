# รายการที่ต้องทำด้วยมือ

## 0. ก๊อป workflow เข้าที่ — บังคับ

ไฟล์ใน `.github/workflows/` เขียนทับจากระยะไกลไม่ได้ (ระบบป้องกันไว้)
ผมวางเวอร์ชันใหม่ไว้ที่ `_workflows_to_apply\` ให้ก๊อปทับเอง

```bat
cd /d D:\Projectsbconnect_app
copy /y _workflows_to_apply\deploy-cloudflare.yml    .github\workflows\deploy-cloudflare.yml
copy /y _workflows_to_apply\deploy-github-pages.yml  .github\workflows\deploy-github-pages.yml
rmdir /s /q _workflows_to_apply
```

- `deploy-cloudflare.yml` — เพิ่มการฉีดค่า `VITE_*` จาก repository variables และหยุด build ถ้าค่าหาย
- `deploy-github-pages.yml` — ปิดถาวร (GitHub Pages เป็นสาธารณะเสมอ ไม่เหมาะกับแอปภายใน)
  จะลบไฟล์นี้ทิ้งไปเลยก็ได้

จากนั้นตั้งค่าใน GitHub → Settings:

- **Variables**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_DRIVE_UPLOAD_ENDPOINT`
- **Secrets**: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`

---

# รายการที่ต้องลบด้วยมือ

ผมแก้ไฟล์ได้แต่ **ลบไฟล์บนเครื่องคุณไม่ได้** (เครื่องมือฝั่งนี้ไม่อนุญาตให้ลบ)
รายการข้างล่างคือสิ่งที่เหลือค้างและต้องลบเอง ลบให้ครบก่อน commit

`npm run check` จะ **ไม่ผ่าน** จนกว่าจะลบข้อ 1 เสร็จ (เทสต์ `securityContract` บังคับไว้ตั้งใจ)

---

## 1. โฟลเดอร์ legacy — บังคับ (ความปลอดภัย)

```bat
cd /d D:\Projectsbconnect_app
rmdir /s /q app
rmdir /s /q public\app
rmdir /s /q dist
```

เหตุผล:

- `public/app/` ถูกก๊อปลง `dist/` แล้ว deploy ขึ้น production จริง ข้างในมี
  `sbConfig.js` ที่ฝัง Supabase URL + anon key, `sbClient.js` ที่เรียก
  `supabase.rpc()` ตรง และ `devVisualEditor.js` (25 KB) ที่เอกสารบอกว่าเอาออกไปแล้ว
- `app/` ที่ root เป็นสำเนาเก่ากว่า `public/app/` (ต่างกัน 32 ไฟล์) ไม่มีอะไรเรียกใช้แล้ว
  หลังจากผมเอา `<script>` ที่ import `app/assets/js/sbConfig.js` ออกจาก `index.html`
- ทั้งสองโฟลเดอร์เก็บรหัสผ่านผู้ใช้เป็น plaintext ใน `sessionStorage`
  (`app/assets/js/sessionService.js` → `saveTempPassword`)
- `dist/` เป็นผลลัพธ์ build อยู่ใน `.gitignore` อยู่แล้ว สร้างใหม่ได้ด้วย `npm run build`

ฟีเจอร์ทุกอย่างของหน้า legacy มีครบใน React แล้ว (home, news, mission, rewards,
ranking, notifications, overall log, admin ทุกหน้า)

---

## 2. เศษเครื่องมือ dev — แนะนำให้ลบ

```bat
del dev-preview.html
del DEV_EDITOR_RUN.bat
del REMOVE_VISUAL_EDITOR_AND_RUN.bat
del RESET_AND_RUN_TOONHUB.bat
del RUN_STABLE_CLEAN.bat
del BUILD_GITHUB.bat
del vite-dev.log
del vite-dev.err.log
del vite.config.ts.timestamp-1784103294518-8d504bf17e5fb8.mjs
rmdir /s /q dev-editor
rmdir /s /q src\dev
```

`docs/00_APP_OVERVIEW_SIMPLE_STABLE.md` เขียนไว้ตั้งแต่รอบก่อนว่า "รอบนี้เอา visual
low-code editor ออก" แต่ไฟล์ยังอยู่ครบ ถ้ายังอยากเก็บ visual editor ไว้ ให้ข้ามข้อนี้ —
แต่ต้องแน่ใจว่า `src/dev/` ไม่ถูก import จาก `src/App.tsx` (ตอนนี้ไม่ถูก import)

---

## 3. ไฟล์ซ้ำจากพิมพ์ผิด — ลบไปพร้อมข้อ 1

อยู่ใน `app/pages/` และ `public/app/pages/` ซึ่งจะหายไปเองเมื่อลบตามข้อ 1

- `admin_legder.html` (พิมพ์ผิดของ `admin_ledger.html`)
- `admin_manager_dept.html` (ซ้ำกับ `admin_manager_depts.html`)

---

## 4. SQL bundle ที่ generate ได้ — ทางเลือก

```bat
del sql\sbconnect_FINAL_all_in_one.sql
```

ไฟล์ 402 KB นี้สร้างใหม่ได้ด้วย `npm run sql:bundle` และตอนนี้ **ยังไม่มี `17_` กับ `18_` อยู่ข้างใน**
ถ้าจะเก็บไว้ใช้ ต้องรัน `npm run sql:bundle` ใหม่ก่อน ไม่งั้นใครเอาไปรันจะได้ฐานที่ยังมีช่องโหว่

---

## 5. Script Property ของ Apps Script

ลบ `UPLOAD_TOKEN` ออกจาก Script Properties ได้เลย ไม่มีเส้นทางไหนใช้แล้ว
(การยืนยันตัวตนเปลี่ยนไปใช้ `sessionToken` ของผู้ใช้ + `validate_public_session` แทน)

**ต้อง redeploy Apps Script** หลังวางโค้ดใหม่จาก `apps_script/SBConnect_Drive_Upload_API.gs`
ไม่งั้นการอัปโหลดรูปจะพัง เพราะ frontend ไม่ส่ง static token มาแล้ว

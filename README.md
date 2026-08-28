# SB Connect

แอปสะสมคะแนนภายในบริษัท — React + Vite + Tailwind + Supabase (PWA)

พนักงานเช็คอินรายวัน อ่านข่าว ทำภารกิจ แลกของรางวัล ดูอันดับ
แอดมินจัดการผู้ใช้ ข่าว ภารกิจ ของรางวัล และดูประวัติแต้มทั้งหมด

> **เอกสารหลักอยู่ที่ [`docs/RUNBOOK.md`](docs/RUNBOOK.md)** — ลำดับรัน SQL, การตั้งค่า, ขั้นตอนก่อนขึ้นจริง
> ไฟล์อื่นใน `docs/` เป็นบันทึกงานรายรอบ ใช้เป็นประวัติเท่านั้น

---

## เริ่มใช้งาน

```bash
cp .env.example .env     # แล้วใส่ค่าจริง 3 ตัว
npm install
npm run dev              # http://127.0.0.1:5175/
```

ทดสอบ UI ด้วยข้อมูลจำลอง: `http://127.0.0.1:5175/?mock=1` (dev + localhost เท่านั้น)

ก่อน push ทุกครั้ง:

```bash
npm run check            # typecheck + test + build
```

---

## โครงสร้าง

```
src/                 React app (โค้ดชุดเดียวของโปรเจกต์)
  App.tsx            หน้าแรก + login + บังคับเปลี่ยนรหัสครั้งแรก
  components/        UserDashboard, AdminDashboard, QuotationWorkspace
  helpers/api.ts     ชั้นเดียวที่คุยกับ Supabase (allowlist RPC อยู่ในนี้)
  helpers/mockApi.ts ฐานข้อมูลจำลองสำหรับ dev เท่านั้น (dynamic import)
sql/                 migration ทั้งหมด — ดูลำดับรันใน docs/RUNBOOK.md
apps_script/         Google Apps Script สำหรับอัปโหลดไฟล์ขึ้น Drive
public/              static asset + service worker
```

---

## กติกาความปลอดภัยที่ห้ามละเมิด

1. **ห้ามเปิดสิทธิ์ตารางให้ `anon`** — แอปคุยกับฐานผ่าน RPC เท่านั้น
2. **เพิ่ม RPC ใหม่ = ต้องเพิ่มชื่อใน `ALLOWED_RPC` (`src/helpers/api.ts`)
   และเพิ่ม `grant execute ... to anon` ใน `sql/17_SECURITY_HARDENING_AND_FIXES.sql` แล้วรัน `17_` ซ้ำ**
   ถ้าลืม เทสต์ `securityContract` จะฟ้องเอง
3. **ห้ามใส่ secret ลงใน `.env` ของ frontend** — ทุกค่า `VITE_*` ถูก build ติดไปกับ JS ที่ผู้ใช้โหลด
   ใส่ได้เฉพาะ publishable/anon key
4. **ห้ามเก็บรหัสผ่านผู้ใช้ไว้ในเบราว์เซอร์** — session token คือหลักฐานตัวตนอยู่แล้ว
5. **ฟังก์ชันภายใน** (`add_point_transaction`, `process_checkin`, `sb_*`) ต้องถูก revoke จาก `anon` เสมอ

ตรวจทั้งหมดได้ด้วย `sql/18_VERIFY_SECURITY.sql` (ทุก CHECK ต้องได้ 0 แถว)

---

## Deploy

push ขึ้น `main` → GitHub Actions รัน `npm run check` แล้ว deploy ขึ้น Cloudflare Workers

GitHub Pages ถูกปิดถาวร (สาธารณะเสมอ ไม่เหมาะกับแอปภายในบริษัท)

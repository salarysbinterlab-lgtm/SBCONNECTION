# SB Connect — Runbook (เอกสารหลัก)

เอกสารนี้คือแหล่งอ้างอิงเดียวสำหรับการติดตั้ง รัน และ deploy
เอกสารเก่าในโฟลเดอร์นี้เป็นบันทึกงานรายรอบ ใช้เป็นประวัติเท่านั้น

---

## 1. สถาปัตยกรรม

```
Browser (React PWA)
  │  POST /rest/v1/rpc/<fn>   apikey = publishable key
  ▼
Supabase Postgres
  ├─ ตาราง/view : anon เข้าถึงตรงไม่ได้เลย (revoke ทั้งหมด)
  └─ RPC 52 ตัว : เท่านั้นที่ anon เรียกได้ ทุกตัวรับ p_token uuid ยกเว้น login
  ▲
  │  service_role key (อยู่ใน Script Properties เท่านั้น)
Google Apps Script  ← อัปโหลดไฟล์ขึ้น Drive, ยืนยันตัวตนด้วย sessionToken ของผู้ใช้
```

การยืนยันตัวตนใช้ session token ของแอปเอง (ตาราง `public_sessions`) ไม่ได้ใช้ Supabase Auth
ดังนั้น **ความปลอดภัยทั้งหมดอยู่ที่ชั้น RPC** ห้ามเปิดสิทธิ์ตารางให้ `anon` เด็ดขาด

---

## 2. ตั้งค่าครั้งแรก

### 2.1 ไฟล์ .env

```bash
cp .env.example .env
```

แล้วใส่ค่าจริง 3 ตัว

| ตัวแปร | ใส่อะไร |
|---|---|
| `VITE_SUPABASE_URL` | URL โปรเจกต์ Supabase |
| `VITE_SUPABASE_ANON_KEY` | publishable / anon key **เท่านั้น** |
| `VITE_DRIVE_UPLOAD_ENDPOINT` | URL ของ Apps Script Web App |

ค่าพวกนี้ถูก build ติดไปกับไฟล์ JS ที่ผู้ใช้โหลด จึงต้องเป็นค่าที่เปิดเผยได้
**ห้ามใส่ service_role key หรือ shared secret ใด ๆ ลงใน .env ของ frontend**

### 2.2 GitHub Actions

ตั้ง repository **variables** (ไม่ใช่ secrets เพราะไม่ใช่ความลับ):
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_DRIVE_UPLOAD_ENDPOINT`

ตั้ง repository **secrets**: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`

---

## 3. ลำดับรัน SQL

รันใน Supabase SQL Editor ตามลำดับนี้ **เป๊ะ ๆ** (เลขไฟล์ไม่ตรงกับลำดับรัน — เป็นหนี้เก่าที่ยังไม่ได้ล้าง)

| # | ไฟล์ | หมายเหตุ |
|---|---|---|
| 1 | `00_FULL_RESET_PUBLIC_SCHEMA_DEV_ONLY.sql` | **DEV เท่านั้น** ห้ามรันบน production |
| 2 | `01_extensions.sql` | |
| 3 | `02_types.sql` | |
| 4 | `03_core_schema.sql` | |
| 5 | `04_content_schema.sql` | |
| 6 | `05_points_rewards_schema.sql` | |
| 7 | `06_chat_notifications_schema.sql` | |
| 8 | `07_it_requests_schema.sql` | |
| 9 | `08_views.sql` | |
| 10 | `09_functions_triggers.sql` | |
| 11 | `10_rls_policies.sql` | ยังไม่มีผลจริง (ดูหัวข้อ 7) |
| 12 | `11_public_session_rpc_FINAL.sql` | |
| 13 | `12_ADMIN_BOOTSTRAP_DEV.sql` | ต้องแก้ `v_admin_password` ก่อน ไม่งั้นสคริปต์จะไม่ยอมรัน |
| 14 | `90_seed_app_settings.sql` | |
| 15 | `91_seed_from_xlsx_FIXED_V3_empid_normalized.sql` | seed พนักงาน |
| 16 | `92_post_seed_fixes.sql` | |
| 17 | `94_EMP_ID_FIRST_LOGIN_PASSWORD.sql` | |
| 18 | `95_ADMIN_ACCOUNTS_SPECIAL_POINTS_ACTIVITY.sql` | |
| 19 | `13_PRODUCTION_SECURITY_AND_ASSETS.sql` | |
| 20 | `14_LEGACY_RPC_ALIASES_FOR_REACT_APP.sql` | |
| 21 | `15_QUOTATION_SUPABASE_SCHEMA.sql` | |
| 22 | `16_FRONTEND_RPC_COMPLETION_AND_AUTH_HARDENING.sql` | |
| 23 | **`17_SECURITY_HARDENING_AND_FIXES.sql`** | **ต้องรันเป็นไฟล์สุดท้ายเสมอ** |
| 24 | **`19_FIRST_LOGIN_SHARED_PASSWORD.sql`** | ระบบรหัสกลางเข้าครั้งแรก + จำกัดเวลา |
| 25 | **`20_PASSWORD_RESET_REQUEST.sql`** | ระบบลืมรหัสผ่าน แจ้งรหัส 6 หลักไปที่อีเมล dev |
| 26 | `18_VERIFY_SECURITY.sql` | ตรวจผล ไม่แก้ข้อมูล |

`17_` รันซ้ำได้ไม่มีผลข้างเคียง และ **ทุกครั้งที่เพิ่ม RPC ใหม่ ต้องรัน `17_` ซ้ำ**
เพราะ default privileges ถูกปิดไว้ ฟังก์ชันใหม่จะไม่มีสิทธิ์ให้ anon จนกว่าจะ grant

---

## 4. ขั้นตอนบังคับก่อนเปิดใช้จริง

### 4.1 เปิดให้พนักงานตั้งรหัสผ่านครั้งแรก (ระบบรหัสกลาง)

ไฟล์ `94_` ตั้งรหัสผ่านเริ่มต้นของทุกคนให้ **เท่ากับรหัสพนักงานของตัวเอง**
ซึ่งเป็นข้อมูลที่คนในบริษัทรู้กันอยู่แล้ว = ใครก็เข้าบัญชีคนอื่นได้ในครั้งแรกแล้วยึดไปเลย

ไฟล์ `19_` เปลี่ยนเป็นระบบ **รหัสกลาง + หน้าต่างเวลา** แทน

| | ค่า | แก้ที่ไหน |
|---|---|---|
| รหัสกลาง | `SBstart2026` | `app_settings.first_login_password` |
| อายุหน้าต่าง | 7 วัน | `app_settings.first_login_window_days` |

**วิธีทำงาน**

1. แอดมินเพิ่มพนักงาน (หรือกดรีเซ็ตรหัส) → ระบบเปิดหน้าต่างให้อัตโนมัติ นับจากตอนนั้น 7 วัน
2. พนักงานล็อกอินด้วย `รหัสพนักงาน` + `รหัสกลาง` ภายในกำหนด
3. ระบบบังคับตั้งรหัสใหม่ทันที (ไม่ต้องกรอกรหัสเดิม) → หน้าต่างปิดถาวรสำหรับคนนั้น
4. พ้นกำหนดแล้วยังไม่เข้า → รหัสกลางใช้ไม่ได้ ต้องให้แอดมินกดรีเซ็ตเพื่อเปิดใหม่

**เปิดให้ทั้งบริษัทพร้อมกัน (ตอนเริ่มใช้ระบบครั้งแรก)**

```sql
select public.sb_open_first_login_for_all();
```

**ดูสถานะรายคน**

```sql
select * from public.v_first_login_status order by dept_th, emp_id;
```

**เปลี่ยนรหัสกลาง / อายุหน้าต่าง**

```sql
update public.app_settings set value = 'รหัสใหม่ของคุณ' where key = 'first_login_password';
update public.app_settings set value = '14'            where key = 'first_login_window_days';
```

> `sb_open_first_login_for_all()` จะเตะทุกคนที่ยังไม่เคยตั้งรหัสเองออกจากระบบ ควรนัดวันกับ HR ก่อน
> คนที่ตั้งรหัสเองไปแล้ว (`must_change = false`) ไม่ถูกแตะต้อง

**กติกาที่ระบบบังคับ**

- รหัสใหม่ต้องยาว 8–72 ตัว มีทั้งตัวอักษรและตัวเลข ใช้อักขระพิเศษได้ ห้ามเว้นวรรค ห้ามภาษาไทย
- ห้ามตั้งรหัสใหม่เป็นรหัสกลาง
- ห้ามตั้งรหัสใหม่เป็นรหัสพนักงานของตัวเอง
- เปลี่ยนรหัสสำเร็จ = session อื่นทุกเครื่องถูกตัดทิ้ง

### 4.2 ระบบลืมรหัสผ่าน

พนักงานกดปุ่ม **"ลืมรหัสผ่าน?"** ที่หน้า login แล้วกรอกรหัสพนักงานของตัวเอง

```
พนักงาน  →  Apps Script  →  Supabase (request_password_reset)
                │
                └→ อีเมลถึง sbinterlab.carbeau@gmail.com
                   มี: รหัส 6 หลัก, รหัสพนักงาน, ชื่อ, แผนก, ตำแหน่ง, เบอร์โทร
```

dev ยืนยันตัวตนพนักงานก่อน แล้วบอกรหัส 6 หลัก พนักงานเอารหัสนั้นใส่ในช่องรหัสผ่าน
แทนรหัสเดิม ระบบจะให้ตั้งรหัสใหม่ทันที

| เรื่อง | ค่าเริ่มต้น | แก้ที่ |
|---|---|---|
| อีเมลผู้ดูแล | `sbinterlab.carbeau@gmail.com` | `app_settings.password_reset_notify_email` |
| อายุรหัส 6 หลัก | 24 ชั่วโมง | `app_settings.password_reset_code_hours` |
| ขอได้กี่ครั้ง/คน/วัน | 3 | `app_settings.password_reset_max_per_user_day` |
| เพดานรวมทั้งระบบ/ชั่วโมง | 30 | `app_settings.password_reset_max_per_hour` |

**สิ่งที่ออกแบบไว้กันปัญหา**

- รหัส 6 หลักไม่เคยถูกส่งกลับไปที่เบราว์เซอร์ ผู้ขออ่านรหัสของคนอื่นไม่ได้
- **ไม่ทับรหัสเดิมของพนักงาน** ถ้ามีคนแกล้งกดขอ เจ้าตัวยังใช้รหัสเดิมเข้าได้ตามปกติ
- รหัสใช้ได้ครั้งเดียว ขอใบใหม่ = ใบเก่าถูกยกเลิกทันที
- ตอบข้อความเดียวกันเสมอ ไม่ว่ารหัสพนักงานจะมีอยู่จริงหรือไม่ กันการไล่เดารหัสพนักงาน
- `request_password_reset` เปิดให้ `service_role` เท่านั้น เบราว์เซอร์เรียกตรงไม่ได้

**ดูคำขอย้อนหลัง**

```sql
select * from public.v_password_reset_pending;
```

ถ้าเห็น state = `ยังส่งเมลไม่สำเร็จ` แปลว่า Apps Script ส่งอีเมลไม่ออก
ให้ตรวจว่า redeploy Apps Script แล้ว และอนุญาตสิทธิ์ MailApp ตอน deploy ครั้งแรก

### 4.3 ตรวจว่า lockdown ทำงาน

รัน `18_VERIFY_SECURITY.sql` ทุก CHECK ต้องได้ 0 แถว และ CHECK 4 ต้องได้ **52 ฟังก์ชันพอดี**

### 4.4 ปิดเว็บไม่ให้คนนอกเข้า

แอปนี้เป็นระบบภายใน ให้ใส่ Cloudflare Access (หรือ IP allowlist) หน้า Cloudflare Worker
`deploy-github-pages.yml` ถูกปิดไปแล้วเพราะ GitHub Pages เป็นสาธารณะเสมอ

---

## 5. คำสั่งที่ใช้บ่อย

```bash
npm install
npm run dev          # http://127.0.0.1:5175/
npm run dev -- --open
npm run check        # typecheck + test + build   <-- ต้องผ่านก่อน push ทุกครั้ง
npm run build
```

ทดสอบ UI ด้วยข้อมูลจำลอง (ไม่แตะฐานจริง): `http://127.0.0.1:5175/?mock=1`
โหมดนี้ทำงานเฉพาะ `npm run dev` บน localhost เท่านั้น และไม่ถูก build เข้า production bundle

---

## 6. งานบำรุงรักษา

```sql
-- ล้าง session และ log login เก่า (ตั้งอัตโนมัติไว้แล้วถ้าเปิด pg_cron)
select public.sb_cleanup_expired();

-- ตรวจว่ายอดแต้มตรงกับ ledger
select public.recalc_user_points('EMP001');
```

ควรรัน `18_VERIFY_SECURITY.sql` ซ้ำทุกครั้งหลังแก้ SQL

---

## 7. ข้อควรรู้ / หนี้เทคนิคที่ยังเหลือ

1. **`10_rls_policies.sql` ยังไม่มีผลจริง** — policy เขียนไว้สำหรับ Supabase Auth (`auth.uid()`)
   แต่ระบบใช้ session token ของตัวเอง และตอนนี้ `anon` ถูกตัดสิทธิ์ตารางทั้งหมดแล้ว
   จึงไม่มีช่องโหว่ แต่ถ้าวันหนึ่งย้ายไป Supabase Auth ต้องกลับมาเปิดสิทธิ์ตารางและทดสอบ policy ใหม่
2. **เลขไฟล์ migration ไม่ตรงกับลำดับรัน** — ควรย้ายไป Supabase CLI migrations
3. **`UserDashboard.tsx` 2,700+ บรรทัด / `AdminDashboard.tsx` 1,900+ บรรทัด** — ควรแยกเป็น feature module
4. **ยังไม่มี ESLint** — เพิ่มไม่ได้ในรอบนี้เพราะจะทำให้ `package-lock.json` ไม่ตรงและ `npm ci` พังใน CI
   ให้เพิ่มแยกรอบ พร้อมอัปเดต lock file
5. **โมดูล Quotation** ใหญ่กว่าโมดูลสะสมแต้ม ควรแยกเป็นแอปคนละตัวในระยะยาว
6. **รูป `public/toonhub/*.png` รวมเกือบ 9 MB** — ควรแปลงเป็น WebP

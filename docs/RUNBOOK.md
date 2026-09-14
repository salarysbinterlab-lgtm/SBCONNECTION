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

## 3. ติดตั้งฐานข้อมูล (ฐานใหม่)

รันใน Supabase SQL Editor **3 ไฟล์ ตามลำดับนี้** ไฟล์อยู่ในโฟลเดอร์ `sql/setup/`

| ลำดับ | ไฟล์ | ขนาด | ได้อะไร |
|---|---|---|---|
| 1 | `sql/setup/SETUP_1_SCHEMA.sql` | ~175 KB | ตาราง view ฟังก์ชัน RPC ทั้งหมด |
| 2 | `sql/setup/SETUP_2_EMPLOYEES.sql` | ~218 KB | พนักงาน 338 คนจากไฟล์ xlsx |
| 3 | `sql/setup/SETUP_3_SECURITY.sql` | ~166 KB | ปิดสิทธิ์ + รหัสกลางเข้าครั้งแรก + บัญชีแอดมิน |
| ตรวจ | `sql/18_VERIFY_SECURITY.sql` | | อ่านอย่างเดียว ทุก CHECK ต้องได้ 0 แถว |

**วิธีรันแต่ละไฟล์** เปิดไฟล์ด้วย Notepad → Ctrl+A → Ctrl+C → วางใน SQL Editor → กด Run
รอจนขึ้นผลลัพธ์ แล้วค่อยไฟล์ถัดไป ห้ามสลับลำดับ

### ต้องทำก่อนรันไฟล์ที่ 3 เท่านั้น: ตั้งรหัสกลาง

`SETUP_3` มีตัวยึด `__SB_DEFAULT_PASSWORD__` อยู่ 2 จุด ต้องแทนที่ด้วยรหัสกลางของคุณก่อน

1. เปิด `sql/setup/SETUP_3_SECURITY.sql` ด้วย Notepad
2. Ctrl+H → ช่องบน `__SB_DEFAULT_PASSWORD__` → ช่องล่างใส่รหัสที่คุณตั้ง → **Replace All**
3. Ctrl+A → Ctrl+C → วางใน SQL Editor → Run

รหัสกลางนี้ใช้ทั้ง **แอดมินและพนักงานทุกคน** เป็นรหัสชั่วคราวสำหรับเข้าครั้งแรกเท่านั้น
ระบบจะบังคับให้ตั้งรหัสของตัวเองทันทีที่เข้าได้

เงื่อนไข: ยาว 8-72 ตัว มีทั้งตัวอักษรและตัวเลข ห้ามเว้นวรรค ห้ามภาษาไทย
ถ้าลืมแทนที่ ใส่ `SB2026` หรือใส่รหัสที่อ่อนเกินไป ไฟล์จะหยุดตั้งแต่บรรทัดแรกและไม่ตั้งรหัสให้ใครเลย

**ห้ามเขียนรหัสกลางตัวจริงลงในเอกสารนี้หรือไฟล์ใดที่จะขึ้น GitHub**
ถ้าต้องเปลี่ยนรหัสกลางภายหลัง ใช้ `sql/23_ROTATE_AFTER_LEAK.sql`

รันจบทั้ง 3 ไฟล์แล้ว **ไม่ต้องสั่งอะไรเพิ่ม** ทุกบัญชีพร้อมเข้าด้วยรหัสกลางทันที

### สร้างไฟล์ setup ใหม่หลังแก้ SQL

ถ้าแก้ไฟล์ต้นทางใน `sql/` ต้องสร้างไฟล์ setup ใหม่ก่อน push

```bash
npm run sql:setup
```

สคริปต์มีตัวกันไว้ว่า `SETUP_3_SECURITY.sql` ต้องเป็นชุดสุดท้ายและต้องขึ้นต้นด้วย `17_` ปิดท้ายด้วย `21_`
ถ้าเรียงผิดจะไม่ยอมสร้างไฟล์ให้

### ไฟล์ต้นทางใน sql/ ที่ประกอบเป็น setup

| ชุด | ไฟล์ต้นทาง |
|---|---|
| SETUP_1 | `01_extensions` `02_types` `03_core_schema` `04_content_schema` `05_points_rewards_schema` `06_chat_notifications_schema` `07_it_requests_schema` `08_views` `09_functions_triggers` `10_rls_policies` `11_public_session_rpc_FINAL` `90_seed_app_settings` `95_ADMIN_ACCOUNTS_SPECIAL_POINTS_ACTIVITY` `13_PRODUCTION_SECURITY_AND_ASSETS` `14_LEGACY_RPC_ALIASES_FOR_REACT_APP` `15_QUOTATION_SUPABASE_SCHEMA` `16_FRONTEND_RPC_COMPLETION_AND_AUTH_HARDENING` |
| SETUP_2 | `91_seed_from_xlsx_FIXED_V3_empid_normalized` `92_post_seed_fixes` |
| SETUP_3 | `17_SECURITY_HARDENING_AND_FIXES` `19_FIRST_LOGIN_SHARED_PASSWORD` `20_PASSWORD_RESET_REQUEST` `21_ADMIN_ACCOUNTS_AND_AUDIT` |

### ไฟล์ที่เลิกใช้แล้ว

รัน `CLEAN_SQL.bat` เพื่อย้ายไปเก็บใน `sql/_unused/` และ `sql/_dev_only/`

| ไฟล์ | เหตุผล |
|---|---|
| `12_ADMIN_BOOTSTRAP_DEV.sql` | บัญชีแอดมินทดสอบ ถูกแทนด้วย `21_` |
| `94_EMP_ID_FIRST_LOGIN_PASSWORD.sql` | ตั้งรหัสเริ่มต้น = รหัสพนักงาน ซึ่งเดาได้ ถูกแทนด้วย `19_`/`21_` |
| `93_OPTIONAL_RESET_PASSWORD_FIRST_LOGIN_MODE.sql` | ล้าง credential ผู้ใช้ทั้งหมด อันตราย |
| `sbconnect_FINAL_all_in_one.sql` | ไฟล์รวมรุ่นเก่า ถูกแทนด้วย `sql/setup/` |
| `00_` `98_` `99_` | DEV เท่านั้น (ล้าง schema / ล้างข้อมูล / ลบตาราง) เก็บไว้ใน `_dev_only/` |

---

## 4. ขั้นตอนบังคับก่อนเปิดใช้จริง

### 4.1 เปิดให้พนักงานตั้งรหัสผ่านครั้งแรก (ระบบรหัสกลาง)

ทุกคน (ทั้งพนักงานและแอดมิน) เข้าครั้งแรกด้วย **รหัสกลางตัวเดียวกัน** แล้วระบบบังคับตั้งรหัสใหม่ทันที
HR ไม่ต้องแจกรหัสรายคน ไม่ต้องใช้อีเมล ไม่ต้องใช้ SMS OTP

รหัสกลางใช้ได้เฉพาะใน **หน้าต่างเวลาที่แอดมินเปิดให้** เพื่อกันไม่ให้คนที่รู้รหัสพนักงาน
ของเพื่อนร่วมงานเข้าบัญชีนั้นก่อนเจ้าตัวแล้วยึดไป

| | ค่า | แก้ที่ไหน |
|---|---|---|
| รหัสกลาง | ดูในไฟล์ `sql/21_` (ไม่อยู่ใน repo) | `app_settings.first_login_password` |
| อายุหน้าต่าง | 7 วัน | `app_settings.first_login_window_days` |

**วิธีทำงาน**

1. แอดมินเพิ่มพนักงาน (หรือกดรีเซ็ตรหัส) → ระบบเปิดหน้าต่างให้อัตโนมัติ นับจากตอนนั้น 7 วัน
2. พนักงานล็อกอินด้วย `รหัสพนักงาน` + `รหัสกลาง` ภายในกำหนด
3. ระบบบังคับตั้งรหัสใหม่ทันที (ไม่ต้องกรอกรหัสเดิม) → หน้าต่างปิดถาวรสำหรับคนนั้น
4. พ้นกำหนดแล้วยังไม่เข้า → รหัสกลางใช้ไม่ได้ ต้องให้แอดมินกดรีเซ็ตเพื่อเปิดใหม่

**ตอนติดตั้งใหม่ ไม่ต้องสั่งอะไรเพิ่ม** — `SETUP_3_SECURITY.sql` เปิดหน้าต่างให้ทุกคนอัตโนมัติแล้ว

ถ้าต้องเปิดใหม่ทั้งบริษัทภายหลัง (เช่น หมดกำหนดไปแล้ว)

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

### 4.2 บัญชีแอดมิน และ log ว่าใครทำอะไร

ไฟล์ `21_` จัดบัญชีแอดมินไว้ 5 บัญชี

| รหัสเข้าระบบ | สิทธิ์ | ใช้ทำอะไร |
|---|---|---|
| `admin` | `dev` | บัญชีของ dev ไว้เข้าไปตรวจระบบ |
| `admin1` – `admin4` | `admin` | HR เพิ่มข่าว/ภารกิจ/ของรางวัล/ปฏิทิน |

ทุกบัญชีเข้าครั้งแรกด้วยรหัสกลาง (ดูค่าจริงในไฟล์ `sql/21_` ที่เก็บไว้นอก repo) แล้วระบบบังคับตั้งรหัสใหม่ทันที

**ใส่ชื่อจริงของแอดมิน** — เปิดไฟล์ `21_` แก้ตารางบนสุด (`tmp_admin_staff`) เป็นชื่อจริง
แล้วรันไฟล์ซ้ำ ชื่อพวกนี้จะโผล่ในรายงาน log ว่าใครเป็นคนทำ

**ดู log ว่าแอดมินคนไหนทำอะไร**

```sql
select * from public.v_admin_activity limit 50;
```

ได้ผลแบบนี้

| เวลา | ชื่อแอดมิน | สิทธิ์ | การกระทำ | รายการ |
|---|---|---|---|---|
| 18/08 16:41 | HR Admin 1 | admin | เพิ่ม/แก้ภารกิจ | MIS-EAFD01D0 |
| 18/08 16:40 | Developer (IT) | dev | ลบข่าว | NEWS-37C31202 |

ครอบคลุมทุกการกระทำฝั่งแอดมิน: เพิ่ม/แก้/ลบ ข่าว ภารกิจ ของรางวัล กฎระเบียบ ปฏิทิน
พนักงาน หัวหน้าแผนก การรีเซ็ตรหัส การตรวจภารกิจ และการอนุมัติแลกของ

> บัญชี `ADMIN` (ตัวพิมพ์ใหญ่) จากไฟล์ `12_` ถูกปิดใช้งานถาวรโดยไฟล์ `21_`
> ไม่ได้ลบทิ้ง เพื่อไม่ให้ประวัติที่อ้างถึงบัญชีนี้หาย

### 4.3 ระบบลืมรหัสผ่าน

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

### 4.4 ตรวจว่า lockdown ทำงาน

รัน `18_VERIFY_SECURITY.sql` ทุก CHECK ต้องได้ 0 แถว และ CHECK 4 ต้องได้ **52 ฟังก์ชันพอดี**

### 4.5 ปิดเว็บไม่ให้คนนอกเข้า

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

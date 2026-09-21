# แผนรวมระบบ IT Request + Quotation เข้ากับ SB Connect
**ฉบับวิเคราะห์ละเอียด + ลำดับงานครบถ้วน**
จัดทำ 17 กันยายน 2569 · อ้างอิงจากการอ่านซอร์สจริงของ `C:\xampp\htdocs\itrequest` และ `D:\Projectsbconnect_app`

---

## 0. สรุปผู้บริหาร (อ่าน 1 นาที)

| | ระบบ IT Request (เดิมบน XAMPP) | ระบบ Quotation (มีในโปรเจกต์อยู่แล้ว) |
|---|---|---|
| สภาพตอนนี้ | PHP + MariaDB รันบนเครื่อง `192.168.0.70` เข้าได้เฉพาะในออฟฟิศ · 134 ใบ · 404 ผู้ใช้ · สร้าง Excel 136 ไฟล์ + PDF 132 ไฟล์ + ทะเบียน Excel 1 ไฟล์ | โค้ดเสร็จ ~85% แต่ **admin/dev เข้าไม่ถึงเลย** เพราะปุ่มอยู่ใน `UserDashboard` เท่านั้น |
| ปัญหาใหญ่ที่สุด | ไฟล์ Excel เป็น "สถานะ" ไม่ใช่ output — ถ้ามีคนเปิดทะเบียนค้างไว้ **IT ปิดเคสไม่ได้เลย** | type มี 2 ชุดชนกัน + แปลงกันด้วย `as unknown as` → คอมไพเลอร์จับ bug ไม่ได้ |
| ทิศทางใหม่ | ย้ายขึ้น Supabase + React ทั้งหมด · **เลิกสร้าง Excel/PDF รายใบ** · เหลือ **Google Sheet ทะเบียนใบเดียว ต่อท้ายไปเรื่อยๆ** | ต่อเมนูให้ครบทุก role + ยุบ type + เพิ่ม RPC ให้ admin อ่านได้ |
| สิ่งที่ **ไม่** ย้าย | ลายเซ็น (ตายแล้ว) · Excel รายใบ · PDF · โมดูล Stock (เฟสหลัง) · Telegram bot token เดิม (ตั้งใหม่) | — |

**ตัวเลขที่ต้องรู้:** ฐานข้อมูลเดิมทั้งหมด **~4 MB** เท่านั้น ย้ายง่ายมาก · emp_id เป็น **TEXT zero-padded 3 หลัก** (`'030'`) ห้ามแปลงเป็นตัวเลข · ระบบเดิม key ทุกอย่างด้วย `emp_id` อยู่แล้ว ซึ่งตรงกับ `app_users.emp_id` ของ SB Connect พอดี → **นี่คือเหตุผลที่การรวมครั้งนี้ทำได้จริง**

---

## 1. วิเคราะห์: ทำไมต้องเลิกใช้ Excel

ระบบเดิมสร้างไฟล์ 3 แบบ และ **2 ใน 3 แบบเป็น "สถานะ" ไม่ใช่แค่รายงาน**:

| ไฟล์ | ปริมาณ | เป็นอะไรจริงๆ | ปัญหา |
|---|---|---|---|
| `report_request/rpt_{เลขที่}.xlsx` | 136 ไฟล์ | รายงาน 1 ใบ/1 คำร้อง สร้างโดย patch XML ของ `master-FM IT-01.xlsx` ทีละเซลล์ | ถ้าไฟล์ template หาย = สร้างรายงานไม่ได้เลยทั้งระบบ |
| `report_request_pdf/rpt_{เลขที่}.pdf` | 132 ไฟล์ | แปลงจาก xlsx ด้วย LibreOffice headless | ต้องติดตั้ง LibreOffice บนเซิร์ฟเวอร์ · แปลงช้า · ขาด 4 ไฟล์เพราะใบที่หัวหน้าไม่อนุมัติไม่สร้าง PDF |
| `request/FM IT-06-ทะเบียนใบแจ้งซ่อม-master.xlsx` | 1 ไฟล์ 173 แถว | **ทะเบียนสะสม = ฐานข้อมูลตัวที่สอง** ระบบอ่าน-แก้-เขียนทับทุกครั้งที่สถานะเปลี่ยน | ★ ถ้ามีใครเปิดไฟล์นี้ค้างใน Excel (เกิดไฟล์ `~$...xlsx`) ระบบจะ **throw error และ IT ปิดเคสไม่ได้** — นี่คือจุดเปราะที่สุดของระบบเดิม |

**ข้อสรุป:** ข้อมูลใน Excel ทั้งหมด derive จาก DB ได้ 100% → ไม่ต้อง migrate ไฟล์ ให้ **rebuild ทะเบียนใหม่จากข้อมูลใน Supabase** แทน

### สิ่งที่มาแทน (ตามที่สั่ง: "ไม่ต้องสร้าง excel แต่สร้างเป็นไฟล์ sheet เก็บไปเรื่อยๆ")

```
Supabase (ความจริงหลัก)  ──► Apps Script ──► Google Sheet 1 ไฟล์
   it_requests                                "SBConnect_IT_Request_Register"
   it_request_logs                            แท็บ REGISTER  ← ต่อท้ายแถวไปเรื่อยๆ
                                              แท็บ LOG       ← ต่อท้ายทุกการกระทำ
```

- **ต่อท้ายแถว** เมื่อเปิดคำร้องใหม่ (append)
- **อัปเดตแถวเดิม** ในตำแหน่งเดิมเมื่อสถานะเปลี่ยน (ค้นด้วย `request_no` ในคอลัมน์ A เหมือนเดิม)
- **ไม่มีไฟล์ล็อก** — Google Sheet เปิดพร้อมกันหลายคนได้ ไม่บล็อกการปิดเคส ✅ แก้ปัญหาที่เปราะที่สุดของระบบเดิมโดยอัตโนมัติ
- ถ้าเขียน Sheet ไม่สำเร็จ **ห้ามบล็อก flow** — บันทึกไว้ว่า `PENDING` แล้วให้ trigger รายชั่วโมงตามเก็บ (ใช้ outbox pattern แบบเดียวกับที่ Quotation ใช้อยู่แล้ว)
- อยากได้ PDF? → กด **"พิมพ์"** จากหน้าเว็บ (`window.print()` + CSS `@media print`) ได้ทันทีโดยไม่ต้องมีเซิร์ฟเวอร์แปลงไฟล์

---

## 2. การแมประบบเดิม → SB Connect

### 2.1 ผู้ใช้และสิทธิ์ — ข่าวดีคือแทบไม่ต้องทำอะไร

| ระบบเดิม (XAMPP) | SB Connect | การแมป |
|---|---|---|
| `users.emp_id` VARCHAR(30) zero-padded | `app_users.emp_id` text | ✅ ตรงกันอยู่แล้ว |
| `users.password_hash` bcrypt | `user_credentials.password_hash` bcrypt (pgcrypto) | ✅ อัลกอริทึมเดียวกัน แต่ **ไม่ต้อง migrate** เพราะพนักงานใช้รหัส SB Connect อยู่แล้ว |
| `roles.role_code = 'USER'` | `app_role = 'user'` | ✅ |
| `MANAGER_*`, `SUP_*` (20 role) | `app_role = 'manager'` | ✅ ยุบเหลือ role เดียว แล้วใช้ตารางแผนกคุมขอบเขตแทน |
| `roles.role_code = 'IT'` | `app_role = 'admin_it'` | ✅ |
| `ADMIN` | `app_role = 'admin'` | ✅ |
| `EXECUTIVE`/`EXCUTIVE`/`EXCLUSIVE`/`EXCUSIVE` (สะกด 4 แบบ!) | `app_role = 'exec'` | ✅ ยุบเหลือแบบเดียว |
| `user_role_departments` (หัวหน้า 1 คน ↔ หลายแผนก) | `manager_department_permissions` (`manager_emp_id`, `dept_th`) | ✅ **มีอยู่แล้วในระบบ ใช้ได้เลย** ต่างกันแค่อ้างชื่อแผนกเป็นข้อความแทน id |
| `departments` 23 แถว | `departments` 30 แถว | ⚠️ ต้องเทียบชื่อให้ตรงตอนย้ายข้อมูลเก่า |
| ไม่มี email | `app_users.email` มีครบ 338 คน | ✅ ดีขึ้น — ส่งอีเมลแจ้งเตือนได้ |

**สิ่งที่ต้องตัดสินใจ:** พนักงานในระบบเดิม 404 คน แต่ SB Connect มี 338 คน → ใบคำร้องเก่าบางใบอาจมี `requester_emp_id` ที่ไม่มีใน `app_users` แล้ว (คนลาออก) → **ออกแบบให้ FK เป็น `on delete set null` และเก็บชื่อแบบ snapshot ไว้ด้วยเสมอ** (ระบบเดิมก็ทำแบบนี้ และเป็นเจตนาที่ถูกต้อง)

### 2.2 สถานะ — คงไว้ 5 ค่าเดิมทุกประการ

```
WAIT_MANAGER      รอหัวหน้า/ผู้จัดการอนุมัติ
WAIT_IT           รอ IT ตรวจสอบ
MANAGER_REJECTED  หัวหน้า/ผู้จัดการไม่อนุมัติ   (จบทันที ไม่ส่งต่อ IT)
IT_REJECTED       IT ไม่อนุมัติ
COMPLETED         ปิดเคสแล้ว
```

ทำไมไม่ใช้ enum `request_status` ที่มีอยู่ (`pending/approved/rejected/closed/cancelled`)?
→ เพราะจะทำให้ข้อมูลเก่า 134 ใบแมปไม่ตรง (`MANAGER_REJECTED` กับ `IT_REJECTED` ยุบเป็น `rejected` เหมือนกันแล้วแยกไม่ออก) **ให้ใช้ `text` + `check constraint` 5 ค่าเดิม**

### 2.3 เลขที่คำร้อง — คงรูปแบบเดิม `IT6909-014`

`IT` + ปี พ.ศ. 2 หลัก + เดือน 2 หลัก + `-` + running 3 หลัก · รีเซ็ตรายเดือน · เวลา Asia/Bangkok

ในระบบใหม่ออกเลขด้วย **ตาราง counter + advisory lock ใน PostgreSQL** แทน retry loop 30 รอบ:
```
select pg_advisory_xact_lock(hashtextextended('it-req-no:'||period_key, 0));
insert into it_request_counters(period_key,last_no) values(...,1)
  on conflict(period_key) do update set last_no = it_request_counters.last_no + 1
returning last_no;
```
ปลอดภัยกว่าเดิม 100% (ไม่มีทางได้เลขซ้ำ) และต้อง **seed ค่าเริ่มต้นจากเลขล่าสุดของระบบเดิม** (`IT6909-014` → `period_key='6909', last_no=14`) ไม่งั้นจะออกเลขทับของเก่า

### 2.4 กฎธุรกิจที่ต้องยกมาให้ครบ

| กฎ | รายละเอียด | ยกมาไหม |
|---|---|---|
| วันที่ต้องการเสร็จ ≥ วันนี้ + 7 วัน | บังคับทั้ง frontend และ DB | ✅ ยกมา (ทำเป็น setting ปรับได้) |
| ต้องติ๊กวัตถุประสงค์อย่างน้อย 1 ข้อ | 12 ช่อง | ✅ |
| ติ๊ก "ตรวจเช็คคอมฯ" → ต้องกรอกเลขเครื่อง | `check_computer_no` | ✅ |
| ติ๊ก "ซ่อมแซมคอมฯ" → ต้องกรอกเลขเครื่อง | `repair_computer_no` | ✅ |
| ติ๊ก "อื่นๆ" → ต้องกรอกรายละเอียด | `other_detail` | ✅ |
| หัวหน้าไม่อนุมัติ = ปิดฝั่ง IT อัตโนมัติ | เขียน `it_staff_emp_id='SYSTEM'` + ต่อท้าย remarks | ✅ ทำใน SQL function เดียวกัน |
| หัวหน้าอนุมัติช้า → ขยาย due ให้ IT +3 วันทำงาน | เก็บวันเดิมไว้ที่ `manager_due_original_required_date` | ✅ ใช้ตาราง `holidays` ที่มีอยู่แล้วคำนวณวันทำงาน (ดีกว่าเดิม!) |
| IT ระบุวันที่เสร็จย้อนหลังได้ | ห้ามอนาคต ห้ามก่อนวันเปิดคำร้อง | ✅ |
| Concurrency guard | `where status='WAIT_MANAGER'` แล้วเช็ค rowcount | ✅ ใช้ `for update` + เช็คสถานะ |
| Auto-reject เกินกำหนด 3 วัน | ปิดอยู่ (`ENABLED=false`) | ⚠️ ยกโครงมา แต่ **ตั้งค่าเริ่มต้นเป็นปิด** เหมือนเดิม |
| แจ้งเตือนใกล้ครบกำหนด 3/2/1/0 วัน | กันซ้ำด้วย unique (request, alert_day) | ✅ ยกมา แต่เปลี่ยนจาก "รันตอนมีคนเปิดหน้า" เป็น **Apps Script time trigger วันละครั้ง** |
| แสดงวันที่เป็น พ.ศ. แบบสั้น `1/7/69` | `itreq_format_date_be_short` | ✅ เขียน helper ฝั่ง React |
| ลายเซ็น | มีโครงแต่ไม่ทำงานจริง (GD ปิด, โฟลเดอร์ว่าง) | ❌ **ไม่ยกมา** |

### 2.5 บั๊กของระบบเดิมที่จะหายไปเอง

1. **นาฬิกา 3 ตัวเดินไม่ตรงกัน** — `php.ini` ตั้ง `date.timezone=Europe/Berlin` ทำให้รายการที่ทำช่วงตี 1–7 โมง **วันที่อาจกลายเป็นเมื่อวาน** → ระบบใหม่ใช้ `timestamptz` + คำนวณวันด้วย `at time zone 'Asia/Bangkok'` ที่เดียว หมดปัญหา
   > ⚠️ **แต่ข้อมูลเก่า 134 ใบที่จะ migrate มีปัญหานี้ติดมาด้วย** ต้องตรวจก่อนนำเข้า
2. **ห้ามเปิดเครื่องเก่า+ใหม่พร้อมกัน** เพราะ scan แจ้งเตือนรันตอนมีคนเปิดหน้าเว็บ → ระบบใหม่ใช้ trigger ตามเวลาจริง ไม่มีปัญหานี้
3. **`first_password_setup.php` ตั้งรหัสใหม่ได้โดยไม่ต้องรู้รหัสเดิม** (รู้แค่ emp_id ก็ยึดบัญชีได้) → ช่องโหว่ร้ายแรง · ระบบใหม่ใช้ OTP ทางอีเมลที่ทำไว้แล้วใน `sql/20_` ✅

---

## 3. สคีมาใหม่ที่จะสร้าง (`sql/27_IT_REQUEST_MODULE.sql`)

> `sql/07_it_requests_schema.sql` ที่มีอยู่เป็น **โครงร่างคร่าวๆ 30 บรรทัด** ที่ไม่เคยใช้งานจริงและไม่รองรับ workflow ของระบบเดิม (ไม่มี 12 วัตถุประสงค์ ไม่มี 5 สถานะ ไม่มี log) → ไฟล์ 27 จะ **drop ตารางเดิมทิ้งแล้วสร้างใหม่** (ปลอดภัยเพราะยังไม่มีข้อมูลจริง — ต้องยืนยันด้วย `select count(*)` ก่อน)

### ตารางที่ 1 — `it_requests`

| กลุ่ม | คอลัมน์ |
|---|---|
| คีย์ | `request_id uuid pk`, `request_no text unique`, `period_key text`, `seq int` |
| วัตถุประสงค์ 12 ช่อง | เก็บเป็น `purposes text[]` + check ว่าทุกค่าอยู่ใน 12 รหัสที่อนุญาต + ต้องมีอย่างน้อย 1 · พร้อม `check_computer_no`, `repair_computer_no`, `other_detail` |
| เนื้อหา | `request_details` (บังคับ), `reason_and_objective` (บังคับ — **แก้คำสะกดจาก `reason_and_objecti`**), `required_specification` |
| ผู้ร้อง (snapshot) | `requester_emp_id` FK, `requester_full_name`, `requester_position`, `requester_dept_th` |
| วันที่ | `request_date date`, `required_date date`, `required_date_original`, `manager_due_days_late`, `manager_due_adjusted_at`, `manager_due_note` |
| หัวหน้า | `manager_decision text` (`PENDING`/`APPROVED`/`REJECTED`), `manager_emp_id`, `manager_name`, `manager_remarks`, `manager_decided_at` |
| IT | `it_decision text`, `it_staff_emp_id`, `it_staff_name`, `it_remarks`, `it_done_date date`, `it_decided_at` |
| สถานะ | `status text` check 5 ค่า |
| ไฟล์แนบ | `attachment_name`, `attachment_url`, `attachment_file_id` (Google Drive) |
| ทะเบียน Sheet | `sheet_sync_status text` (`PENDING`/`SYNCED`/`ERROR`), `sheet_row_no int`, `sheet_synced_at`, `sheet_sync_attempts int` |
| ระบบ | `metadata jsonb`, `created_at`, `updated_at` |

### ตารางที่ 2 — `it_request_logs`
audit trail ทุกการกระทำ · `action_by_emp_id` (รองรับค่า `SYSTEM`) · `old_status` → `new_status` · `action_text`

### ตารางที่ 3 — `it_request_counters`
`period_key text pk`, `last_no int`, `updated_at` — สำหรับออกเลขและ seed ค่าจากระบบเดิม

### ตารางที่ 4 — `it_request_due_alerts`
`request_id`, `alert_day int`, `channel text`, `sent_at` · unique `(request_id, alert_day, channel)` กันส่งซ้ำ

### RPC ที่จะสร้าง (11 ตัว)

| ฟังก์ชัน | ใครเรียก | ทำอะไร |
|---|---|---|
| `it_create_request(token, payload)` | ทุกคน | ออกเลข + validate ครบ + insert + log + แจ้งเตือน |
| `it_list_my_requests(token, filter)` | ทุกคน | ใบของตัวเอง |
| `it_get_request(token, request_no)` | ตามสิทธิ์ | รายละเอียด + log |
| `it_list_manager_queue(token, filter)` | manager/admin/admin_it/dev/exec | ใบที่รออนุมัติ ในแผนกที่ดูแล เรียงตามใกล้ครบกำหนด |
| `it_manager_decide(token, request_no, decision, remarks)` | เหมือนบน | อนุมัติ/ไม่อนุมัติ + ขยาย due + ปิดฝั่ง IT อัตโนมัติเมื่อ reject |
| `it_list_it_queue(token, filter)` | admin_it/admin/dev | ใบที่รอ IT |
| `it_close_request(token, request_no, decision, remarks, done_date)` | admin_it/admin/dev | ปิดเคส/ไม่อนุมัติ |
| `it_list_all_requests(token, filter)` | admin_it/admin/dev/exec | ทุกใบ + ค้นหา + แบ่งหน้า |
| `it_dashboard_summary(token)` | ตามสิทธิ์ | KPI: ค้างที่หัวหน้า/ค้างที่ IT/เสร็จเดือนนี้/เกินกำหนด |
| `it_admin_edit_request(token, request_no, patch)` | admin_it/dev | แก้ไขย้อนหลัง (แทน `admin_edit_request.php`) |
| `it_sync_register_claim(service)` | service_role | ให้ Apps Script ดึงใบที่ `sheet_sync_status='PENDING'` ไปเขียน Sheet แล้ว mark กลับ |

ทั้ง 10 ตัวแรกต้องเพิ่มใน **3 ที่พร้อมกัน** ไม่งั้น test แดง:
1. `create function` ใน `sql/27_`
2. `grant execute ... to anon` ใน `sql/17_SECURITY_HARDENING_AND_FIXES.sql`
3. `ALLOWED_RPC` ใน `src/helpers/api.ts`

(`it_sync_register_claim` ให้เฉพาะ `service_role` เท่านั้น **ห้ามใส่ใน ALLOWED_RPC**)

---

## 4. โครงสร้าง Google Sheet ทะเบียน

**ไฟล์:** `SBConnect_IT_Request_Register` (Apps Script สร้างเองครั้งแรก แล้วเก็บ id ไว้ที่ Script Property `IT_REQUEST_REGISTER_SHEET_ID`)

### แท็บ `REGISTER` — 1 คำร้อง = 1 แถว ต่อท้ายเรื่อยๆ

| คอลัมน์ | หัวตาราง | หมายเหตุ |
|---|---|---|
| A | เลขที่คำร้อง | คีย์ที่ใช้ค้นแถวเดิม (เหมือน FM IT-06 เดิม) |
| B | วันที่เปิดคำร้อง | พ.ศ. `D/M/YY` |
| C | วัตถุประสงค์ | รวมข้อความ + เลขเครื่อง/รายละเอียดอื่น |
| D | รายละเอียด / เหตุผล / Spec | 3 ท่อนคั่นบรรทัด (เหมือนเดิม) |
| E | แผนก | *(เพิ่มใหม่ — เดิมไม่มี แต่ต้องใช้ทำรายงาน)* |
| F | สถานะ | ข้อความไทย |
| G | ผู้ร้องขอ | |
| H | ผู้ดำเนินการ (IT) | ว่างถ้ายังไม่ปิด |
| I | วันที่ต้องการ | |
| J | วันที่เสร็จ | |
| K | ผลการพิจารณา + หมายเหตุ IT | `อนุมัติ` / `ไม่อนุมัติ` + ` | หมายเหตุ IT: ...` |
| L | หมายเหตุหัวหน้า | *(เพิ่มใหม่)* |
| M | อัปเดตล่าสุด | timestamp |

> คอลัมน์ A–D, G–K **ตรงกับ FM IT-06 เดิมทุกช่อง** เพื่อให้เอาไปใช้แทนกันได้ทันที (เดิมคอลัมน์ E, F ว่าง — ใช้เติมของใหม่พอดี)

### แท็บ `LOG` — ต่อท้ายอย่างเดียว ไม่มีการแก้
`เวลา | เลขที่คำร้อง | ผู้กระทำ (emp_id) | ชื่อ | การกระทำ | สถานะเดิม | สถานะใหม่`

### กลไกกันพัง
- Apps Script ใช้ `LockService.getScriptLock().waitLock(30000)` ล้อมทุกครั้งที่เขียน
- `TextFinder` ค้นคอลัมน์ A หา `request_no` → เจอ = เขียนทับแถวนั้น, ไม่เจอ = `appendRow`
- จำ `sheet_row_no` กลับไปเก็บใน Supabase เพื่อครั้งหน้าเขียนตรงแถวเลย ไม่ต้องค้น
- เขียนไม่สำเร็จ → คงสถานะ `PENDING` + `sheet_sync_attempts += 1` · **ไม่ทำให้ผู้ใช้กดปุ่มไม่ผ่าน**
- Time-driven trigger ทุก 1 ชั่วโมง เก็บตกใบที่ยัง `PENDING`

---

## 5. แผนการแจ้งเตือน

| เหตุการณ์ | ในแอป | อีเมล | Telegram |
|---|---|---|---|
| เปิดคำร้องใหม่ | → หัวหน้าที่ดูแลแผนกนั้น | → หัวหน้า | กลุ่ม IT (ถ้าเปิด) |
| หัวหน้าอนุมัติ | → ผู้ร้อง + ทีม IT | → ทีม IT | ✅ |
| หัวหน้าไม่อนุมัติ | → ผู้ร้อง | → ผู้ร้อง | ✅ |
| IT ปิดเคส / ไม่อนุมัติ | → ผู้ร้อง | → ผู้ร้อง | ✅ |
| ใกล้ครบกำหนด 3/2/1/0 วัน | → หัวหน้า | → หัวหน้า | ✅ |

- **ในแอป** ใช้ตาราง `notifications` ที่มีอยู่แล้ว (enum มี `it_request` และ `it_status` รออยู่แล้ว ✅)
- **อีเมล** ใช้ `MailApp.sendEmail` ใน Apps Script ตัวเดิมที่เพิ่งทำ OTP ลืมรหัสผ่านสำเร็จ
- **Telegram** เป็น optional เปิด/ปิดได้ที่ `app_settings` — **ต้องออก bot token ใหม่ เพราะ token เดิมอยู่ในไฟล์ที่อ่านได้**
- Push บนหน้าจอล็อกมือถือ = **เฟส 8** (ต้องใช้ VAPID ซึ่ง Apps Script เซ็นไม่ได้ ต้องใช้ Cloudflare Worker หรือ OneSignal)

---

## 6. แผนสำหรับ Quotation

### สิ่งที่พบ
โครงสร้างดีมาก (idempotency, advisory lock, source_hash, outbox) แต่มี 12 ช่องว่าง เรียงตามความสำคัญ:

| # | ปัญหา | ผลกระทบ | แก้ที่เฟส |
|---|---|---|---|
| 1 | **admin/admin_it/dev เข้าไม่ถึงหน้า Quotation เลย** — ปุ่มอยู่ใน `UserDashboard` เท่านั้น แต่ `App.tsx` ส่ง role เหล่านี้ไป `AdminDashboard` ที่ไม่มีคำว่า quotation | คนที่ backend ให้สิทธิ์ดูทุกใบ กลับกดเข้าไม่ได้ | 6 |
| 2 | พนักงานทุกคนเห็นปุ่ม Quotation (ไม่มี role gating) | ใบเสนอราคาควรจำกัดฝ่ายขาย/จัดซื้อ | 6 |
| 3 | **type ซ้อน 2 ชุด** แปลงด้วย `as unknown as QuotationApi` | คอมไพเลอร์จับ field ที่แมปผิดไม่ได้เลย | 6 |
| 4 | ไม่มีระบบอนุมัติ — สถานะเป็นแค่ `<select>` ใครก็ตั้ง `APPROVED` เองได้ | ช่องว่างเชิงธุรกิจที่ใหญ่ที่สุด | 6 |
| 5 | สถานะ `EXPIRED` มีใน DB แต่ไม่มีใน UI และไม่มีใครตั้งอัตโนมัติจาก `validity_days` | | 6 |
| 6 | ไม่มีปุ่มลบใบเสนอราคา | | 6 |
| 7 | `created_by_emp_id` เป็น `on delete restrict` → `admin_delete_user` จะ fail ถ้าคนนั้นเคยออกใบเสนอราคา | ลบพนักงานไม่ได้แล้วขึ้น error งงๆ | 6 |
| 8 | ไม่มี master ลูกค้า/สินค้า/หน่วย — พิมพ์ใหม่ทุกครั้ง | พิมพ์ผิด ชื่อลูกค้าไม่ตรงกันข้ามใบ | 7 |
| 9 | UI ไม่มีช่อง `currency`, `customer_code` ทั้งที่ schema รองรับ | | 7 |
| 10 | `?mock=1` ไม่ครอบ quotation → **dev อาจยิงไป Apps Script production จริง** | เสี่ยงสร้างใบจริงตอนทดสอบ | 6 |
| 11 | คำนวณยอดอยู่ **4 ที่** (service / workspace fallback / Apps Script / SQL) ปัดเศษไม่เหมือนกัน | ต่างกันระดับสตางค์ | 6 |
| 12 | `quotation_safe_date()` เป็น dead code · เอกสาร `docs/16_` ล้าสมัย (อ้าง `app/assets/js/sbConfig.js` ที่เลิกใช้แล้ว) | | 7 |

### สิ่งที่ **ห้าม** ทำ
- ❌ **ห้ามใส่ `sync_quotation_from_drive` / `reconcile_quotation_from_drive` / `validate_quotation_session_for_service` ลงใน `ALLOWED_RPC`** — ทั้ง 3 ตัว grant ให้ `service_role` เท่านั้น ถ้าใส่ `securityContract.test.ts` จะแดงทันที และเท่ากับเปิดให้เบราว์เซอร์เขียนใบเสนอราคาได้โดยตรง
- ต้องการให้ admin อ่านใบเสนอราคาจากแอป → สร้าง RPC **ใหม่** `admin_list_quotations` / `admin_get_quotation` แบบ `security definer` อ่านอย่างเดียว แล้วทำครบ 3 ที่ (SQL + grant ใน 17_ + ALLOWED_RPC)

---

## 7. ลำดับงาน 8 เฟส

> แต่ละเฟสจบแล้วต้อง **ดันขึ้น GitHub ได้และแอปยังใช้งานได้ปกติ** ไม่มีเฟสไหนที่ทิ้งระบบไว้ครึ่งๆ กลางๆ

### เฟส 1 — ฐานข้อมูล IT Request ✅ เริ่มทันที
- `sql/27_IT_REQUEST_MODULE.sql` — 4 ตาราง + 11 RPC + grant + seed `app_settings`
- `sql/28_IT_REQUEST_SEED_COUNTER.sql` — seed เลขรันจากระบบเดิม (`6909` → `14`)
- แก้ `sql/17_` เพิ่ม grant 10 ตัว
- **ทดสอบบน PostgreSQL จริงในแซนด์บ็อกซ์**: เปิดใบ → หัวหน้าอนุมัติ → IT ปิด · ทดสอบ reject ทั้ง 2 แบบ · ทดสอบออกเลขพร้อมกัน 10 คน (ต้องไม่ซ้ำ)
- **เกณฑ์ผ่าน:** รัน SETUP ใหม่ทั้งชุดแล้ว 0 error · `18_VERIFY_SECURITY` ผ่านหมด

### เฟส 2 — Apps Script: Sheet ทะเบียน
- เพิ่ม action `it_register_sync` + `it_register_flush` + `it_notify` ใน `SBConnect_Drive_Upload_API.gs`
- สร้าง Sheet อัตโนมัติครั้งแรก + ตั้ง Script Property
- Time trigger รายชั่วโมงเก็บตก `PENDING`
- ฟังก์ชันทดสอบ `TEST_IT_REGISTER` กดรันเองได้
- **เกณฑ์ผ่าน:** เปิดใบทดสอบ 1 ใบ → มีแถวโผล่ใน Sheet ภายใน 5 วินาที · เปลี่ยนสถานะ → แถวเดิมอัปเดต ไม่เพิ่มแถวใหม่

### เฟส 3 — หน้าจอผู้ร้องขอ
- `src/components/ITRequestWorkspace.tsx` — ฟอร์ม 12 checkbox + validate + แนบไฟล์ + รายการของฉัน + ไทม์ไลน์สถานะ
- `src/services/itRequestService.ts` — เรียกผ่าน `rpc()` ใน `helpers/api.ts` (**ไม่ทำ transport แยกแบบ Quotation**)
- ต่อเข้าเมนู `UserDashboard` แท็บ `tools`
- **เกณฑ์ผ่าน:** พนักงานทั่วไปเปิดใบได้ เห็นสถานะของตัวเอง แนบรูปได้

### เฟส 4 — กล่องอนุมัติของหัวหน้า
- แท็บใหม่ใน `UserDashboard` (หัวหน้าลง UserDashboard) + การ์ดเรียงตามใกล้ครบกำหนด สีตามจำนวนวันเหลือเหมือนเดิม
- ปุ่มอนุมัติ/ไม่อนุมัติ + ช่องหมายเหตุ + ยืนยันก่อนส่ง
- **เกณฑ์ผ่าน:** หัวหน้าเห็นเฉพาะแผนกที่ดูแลจริง (ทดสอบด้วยบัญชี 2 คนต่างแผนก)

### เฟส 5 — กล่องงานของ IT + หน้ารวมใน AdminDashboard
- แท็บ "IT Request" ใน `AdminDashboard` — คิวงาน + ค้นหาทุกใบ + KPI + หน้าแก้ไขย้อนหลัง + ปุ่มพิมพ์
- **เกณฑ์ผ่าน:** เดิน flow ครบ 1 ใบจริงบนเว็บออนไลน์ + Sheet อัปเดตครบทุกขั้น

### เฟส 6 — รวม Quotation ให้สมบูรณ์
- ต่อเมนูใน `AdminDashboard` + จำกัด role ฝั่ง `UserDashboard`
- ยุบ type เหลือชุดเดียว ทิ้ง `as unknown as`
- รวมการคำนวณเหลือแหล่งเดียว (`quotationService`) ให้ workspace เรียกใช้
- เพิ่ม `quotation_status_history` + `approved_by_emp_id` + สถานะ `EXPIRED` อัตโนมัติ
- แก้ `created_by_emp_id` เป็น `on delete set null` + เก็บชื่อ snapshot
- แก้ `?mock=1` ให้ครอบ quotation ด้วย
- RPC ใหม่ `admin_list_quotations` / `admin_get_quotation`

### เฟส 7 — ข้อมูลเก่า + master data
- นำเข้าใบคำร้องเก่า 134 ใบ (ต้องได้ `mysqldump itrequest_db` จากเครื่องเดิมก่อน)
- ตรวจแก้วันที่ที่เพี้ยนจากบั๊ก timezone Berlin
- rebuild Sheet ทะเบียนจากข้อมูลทั้งหมด
- master ลูกค้า/สินค้า/หน่วย สำหรับ Quotation
- เทียบชื่อแผนก 23 ↔ 30 ให้ตรง

### เฟส 8 — ส่วนขยาย (ทีหลัง)
- โมดูล Stock/Inventory (95 รายการ, 152 movement) — ใหญ่พอๆ กับ IT Request ทั้งโมดูล
- Web Push แจ้งเตือนบนหน้าจอล็อกมือถือ (ต้องมี Cloudflare Worker เซ็น VAPID)
- รายงาน/กราฟสรุปรายเดือน

---

## 8. ความเสี่ยงและวิธีรับมือ

| ความเสี่ยง | ผลถ้าเกิด | วิธีรับมือ |
|---|---|---|
| ผู้ใช้ 404 คนในระบบเดิม แต่ SB Connect มี 338 | ใบเก่าบางใบหาเจ้าของไม่เจอ | FK `on delete set null` + เก็บชื่อ snapshot เสมอ |
| เลขคำร้องซ้ำกับของเก่า | เอกสารชนกัน | seed counter จาก `IT6909-014` ก่อนเปิดใช้ **ทำในเฟส 1** |
| Apps Script quota (MailApp 100 ฉบับ/วัน) | อีเมลไม่ออก | แจ้งเตือนในแอปเป็นหลัก อีเมลเป็นรอง + log ทุกครั้งที่ส่งไม่สำเร็จ |
| Sheet โต 134 → หลายพันแถว | ค้นช้า | ใช้ `sheet_row_no` เขียนตรงแถว ไม่ต้องค้น + แยกแท็บรายปีเมื่อเกิน 5,000 แถว |
| เปิดระบบใหม่ขนานกับ XAMPP | ข้อมูลแตกเป็น 2 ชุด | **ตัดสวิตช์วันเดียว** ปิด Apache เครื่องเก่าทันทีที่เปิดระบบใหม่ (PLAN ของคุณเขียนเตือนไว้แล้ว) |
| `sql/` หลุดขึ้น GitHub อีก | ข้อมูลพนักงานรั่ว | `.gitignore` มี `sql/` แล้ว + `securityContract.test.ts` มีเทสต์เช็คให้ · ไฟล์ 27/28 อยู่ใน `sql/` จึงไม่ขึ้น GitHub โดยอัตโนมัติ |

---

## 9. สิ่งที่ต้องขอจากคุณ (ไม่บล็อกเฟส 1–6)

1. **`mysqldump --routines --events --triggers --single-transaction itrequest_db > itrequest_db.sql`** จากเครื่อง XAMPP → ใช้ในเฟส 7 (ห้ามใช้ไฟล์ `--all-databases` ที่ backup ไว้ เพราะจะทับตาราง `mysql` ของระบบ)
2. ผลลัพธ์ 3 คำสั่งนี้ (ไว้ยืนยันสิ่งที่ผมอนุมานไว้):
   - `SELECT status, COUNT(*) FROM it_requests GROUP BY status;`
   - `SELECT * FROM roles ORDER BY role_id;`
   - `SHOW CREATE TABLE users;`
3. **ยืนยันว่าเลขล่าสุดคือ `IT6909-014`** (ถ้าเปิดใบเพิ่มหลังจากนี้ ให้บอกเลขล่าสุดจริง)
4. ตัดสินใจ 3 ข้อ:
   - Telegram — เอาต่อไหม? ถ้าเอา ต้อง**ออก bot token ใหม่** (ตัวเดิมอยู่ในไฟล์ที่อ่านได้)
   - ใครควรเห็นปุ่ม Quotation? (ทุกคน / เฉพาะฝ่ายขาย+จัดซื้อ / เฉพาะ manager ขึ้นไป)
   - Quotation ต้องมีระบบอนุมัติไหม? (ตอนนี้ใครก็ตั้งเป็น "อนุมัติแล้ว" เองได้)

---

## 10. สิ่งที่ผมยืนยันไม่ได้ (บอกตรงๆ)

1. **จำนวนแถวจริงของทุกตารางในระบบเดิม** — ผมอ่านจากไฟล์ `.ibd`/`.frm` และไฟล์ Excel ไม่ได้ query DB จริง
2. **`CREATE TABLE users` ฉบับจริง** — reconstruct จาก `users.frm` ชนิดข้อมูลบางตัวเป็นการอนุมาน
3. **สถานะรันไทม์ของ Quotation** — Apps Script deploy เวอร์ชันล่าสุดหรือยัง, Script Properties ครบไหม, ตาราง `quotations` ใน production มีข้อมูลหรือยัง ดูจากซอร์สไม่ได้
4. **ชื่อแผนก `department_id = 22`** ในระบบเดิม อ่านจากไฟล์ไบนารีไม่สำเร็จ
5. รายละเอียดเลย์เอาต์ทุกเซลล์ของ PDF/XLSX ใน Quotation Apps Script (อ่านเฉพาะโครงสร้าง)

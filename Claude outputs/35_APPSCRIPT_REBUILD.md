# กู้ Apps Script ที่หายไป + แยกโฟลเดอร์รูปตามเกม

**SB Connect · 23 กันยายน 2569**

---

## สรุปสั้นที่สุด

โปรเจกต์ Apps Script หาย = **Script Properties ว่าง** = แอป **อัปโหลดรูปใหม่ไม่ได้**

แต่ **รูปเก่าที่เคยอัปไปแล้วไม่ได้หายตามไปด้วย** เพราะหน้าเว็บแสดงรูปจาก *รหัสไฟล์*
(`https://lh3.googleusercontent.com/d/<รหัสไฟล์>`) ไม่ได้แสดงผ่านรหัสโฟลเดอร์เลย
รหัสโฟลเดอร์ถูกใช้แค่ตอน "จะเอาไฟล์ใหม่ไปวางไว้ที่ไหน" เท่านั้น

เพราะฉะนั้นคำถามเดียวที่ต้องตอบก่อนคือ:

> **บัญชี Google ที่จะใช้รัน Apps Script ตัวใหม่ ยังเข้าถึงโฟลเดอร์/ไฟล์เดิมได้ไหม**

- **เข้าถึงได้** → ตัวติดตั้งจะหยิบโฟลเดอร์เดิมกลับมาใช้ รูปเก่าอยู่ครบ ไม่ต้องทำอะไรเพิ่ม
- **เข้าถึงไม่ได้** → ตัวติดตั้งจะสร้างชุดใหม่ให้ แอปกลับมาอัปโหลดได้ทันที แต่รูปเก่าต้องอัปใหม่

ไฟล์ `SB_CHECK_LEGACY()` ตอบคำถามนี้ให้ภายใน 10 วินาที โดยไม่แก้อะไรเลย

---

## ของใหม่ที่เตรียมไว้ให้ 4 ไฟล์

| ไฟล์ | ทำอะไร |
|---|---|
| `apps_script/SBConnect_Setup_Folders.gs` | **ไฟล์ใหม่** ตัวติดตั้ง: หาโฟลเดอร์เดิมก่อน ถ้าไม่เจอค่อยสร้างใหม่ แล้วเขียน Script Properties ให้เอง — ไม่ต้องก๊อป ID ทีละอันด้วยมือ |
| `apps_script/SBConnect_Drive_Upload_API.gs` | **แก้แล้ว** รองรับ bucket รูปเกม `game_<slug>` แยกโฟลเดอร์เกมละอัน และจำกัดให้เฉพาะแอดมินอัปได้ |
| `apps_script/SBConnect_Image_Sharing_Audit.gs` | **แก้แล้ว** ตรวจสิทธิ์รูปของเกมด้วย และรู้จักเกมใหม่เองโดยไม่ต้องแก้โค้ด |
| `sql/34_DRIVE_ASSETS_REPORT.sql` | **ไฟล์ใหม่** ตรวจอย่างเดียว: รูปในระบบมีกี่ใบ อยู่โฟลเดอร์ไหน ถ้าของเดิมหายต้องอัปใหม่กี่ใบ |

---

## ผังโฟลเดอร์ที่ตัวติดตั้งจะสร้าง

```
SB_CONNECT_APP/                     ← SB_ROOT_FOLDER_ID
├── 01_profile                      ← FOLDER_PROFILE_ID        รูปโปรไฟล์
├── 02_news                         ← FOLDER_NEWS_ID           รูปข่าว
├── 03_missions                     ← FOLDER_MISSIONS_ID       รูปภารกิจ
├── 04_rewards                      ← FOLDER_REWARD_ID         รูปของรางวัล
├── 05_mission_evidence             ← FOLDER_MISSION_EVIDENCE_ID
├── 06_attachments                  ← FOLDER_ATTACHMENTS_ID
├── 07_games/                       ← FOLDER_GAMES_ID          โฟลเดอร์แม่ของเกม
│   └── wheel                       ← FOLDER_GAME_WHEEL_ID     รูปกงล้อรางวัล
└── 08_quotation/                   ← FOLDER_QUOTATION_ID      (ยัง hold อยู่)
    ├── pdf                         ← FOLDER_QUOTATION_PDF_ID
    └── images                      ← FOLDER_QUOTATION_IMAGE_ID
```

**เพิ่มเกมใหม่ทีหลัง** เปิดไฟล์ติดตั้ง แก้บรรทัด `var slug = 'quiz';` เป็นชื่อเกมใหม่
แล้วกด Run ที่ `SB_ADD_GAME()` → ได้โฟลเดอร์ `07_games/<slug>` + property
`FOLDER_GAME_<SLUG>_ID` อัตโนมัติ ฝั่งแอปส่ง `bucket: "game_<slug>"` ได้ทันที
**ไม่ต้องแก้โค้ด `SBConnect_Drive_Upload_API.gs` อีกเลย**

ถ้าเกมไหนยังไม่ได้สร้างโฟลเดอร์ของตัวเอง ไฟล์จะไปลงที่ `07_games` แทน — อัปโหลดไม่พัง

---

## ขั้นตอนที่ต้องทำเอง (เรียงตามลำดับ ห้ามสลับ)

### ขั้นที่ 0 — สำรองก่อน

```
D:\Projectsbconnect_app\BACKUP_TO_GDRIVE.bat
```

และใน Supabase → Database → Backups → กด backup หนึ่งครั้ง

---

### ขั้นที่ 1 — เปิดโปรเจกต์ Apps Script

ดับเบิลคลิก

```
G:\My Drive\SBconnection\Projectsbconnect_app\apps_script\Script_SBconnect.gscript
```

**ต้องเช็กให้แน่ว่าล็อกอินอยู่ด้วยบัญชีเดียวกับที่เป็นเจ้าของโฟลเดอร์รูปเดิม**
ถ้ามีหลายบัญชีใน Chrome ให้ดูมุมขวาบนของหน้า Apps Script ก่อน

> ถ้าเปิดไฟล์นี้แล้วโปรเจกต์ยังอยู่ (แค่โค้ดหาย) → **ดีมาก** เพราะขั้นที่ 7
> จะเลือกแบบ "อัปเดต deployment เดิม" ได้ URL `/exec` จะไม่เปลี่ยน ไม่ต้องแก้ `.env`
> ถ้าเปิดไม่ได้เลย → สร้างโปรเจกต์ใหม่ที่ script.google.com

---

### ขั้นที่ 2 — วางโค้ดให้ครบ 4 ไฟล์

ใน Apps Script Editor กดเครื่องหมาย **+** ข้างคำว่า Files แล้วสร้างไฟล์ตามนี้
(ชื่อไฟล์พิมพ์ให้ตรง ไม่ต้องใส่ `.gs` ตอนตั้งชื่อ)

| ชื่อไฟล์ใน Apps Script | ก๊อปเนื้อหาจาก |
|---|---|
| `SBConnect_Setup_Folders` | `apps_script/SBConnect_Setup_Folders.gs` |
| `SBConnect_Drive_Upload_API` | `apps_script/SBConnect_Drive_Upload_API.gs` |
| `SBConnect_Image_Sharing_Audit` | `apps_script/SBConnect_Image_Sharing_Audit.gs` |
| `SBConnect_IT_Request_Register` | `apps_script/SBConnect_IT_Request_Register.gs` |

ไฟล์ที่ 4 ต้องใส่ด้วย **แม้โมดูล IT Request ยัง hold อยู่** เพราะ `doPost` ใน
ไฟล์หลักเรียก `itReqFlushRegister_()` ถ้าไม่มีไฟล์นี้จะพังตอนมีคำขอ
`it_request_sync` วิ่งเข้ามา (Apps Script ไม่ฟ้องตอน save ฟ้องตอนรันจริง)

---

### ขั้นที่ 3 — ใส่ค่าความลับ 2 ตัว

ฟันเฟือง **Project Settings** → เลื่อนลงล่างสุด **Script Properties** → **Add script property**

| Property | ค่า | หาได้จาก |
|---|---|---|
| `SUPABASE_URL` | `https://tmcbblwfucwauksenqqr.supabase.co` | มีอยู่ใน `.env` แล้ว |
| `SUPABASE_SERVICE_ROLE_KEY` | *(คีย์ยาวๆ)* | Supabase → Settings → API → `service_role` **secret** |

> ⚠️ `service_role` key อยู่ได้ที่เดียวคือที่นี่ **ห้ามใส่ใน `.env` ห้ามใส่ในโค้ดหน้าเว็บ**
> ถ้าเคยหลุดออกไปให้กด Reset ใน Supabase ก่อนแล้วค่อยเอาอันใหม่มาใส่

**ยังไม่ต้องใส่ `FOLDER_*` ใดๆ ทั้งสิ้น** — ขั้นที่ 5 จะใส่ให้เอง

---

### ขั้นที่ 4 — ตรวจว่าของเดิมยังอยู่ไหม *(ยังไม่แก้อะไร)*

เลือกฟังก์ชัน **`SB_CHECK_LEGACY`** จาก dropdown ด้านบน → กด **Run**

ครั้งแรก Google จะขอสิทธิ์ → Review permissions → เลือกบัญชี → Advanced →
Go to (ชื่อโปรเจกต์) → Allow

ดูผลที่ **Execution log** ด้านล่าง แล้ว**ส่งข้อความในนั้นกลับมาให้ผมทั้งหมด**

อ่านเองคร่าวๆ ได้แบบนี้:

- ขึ้น `OK` หมด → ของเดิมอยู่ครบ รูปเก่าไม่หาย
- ขึ้น `พัง` หมด → บัญชีนี้เข้าไม่ถึงของเดิม ต้องเริ่มชุดใหม่ + อัปรูปใหม่
- ปนกัน → อันที่ OK จะถูกใช้ต่อ อันที่พังจะสร้างใหม่ทีละอัน

---

### ขั้นที่ 5 — ติดตั้งจริง

เลือกฟังก์ชัน **`SB_SETUP_ALL`** → **Run**

จะได้ log บอกทีละบรรทัดว่าอันไหน *ใช้ของเดิม* อันไหน *สร้างใหม่* และปิดท้ายด้วย
`สรุป: ใช้ของเดิม N รายการ · สร้างใหม่ M รายการ`

รันซ้ำกี่รอบก็ได้ ผลเหมือนเดิมทุกครั้ง (ทดสอบแล้ว) ไม่สร้างโฟลเดอร์ซ้ำ

---

### ขั้นที่ 6 — เอา ID ใหม่ไปบอก Supabase

เลือกฟังก์ชัน **`SB_SHOW_CONFIG`** → **Run** → ใน log จะมีบล็อก

```
── SQL: ก๊อปไปวางใน Supabase > SQL Editor แล้วกด Run ──
insert into public.app_settings(key, value, description, is_public) values
  ...
on conflict (key) do update set ...
```

ก๊อปตั้งแต่ `insert` ถึง `;` เอาไปวางใน **Supabase → SQL Editor → Run**

---

### ขั้นที่ 7 — Deploy

**ทางที่ดีกว่า — ถ้ามี deployment เดิมอยู่** (URL ไม่เปลี่ยน ไม่ต้อง build ใหม่)

1. **Deploy** → **Manage deployments**
2. กดดินสอ ✏️ ที่ deployment เดิม
3. **Version** → **New version**
4. **Deploy**

URL `/exec` เดิมจะยังใช้ได้ทันที → **ข้ามขั้นที่ 8 ไปเลย**

**ถ้าไม่มี deployment เดิม**

1. **Deploy** → **New deployment** → เฟือง → **Web app**
2. Execute as: **Me**
3. Who has access: **Anyone**
4. **Deploy** → ก๊อป URL ที่ลงท้าย `/exec`

---

### ขั้นที่ 8 — *(เฉพาะกรณีได้ URL ใหม่)* แก้ endpoint แล้ว build ใหม่

ค่านี้ถูกฝังตอน **build** ไม่ใช่ตอนเปิดเว็บ แก้ที่เดียวไม่พอ ต้องแก้ทั้ง 2 ที่

1. `D:\Projectsbconnect_app\.env`
   ```
   VITE_DRIVE_UPLOAD_ENDPOINT=https://script.google.com/macros/s/<ของใหม่>/exec
   ```
2. GitHub → repo `SBCONNECTION` → **Settings** → **Secrets and variables** →
   **Actions** → แท็บ **Variables** → แก้ `VITE_DRIVE_UPLOAD_ENDPOINT`
3. รัน `D:\Projectsbconnect_app\push.bat` แล้วรอ GitHub Actions ขึ้นเขียว

---

### ขั้นที่ 9 — ตรวจสิทธิ์รูป

เลือก **`IMAGE_SHARING_CHECK`** → **Run** → ต้องได้ `ยังไม่เปิดให้ดู 0`

ถ้าไม่ใช่ 0 ให้รัน **`IMAGE_SHARING_FIX`** แล้วรัน `IMAGE_SHARING_CHECK` ซ้ำให้ได้ 0

---

### ขั้นที่ 10 — ตรวจของจริงในแอป

1. เปิด `https://script.google.com/macros/s/<id>/exec` ในเบราว์เซอร์ตรงๆ
   ต้องได้ JSON ที่มี `"gameFolderConfigured": true` และมี `game_wheel` ใน `gameBuckets`
2. เข้าแอปด้วยบัญชีแอดมิน → เพิ่มข่าว 1 อัน + แนบรูป → รูปต้องขึ้น
3. แก้รูปโปรไฟล์ตัวเอง → รูปต้องขึ้น
4. เพิ่มของรางวัล + รูป → รูปต้องขึ้น
5. รัน `sql/34_DRIVE_ASSETS_REPORT.sql` ใน Supabase → ส่งตารางกลับมาให้ผม

---

## เรื่องระบบเกม — สถานะจริงตอนนี้

เปิดดูไฟล์ในเครื่องแล้ว ตอนนี้มีแค่ **หน้าตาของกงล้อ** ยังไม่มีหลังบ้าน

| ส่วน | สถานะ |
|---|---|
| `src/games/wheel/WheelGame.tsx` | ✅ มีแล้ว วาดกงล้อ 6 ช่อง หมุนได้ รับ `slots` + `onSpin()` จากข้างนอก |
| เรียกใช้ใน `UserDashboard.tsx` | ❌ **ยังไม่ได้ต่อเลย** — ไฟล์นี้ยังไม่ถูก import ที่ไหน |
| ตารางในฐานข้อมูล (`wheel_slots`, `wheel_spins`, สิทธิ์การหมุน) | ❌ ยังไม่มี |
| RPC `spin_wheel` ที่ตัวคอมโพเนนต์รอเรียก | ❌ ยังไม่มี |
| หน้าแอดมินตั้งช่องรางวัล / อัตราออก / สต็อก | ❌ ยังไม่มี |
| ที่เก็บรูปของเกม | ✅ **พร้อมแล้วจากงานรอบนี้** (`07_games/wheel`, bucket `game_wheel`) |

**ข้อดีของโครงที่เขียนไว้:** `onSpin()` ให้เซิร์ฟเวอร์ตัดสินผลแล้วค่อยหมุนไปหยุด
ช่องนั้น ถูกต้องตามหลักแล้ว — หน้าบ้านไม่รู้อัตราออก โกงไม่ได้

**ข้อควรระวังที่เจอ:** `sql/33_AUDIT_POINTS_TYPES.sql` เป็นสคริปต์เตรียมแปลงแต้ม
เป็นทศนิยม ถ้าจะแปลงจริงต้องทำ **ก่อน** เขียนระบบเกม ไม่งั้นต้องรื้อฟังก์ชันเกมซ้ำอีกรอบ
เพราะฟังก์ชันแต้มเดิมประกาศตัวแปรภายในเป็น `integer` — ค่า 0.5 จะถูกปัดเศษเงียบๆ

---

## ลำดับที่แนะนำหลังจากนี้

| ลำดับ | งาน | ใครทำ |
|---|---|---|
| 1 | ขั้นที่ 0–10 ข้างบน — ให้แอปกลับมาอัปโหลดรูปได้ | คุณ |
| 2 | ส่ง log `SB_CHECK_LEGACY` + ผล `34_DRIVE_ASSETS_REPORT.sql` กลับมา | คุณ |
| 3 | งานค้างเดิม: `32_` → `31_` → `26_` → `18_` → `push.bat` (รายชื่อใหม่ + ล้างแต้มเทส) | คุณ |
| 4 | ตัดสินใจ: แต้มเป็นทศนิยมหรือไม่ | คุยกัน |
| 5 | เขียนหลังบ้านเกมกงล้อ (ตาราง + RPC + หน้าแอดมิน + ต่อเข้าเมนู) | ผม |

---

## สิ่งที่ผมยืนยันไม่ได้จากตรงนี้

1. เข้า Google Drive ของคุณตรงๆ ไม่ได้ จึงบอกไม่ได้ว่าโฟลเดอร์เดิมยังอยู่ไหม —
   `SB_CHECK_LEGACY()` เป็นตัวตอบ
2. ต่อ Supabase production ไม่ได้ ตัวเลขทั้งหมดต้องมาจากการรัน SQL จริง
3. `npm run dev` / `npm run check` รันจากที่นี่ไม่ได้ (npm ถูกบล็อก) —
   โค้ด Apps Script ทั้ง 3 ไฟล์ตรวจด้วย Node แล้ว (syntax ผ่าน + จำลองการทำงาน 28 เคสผ่าน)
   และ `34_DRIVE_ASSETS_REPORT.sql` รันจริงบน PostgreSQL 16 แล้วได้ผลถูกต้อง

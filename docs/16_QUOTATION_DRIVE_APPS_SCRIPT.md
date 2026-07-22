# ระบบ Quotation: SB Connect + Supabase SQL + Google Apps Script + Google Drive

ระบบนี้ใช้ Supabase SQL เก็บข้อมูลใบเสนอราคาแบบ normalized เพื่อค้นหา ตรวจสอบ และทำรายงาน ส่วน Google Drive เป็นแหล่งเก็บไฟล์จริง ได้แก่ รูป ไฟล์แนบ PDF และ XLSX จึงใช้พื้นที่ฐานข้อมูล Supabase เพิ่มเล็กน้อยตามจำนวนข้อความ/รายการ แต่ไม่ใช้ Supabase Storage สำหรับไฟล์ Quotation

โฟลเดอร์ปลายทาง:

`1AtmDwLBJmK9OTgkskEdHBxqMildr6msf`

## สิ่งที่ระบบสร้าง

- Supabase tables: `quotations`, `quotation_items`, `quotation_cost_notes` และ `quotation_files`
- Google Sheet ชื่อ `SBConnect_Quotation_Index` เป็นดัชนีและเก็บข้อมูล JSON ของใบเสนอราคา
- PDF สำหรับส่งลูกค้า โดยไม่แสดงต้นทุนภายในหรือ GP
- XLSX สำหรับวิเคราะห์ภายใน มีราคา ต้นทุน Cost Notes กำไร และ GP
- รูปสินค้าและไฟล์แนบที่ผูกกับใบเสนอราคา
- เลขที่อัตโนมัติแบบปี พ.ศ. เช่น `Q69070001`

ผู้ใช้ทั่วไปเห็นเฉพาะใบที่ตนเองสร้าง ส่วน `manager`, `admin`, `admin_it` และ `dev` ดูใบทั้งหมดได้

## 1. ติดตั้ง Supabase SQL

เปิด Supabase Dashboard > SQL Editor แล้วรันไฟล์นี้หนึ่งครั้ง:

`sql/15_QUOTATION_SUPABASE_SCHEMA.sql`

Migration เป็นแบบ idempotent จึงรันซ้ำได้ และประกอบด้วย:

- 4 ตารางพร้อม foreign keys, checks และ indexes
- RLS แบบ service-only: browser/anon/authenticated เข้าตารางโดยตรงไม่ได้
- RPC ตรวจ session ที่อ่าน role และสถานะล่าสุดจาก `app_users`
- RPC sync แบบ transaction เดียว พร้อม `source_version` ป้องกันข้อมูลเก่าทับข้อมูลใหม่

ตรวจหลังรัน:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('quotations','quotation_items','quotation_cost_notes','quotation_files')
order by table_name;
```

ต้องได้ 4 แถว ไม่ต้องสร้าง Supabase Storage bucket เพิ่ม

## 2. ตั้งค่า Script Properties

เปิด Apps Script > Project Settings > Script properties แล้วเพิ่มค่าต่อไปนี้

| Property | ค่า/คำอธิบาย |
|---|---|
| `FOLDER_QUOTATION_ID` | `1AtmDwLBJmK9OTgkskEdHBxqMildr6msf` |
| `SUPABASE_URL` | URL ของ Supabase โปรเจกต์เดียวกับ SB Connect |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key สำหรับตรวจ session ฝั่ง server เท่านั้น |

ห้ามใส่ `SUPABASE_SERVICE_ROLE_KEY` ใน `sbConfig.js`, React, GitHub หรือไฟล์ที่ browser ดาวน์โหลดได้

ค่าเสริมสำหรับหัวเอกสาร:

| Property | คำอธิบาย |
|---|---|
| `QUOTATION_COMPANY_NAME` | ชื่อบริษัท |
| `QUOTATION_COMPANY_ADDRESS` | ที่อยู่บริษัท |
| `QUOTATION_COMPANY_PHONE` | เบอร์โทร |
| `QUOTATION_COMPANY_TAX_ID` | เลขประจำตัวผู้เสียภาษี |
| `QUOTATION_LOGO_FILE_ID` | File ID ของโลโก้ใน Drive |

ค่าการแชร์ (ไม่บังคับ):

| Property | คำอธิบาย |
|---|---|
| `QUOTATION_SHARE_MODE=ANYONE_WITH_LINK` | เปิดเฉพาะ PDF สำหรับลูกค้าให้ผู้มีลิงก์ดูได้ |
| `QUOTATION_INTERNAL_SHARE_MODE=ANYONE_WITH_LINK` | เปิด XLSX วิเคราะห์ภายในให้ผู้มีลิงก์ดูได้ — ไม่แนะนำ |
| `QUOTATION_UPLOAD_SHARE_MODE=ANYONE_WITH_LINK` | เปิดรูป/ไฟล์แนบให้ผู้มีลิงก์ดูได้ — ใช้เมื่อจำเป็น |
| `QUOTATION_SQL_SYNC_ENABLED=FALSE` | ปิด SQL mirror ชั่วคราวเฉพาะตอนซ่อมระบบ — ค่าเริ่มต้นเปิดใช้งาน |

ค่าเริ่มต้นคือไฟล์ private และใช้สิทธิ์ของโฟลเดอร์ Drive แนะนำให้แชร์โฟลเดอร์กับ Google Group หรือบัญชีของบริษัทแทนการเปิด `ANYONE_WITH_LINK`

ระบบจะสร้างและบันทึก `QUOTATION_INDEX_SHEET_ID` ให้อัตโนมัติ ไม่ต้องกรอกเอง

## 3. ใส่โค้ดและเตรียมระบบครั้งแรก

1. นำไฟล์ `apps_script/SBConnect_Drive_Upload_API.gs` ไปแทนโค้ดใน Apps Script โปรเจกต์เดิม
2. บันทึกโปรเจกต์
3. เลือกฟังก์ชัน `setupQuotationSystem`
4. กด Run และอนุญาตสิทธิ์ Drive, Sheets และ UrlFetch
5. ตรวจ Execution log ต้องได้ `status: success`
6. ตรวจโฟลเดอร์ปลายทางว่ามี `SBConnect_Quotation_Index`
7. ตรวจผล `sqlSync.status` และ `sqlReconcileTrigger` ใน log ระบบจะติดตั้ง time trigger สำหรับ retry SQL ทุกชั่วโมงให้อัตโนมัติ

## 4. Deploy Web App เวอร์ชันใหม่

1. Apps Script > Deploy > Manage deployments
2. กด Edit deployment
3. Version เลือก New version
4. Execute as: `Me`
5. Who has access: `Anyone` หรือค่าที่ตรงกับนโยบายองค์กรและยังให้เว็บ SB Connect เรียกได้
6. กด Deploy และคัดลอก URL ที่ลงท้ายด้วย `/exec`
7. ใส่ URL ใน `app/assets/js/sbConfig.js` ที่ `driveUploadEndpoint`

Quotation ใช้ `sessionToken` ของผู้ใช้ในการยืนยันตัวตน จึงไม่ต้องเปิดเผย shared upload token สำหรับ action ของ Quotation ส่วนระบบอัปโหลดเดิมที่ไม่ใช่ Quotation ยังใช้ `UPLOAD_TOKEN` ตามเดิม

## 5. ตรวจหลัง Deploy

เปิด URL `/exec` ด้วย GET แล้วตรวจค่าต่อไปนี้:

- `quotationFolderConfigured: true`
- `quotationIndexConfigured: true`
- `quotationSessionValidationConfigured: true`
- `quotationSqlSyncConfigured: true`
- `quotationSqlSyncEnabled: true`
- มี `quotation_create`, `quotation_save`, `quotation_list`, `quotation_get`, `quotation_report`

จากนั้นทดสอบผ่าน SB Connect:

1. Login ด้วยผู้ใช้จริง
2. Services > Quotation
3. ระบบต้องออกเลขใหม่และสร้าง PDF/XLSX ใน Drive
4. กรอกลูกค้าและอย่างน้อยหนึ่งรายการ แล้วกดบันทึก
5. กดสร้างรายงาน แล้วเปิด PDF และ Excel จากปุ่มในหน้าเดียวกัน
6. ตรวจ PDF ว่าไม่มี Unit Cost, SB Cost, Total Cost, Gross Profit หรือ GP
7. ตรวจ XLSX ว่ามีสูตร Subtotal, VAT, Grand Total, Total Cost, Gross Profit และ GP%
8. ปิดแล้วเปิดใบเดิมจากหน้ารายงาน ข้อมูล รูป ไฟล์แนบ และลิงก์ต้องอยู่ครบ
9. ทดสอบผู้ใช้คนอื่นว่ามองไม่เห็น/แก้ใบของเจ้าของเดิม เว้นแต่มี role ผู้ดูแล
10. ตรวจ Supabase Table Editor ว่า `quotations` และตารางลูกมีข้อมูลตรงกับ Google Sheet

## สูตรหลัก

- Amount = Quantity x Unit Price
- Item Cost = Quantity x Unit Cost
- Subtotal = ผลรวม Amount
- VAT = Subtotal x VAT% / 100
- Grand Total = Subtotal + VAT
- Total Cost = ผลรวม SB Cost เมื่อมี SB Cost มากกว่า 0 อย่างน้อยหนึ่งรายการ มิฉะนั้นใช้ผลรวม Item Cost
- Gross Profit = Subtotal - Total Cost
- GP% = Gross Profit / Subtotal x 100 (ถ้า Subtotal เป็น 0 ให้เป็น 0)

ตัวเงินปัดทศนิยม 2 ตำแหน่งทั้งหน้าเว็บและ Apps Script

## ข้อจำกัดและการดูแลพื้นที่

- ไฟล์ละไม่เกิน 8 MB
- รองรับ JPEG, PNG, WebP, GIF, PDF, XLSX และ DOCX
- HEIC/HEIF ต้องแปลงเป็น JPEG/PNG ก่อนอัปโหลด
- การสร้างรายงานเวอร์ชันใหม่จะแทนที่ไฟล์รายงานเวอร์ชันเดิม โดยไม่ลบรูปหรือไฟล์แนบที่ยังถูกอ้างอิง
- การลบ/เปลี่ยนรูปหรือไฟล์แนบจากใบจะย้ายไฟล์ที่ผูกไว้ไปถังขยะของ Drive หลังตรวจเจ้าของใบแล้ว
- Google Sheet เป็น operational source และ Supabase เป็น SQL mirror หาก Supabase ใช้งานไม่ได้ชั่วคราว ระบบจะเก็บสถานะ `PENDING/ERROR` และ sync ซ้ำได้โดยไม่ทำให้การบันทึก Drive สูญหาย
- ใช้ฟังก์ชัน `reconcileQuotationSupabase()` ใน Apps Script editor เพื่อเร่ง sync แถวค้าง ฟังก์ชันนี้ประมวลผลครั้งละ 20 แถวโดยค่าเริ่มต้น (สูงสุด 50 แถวต่อครั้ง) และไม่เปิดให้ browser เรียก หากมีแถวค้างมากให้รันซ้ำ; time trigger จะ retry ให้อัตโนมัติทุกชั่วโมง
- ควรตรวจ Drive Trash และโควตาพื้นที่ตามรอบนโยบายของบริษัท

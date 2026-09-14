# Visual Low-code Pro All Project

เพิ่มตามคำขอ: โหมดแก้ทั้งโปรเจกต์แบบคลิก/พิมพ์/ลาก/วาง/insert

## ใช้งาน

รัน:

```bat
npm run dev
```

บน localhost จะมี toolbar ล่าง:

```text
Edit OFF | Desktop | iPad | Tablet | Mobile | +Text | +Pic | +Btn | +Card | Tools | Save
```

## ทำอะไรได้

- เปิด/ปิด Edit mode
- คลิก element เพื่อเลือก
- คลิก text แล้วพิมพ์แก้ได้ทันที
- ลาก element ด้วย handle `DRAG`
- resize element ด้วย handle มุมขวาล่าง
- Insert:
  - Text
  - Pic
  - Button
  - Card
- แก้ style:
  - font size
  - font weight
  - color
  - background
  - radius
  - padding
  - margin
  - shadow
  - border
  - opacity
  - position / left / top / width / height / z-index
- ซ่อน/ลบ element
- duplicate
- Save ลงไฟล์ project

## Device mode

ปุ่ม:

```text
Desktop / iPad / Tablet / Mobile
```

จะเปิดผ่าน `dev-preview.html` เป็น iframe preview จริง ทำให้ media query ของหน้าเว็บทำงานตามขนาด iframe มากกว่าเดิม

## ไฟล์ที่ save จริง

เมื่อกด Save:

```text
public/app/assets/dev/visual-editor-state.json
public/app/assets/dev/visual-overrides.css
```

ไฟล์พวกนี้อยู่ใน project และถูกโหลดโดยทุกหน้า

## ใช้กับทั้งโปรเจกต์

มีการ inject script เข้า:

```text
index.html
public/app/*.html
public/app/pages/*.html
```

ดังนั้นหน้า login, หน้า user, หน้า admin ใช้ visual editor ได้ทั้งหมดตอน dev

## Production / GitHub

- ตัวแก้ไขจะแสดงเฉพาะ localhost / 127.0.0.1 หรือ `?sbdev=1`
- แต่ visual changes ที่ save แล้วจะถูก apply จาก state/css ได้
- endpoint save มีเฉพาะ `npm run dev`

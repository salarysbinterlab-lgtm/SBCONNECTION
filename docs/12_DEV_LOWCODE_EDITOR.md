# Dev Low-code Editor

เพิ่มตามคำขอ: แก้หน้าเว็บจากหน้าเว็บได้ตอน `npm run dev`

## ใช้อะไรได้

เมื่อรัน dev แล้ว ด้านล่างจะมีแถบ:

```text
Desktop | Tablet | Mobile | Edit
```

- Desktop / Tablet / Mobile = preview mode ตอน dev
- Edit = เปิด panel แก้ค่า
- Save to files = เขียนกลับเข้าไฟล์ project จริง

## ไฟล์ที่ถูกแก้เมื่อกด Save to files

```text
src/dev/devPageConfig.ts
```

## แก้อะไรได้จากหน้าเว็บ

- ข้อความใหญ่ CAREBEAU
- Login title
- Login subtitle
- First login note
- สี background/panel ของ index_1 ถึง index_4
- ตำแหน่ง login top/right
- ตำแหน่ง ghost text
- scale ตัวละครกลาง

## ใช้ได้เฉพาะ dev

ระบบนี้ทำงานผ่าน Vite dev server middleware:

```text
dev-editor/devEditorPlugin.ts
```

API:
```text
/__sb_dev_editor/status
/__sb_dev_editor/save-config
```

ตอน build production / ดัน GitHub Pages จะไม่มี API นี้ จึงแก้ไฟล์จริงจากหน้าเว็บไม่ได้ตามที่ต้องการ

## ไฟล์ที่เพิ่ม

```text
src/dev/devPageConfig.ts
src/dev/DevEditor.tsx
src/dev/dev-editor.css
dev-editor/devEditorPlugin.ts
```

## ทดสอบ

```bat
cd /d D:\Projectsbconnect_app
npm run dev
```

เปิด:
```text
http://127.0.0.1:5173/
```

# Dev Low-code Editor Responsive Complete

อัปเดตเพิ่มเครื่องมือ edit ให้ครบขึ้น และแก้ปัญหา mode ไม่ย่อ/ขยายจริง

## Mode ที่มี

```text
Desktop 1440 x 900
iPad    1024 x 1366
Tablet  768 x 1024
Mobile  390 x 844
```

ตอนเลือก mode:
- ตัว preview frame เปลี่ยน width/height จริง
- App ใช้ค่า layout ตาม mode นั้นจริง
- ไม่อิง `window.innerWidth` อย่างเดียวแล้ว
- แก้ตำแหน่ง/ขนาดแยกแต่ละ mode ได้

## Tabs ใน Edit panel

```text
Text
Colors
Layout
Images
Advanced
```

## แก้อะไรได้เพิ่ม

### Text
- Ghost text
- Login title
- Login subtitle
- First login note

### Colors
- BG color ของรูปแต่ละ tone
- Panel color ของรูปแต่ละ tone

### Images
- path รูปแต่ละตัว เช่น ./image/index_1.png

### Layout
แยกตาม mode ที่เลือกอยู่:
- preview width / height
- ghost top %
- ghost font clamp
- login top
- login right
- login width
- center scale
- center height
- center bottom
- side height
- side bottom
- left x
- right x

### Advanced
- carousel interval
- transition speed
- auto rotate on/off
- JSON preview

## Save to files

กด Save แล้วเขียนกลับ:

```text
src/dev/devPageConfig.ts
```

## ใช้เฉพาะ dev

API เขียนไฟล์มีเฉพาะตอน:

```bat
npm run dev
```

ตอน build / GitHub Pages จะไม่มี endpoint นี้

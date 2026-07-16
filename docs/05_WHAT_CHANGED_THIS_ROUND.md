# 05 - สิ่งที่เพิ่มรอบนี้

## เพิ่ม Hero UI ตาม specification

- Full screen raw video background
- ไม่มี overlay / gradient / dim layer
- Font Inter ผ่าน link ใน `index.html`
- `body` ใช้ `font-family: 'Inter', sans-serif`
- เปิด font smoothing
- Tailwind config ใช้ `fontFamily.sans = ['Inter', 'sans-serif']`
- Navbar liquid glass
- Animated heading แบบ character-by-character
- FadeIn component สำหรับ subtitle/buttons/tag

## ไม่แตะ UI เดิมของระบบ

Legacy app ถูกเก็บใน `public/app/` และยังอ้าง CSS/JS เดิมตาม path เดิม

## SQL ไม่ต้องเพิ่มเพื่อ Hero

Hero เป็นหน้า landing เท่านั้น ไม่ต้องเพิ่มตาราง Supabase ใหม่
SQL ที่จำเป็นยังเป็นชุด final เดิม โดยเฉพาะ `11_public_session_rpc_FINAL.sql`

## ไฟล์ที่ต้องแก้เวลาขึ้นจริง

1. `public/app/assets/js/sbConfig.js` ใส่ Supabase URL/key
2. `apps_script/SBConnect_Drive_Upload_API.gs` ถ้าจะใช้ Google Drive upload
3. `sql/*.sql` รันใน Supabase ตามลำดับ
4. `src/App.tsx` แก้ข้อความ Hero หรือปุ่ม landing เท่านั้น
5. ห้ามแก้ CSS legacy ถ้าไม่ได้แก้ bug เพราะเป็นหน้าตาเดิมของโปรเจกต์

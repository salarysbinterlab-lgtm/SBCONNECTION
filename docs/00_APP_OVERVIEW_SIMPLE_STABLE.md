# SB Connect Stable Clean Overview

แอปนี้ไม่ได้ซับซ้อน แกนที่ถูกต้องคือ:

## User ฝั่งพนักงาน
1. Login ด้วยรหัสพนักงาน
2. First login ใช้รหัสเริ่มต้น 1234 แล้วเปลี่ยนรหัสใหม่
3. Home แสดงข้อมูลพนักงาน / แต้ม / check-in / ข่าวล่าสุด / ranking
4. News อ่านข่าวแล้วรับแต้ม
5. Mission ทำกิจกรรม / ส่งภารกิจ / ได้แต้ม
6. Rewards แลกของรางวัลด้วยแต้ม
7. Ranking ดูอันดับคะแนน
8. Notifications ดูแจ้งเตือน
9. Overall Log ดูประวัติกิจกรรม/แต้ม

## Admin
1. Dashboard ดูภาพรวม
2. Users จัดการข้อมูลพนักงาน
3. News เพิ่ม/แก้ข่าว
4. Missions เพิ่ม/แก้กิจกรรม
5. Rewards เพิ่ม/แก้ของรางวัล
6. Ledger ดูประวัติแต้ม
7. Manager Depts จัดการสิทธิ์หัวหน้าแผนก

## รอบนี้เอาออก
- visual low-code editor
- devVisualEditor.js
- dev-preview.html
- dev-editor vite plugin

เหตุผล: tools editor ทำให้หน้าแรกขาวและปนกับ core app เกินไป

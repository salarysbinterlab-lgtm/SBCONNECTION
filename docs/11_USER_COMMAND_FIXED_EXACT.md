# แก้ตามคำสั่งล่าสุดแบบตรงตัว

สิ่งที่ทำ:
- ใช้รูปที่ผู้ใช้ส่งมา ไม่สร้างภาพใหม่
- เอาพื้นหลังดำที่ติดมากับรูปออกจาก asset ด้วยการทำ alpha จากขอบภาพ
- ใช้ path รูป:
  - image/index_1.png
  - image/index_2.png
  - image/index_3.png
  - image/index_4.png
- มีสำเนาสำหรับ Vite/GitHub:
  - public/image/index_1.png
  - public/image/index_2.png
  - public/image/index_3.png
  - public/image/index_4.png
- เปลี่ยนข้อความใหญ่จาก 3D SHAPE เป็น CAREBEAU
- เอา TOONHUB ซ้ายบนออก
- เอา TOONHUB FIGURINES ออก
- เอาข้อความ paragraph ออก
- เอา Auto rotate 3 sec ออก
- เอาปุ่ม DISCOVER IT ออก
- ปรับ login เป็น 3D glass

ไฟล์หลักที่แก้:
- index.html
- src/App.tsx
- src/index.css
- image/index_1.png ถึง image/index_4.png
- public/image/index_1.png ถึง public/image/index_4.png

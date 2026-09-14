# CAREBEAU Local Transparent Image Update

อัปเดตตามคำสั่งล่าสุด:

## แก้หน้า index / TOONHUB

- ใช้รูปจาก `D:\Projectsbconnect_app\image\index_1.png` ถึง `index_4.png`
- มีสำเนาใน `public/image/` เพื่อให้ Vite/GitHub Pages build แล้วเจอรูป
- ลบข้อความ `TOONHUB` ซ้ายบน
- เปลี่ยน ghost text จาก `3D SHAPE` เป็น `CAREBEAU`
- ลบกล่องข้อความ `TOONHUB FIGURINES`
- ลบคำอธิบาย paragraph
- ลบ badge `Auto rotate 3 sec`
- ลบปุ่ม/ลิงก์ `DISCOVER IT`
- ปรับ Login เป็น 3D glass มากขึ้น
- ไม่มีการสร้างภาพใหม่ เป็นการแก้ project และใช้รูปที่ผู้ใช้ส่งมา

## ลำดับรูป

```text
index_1.png = orange
index_2.png = green
index_3.png = blue
index_4.png = pink
```

## ไฟล์ที่แก้หลัก

```text
src/App.tsx
src/index.css
image/index_1.png
image/index_2.png
image/index_3.png
image/index_4.png
public/image/index_1.png
public/image/index_2.png
public/image/index_3.png
public/image/index_4.png
```

## รัน

```bat
cd /d D:\Projectsbconnect_app
npm run dev
```

หรือ reset dependency:

```bat
RESET_AND_RUN_TOONHUB.bat
```

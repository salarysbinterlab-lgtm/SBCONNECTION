# Local Index Images

อัปเดตตามคำสั่งล่าสุด: หน้าแรก TOONHUB ใช้รูป local ในโปรเจกต์ ไม่ใช้ URL ภายนอกแล้ว

## ตำแหน่งรูปที่ใช้

```text
image/index_1.png
image/index_2.png
image/index_3.png
image/index_4.png
```

เพื่อให้ Vite build / GitHub Pages ใช้ได้ด้วย ชุดนี้ใส่สำเนาไว้ที่:

```text
public/image/index_1.png
public/image/index_2.png
public/image/index_3.png
public/image/index_4.png
```

ใน `src/App.tsx` ใช้ path:

```ts
`${BASE}image/index_1.png`
`${BASE}image/index_2.png`
`${BASE}image/index_3.png`
`${BASE}image/index_4.png`
```

## สีที่ผูกไว้

```text
index_1 = orange
index_2 = green
index_3 = blue
index_4 = pink
```

## วิธีรัน

```bat
cd /d D:\Projectsbconnect_app
RESET_AND_RUN_TOONHUB.bat
```

หรือ

```bat
npm install
npm run dev
```

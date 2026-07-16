# SB Connect: Private GitHub + Domain + Install App

เอกสารนี้คือ flow แนะนำสำหรับโปรเจกต์นี้:

`local dev` -> `private GitHub` -> `GitHub Pages domain` -> `PWA install` -> `push update = app update`

## 1. ทำงาน local เหมือนเดิม

ใช้คำสั่งนี้ระหว่างแก้ไข:

```bash
npm run dev
```

เปิด:

```text
http://127.0.0.1:5175/
```

PWA service worker จะไม่ทำงานตอน dev เพื่อไม่ให้ cache กวนการแก้ไข

## 2. เช็กก่อน push

ทุกครั้งก่อน push:

```bash
npm run build
```

ถ้าผ่าน แปลว่า build production พร้อม deploy

## 3. สร้าง GitHub private repo

ใน GitHub:

1. New repository
2. Repository name เช่น `sbconnect_app`
3. เลือก `Private`
4. ไม่ต้อง add README ถ้า repo local มีอยู่แล้ว

ในเครื่อง:

```bash
git init
git add .
git commit -m "Initial SB Connect PWA"
git branch -M main
git remote add origin https://github.com/USERNAME/sbconnect_app.git
git push -u origin main
```

ครั้งต่อไปหลังแก้:

```bash
git add .
git commit -m "Update SB Connect"
git push
```

## 4. Hosting แบบเร็วสุด: GitHub Pages

โปรเจกต์นี้เพิ่ม workflow ให้แล้ว:

```text
.github/workflows/deploy-github-pages.yml
```

ตั้งค่า GitHub repo:

1. ไปที่ repo บน GitHub
2. Settings
3. Pages
4. Source เลือก `GitHub Actions`
5. push เข้า branch `main`

GitHub จะ build ด้วย:

```text
npm ci
npm run build
```

แล้ว deploy folder:

```text
dist
```

URL จะได้ประมาณ:

```text
https://USERNAME.github.io/REPO_NAME/
```

นี่คือ domain ฟรีของ GitHub และใช้ HTTPS ได้ทันที

หมายเหตุสำคัญ: repo เป็น private ได้ แต่ URL ของ GitHub Pages ให้ถือว่าเป็น public URL สำหรับคนที่รู้ลิงก์ ดังนั้น security จริงต้องอยู่ที่ login, session guard, Supabase RLS/policy และ Apps Script secret properties

## 5. Hosting ทางเลือก

ถ้าวันหลังอยากใช้ domain บริษัทจริง ค่อยย้ายหรือเพิ่ม custom domain ใน:

- Vercel
- Netlify
- Cloudflare Pages

ตั้งค่าเหมือนกัน:

```text
Build command: npm run build
Output directory: dist
```

หลังเชื่อม private GitHub repo แล้ว ทุกครั้งที่ `git push` เข้า `main` hosting จะ build/deploy ใหม่เอง

## 6. Custom domain ถ้าต้องการภายหลัง

ใน hosting provider:

1. Add custom domain
2. ใส่ domain เช่น `connect.yourcompany.com`
3. ทำ DNS ตามที่ provider ให้
4. เปิด HTTPS

PWA install ต้องใช้ HTTPS บน domain จริง ยกเว้น localhost

## 7. Android install

บน Chrome Android:

1. เปิด domain
2. Login
3. กดเมนู Chrome
4. เลือก `Install app` หรือ `Add to Home screen`
5. เปิดจาก icon แล้วจะเห็นเหมือนแอป ไม่มี address bar

## 8. iOS install

บน Safari iPhone/iPad:

1. เปิด domain ด้วย Safari
2. Login
3. กด Share
4. เลือก `Add to Home Screen`
5. เปิดจาก icon แล้วจะเป็น standalone view เหมือนแอป

## 9. Update behavior

เมื่อ push code ใหม่:

```text
git push
-> hosting build/deploy
-> user เปิดเว็บหรือ app icon ใหม่
-> ได้เวอร์ชันล่าสุดจาก server
```

โปรเจกต์นี้มี service worker แบบ network-first:

- ออนไลน์: โหลดไฟล์ใหม่จาก server ก่อน
- ออฟไลน์/เน็ตล่ม: ใช้ cache หรือหน้า offline fallback
- ถ้า service worker มี update จะ activate และ reload หน้าอัตโนมัติหนึ่งครั้ง

ไม่ต้อง install ซ้ำแบบ Android native

## 10. Security principle

URL ไม่ใช่ security จริง การเข้ารหัส URL แค่ซ่อน ไม่ได้กันข้อมูล

หลักที่ใช้:

- หน้า React หลังบ้านต้องมี `sb_session_token`
- หน้า static สำคัญ เช่น `ranking_full.html` มี guard กันเปิดตรงถ้าไม่มี token
- Supabase ต้องใช้ RLS/policy คุมข้อมูลจริง
- Apps Script ถือ `service_role` เฉพาะฝั่ง server/script properties
- ห้ามใส่ `service_role` ใน React, GitHub, public HTML

## 11. External services

Supabase:

- เก็บข้อมูล user, role, department, points, check-in
- เก็บ URL รูปเป็น text เช่น `avatar_url`
- ไม่เก็บ base64 รูปใน database

Google Drive + Apps Script:

- เก็บไฟล์รูปจริง
- Apps Script รับ upload แล้ว update URL กลับ Supabase

## 12. Files added for PWA

```text
public/manifest.webmanifest
public/sw.js
public/offline.html
public/icons/icon-192.png
public/icons/icon-512.png
public/icons/maskable-512.png
public/icons/apple-touch-icon.png
src/pwa.ts
```

## 13. Important

โปรเจกต์นี้ปรับ PWA path เป็น relative แล้ว จึงใช้ได้กับ GitHub Pages แบบ subpath:

```text
https://USERNAME.github.io/REPO_NAME/
```

และยังใช้ได้กับ custom domain root เช่น `https://connect.yourcompany.com/`

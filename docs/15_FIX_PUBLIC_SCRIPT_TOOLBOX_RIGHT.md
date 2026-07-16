# Fix public script import + right toolbox

แก้ error:

```text
Failed to load url /app/assets/dev/devVisualEditor.js
This file is in /public and will be copied as-is...
```

สาเหตุ:
- ไฟล์อยู่ใน `public/app/assets/dev/`
- แต่ถูกโหลดเป็น `<script type="module">`
- Vite ห้ามใช้ไฟล์ใน public เป็น module import

แก้แล้ว:
- เปลี่ยน `devVisualEditor.js` เป็น classic script
- เปลี่ยนทุกหน้าเป็น `<script src="...devVisualEditor.js"></script>`
- ไม่ใช้ `import.meta.url`
- ใช้ `document.currentScript.src`
- Tools เปลี่ยนเป็น toolbox เด้งจากขวา

ไฟล์ที่แก้:
- `public/app/assets/dev/devVisualEditor.js`
- `public/app/assets/dev/devVisualEditor.css`
- `index.html`
- `public/app/*.html`
- `public/app/pages/*.html`

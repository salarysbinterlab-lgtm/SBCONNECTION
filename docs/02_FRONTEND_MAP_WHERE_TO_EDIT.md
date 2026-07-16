# FRONTEND MAP / WHERE TO EDIT

## ห้ามแก้ดีไซน์หลักโดยไม่จำเป็น
HTML/CSS ชุดนี้คือ legacy UI ล่าสุด ให้แก้เฉพาะ logic, path, Supabase binding, bug เท่านั้น

## Path หลัก
- `app/index.html` = Login + First login overlay
- `app/pages/home.html` = User Home
- `app/pages/homeAdmin.html` = Admin Dashboard หลัก
- `app/pages/admin_users.html` = Users
- `app/pages/admin_news.html` = News Manager
- `app/pages/admin_questCenter.html` = Mission Manager
- `app/pages/admin_rewards.html` = Rewards
- `app/pages/admin_ledger.html` = Point Ledger
- `app/pages/admin_manager_depts.html` = Manager Depts
- `app/pages/news.html`, `mission.html`, `rewards.html`, `ranking.html`, `overall_log.html`, `notifications.html`

## CSS ที่วางตาม HTML เดิม
- `app/assets/css/legacy/ui-common.css`
- `app/assets/css/legacy/security-light.css`
- `app/assets/css/legacy/chatbot.css`
- `app/assets/css/pages/*-legacy.css`

## Config ที่ต้องแก้ก่อนขึ้นเว็บ
แก้ที่เดียว:
`app/assets/js/sbConfig.js`

```js
supabaseUrl: "https://xxxx.supabase.co",
supabaseAnonKey: "anon/publishable key",
driveUploadEndpoint: "Apps Script Web App URL",
driveUploadToken: "token เดียวกับ Apps Script"
```

## ฟังก์ชั่นอยู่ไฟล์ไหน
- Login / first-login overlay: `app/assets/js/authLegacy.js`
- Session / route guard: `app/assets/js/sessionService.js`
- Home / check-in / dashboard preview: `app/assets/js/homeLegacy.js`
- News/Mission/Rewards/Ranking/Overall Log: `app/assets/js/pagesLegacy.js`
- Notifications: `app/assets/js/notificationsLegacy.js`
- Change password: `app/assets/js/changePasswordLegacy.js`
- Admin dashboard / reset password: `app/assets/js/adminLegacy.js`
- Admin module CRUD/export: `app/assets/js/adminModulesLegacy.js`
- Google Drive upload service: `app/assets/js/driveUploadService.js`

## ดันขึ้นเว็บ
1. วางทั้งโฟลเดอร์ `app/` ขึ้น hosting หรือ GitHub Pages
2. ตั้งค่า `sbConfig.js`
3. เปิด `index.html`
4. Login DEV admin: `ADMIN` / `Admin123`
5. User ที่ seed มา login ด้วย `emp_id` / `1234` แล้วระบบบังคับตั้งรหัสใหม่ 8 ตัว

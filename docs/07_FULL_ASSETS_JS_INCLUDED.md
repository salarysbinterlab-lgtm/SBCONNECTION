# SB Connect TOONHUB Full Assets Included

ชุดนี้แก้จากรอบก่อนที่ asset/js ไม่ครบ

## เพิ่มครบแล้ว

```text
public/app/assets/js/
├── sbConfig.js
├── sbClient.js
├── sessionService.js
├── uiHelpers.js
├── authLegacy.js
├── homeLegacy.js
├── pagesLegacy.js
├── notificationsLegacy.js
├── changePasswordLegacy.js
├── adminLegacy.js
├── adminModulesLegacy.js
├── driveUploadService.js
└── chatbot.js
```

## หน้า HTML ด้านในใช้ path เดิม

```text
public/app/pages/home.html
public/app/pages/homeAdmin.html
public/app/pages/news.html
public/app/pages/mission.html
public/app/pages/rewards.html
public/app/pages/ranking.html
public/app/pages/overall_log.html
public/app/pages/notifications.html
public/app/pages/admin_users.html
public/app/pages/admin_news.html
public/app/pages/admin_questCenter.html
public/app/pages/admin_rewards.html
public/app/pages/admin_ledger.html
public/app/pages/admin_manager_depts.html
```

## CSS legacy อยู่ที่

```text
public/app/assets/css/legacy/
public/app/assets/css/pages/
```

## จุดแก้ Supabase

แก้ไฟล์เดียว:

```text
public/app/assets/js/sbConfig.js
```

## รัน

```bat
RESET_AND_RUN_TOONHUB.bat
```

// scripts/generate-setup-files.mjs
// รวมไฟล์ migration เป็นชุดติดตั้ง 3 ไฟล์ สำหรับวางใน Supabase SQL Editor ทีละไฟล์
// รัน:  node scripts/generate-setup-files.mjs   (หรือ npm run sql:setup)
//
// ทำไมต้องแบ่ง 3 ไฟล์
//   - ไฟล์เดียวจะใหญ่เกิน 500 KB เพราะมี seed พนักงาน SQL Editor จะอืดและพลาดง่าย
//   - แบ่งตามหน้าที่ ทำให้ถ้าพลาดตรงไหน รู้ทันทีว่าอยู่ขั้นไหน
//
// ลำดับภายในห้ามสลับ
//   1 SCHEMA    ตาราง + view + ฟังก์ชัน + RPC ทั้งหมด (ยังไม่มีข้อมูลพนักงาน)
//   2 EMPLOYEES ข้อมูลพนักงานจาก xlsx + แก้ข้อมูลหลัง import
//   3 SECURITY  ปิดสิทธิ์ + ระบบรหัสกลาง + ลืมรหัสผ่าน + บัญชีแอดมิน  <-- ต้องท้ายสุดเสมอ

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const sqlDir = join(projectRoot, 'sql');
const outDir = join(sqlDir, 'setup');

const BUNDLES = [
  {
    out: 'SETUP_1_SCHEMA.sql',
    title: 'ขั้นที่ 1 - โครงสร้างฐานข้อมูลและฟังก์ชันทั้งหมด',
    note: 'ยังไม่มีข้อมูลพนักงาน และยังไม่ปิดสิทธิ์ ต้องรันขั้นที่ 2 และ 3 ต่อให้ครบ',
    files: [
      '01_extensions.sql',
      '02_types.sql',
      '03_core_schema.sql',
      '04_content_schema.sql',
      '05_points_rewards_schema.sql',
      '06_chat_notifications_schema.sql',
      '07_it_requests_schema.sql',
      '08_views.sql',
      '09_functions_triggers.sql',
      '10_rls_policies.sql',
      '11_public_session_rpc_FINAL.sql',
      '90_seed_app_settings.sql',
      '95_ADMIN_ACCOUNTS_SPECIAL_POINTS_ACTIVITY.sql',
      '13_PRODUCTION_SECURITY_AND_ASSETS.sql',
      '14_LEGACY_RPC_ALIASES_FOR_REACT_APP.sql',
      '15_QUOTATION_SUPABASE_SCHEMA.sql',
      '16_FRONTEND_RPC_COMPLETION_AND_AUTH_HARDENING.sql',
    ],
  },
  {
    out: 'SETUP_2_EMPLOYEES.sql',
    title: 'ขั้นที่ 2 - ข้อมูลพนักงานจากไฟล์ xlsx',
    note: 'ยังไม่ตั้งรหัสผ่านให้ใคร รหัสจะถูกตั้งในขั้นที่ 3',
    files: [
      '91_seed_from_xlsx_FIXED_V3_empid_normalized.sql',
      '92_post_seed_fixes.sql',
    ],
  },
  {
    out: 'SETUP_3_SECURITY.sql',
    title: 'ขั้นที่ 3 - ปิดสิทธิ์ ระบบรหัสผ่าน และบัญชีแอดมิน',
    note: 'ต้องรันเป็นไฟล์สุดท้ายเสมอ ก่อนรันต้อง Find & Replace __SB_DEFAULT_PASSWORD__ เป็นรหัสกลางของคุณ',
    // ด่านแรกสุดของไฟล์ ต้องอยู่ก่อน 17_ เพื่อไม่ให้เขียนอะไรลงฐานข้อมูลเลยถ้าลืม Replace
    preamble:
      `-- ###########################################################################\n` +
      `-- ด่านตรวจก่อนเริ่ม: ต้อง Find & Replace __SB_DEFAULT_PASSWORD__ ทั้งไฟล์ก่อน\n` +
      `-- เป็นรหัสกลางที่คุณตั้งเอง ใช้ทั้งแอดมินและพนักงานสำหรับเข้าครั้งแรก\n` +
      `-- ถ้าลืม ไฟล์นี้จะหยุดตั้งแต่บรรทัดแรก ไม่เขียนอะไรลงฐานข้อมูลเลย\n` +
      `-- ###########################################################################\n` +
      `do $preflight$\n` +
      `declare v_pw text := '__SB_DEFAULT_PASSWORD__';\n` +
      `begin\n` +
      `  if v_pw = '__SB_DEFAULT' || '_PASSWORD__' then\n` +
      `    raise exception 'หยุดก่อน: ยังไม่ได้ตั้งรหัสกลาง ให้ Find & Replace ตัวยึดที่เขียนไว้ในคอมเมนต์ข้างบนทั้งไฟล์ แล้วค่อยรันใหม่';\n` +
      `  end if;\n` +
      `  if upper(btrim(v_pw)) = 'SB2026' then\n` +
      `    raise exception 'หยุดก่อน: ห้ามใช้ SB2026 เพราะเป็นรหัสที่เคยหลุดออกไปแล้ว';\n` +
      `  end if;\n` +
      `  if length(v_pw) < 8 or length(v_pw) > 72\n` +
      `     or v_pw !~ '[A-Za-z]' or v_pw !~ '[0-9]' or v_pw ~ '\\s' then\n` +
      `    raise exception 'หยุดก่อน: รหัสกลางต้องยาว 8-72 ตัว มีทั้งตัวอักษรและตัวเลข ห้ามเว้นวรรค';\n` +
      `  end if;\n` +
      `end $preflight$;\n`,
    files: [
      '17_SECURITY_HARDENING_AND_FIXES.sql',
      '19_FIRST_LOGIN_SHARED_PASSWORD.sql',
      '20_PASSWORD_RESET_REQUEST.sql',
      '21_ADMIN_ACCOUNTS_AND_AUDIT.sql',
      '22_NEWS_DAILY_OTP_AND_FAILPATH_FIXES.sql',
      '25_ADMIN_SYSTEM_RESET.sql',
      '27_IT_REQUEST_MODULE.sql',
      '28_IT_REQUEST_SEED_COUNTER.sql',
    ],
  },
];

// กันพลาด: ชุดสุดท้ายต้องเป็นชุด security เสมอ ไม่งั้นได้ฐานที่เปิดช่องให้ anon
const last = BUNDLES[BUNDLES.length - 1];
if (last.out !== 'SETUP_3_SECURITY.sql'
    || last.files[0] !== '17_SECURITY_HARDENING_AND_FIXES.sql'
    || last.files[last.files.length - 1] !== '28_IT_REQUEST_SEED_COUNTER.sql'
    || !last.files.includes('25_ADMIN_SYSTEM_RESET.sql')) {
  throw new Error('SETUP_3_SECURITY.sql ต้องเป็นชุดสุดท้าย ขึ้นต้นด้วย 17_ มี 25_ และปิดท้ายด้วย 28_');
}

await import('node:fs/promises').then(({ mkdir }) => mkdir(outDir, { recursive: true }));

let total = 0;
for (const bundle of BUNDLES) {
  const parts = [];
  for (const name of bundle.files) {
    const body = (await readFile(join(sqlDir, name), 'utf8')).trim();
    parts.push(
      `\n\n-- =========================================================================\n` +
      `-- ${name}\n` +
      `-- =========================================================================\n\n` +
      `${body}\n`,
    );
  }

  const header =
    `-- ###########################################################################\n` +
    `-- ${bundle.title}\n` +
    `-- ###########################################################################\n` +
    `-- ไฟล์นี้สร้างอัตโนมัติ ห้ามแก้ตรงนี้ ให้แก้ที่ไฟล์ต้นทางใน sql/ แล้วรัน\n` +
    `--   npm run sql:setup\n` +
    `--\n` +
    `-- ${bundle.note}\n` +
    `-- รวมจากไฟล์: ${bundle.files.join(', ')}\n` +
    `-- ###########################################################################\n`;

  const outPath = join(outDir, bundle.out);
  const content = header + (bundle.preamble ? `\n${bundle.preamble}` : '') + parts.join('');
  await writeFile(outPath, content, 'utf8');
  const kb = Math.round(Buffer.byteLength(content, 'utf8') / 1024);
  total += kb;
  console.log(`สร้าง ${bundle.out.padEnd(24)} ${String(kb).padStart(4)} KB  (${bundle.files.length} ไฟล์)`);
}

console.log(`\nรวม ${total} KB -> ${outDir}`);
console.log('รันใน Supabase SQL Editor ตามลำดับ 1 -> 2 -> 3 แล้วปิดท้ายด้วย sql/18_VERIFY_SECURITY.sql');

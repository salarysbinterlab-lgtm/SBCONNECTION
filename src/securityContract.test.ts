import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { ALLOWED_RPC } from './helpers/api';

const root = resolve(import.meta.dirname, '..');

// โฟลเดอร์ sql/ ถูก gitignore ไว้ เพราะมีข้อมูลส่วนบุคคลของพนักงานและรหัสกลาง
// เครื่องของเราจะมีโฟลเดอร์นี้ -> ตรวจครบทุกข้อ
// เครื่อง CI ของ GitHub จะไม่มี -> ข้ามเฉพาะข้อที่ต้องอ่านไฟล์ sql
// ไม่ใช่การปิดการตรวจ แต่เป็นการตรวจเท่าที่ไฟล์ที่มีอยู่จริงจะให้ตรวจได้
const sqlDir = join(root, 'sql');
const hasSqlDir = existsSync(sqlDir);
const itWithSql = hasSqlDir ? it : it.skip;

function filesUnder(directory: string, extension: RegExp): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? filesUnder(path, extension) : extension.test(path) ? [path] : [];
  });
}

function basenameOf(path: string): string {
  return path.split(/[\\/]/).pop() || '';
}

// ไฟล์ SQL ที่ถูกนำไปรันจริง ไม่รวมชุดรวม setup/ และไฟล์ที่เลิกใช้แล้ว
function activeSqlFiles(): string[] {
  return filesUnder(join(root, 'sql'), /\.sql$/).filter(
    (path) =>
      !path.includes('all_in_one') &&
      !path.includes(`${join('sql', 'setup')}`) &&
      !path.includes('_unused') &&
      !path.includes('_dev_only'),
  );
}

function productionSource(): string {
  return filesUnder(join(root, 'src'), /\.(ts|tsx)$/)
    .filter((path) => !path.includes(`${join('src', 'dev')}`) && !path.endsWith('.test.ts') && !path.endsWith('.test.tsx'))
    .map((path) => readFileSync(path, 'utf8'))
    .join('\n');
}

describe('security contract', () => {
  it('ไม่มี Supabase URL / key ฝังอยู่ในซอร์ส (ต้องมาจาก .env เท่านั้น)', () => {
    const source = productionSource();
    expect(source).not.toMatch(/https:\/\/[a-z0-9]{16,}\.supabase\.co/);
    expect(source).not.toMatch(/\bsb_publishable_[A-Za-z0-9_-]{10,}/);
    expect(source).not.toMatch(/\beyJ[A-Za-z0-9_-]{20,}\./); // JWT-style anon/service key
  });

  it('ไม่มี service_role key อยู่ในโปรเจกต์', () => {
    const source = productionSource();
    // ห้ามคำนี้โผล่ในซอร์สหน้าบ้านเลย แม้แต่ในข้อความ error
    // เพราะเป็นสัญญาณแรกว่ามีคนกำลังจะเอาคีย์ฝั่งเซิร์ฟเวอร์มาใช้ฝั่ง client
    expect(source).not.toMatch(/service_role/i);
    // และห้ามมีคีย์ลับรูปแบบใหม่ของ Supabase ปนมาด้วย
    expect(source).not.toMatch(/\bsb_secret_[A-Za-z0-9_-]{10,}/);
  });

  it('ไม่เหลือ shared secret ของ Apps Script ในฝั่ง frontend', () => {
    const source = productionSource();
    expect(source).not.toMatch(/driveUploadToken/);
    expect(source).not.toMatch(/CHANGE_THIS_TOKEN/);
  });

  it('ไม่เก็บรหัสผ่านผู้ใช้ไว้ในเบราว์เซอร์', () => {
    const source = productionSource();
    // อนุญาตเฉพาะบรรทัดที่ "ลบ" ค่าเก่าทิ้งเท่านั้น
    const writes = source.match(/(?:sessionStorage|localStorage)\.setItem\([^)]*(?:password|Password)[^)]*\)/g) || [];
    expect(writes).toEqual([]);
  });

  it('ทุก RPC ที่ frontend เรียก ต้องอยู่ใน allowlist ของ api.ts', () => {
    const source = productionSource();
    const called = new Set<string>();
    for (const m of source.matchAll(/rpc(?:<[^>]+>)?\(\s*['"`]([^'"`]+)['"`]/g)) called.add(m[1]);
    for (const m of source.matchAll(/(?:list|save|delete):\s*['"]([a-z][a-z0-9_]+)['"]/g)) called.add(m[1]);

    const allowed = new Set<string>(ALLOWED_RPC as readonly string[]);
    const missing = [...called].filter((name) => !allowed.has(name)).sort();
    expect(missing).toEqual([]);
  });

  itWithSql('ทุกชื่อใน allowlist ต้องถูก grant ให้ anon และไม่มีชื่อเกิน', () => {
    // 17_ เป็นไฟล์ปิดสิทธิ์หลัก แต่ฟังก์ชันที่ถูกสร้างในไฟล์หลังจากนั้น (25_, 27_ ...)
    // ต้อง grant ในไฟล์ของตัวเอง เพราะตอนรัน 17_ ฟังก์ชันเหล่านั้นยังไม่มีอยู่จริง
    // จึงรวม grant จากไฟล์ 17_ ถึง 29_ แล้วเทียบกับ allowlist ทีเดียว
    const lockdown = activeSqlFiles()
      .filter((path) => /(?:1[7-9]|2[0-9])_/.test(basenameOf(path)))
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n');
    const granted = new Set<string>();
    for (const m of lockdown.matchAll(/grant execute on function public\.([a-z0-9_]+)\([^)]*\)\s+to\s+anon/gi)) {
      granted.add(m[1].toLowerCase());
    }

    const allowed = [...new Set(ALLOWED_RPC as readonly string[])].sort();
    const notGranted = allowed.filter((name) => !granted.has(name));
    const grantedButUnused = [...granted].filter((name) => !allowed.includes(name)).sort();

    expect(notGranted).toEqual([]);
    expect(grantedButUnused).toEqual([]);
  });

  itWithSql('ไม่มีไฟล์ SQL ไหน grant ฟังก์ชันนอก allowlist ให้ anon', () => {
    // ไฟล์ 19_/20_ ใช้ create or replace แล้ว grant กลับ ต้องไม่แอบเปิดชื่อใหม่ให้ anon
    const sqlFiles = activeSqlFiles();
    const allowed = new Set<string>(ALLOWED_RPC as readonly string[]);
    const offenders: string[] = [];

    for (const path of sqlFiles) {
      const body = readFileSync(path, 'utf8');
      // ข้ามไฟล์รุ่นเก่าที่ถูก 17_ ปิดสิทธิ์ทับไปแล้วทั้งหมด
      if (!/(?:1[7-9]|2[0-9])_/.test(basenameOf(path))) continue;
      for (const m of body.matchAll(/grant execute on function public\.([a-z0-9_]+)\([^)]*\)\s+to\s+[^;]*\banon\b/gi)) {
        const name = m[1].toLowerCase();
        if (!allowed.has(name)) offenders.push(`${path.split(/[\\/]/).pop()}: ${name}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  itWithSql('ฟังก์ชันของระบบลืมรหัสผ่านต้องไม่เปิดให้ anon', () => {
    const reset = readFileSync(join(root, 'sql', '20_PASSWORD_RESET_REQUEST.sql'), 'utf8');
    expect(reset).toMatch(/revoke all on function public\.request_password_reset\(text,text,text\)\s+from public, anon, authenticated/i);
    expect(reset).toMatch(/grant execute on function public\.request_password_reset\(text,text,text\)\s+to service_role/i);
    // รหัส 6 หลักต้องไม่มีทางถูกส่งกลับไปที่เบราว์เซอร์
    const source = productionSource();
    expect(source).not.toMatch(/request_password_reset/);
  });

  itWithSql('sql/17 ต้องมีคำสั่งปิดสิทธิ์แบบครอบทั้ง schema', () => {
    const lockdown = readFileSync(join(root, 'sql', '17_SECURITY_HARDENING_AND_FIXES.sql'), 'utf8');
    expect(lockdown).toMatch(/revoke execute on all functions in schema public from public, anon, authenticated/i);
    expect(lockdown).toMatch(/revoke all on all tables in schema public from anon, authenticated/i);
    expect(lockdown).toMatch(/alter default privileges in schema public revoke execute on functions/i);
  });

  itWithSql('ฟังก์ชันภายในต้องถูก revoke อย่างชัดเจนใน sql/17', () => {
    const lockdown = readFileSync(join(root, 'sql', '17_SECURITY_HARDENING_AND_FIXES.sql'), 'utf8');
    for (const fn of [
      'add_point_transaction',
      'process_checkin',
      'recalc_user_points',
      'sb_redeem_reward',
      'sb_hash_password',
      'sb_verify_password',
      'public_session_emp_id',
      'public_session_is_admin',
    ]) {
      expect(lockdown).toMatch(new RegExp(`revoke all on function public\\.${fn}\\(`, 'i'));
    }
  });

  it('ไม่มีโฟลเดอร์ legacy app/ หลงเหลืออยู่ในสิ่งที่ deploy', () => {
    expect(existsSync(join(root, 'public', 'app'))).toBe(false);
    expect(existsSync(join(root, 'app'))).toBe(false);
  });

  it('.gitignore ต้องกันโฟลเดอร์ที่มีข้อมูลพนักงานและรหัสกลางไม่ให้ขึ้น GitHub', () => {
    const ignore = readFileSync(join(root, '.gitignore'), 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));

    // sql/ มีอีเมลและชื่อพนักงานทั้งบริษัทใน 91_seed และรหัสกลางใน 19_/21_
    // app/ เป็นแอปรุ่นเก่าที่ฝัง Supabase URL กับ anon key ไว้ในโค้ดตรง ๆ
    for (const rule of ['sql/', 'app/', '.env']) {
      expect(ignore).toContain(rule);
    }
  });

  it('มีเพียง workflow เดียวที่ deploy อัตโนมัติเมื่อ push main', () => {
    const dir = join(root, '.github', 'workflows');
    const autoDeploy = filesUnder(dir, /\.ya?ml$/).filter((path) => {
      const body = readFileSync(path, 'utf8');
      return /on:\s*[\s\S]*?push:/.test(body) && /branches:\s*\[\s*main/.test(body);
    });
    expect(autoDeploy.length).toBe(1);
  });
});

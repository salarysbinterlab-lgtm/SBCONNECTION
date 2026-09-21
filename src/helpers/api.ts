// src/helpers/api.ts
// ชั้นเดียวที่คุยกับ Supabase และ Apps Script
//
// หลักการ
//  - config มาจาก .env (VITE_*) เท่านั้น ไม่มี key ฝังในซอร์สอีกต่อไป
//  - ไม่เก็บรหัสผ่านของผู้ใช้ไว้ที่ไหนทั้งสิ้น
//  - เรียกได้เฉพาะ RPC ไม่มีการ select ตารางตรง
//  - mock database ถูก import แบบ dynamic เฉพาะตอน dev จึงไม่ติดไปกับ production bundle

const TOKEN_KEY = 'sb_session_token';
const USER_KEY = 'sb_current_user';

/** RPC ที่ frontend เรียกได้ ต้องตรงกับ allowlist ใน sql/17_SECURITY_HARDENING_AND_FIXES.sql */
export const ALLOWED_RPC = [
  'login_with_emp_password',
  'validate_public_session',
  'logout_public_session',
  'change_my_password',
  'get_app_welcome',
  'get_home_dashboard',
  'get_my_profile',
  'daily_checkin',
  'list_news',
  'read_news',
  'list_missions',
  'submit_mission',
  'list_rewards',
  'redeem_reward',
  'list_my_redemptions',
  'list_ranking',
  'list_notifications',
  'mark_notification_read',
  'list_my_overall_logs',
  'list_calendar_events',
  'list_rule_board',
  'public_save_my_avatar',
  'get_admin_dashboard',
  'admin_list_users',
  'admin_list_news',
  'admin_list_missions',
  'admin_list_mission_submissions',
  'admin_list_rewards',
  'admin_list_reward_redemptions',
  'admin_list_ledger',
  'admin_list_manager_depts',
  'admin_list_calendar_events',
  'admin_list_rule_board',
  'admin_list_overall_activity',
  'admin_list_special_point_logs',
  'admin_upsert_user',
  'admin_upsert_news',
  'admin_upsert_mission',
  'admin_upsert_reward',
  'admin_upsert_rule_board',
  'admin_upsert_calendar_event',
  'admin_delete_user',
  'admin_delete_news',
  'admin_delete_mission',
  'admin_delete_reward',
  'admin_delete_rule_board',
  'admin_delete_calendar_event',
  'admin_save_manager_depts_batch',
  'admin_review_mission_submission',
  'admin_update_reward_redemption',
  'admin_add_special_points',
  'admin_reset_password',
  // ล้างข้อมูลทดสอบ ฐานข้อมูลเช็คเองว่าเป็นบัญชีที่อยู่ในรายชื่ออนุญาตหรือเปล่า
  'admin_system_reset',
  // โมดูลใบคำร้อง IT (ย้ายมาจากระบบ XAMPP) สิทธิ์ทั้งหมดเช็คในฐานข้อมูล
  'it_create_request',
  'it_list_my_requests',
  'it_get_request',
  'it_list_manager_queue',
  'it_manager_decide',
  'it_list_it_queue',
  'it_close_request',
  'it_list_all_requests',
  'it_dashboard_summary',
  'it_admin_edit_request',
] as const;

export type AllowedRpc = (typeof ALLOWED_RPC)[number];

const ALLOWED_RPC_SET: ReadonlySet<string> = new Set(ALLOWED_RPC);

export type AppConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  driveUploadEndpoint: string;
};

/** ใช้ mock database เฉพาะตอน dev บนเครื่องตัวเอง และต้องใส่ ?mock=1 เท่านั้น */
export function isMockMode(): boolean {
  return (
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    ['127.0.0.1', 'localhost'].includes(window.location.hostname) &&
    new URLSearchParams(window.location.search).get('mock') === '1'
  );
}

export function getConfig(): AppConfig {
  return {
    supabaseUrl: (import.meta.env.VITE_SUPABASE_URL || '').trim(),
    supabaseAnonKey: (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim(),
    driveUploadEndpoint: (import.meta.env.VITE_DRIVE_UPLOAD_ENDPOINT || '').trim(),
  };
}

export function isSupabaseConfigured(): boolean {
  const cfg = getConfig();
  return Boolean(
    cfg.supabaseUrl &&
      cfg.supabaseUrl.startsWith('https://') &&
      cfg.supabaseAnonKey &&
      cfg.supabaseAnonKey.length > 20,
  );
}

export function getToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function getCurrentUser(): Record<string, any> {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || '{}');
  } catch {
    return {};
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    // ล้างร่องรอยของเวอร์ชันเก่าที่เคยเก็บรหัสผ่านไว้ในเบราว์เซอร์
    sessionStorage.removeItem('sb_tmp_login_password');
  } catch {
    /* ignore */
  }
}

export function setSession(token: string, user: any) {
  const normalizedUser = {
    ...(user || {}),
    emp_id: user?.emp_id || user?.empId || '',
    empId: user?.empId || user?.emp_id || '',
    full_name: user?.full_name || user?.name || user?.display_name || '',
    name: user?.name || user?.full_name || user?.display_name || '',
    department: user?.department || user?.dept || user?.dept_th || '',
    dept: user?.dept || user?.department || user?.dept_th || '',
    position: user?.position || user?.pos_th || user?.position_name || '',
    avatar_url: user?.avatar_url || user?.avatar || '',
    avatar: user?.avatar || user?.avatar_url || '',
  };
  localStorage.setItem(TOKEN_KEY, token || '');
  localStorage.setItem(USER_KEY, JSON.stringify(normalizedUser));
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์ที่เลือกได้'));
    reader.readAsDataURL(file);
  });
}

const ALLOWED_UPLOAD_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
];

export type DriveUploadResult = {
  fileId: string;
  fileName: string;
  mimeType: string;
  directUrl: string;
  viewUrl: string;
  downloadUrl: string;
};

/**
 * อัปโหลดไฟล์ผ่าน Apps Script
 * ยืนยันตัวตนด้วย session token ของผู้ใช้ (Apps Script จะเอา token ไปถาม
 * validate_public_session กับ Supabase อีกที) ไม่มี shared secret ฝังในหน้าเว็บอีกแล้ว
 */
export async function uploadDriveFile(
  file: File,
  bucket: 'profile' | 'news' | 'missions' | 'rewards' | 'mission_evidence' | 'attachments',
  meta: Record<string, unknown> = {},
): Promise<DriveUploadResult> {
  const endpoint = getConfig().driveUploadEndpoint;
  const sessionToken = getToken();

  if (!endpoint) throw new Error('ยังไม่ได้ตั้งค่า VITE_DRIVE_UPLOAD_ENDPOINT');
  if (!sessionToken) throw new Error('SESSION_EXPIRED');
  if (!ALLOWED_UPLOAD_MIME.includes(file.type)) {
    throw new Error('อนุญาตเฉพาะไฟล์รูปภาพ (JPG, PNG, WEBP, GIF) และ PDF เท่านั้น');
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error('ไฟล์มีขนาดเกิน 8 MB');
  }

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      signal: controller.signal,
      body: JSON.stringify({
        type: 'upload',
        sessionToken,
        bucket,
        fileName: file.name,
        mimeType: file.type,
        base64: await fileToDataUrl(file),
        meta,
      }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || !data || data.status === 'error' || data.ok === false) {
      throw new Error(data?.message || 'อัปโหลดไฟล์ไม่สำเร็จ');
    }
    return data as DriveUploadResult;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('อัปโหลดไฟล์นานเกินไป กรุณาลองใหม่');
    }
    throw err;
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * ลืมรหัสผ่าน - ส่งคำขอไปที่ Apps Script ซึ่งจะไปขอรหัสชั่วคราวจาก Supabase
 * แล้วส่งอีเมลแจ้งผู้ดูแลระบบพร้อมข้อมูลพนักงาน
 *
 * รหัสชั่วคราวไม่เคยถูกส่งกลับมาที่เบราว์เซอร์ ผู้ขอจึงอ่านรหัสของคนอื่นไม่ได้
 * และข้อความตอบกลับเหมือนกันเสมอ ไม่ว่ารหัสพนักงานจะมีอยู่จริงหรือไม่
 */
export async function requestPasswordReset(empId: string): Promise<string> {
  const id = String(empId || '').trim();
  if (!id) throw new Error('กรุณากรอกรหัสพนักงาน');
  if (id.length > 40) throw new Error('รหัสพนักงานไม่ถูกต้อง');

  const GENERIC = 'ส่งคำขอเรียบร้อยแล้ว ผู้ดูแลระบบจะติดต่อกลับเพื่อแจ้งรหัสชั่วคราวให้';

  if (isMockMode()) return GENERIC;

  const endpoint = getConfig().driveUploadEndpoint;
  if (!endpoint) throw new Error('ยังไม่ได้ตั้งค่า VITE_DRIVE_UPLOAD_ENDPOINT');

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      signal: controller.signal,
      body: JSON.stringify({
        type: 'password_reset_request',
        empId: id,
        userAgent: navigator.userAgent,
      }),
    });
    const data = await res.json().catch(() => null);
    return (data && typeof data.message === 'string' && data.message) || GENERIC;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('ส่งคำขอนานเกินไป กรุณาลองใหม่อีกครั้ง');
    }
    throw new Error('ส่งคำขอไม่สำเร็จ กรุณาลองใหม่ หรือติดต่อผู้ดูแลระบบโดยตรง');
  } finally {
    window.clearTimeout(timer);
  }
}

const RPC_TIMEOUT_MS = 20_000;

export async function rpc<T>(fn: AllowedRpc | string, args: Record<string, unknown> = {}): Promise<T> {
  if (!ALLOWED_RPC_SET.has(fn)) {
    // กันพิมพ์ชื่อผิดและกันเรียกฟังก์ชันที่ไม่ได้อยู่ใน allowlist ของฝั่งฐานข้อมูล
    throw new Error(`RPC ไม่อยู่ในรายการที่อนุญาต: ${fn}`);
  }

  if (isMockMode()) {
    const { handleMockRpc } = await import('./mockApi');
    return handleMockRpc(fn, args) as T;
  }

  const cfg = getConfig();
  if (!isSupabaseConfigured()) {
    throw new Error('ยังไม่ได้ตั้งค่า VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY');
  }

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);

  try {
    const res = await fetch(`${cfg.supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        apikey: cfg.supabaseAnonKey,
        Authorization: `Bearer ${cfg.supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify(args || {}),
    });

    const rawText = await res.text();
    let data: any = null;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch {
      data = rawText;
    }

    if (!res.ok) {
      const obj = data as { message?: string; error?: string; details?: string; code?: string };
      // ไม่โยนข้อความดิบจากฐานข้อมูลออกหน้าจอ กัน information disclosure
      // แต่โชว์ "รหัสข้อผิดพลาด" ได้ เพราะเป็นรหัสมาตรฐาน ไม่มีข้อมูลของใครอยู่ในนั้น
      // และช่วยให้แอดมินบอกทีมดูแลได้ว่าติดตรงไหน แทนที่จะเดากันไปมา
      //   PGRST202 = ยังไม่ได้สร้างฟังก์ชันนี้ในฐานข้อมูล (ลืมรัน SQL)
      //   PGRST301 = ปัญหาเรื่องคีย์/สิทธิ์
      //   42501    = ฐานข้อมูลไม่อนุญาตให้เรียกฟังก์ชันนี้
      const code = String(obj?.code || res.status);
      if (import.meta.env.DEV) {
        console.warn(`[rpc:${fn}]`, code, obj?.message || obj?.details || rawText);
      } else {
        console.warn(`[rpc:${fn}] ${code}`);
      }
      if (res.status === 401 || res.status === 403) {
        throw new Error('SESSION_EXPIRED');
      }
      throw new Error(`ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง (รหัส ${code})`);
    }

    if (data && typeof data === 'object' && data.status === 'error') {
      throw new Error(data.message || 'ทำรายการไม่สำเร็จ');
    }

    return data as T;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('เชื่อมต่อเซิร์ฟเวอร์นานเกินไป กรุณาลองใหม่');
    }
    if (err instanceof TypeError) {
      throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ต');
    }
    throw err;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function logout() {
  const token = getToken();
  try {
    if (token) await rpc('logout_public_session', { p_token: token });
  } catch {
    /* ออกจากระบบฝั่งเครื่องให้ได้เสมอ แม้เซิร์ฟเวอร์จะตอบไม่ได้ */
  }
  clearSession();
  window.location.hash = '';
  window.location.reload();
}

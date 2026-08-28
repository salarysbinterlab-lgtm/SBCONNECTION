/// <reference types="vite/client" />

interface ImportMetaEnv {
  // ค่าที่ Vite ใส่ให้เอง ประกาศซ้ำไว้ให้ตรงกับ vite/client ทุกตัวอักษร
  // (ห้ามใส่ readonly เพราะ vite/client ไม่ได้ใส่ ถ้าไม่ตรงจะ error เรื่อง modifier)
  BASE_URL: string;
  MODE: string;
  DEV: boolean;
  PROD: boolean;
  SSR: boolean;

  /** URL ของโปรเจกต์ Supabase เช่น https://xxxx.supabase.co */
  readonly VITE_SUPABASE_URL: string;
  /** publishable / anon key เท่านั้น ห้ามใส่ secret key ฝั่งเซิร์ฟเวอร์เด็ดขาด */
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** URL ของ Apps Script Web App สำหรับอัปโหลดไฟล์ขึ้น Drive และรับคำขอลืมรหัสผ่าน */
  readonly VITE_DRIVE_UPLOAD_ENDPOINT: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  Swal?: {
    fire: (options: Record<string, unknown>) => Promise<{ isConfirmed?: boolean }>;
  };
}

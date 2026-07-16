// assets/js/driveUploadService.js
// ใช้กับ Apps Script Drive Upload API ในโฟลเดอร์ apps_script/
import { SB_CONFIG } from "./sbConfig.js";

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export async function uploadDrive(bucket, file, meta = {}) {
  if (!file) throw new Error("ไม่พบไฟล์");
  if (!SB_CONFIG.driveUploadEndpoint || SB_CONFIG.driveUploadEndpoint.includes("PASTE_")) {
    throw new Error("ยังไม่ได้ตั้งค่า driveUploadEndpoint ใน sbConfig.js");
  }
  const base64 = await fileToBase64(file);
  const res = await fetch(SB_CONFIG.driveUploadEndpoint, {
    method: "POST",
    body: JSON.stringify({ token: SB_CONFIG.driveUploadToken, bucket, fileName: file.name, mimeType: file.type, base64, meta })
  });
  const json = await res.json();
  if (!json || json.status !== "success") throw new Error(json.message || "Upload Drive failed");
  return json;
}

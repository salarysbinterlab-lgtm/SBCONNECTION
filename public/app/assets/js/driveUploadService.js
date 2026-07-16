import { getConfig } from "./sbClient.js";

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function uploadToDrive(folderKey, file, meta = {}) {
  const cfg = getConfig();

  if (!cfg.driveUploadEndpoint || cfg.driveUploadEndpoint.includes("PASTE_")) {
    throw new Error("ยังไม่ได้ตั้งค่า driveUploadEndpoint ใน sbConfig.js");
  }

  const base64 = await fileToBase64(file);

  const res = await fetch(cfg.driveUploadEndpoint, {
    method: "POST",
    body: JSON.stringify({
      token: cfg.driveUploadToken,
      bucket: folderKey,
      folderKey,
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size,
      base64,
      meta
    })
  });

  const data = await res.json();
  if (!res.ok || data.status !== "success") {
    throw new Error(data.message || "อัปโหลดไฟล์ไม่สำเร็จ");
  }

  return data;
}

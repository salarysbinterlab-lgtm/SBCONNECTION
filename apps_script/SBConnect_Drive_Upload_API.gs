// SBConnect_Drive_Upload_API.gs
// Deploy: Web app / Execute as Me / Anyone with link
const UPLOAD_TOKEN = "CHANGE_THIS_TOKEN_TO_MATCH_FRONTEND";
const DRIVE_FOLDERS = {
  avatars: "PASTE_AVATARS_FOLDER_ID",
  news: "PASTE_NEWS_FOLDER_ID",
  missions: "PASTE_MISSIONS_FOLDER_ID",
  rewards: "PASTE_REWARDS_FOLDER_ID",
  mission_evidence: "PASTE_MISSION_EVIDENCE_FOLDER_ID",
  attachments: "PASTE_ATTACHMENTS_FOLDER_ID"
};

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || "{}");
    if (body.token !== UPLOAD_TOKEN) return jsonOutput({ status:"error", message:"Unauthorized" });
    const bucket = body.bucket;
    if (!bucket || !DRIVE_FOLDERS[bucket]) return jsonOutput({ status:"error", message:"Invalid bucket" });
    if (!body.fileName || !body.mimeType || !body.base64) return jsonOutput({ status:"error", message:"Missing file data" });

    const cleanBase64 = String(body.base64).includes(",") ? String(body.base64).split(",")[1] : String(body.base64);
    const bytes = Utilities.base64Decode(cleanBase64);
    const safeName = Date.now() + "_" + sanitizeFileName(body.fileName);
    const blob = Utilities.newBlob(bytes, body.mimeType, safeName);
    const folder = DriveApp.getFolderById(DRIVE_FOLDERS[bucket]);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const fileId = file.getId();
    return jsonOutput({
      status:"success",
      fileId,
      fileName:safeName,
      mimeType:body.mimeType,
      bucket,
      directUrl:"https://lh3.googleusercontent.com/d/" + fileId,
      viewUrl:"https://drive.google.com/file/d/" + fileId + "/view",
      meta: body.meta || {}
    });
  } catch (err) {
    return jsonOutput({ status:"error", message:err.message });
  }
}
function sanitizeFileName(name) {
  return String(name || "file").replace(/[\\\/:*?"<>|#%{}~&]/g, "_").replace(/\s+/g, "_").slice(0, 120);
}
function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

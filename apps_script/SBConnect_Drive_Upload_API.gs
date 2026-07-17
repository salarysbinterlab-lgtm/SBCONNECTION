// SBConnect_Drive_Upload_API.gs
// Deploy: Web app / Execute as Me / Anyone with link
// Handles Drive image uploads and lightweight audit logs to Google Sheets.
// Script Properties:
// UPLOAD_TOKEN, AUDIT_SHEET_ID, FOLDER_PROFILE_ID, FOLDER_NEWS_ID,
// FOLDER_MISSIONS_ID, FOLDER_REWARD_ID, optional FOLDER_MISSION_EVIDENCE_ID,
// optional FOLDER_ATTACHMENTS_ID
const DEFAULT_AUDIT_SHEET_ID = "1co7BNHIaMBu6In-CJe3U9wckjNgDJkSLFVKvuAIuuQs";

function scriptProps() {
  return PropertiesService.getScriptProperties();
}

function prop(name, fallback) {
  return scriptProps().getProperty(name) || fallback || "";
}

function uploadToken() {
  return prop("UPLOAD_TOKEN", "CHANGE_THIS_TOKEN_TO_MATCH_FRONTEND");
}

function auditSheetId() {
  return prop("AUDIT_SHEET_ID", DEFAULT_AUDIT_SHEET_ID);
}

function driveFolders() {
  const profileId = prop("FOLDER_PROFILE_ID");
  const newsId = prop("FOLDER_NEWS_ID");
  const missionsId = prop("FOLDER_MISSIONS_ID");
  const rewardId = prop("FOLDER_REWARD_ID");
  return {
    avatars: profileId,
    profile: profileId,
    news: newsId,
    missions: missionsId,
    rewards: rewardId,
    reward: rewardId,
    mission_evidence: prop("FOLDER_MISSION_EVIDENCE_ID", missionsId),
    attachments: prop("FOLDER_ATTACHMENTS_ID", missionsId || newsId || rewardId || profileId)
  };
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || "{}");
    if (body.token !== uploadToken()) return jsonOutput({ status:"error", message:"Unauthorized" });

    const type = String(body.type || "").trim();
    if (type === "log") return appendAuditLog(body.log || body);
    if (type === "log_batch") return appendAuditLogBatch(body.logs || []);

    const bucket = body.bucket;
    const legacyType = String(body.type || "").trim();
    const resolvedBucket = bucket || legacyTypeToBucket(legacyType);
    const folders = driveFolders();
    if (!resolvedBucket || !folders[resolvedBucket]) return jsonOutput({ status:"error", message:"Invalid bucket or missing folder Script Property" });

    if (body.image_base64 && !body.base64) body.base64 = body.image_base64;
    if (body.mime_type && !body.mimeType) body.mimeType = body.mime_type;
    if (!body.fileName) body.fileName = buildLegacyFileName(legacyType, body);

    if (!body.fileName || !body.mimeType || !body.base64) return jsonOutput({ status:"error", message:"Missing file data" });

    const cleanBase64 = String(body.base64).includes(",") ? String(body.base64).split(",")[1] : String(body.base64);
    const bytes = Utilities.base64Decode(cleanBase64);
    const safeName = Date.now() + "_" + sanitizeFileName(body.fileName);
    const blob = Utilities.newBlob(bytes, body.mimeType, safeName);
    const folder = DriveApp.getFolderById(folders[resolvedBucket]);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const fileId = file.getId();
    return jsonOutput({
      status:"success",
      fileId,
      fileName:safeName,
      mimeType:body.mimeType,
      bucket: resolvedBucket,
      directUrl:"https://lh3.googleusercontent.com/d/" + fileId,
      viewUrl:"https://drive.google.com/file/d/" + fileId + "/view",
      meta: body.meta || {}
    });
  } catch (err) {
    return jsonOutput({ status:"error", message:err.message });
  }
}

function appendAuditLog(raw) {
  const row = normalizeLogRow(raw);
  appendRowsToSheet("ALL", [row]);
  appendRowsToSheet(sheetNameForGroup(row[2]), [row]);
  return jsonOutput({ status:"success", ok:true, logged:1 });
}

function appendAuditLogBatch(logs) {
  if (!Array.isArray(logs)) logs = [];
  const rows = logs.map(normalizeLogRow);
  if (!rows.length) return jsonOutput({ status:"success", ok:true, logged:0 });

  appendRowsToSheet("ALL", rows);

  const grouped = {};
  rows.forEach(function(row) {
    const sheet = sheetNameForGroup(row[2]);
    if (!grouped[sheet]) grouped[sheet] = [];
    grouped[sheet].push(row);
  });

  Object.keys(grouped).forEach(function(sheet) {
    appendRowsToSheet(sheet, grouped[sheet]);
  });

  return jsonOutput({ status:"success", ok:true, logged:rows.length });
}

function normalizeLogRow(log) {
  log = log || {};
  const now = new Date();
  const metadata = scrubObject(log.metadata || log.payload || {});
  return [
    Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss"),
    String(log.session_id || log.request_id || ""),
    String(log.action_group || log.group || groupFromAction(log.action || log.rpc || "")),
    String(log.action || log.rpc || ""),
    String(log.status || "success"),
    String(log.actor_emp_id || log.emp_id || ""),
    String(log.target_emp_id || log.target_id || ""),
    String(log.target_table || ""),
    String(log.target_id || ""),
    String(log.description || log.message || ""),
    JSON.stringify(metadata).slice(0, 45000)
  ];
}

function appendRowsToSheet(sheetName, rows) {
  const ss = SpreadsheetApp.openById(auditSheetId());
  const sheet = getOrCreateSheet(ss, sheetName);
  if (!rows.length) return;
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

function getOrCreateSheet(ss, sheetName) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "created_at",
      "session_id",
      "action_group",
      "action",
      "status",
      "actor_emp_id",
      "target_emp_id",
      "target_table",
      "target_id",
      "description",
      "metadata_json"
    ]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function sheetNameForGroup(group) {
  const g = String(group || "system").toLowerCase();
  if (g.indexOf("login") >= 0 || g.indexOf("auth") >= 0) return "AUTH_LOGIN";
  if (g.indexOf("admin") >= 0) return "ADMIN";
  if (g.indexOf("point") >= 0 || g.indexOf("แต้ม") >= 0) return "POINTS";
  if (g.indexOf("news") >= 0) return "NEWS";
  if (g.indexOf("mission") >= 0) return "MISSIONS";
  if (g.indexOf("reward") >= 0 || g.indexOf("redeem") >= 0) return "REWARDS";
  if (g.indexOf("ranking") >= 0) return "RANKING";
  if (g.indexOf("profile") >= 0) return "PROFILE";
  return "SYSTEM";
}

function groupFromAction(action) {
  const a = String(action || "").toLowerCase();
  if (a.indexOf("login") >= 0 || a.indexOf("session") >= 0) return "auth";
  if (a.indexOf("admin") >= 0) return "admin";
  if (a.indexOf("point") >= 0 || a.indexOf("checkin") >= 0) return "points";
  if (a.indexOf("news") >= 0) return "news";
  if (a.indexOf("mission") >= 0) return "missions";
  if (a.indexOf("reward") >= 0 || a.indexOf("redeem") >= 0) return "rewards";
  if (a.indexOf("ranking") >= 0) return "ranking";
  if (a.indexOf("profile") >= 0 || a.indexOf("avatar") >= 0) return "profile";
  return "system";
}

function scrubObject(obj) {
  const blocked = /password|pass|token|secret|key|authorization|image_base64|base64/i;
  if (!obj || typeof obj !== "object") return obj;
  const out = Array.isArray(obj) ? [] : {};
  Object.keys(obj).forEach(function(k) {
    if (blocked.test(k)) {
      out[k] = "[redacted]";
    } else if (obj[k] && typeof obj[k] === "object") {
      out[k] = scrubObject(obj[k]);
    } else {
      out[k] = obj[k];
    }
  });
  return out;
}

function legacyTypeToBucket(type) {
  if (type === "profile") return "avatars";
  if (type === "reward") return "rewards";
  if (type === "news") return "news";
  if (type === "mission") return "missions";
  return "";
}

function buildLegacyFileName(type, body) {
  const ext = getExt(body.mimeType || body.mime_type || "image/png");
  if (type === "profile") return sanitizeFileName(body.emp_id || "profile") + "." + ext;
  if (type) return type + "_" + sanitizeFileName(body.record_id || body.file_id || Date.now()) + "." + ext;
  return "upload_" + Date.now() + "." + ext;
}

function getExt(mimeType) {
  const type = String(mimeType || "").toLowerCase();
  if (type.indexOf("jpeg") >= 0 || type.indexOf("jpg") >= 0) return "jpg";
  if (type.indexOf("webp") >= 0) return "webp";
  if (type.indexOf("gif") >= 0) return "gif";
  return "png";
}

function sanitizeFileName(name) {
  return String(name || "file").replace(/[\\\/:*?"<>|#%{}~&]/g, "_").replace(/\s+/g, "_").slice(0, 120);
}
function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  const folders = driveFolders();
  return jsonOutput({
    status:"success",
    service:"SB Connect Drive Upload + Sheet Audit API",
    sheetId:auditSheetId(),
    buckets:Object.keys(folders).filter(function(key) { return !!folders[key]; }),
    logTypes:["log","log_batch"]
  });
}

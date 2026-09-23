/**
 * SBConnect_Image_Sharing_Audit.gs
 *
 * เพิ่มไฟล์นี้เป็นอีกไฟล์ในโปรเจกต์ Apps Script เดิม (ไฟล์ > สคริปต์ใหม่)
 *
 * ใช้ทำอะไร
 *   ก่อนจะปิดแชร์โฟลเดอร์ SBconnection ใน Google Drive
 *   ต้องมั่นใจก่อนว่ารูปทุกใบในแอปถูกตั้งสิทธิ์ "ใครมีลิงก์ก็ดูได้" ไว้ที่ตัวไฟล์เอง
 *   ไม่ได้อาศัยสิทธิ์ของโฟลเดอร์แม่
 *
 *   รูปที่แอปอัปโหลดเองจะถูกตั้งให้แล้วอัตโนมัติ (บรรทัด file.setSharing ใน
 *   SBConnect_Drive_Upload_API.gs) แต่ถ้ามีรูปที่เคยลากวางเข้าโฟลเดอร์ด้วยมือ
 *   หรืออัปโหลดมาก่อนที่โค้ดบรรทัดนั้นจะมี รูปพวกนั้นจะขึ้นได้เพราะสิทธิ์โฟลเดอร์
 *   ล้วน ๆ พอปิดแชร์โฟลเดอร์ก็จะกลายเป็นรูปแตกทันที ไฟล์นี้มีไว้ตามเก็บพวกนั้น
 *
 * ลำดับการใช้
 *   1. IMAGE_SHARING_CHECK()   ตรวจอย่างเดียว ไม่แก้อะไร ดูว่ามีกี่ไฟล์ที่ยังไม่ปลอดภัย
 *   2. IMAGE_SHARING_FIX()     แก้ให้ทุกไฟล์เป็น ใครมีลิงก์ก็ดูได้ (VIEW เท่านั้น)
 *   3. ปิดแชร์โฟลเดอร์ SBconnection ใน Drive เป็น Restricted
 *   4. IMAGE_SHARING_CHECK()   ตรวจซ้ำให้ได้ 0 ไฟล์ที่ยังไม่ปลอดภัย
 *   5. เปิดแอป ดูว่ารูปข่าว รูปภารกิจ รูปของรางวัล รูปโปรไฟล์ ขึ้นครบ
 *
 * หมายเหตุ
 *   ตั้งเป็น VIEW เท่านั้น ไม่มีใครแก้หรือลบไฟล์ได้จากลิงก์
 *   การตั้งสิทธิ์รายไฟล์ ปลอดภัยกว่าการแชร์ทั้งโฟลเดอร์ เพราะคนที่ได้ลิงก์รูปหนึ่งใบ
 *   จะเปิดดูได้แค่ใบนั้น ไม่สามารถไล่ดูรายการไฟล์ทั้งโฟลเดอร์ได้
 */

// โฟลเดอร์ที่เก็บรูปของแอป ชื่อ property ตรงกับที่ driveFolders() ใช้
var IMG_FOLDER_PROPS_BASE = [
  ["FOLDER_PROFILE_ID",          "รูปโปรไฟล์พนักงาน"],
  ["FOLDER_NEWS_ID",             "รูปข่าวสาร"],
  ["FOLDER_MISSIONS_ID",         "รูปภารกิจ"],
  ["FOLDER_REWARD_ID",           "รูปของรางวัล"],
  ["FOLDER_MISSION_EVIDENCE_ID", "หลักฐานการทำภารกิจ"],
  ["FOLDER_ATTACHMENTS_ID",      "ไฟล์แนบอื่น ๆ"],
  ["FOLDER_GAMES_ID",            "รูประบบเกม (โฟลเดอร์แม่)"]
];

/**
 * รายการโฟลเดอร์ที่ต้องตรวจ = ชุดพื้นฐาน + โฟลเดอร์ของทุกเกมที่ตั้งไว้
 * เกมใหม่ที่เพิ่มทีหลัง (FOLDER_GAME_<SLUG>_ID) จะถูกตรวจเองโดยไม่ต้องแก้ไฟล์นี้
 */
function imgFolderProps_() {
  var list = IMG_FOLDER_PROPS_BASE.slice(0);
  var all = PropertiesService.getScriptProperties().getProperties();
  var keys = Object.keys(all).sort();
  for (var i = 0; i < keys.length; i++) {
    var m = keys[i].match(/^FOLDER_GAME_([A-Z0-9_]+)_ID$/);
    if (!m) continue;
    list.push([keys[i], "รูปเกม " + m[1].toLowerCase()]);
  }
  return list;
}

var IMG_MAX_FILES_PER_RUN = 3000;

function imgProp_(name) {
  return PropertiesService.getScriptProperties().getProperty(name) || "";
}

/** ตัดลิงก์ Drive ให้เหลือแต่รหัส กันกรณีวาง URL มาทั้งอัน */
function imgDriveId_(value) {
  var raw = String(value || "").trim();
  if (!raw) return "";
  var m = raw.match(/[-\w]{25,}/);
  return m ? m[0] : raw.split("?")[0].split("#")[0];
}

/** ไฟล์นี้เปิดให้คนมีลิงก์ดูได้แล้วหรือยัง */
function imgIsPublic_(file) {
  try {
    var access = file.getSharingAccess();
    return access === DriveApp.Access.ANYONE_WITH_LINK || access === DriveApp.Access.ANYONE;
  } catch (err) {
    return false;
  }
}

function imgWalk_(fix) {
  var lines = [];
  var totalAll = 0, totalBad = 0, totalFixed = 0, totalFail = 0;
  var seen = {};

  lines.push(fix ? "โหมด: แก้ไขจริง" : "โหมด: ตรวจอย่างเดียว ไม่แก้อะไร");
  lines.push("");

  var folderProps = imgFolderProps_();
  for (var i = 0; i < folderProps.length; i++) {
    var propName = folderProps[i][0];
    var label    = folderProps[i][1];
    var id       = imgDriveId_(imgProp_(propName));

    if (!id) {
      lines.push("- " + label + " (" + propName + "): ยังไม่ได้ตั้งค่า ข้าม");
      continue;
    }
    if (seen[id]) {
      lines.push("- " + label + " (" + propName + "): ใช้โฟลเดอร์เดียวกับที่ตรวจไปแล้ว ข้าม");
      continue;
    }
    seen[id] = true;

    var folder;
    try {
      folder = DriveApp.getFolderById(id);
    } catch (err) {
      lines.push("- " + label + ": เปิดโฟลเดอร์ไม่ได้ (" + id + ") -> " + err);
      totalFail++;
      continue;
    }

    var n = 0, bad = 0, fixed = 0, failed = 0;
    var it = folder.getFiles();
    while (it.hasNext() && n < IMG_MAX_FILES_PER_RUN) {
      var f = it.next();
      n++;
      if (imgIsPublic_(f)) continue;
      bad++;
      if (!fix) continue;
      try {
        f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        fixed++;
      } catch (err2) {
        failed++;
        if (failed <= 3) lines.push("    แก้ไม่ได้: " + f.getName() + " -> " + err2);
      }
    }

    totalAll += n; totalBad += bad; totalFixed += fixed; totalFail += failed;
    lines.push("- " + label + ": " + n + " ไฟล์"
      + " | ยังไม่เปิดให้ดู " + bad
      + (fix ? (" | แก้แล้ว " + fixed + (failed ? (" | แก้ไม่ได้ " + failed) : "")) : ""));
    if (n >= IMG_MAX_FILES_PER_RUN) {
      lines.push("    ถึงเพดาน " + IMG_MAX_FILES_PER_RUN + " ไฟล์ต่อรอบ ให้รันอีกครั้งเพื่อตามเก็บที่เหลือ");
    }
  }

  lines.push("");
  lines.push("รวม: " + totalAll + " ไฟล์ | ยังไม่เปิดให้ดู " + totalBad
    + (fix ? (" | แก้แล้ว " + totalFixed) : "") + (totalFail ? (" | มีปัญหา " + totalFail) : ""));
  lines.push("");

  if (!fix && totalBad > 0) {
    lines.push("ยังปิดแชร์โฟลเดอร์ไม่ได้ ถ้าปิดตอนนี้จะมีรูปแตก " + totalBad + " ใบ");
    lines.push("ให้กดรัน IMAGE_SHARING_FIX() ก่อน แล้วรันตรวจซ้ำให้ได้ 0");
  } else if (!fix && totalBad === 0) {
    lines.push("พร้อมปิดแชร์โฟลเดอร์ได้เลย ทุกไฟล์ตั้งสิทธิ์ไว้ที่ตัวไฟล์เองครบแล้ว");
  } else if (fix) {
    lines.push("เสร็จแล้ว ให้รัน IMAGE_SHARING_CHECK() ซ้ำให้ได้ 0 แล้วค่อยปิดแชร์โฟลเดอร์");
  }

  var text = lines.join("\n");
  Logger.log(text);
  return text;
}

/** ตรวจอย่างเดียว ไม่แก้อะไรทั้งนั้น */
function IMAGE_SHARING_CHECK() {
  return imgWalk_(false);
}

/** แก้ให้ทุกไฟล์เป็น ใครมีลิงก์ก็ดูได้ แบบดูอย่างเดียว */
function IMAGE_SHARING_FIX() {
  return imgWalk_(true);
}

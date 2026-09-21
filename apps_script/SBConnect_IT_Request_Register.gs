/**
 * SBConnect_IT_Request_Register.gs
 *
 * ทะเบียนใบคำร้อง IT บน Google Sheet  (มาแทนไฟล์ Excel FM IT-06 ของระบบเดิม)
 *
 * เพิ่มไฟล์นี้เป็นไฟล์ที่สองในโปรเจกต์ Apps Script เดิม (ไฟล์ > สคริปต์ใหม่)
 * ไม่ต้องแก้ไฟล์ SBConnect_Drive_Upload_API.gs เลย ยกเว้นถ้าต้องการให้แถวขึ้นทันที
 * ที่กดปุ่ม (ดูหัวข้อ "การต่อกับ doPost" ท้ายไฟล์)
 *
 * ทำไมถึงเลิกใช้ Excel
 *   ระบบเดิมเปิดไฟล์ Excel ทะเบียนขึ้นมาแก้ทุกครั้งที่สถานะเปลี่ยน
 *   ถ้ามีใครเปิดไฟล์นั้นค้างไว้ จะเกิดไฟล์ ~$....xlsx แล้ว "IT ปิดเคสไม่ได้เลย"
 *   Google Sheet เปิดพร้อมกันกี่คนก็ได้ จึงไม่มีปัญหานี้อีก
 *
 * หลักการทำงาน
 *   Supabase เป็นความจริงหลัก ใบไหนที่ข้อมูลเปลี่ยนจะถูกทำเครื่องหมาย PENDING
 *   ไฟล์นี้มาดึงไปเขียนลง Sheet แล้วรายงานผลกลับ (outbox pattern)
 *   เขียนไม่สำเร็จก็ไม่กระทบผู้ใช้ รอบถัดไปจะตามเก็บเอง
 *
 * Script Properties ที่ต้องมี
 *   SUPABASE_URL                  เช่น https://xxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY     คีย์ service_role (มีที่นี่ที่เดียว ห้ามอยู่ในหน้าเว็บ)
 *   IT_REQUEST_REGISTER_SHEET_ID  เว้นว่างได้ ระบบจะสร้างไฟล์ให้เองครั้งแรกแล้วเติมให้
 *   IT_REQUEST_REGISTER_FOLDER_ID เว้นว่างได้ โฟลเดอร์ที่จะเก็บไฟล์ทะเบียน
 *
 * ปุ่มที่กดรันเองได้
 *   IT_REQUEST_SETUP            สร้างไฟล์ทะเบียน + ตั้ง trigger ให้ครบในทีเดียว
 *   IT_REQUEST_SYNC_NOW         เขียนใบที่ค้างลง Sheet เดี๋ยวนี้
 *   IT_REQUEST_DUE_ALERT_RUN    ส่งอีเมลเตือนหัวหน้าที่ยังไม่อนุมัติ
 *   IT_REQUEST_AUTO_REJECT_RUN  ปิดใบที่เกินกำหนด (ทำงานเมื่อเปิดสวิตช์ในฐานข้อมูลเท่านั้น)
 *   IT_REQUEST_TEST             ตรวจว่าตั้งค่าครบไหม โดยไม่แตะข้อมูลจริง
 */

var IT_REQ_SHEET_PROPERTY  = "IT_REQUEST_REGISTER_SHEET_ID";
var IT_REQ_FOLDER_PROPERTY = "IT_REQUEST_REGISTER_FOLDER_ID";
var IT_REQ_SHEET_NAME      = "SBConnect_IT_Request_Register";
var IT_REQ_TAB_REGISTER    = "REGISTER";
var IT_REQ_TAB_LOG         = "LOG";
var IT_REQ_LOCK_TIMEOUT_MS = 30000;

/**
 * หัวตาราง 13 คอลัมน์
 * A-D และ G-K ตรงกับทะเบียน FM IT-06 เดิมทุกช่อง เพื่อให้ใช้แทนกันได้ทันที
 * E,F,L,M เป็นของใหม่ (เดิม E,F ว่างอยู่แล้ว)
 */
var IT_REQ_HEADERS = [
  "เลขที่คำร้อง",        // A
  "วันที่เปิดคำร้อง",     // B
  "วัตถุประสงค์",        // C
  "รายละเอียด/เหตุผล/Spec", // D
  "แผนก",              // E
  "สถานะ",             // F
  "ผู้ร้องขอ",           // G
  "ผู้ดำเนินการ (IT)",   // H
  "วันที่ต้องการ",        // I
  "วันที่เสร็จ",          // J
  "ผลการพิจารณา + หมายเหตุ IT", // K
  "หมายเหตุหัวหน้า",     // L
  "อัปเดตล่าสุด"         // M
];

var IT_REQ_COLUMN_WIDTHS = [110, 110, 260, 420, 120, 150, 150, 150, 110, 110, 320, 260, 150];

var IT_REQ_LOG_HEADERS = ["เวลาที่เขียน", "เลขที่คำร้อง", "สถานะ", "การกระทำ", "แถวใน REGISTER"];

// =============================================================================
// ส่วนที่ 1 - ตัวช่วยพื้นฐาน (ตั้งชื่อขึ้นต้นด้วย itReq เพื่อไม่ชนกับไฟล์เดิม)
// =============================================================================

function itReqProp_(name, fallback) {
  var value = PropertiesService.getScriptProperties().getProperty(name);
  return value || fallback || "";
}

/**
 * ตัดส่วนเกินของลิงก์ Drive ออก เหลือเฉพาะรหัส
 * กันปัญหาเดิมที่ก๊อปลิงก์มาวางแล้วติด ?usp=sharing มาด้วย
 */
function itReqDriveId_(value) {
  var raw = String(value || "").trim();
  if (!raw) return "";
  var match = raw.match(/[-\w]{25,}/);
  return match ? match[0] : raw.split("?")[0].split("#")[0];
}

function itReqSupabaseRpc_(fnName, payload) {
  var baseUrl = String(itReqProp_("SUPABASE_URL")).replace(/\/+$/, "");
  var serviceKey = itReqProp_("SUPABASE_SERVICE_ROLE_KEY");
  if (!baseUrl || !serviceKey) {
    throw new Error("ยังไม่ได้ตั้งค่า SUPABASE_URL หรือ SUPABASE_SERVICE_ROLE_KEY ใน Script Properties");
  }
  var response = UrlFetchApp.fetch(baseUrl + "/rest/v1/rpc/" + fnName, {
    method: "post",
    contentType: "application/json",
    headers: {
      apikey: serviceKey,
      Authorization: "Bearer " + serviceKey,
      Accept: "application/json"
    },
    payload: JSON.stringify(payload || {}),
    muteHttpExceptions: true
  });
  var code = response.getResponseCode();
  var text = response.getContentText();
  if (code < 200 || code >= 300) {
    throw new Error("Supabase ตอบกลับ " + code + " จาก " + fnName + ": " + String(text).slice(0, 300));
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    return text;
  }
}

// =============================================================================
// ส่วนที่ 2 - ไฟล์ทะเบียน
// =============================================================================

/**
 * คืนไฟล์ทะเบียน ถ้ายังไม่มีจะสร้างให้แล้วจำรหัสไว้ใน Script Properties
 */
function itReqRegisterSpreadsheet_() {
  var id = itReqDriveId_(itReqProp_(IT_REQ_SHEET_PROPERTY));
  if (id) {
    try {
      return SpreadsheetApp.openById(id);
    } catch (err) {
      // รหัสเดิมเปิดไม่ได้ (ถูกลบ/ย้ายสิทธิ์) ให้สร้างใหม่แทนการหยุดทั้งระบบ
      Logger.log("เปิดไฟล์ทะเบียนเดิมไม่ได้ จะสร้างใหม่: " + err);
    }
  }

  var spreadsheet = SpreadsheetApp.create(IT_REQ_SHEET_NAME);
  var folderId = itReqDriveId_(itReqProp_(IT_REQ_FOLDER_PROPERTY));
  if (folderId) {
    try {
      var file = DriveApp.getFileById(spreadsheet.getId());
      DriveApp.getFolderById(folderId).addFile(file);
      DriveApp.getRootFolder().removeFile(file);
    } catch (err) {
      Logger.log("ย้ายไฟล์ทะเบียนเข้าโฟลเดอร์ไม่สำเร็จ (ไฟล์ยังอยู่ใน My Drive): " + err);
    }
  }
  PropertiesService.getScriptProperties().setProperty(IT_REQ_SHEET_PROPERTY, spreadsheet.getId());
  return spreadsheet;
}

function itReqEnsureTab_(spreadsheet, tabName, headers, widths) {
  var sheet = spreadsheet.getSheetByName(tabName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(tabName);
  }
  var firstRow = sheet.getRange(1, 1, 1, headers.length);
  var current = firstRow.getValues()[0];
  var needHeader = false;
  for (var i = 0; i < headers.length; i++) {
    if (String(current[i] || "").trim() !== headers[i]) { needHeader = true; break; }
  }
  if (needHeader) {
    firstRow.setValues([headers]);
    firstRow.setFontWeight("bold");
    firstRow.setBackground("#0f766e");
    firstRow.setFontColor("#ffffff");
    sheet.setFrozenRows(1);
  }
  if (widths) {
    for (var c = 0; c < widths.length; c++) {
      sheet.setColumnWidth(c + 1, widths[c]);
    }
  }
  // ลบแท็บ "Sheet1" ที่ Google สร้างติดมาตอนสร้างไฟล์ใหม่
  var extra = spreadsheet.getSheetByName("Sheet1") || spreadsheet.getSheetByName("ชีต1");
  if (extra && spreadsheet.getSheets().length > 1 && extra.getLastRow() === 0) {
    spreadsheet.deleteSheet(extra);
  }
  return sheet;
}

function itReqRegisterSheet_() {
  var spreadsheet = itReqRegisterSpreadsheet_();
  itReqEnsureTab_(spreadsheet, IT_REQ_TAB_LOG, IT_REQ_LOG_HEADERS, null);
  return itReqEnsureTab_(spreadsheet, IT_REQ_TAB_REGISTER, IT_REQ_HEADERS, IT_REQ_COLUMN_WIDTHS);
}

/**
 * หาแถวของคำร้องใบนี้
 *   1. ถ้ารู้เลขแถวเดิมจากฐานข้อมูล ให้ตรวจก่อนว่าแถวนั้นยังเป็นใบเดิมจริงไหม (เร็วที่สุด)
 *   2. ถ้าไม่ตรง ค่อยค้นทั้งคอลัมน์ A ด้วย TextFinder
 *   3. ถ้ายังไม่เจอ = ใบใหม่ ให้ต่อท้าย
 */
function itReqFindRow_(sheet, requestNo, hintRow) {
  var lastRow = sheet.getLastRow();
  var hint = Number(hintRow || 0);
  if (hint >= 2 && hint <= lastRow) {
    if (String(sheet.getRange(hint, 1).getValue() || "").trim() === requestNo) return hint;
  }
  if (lastRow < 2) return 0;
  var found = sheet.getRange(2, 1, lastRow - 1, 1)
    .createTextFinder(requestNo)
    .matchEntireCell(true)
    .findNext();
  return found ? found.getRow() : 0;
}

function itReqRowValues_(item) {
  return [
    String(item.request_no || ""),
    String(item.request_date || ""),
    String(item.purposes_text || ""),
    String(item.detail_text || ""),
    String(item.dept || ""),
    String(item.status_label || item.status || ""),
    String(item.requester_name || ""),
    String(item.it_staff_name || ""),
    String(item.required_date || ""),
    String(item.done_date || ""),
    String(item.it_result || ""),
    String(item.manager_remarks || ""),
    String(item.updated_at || "")
  ];
}

/**
 * เขียน 1 ใบลงทะเบียน คืนค่าเลขแถวที่เขียน
 */
function itReqWriteRow_(sheet, item) {
  var requestNo = String(item.request_no || "").trim();
  if (!requestNo) throw new Error("ไม่มีเลขที่คำร้องในข้อมูลที่ส่งมา");

  var row = itReqFindRow_(sheet, requestNo, item.sheet_row_no);
  var isNew = false;
  if (!row) {
    row = Math.max(sheet.getLastRow() + 1, 2);
    isNew = true;
  }

  sheet.getRange(row, 1, 1, IT_REQ_HEADERS.length).setValues([itReqRowValues_(item)]);
  sheet.getRange(row, 1, 1, IT_REQ_HEADERS.length).setVerticalAlignment("top").setWrap(true);

  return { row: row, isNew: isNew };
}

function itReqAppendLog_(item, result) {
  try {
    var spreadsheet = itReqRegisterSpreadsheet_();
    var logSheet = itReqEnsureTab_(spreadsheet, IT_REQ_TAB_LOG, IT_REQ_LOG_HEADERS, null);
    logSheet.appendRow([
      Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss"),
      String(item.request_no || ""),
      String(item.status_label || item.status || ""),
      result.isNew ? "เพิ่มแถวใหม่" : "อัปเดตแถวเดิม",
      result.row
    ]);
  } catch (err) {
    Logger.log("เขียนแท็บ LOG ไม่สำเร็จ (ไม่กระทบทะเบียนหลัก): " + err);
  }
}

// =============================================================================
// ส่วนที่ 3 - งานหลัก
// =============================================================================

/**
 * ดึงใบที่รอเขียนจาก Supabase มาลงทะเบียน แล้วรายงานผลกลับ
 * ปลอดภัยต่อการรันซ้ำและรันพร้อมกัน เพราะล็อกไว้ทั้งก้อน
 */
function itReqFlushRegister_(limit) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(IT_REQ_LOCK_TIMEOUT_MS)) {
    return { status: "success", ok: true, skipped: true, message: "มีอีกรอบกำลังเขียนอยู่ ข้ามรอบนี้ไปก่อน" };
  }
  try {
    var claim = itReqSupabaseRpc_("it_register_claim", { p_limit: Math.min(Math.max(Number(limit) || 50, 1), 200) });
    var items = (claim && claim.items) || [];
    if (!items.length) {
      return { status: "success", ok: true, processed: 0, written: 0, failed: 0 };
    }

    var sheet = itReqRegisterSheet_();
    var written = 0;
    var failed = 0;
    var errors = [];

    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      try {
        var result = itReqWriteRow_(sheet, item);
        itReqSupabaseRpc_("it_register_ack", {
          p_request_id: item.request_id,
          p_row_no: result.row,
          p_ok: true,
          p_error: ""
        });
        itReqAppendLog_(item, result);
        written++;
      } catch (err) {
        failed++;
        var message = String(err && err.message ? err.message : err).slice(0, 400);
        errors.push(item.request_no + ": " + message);
        try {
          itReqSupabaseRpc_("it_register_ack", {
            p_request_id: item.request_id,
            p_row_no: null,
            p_ok: false,
            p_error: message
          });
        } catch (ackErr) {
          Logger.log("รายงานผลกลับ Supabase ไม่สำเร็จ: " + ackErr);
        }
      }
    }

    SpreadsheetApp.flush();
    return {
      status: "success",
      ok: failed === 0,
      processed: items.length,
      written: written,
      failed: failed,
      errors: errors
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * ส่งอีเมลเตือนหัวหน้าที่ยังไม่อนุมัติ (เหลือ 3/2/1/0 วัน)
 * ฐานข้อมูลเป็นคนกันไม่ให้ส่งซ้ำ ใบเดียววันเดียวจะได้ครั้งเดียวเท่านั้น
 */
function IT_REQUEST_DUE_ALERT_RUN() {
  var claim = itReqSupabaseRpc_("it_due_alert_claim", { p_limit: 100 });
  var items = (claim && claim.items) || [];
  var sent = 0;
  var skipped = 0;

  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var managers = item.managers || [];
    var emails = [];
    for (var m = 0; m < managers.length; m++) {
      var email = String(managers[m].email || "").trim();
      if (email && emails.indexOf(email) < 0) emails.push(email);
    }
    if (!emails.length) { skipped++; continue; }

    var urgent = Number(item.alert_day) <= 0;
    var subject = (urgent ? "[ด่วน] " : "") + "คำร้อง IT " + item.request_no +
      (urgent ? " ครบกำหนดแล้ว กรุณาอนุมัติ" : " เหลืออีก " + item.alert_day + " วัน");
    var body =
      "เรียน หัวหน้า/ผู้จัดการ\n\n" +
      "มีคำร้องแจ้งซ่อม/ขอบริการ IT รอการอนุมัติจากท่าน\n\n" +
      "เลขที่คำร้อง : " + item.request_no + "\n" +
      "ผู้ร้องขอ     : " + item.requester_name + "\n" +
      "แผนก        : " + item.dept + "\n" +
      "วันที่ต้องการ  : " + item.required_date + "\n" +
      "สถานะเวลา   : " + (urgent ? "ครบกำหนดแล้ว" : "เหลืออีก " + item.alert_day + " วัน") + "\n\n" +
      "กรุณาเข้าแอป SB Connect เพื่ออนุมัติหรือไม่อนุมัติคำร้องนี้\n\n" +
      "ข้อความนี้ส่งโดยระบบอัตโนมัติ ไม่ต้องตอบกลับ";

    try {
      MailApp.sendEmail(emails.join(","), subject, body);
      sent++;
    } catch (err) {
      Logger.log("ส่งอีเมลเตือน " + item.request_no + " ไม่สำเร็จ: " + err);
      skipped++;
    }
  }

  var summary = { status: "success", claimed: items.length, sent: sent, skipped: skipped };
  Logger.log(JSON.stringify(summary));
  return summary;
}

/**
 * ปิดใบที่หัวหน้าไม่อนุมัติภายในกำหนด
 * จะทำงานต่อเมื่อเปิดสวิตช์ it_request_auto_reject_enabled ในฐานข้อมูลเท่านั้น
 */
function IT_REQUEST_AUTO_REJECT_RUN() {
  var result = itReqSupabaseRpc_("it_auto_reject_overdue", { p_max: 20 });
  Logger.log(JSON.stringify(result));
  // ปิดใบไปแล้วต้องอัปเดตทะเบียนด้วย
  if (result && result.closed > 0) {
    itReqFlushRegister_(50);
  }
  return result;
}

function IT_REQUEST_SYNC_NOW() {
  var result = itReqFlushRegister_(100);
  Logger.log(JSON.stringify(result));
  return result;
}

// =============================================================================
// ส่วนที่ 4 - ติดตั้งและตรวจสอบ
// =============================================================================

function itReqDeleteTriggers_(handlerNames) {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (handlerNames.indexOf(triggers[i].getHandlerFunction()) >= 0) {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}

/**
 * กดปุ่มนี้ครั้งเดียวตอนติดตั้ง
 * สร้างไฟล์ทะเบียน + ตั้ง trigger ทั้งหมด (ลบของเดิมก่อน จึงกดซ้ำได้)
 */
function IT_REQUEST_SETUP() {
  var sheet = itReqRegisterSheet_();
  var spreadsheet = sheet.getParent();

  itReqDeleteTriggers_(["IT_REQUEST_SYNC_NOW", "IT_REQUEST_DUE_ALERT_RUN", "IT_REQUEST_AUTO_REJECT_RUN"]);

  ScriptApp.newTrigger("IT_REQUEST_SYNC_NOW").timeBased().everyMinutes(10).create();
  ScriptApp.newTrigger("IT_REQUEST_DUE_ALERT_RUN").timeBased().atHour(8).everyDays(1)
    .inTimezone("Asia/Bangkok").create();
  ScriptApp.newTrigger("IT_REQUEST_AUTO_REJECT_RUN").timeBased().atHour(8).nearMinute(30).everyDays(1)
    .inTimezone("Asia/Bangkok").create();

  var info = {
    status: "success",
    sheetId: spreadsheet.getId(),
    sheetUrl: spreadsheet.getUrl(),
    triggers: ["IT_REQUEST_SYNC_NOW ทุก 10 นาที",
               "IT_REQUEST_DUE_ALERT_RUN ทุกวัน 08:00",
               "IT_REQUEST_AUTO_REJECT_RUN ทุกวัน 08:30"]
  };
  Logger.log(JSON.stringify(info, null, 2));
  return info;
}

/**
 * ตรวจว่าตั้งค่าครบไหม โดยไม่เขียนข้อมูลจริงลงทะเบียน
 */
function IT_REQUEST_TEST() {
  var report = [];

  var url = itReqProp_("SUPABASE_URL");
  var key = itReqProp_("SUPABASE_SERVICE_ROLE_KEY");
  report.push("SUPABASE_URL: " + (url ? "ตั้งแล้ว (" + url + ")" : "ยังไม่ได้ตั้ง <-- ต้องแก้"));
  report.push("SUPABASE_SERVICE_ROLE_KEY: " + (key ? "ตั้งแล้ว (ความยาว " + key.length + " ตัว)" : "ยังไม่ได้ตั้ง <-- ต้องแก้"));

  try {
    var claim = itReqSupabaseRpc_("it_register_claim", { p_limit: 3 });
    var items = (claim && claim.items) || [];
    report.push("เรียก it_register_claim สำเร็จ พบใบที่รอเขียน " + items.length + " ใบ");
    if (items.length) {
      report.push("ตัวอย่างใบแรก: " + items[0].request_no + " (" + items[0].status_label + ")");
    }
  } catch (err) {
    report.push("เรียก it_register_claim ไม่สำเร็จ: " + err);
  }

  try {
    var sheet = itReqRegisterSheet_();
    report.push("ไฟล์ทะเบียน: " + sheet.getParent().getUrl());
    report.push("จำนวนแถวข้อมูลในทะเบียนตอนนี้: " + Math.max(sheet.getLastRow() - 1, 0));
  } catch (err) {
    report.push("เปิด/สร้างไฟล์ทะเบียนไม่สำเร็จ: " + err);
  }

  try {
    report.push("อีเมลที่สคริปต์ใช้ส่ง: " + Session.getEffectiveUser().getEmail());
    report.push("โควตาอีเมลคงเหลือวันนี้: " + MailApp.getRemainingDailyQuota() + " ฉบับ");
  } catch (err) {
    report.push("ตรวจสิทธิ์อีเมลไม่สำเร็จ (ให้กดรันแล้วอนุญาตสิทธิ์ก่อน): " + err);
  }

  var text = report.join("\n");
  Logger.log(text);
  return text;
}

/**
 * ---------------------------------------------------------------------------
 * การต่อกับ doPost (ทำหรือไม่ทำก็ได้)
 *
 * ถ้าอยากให้แถวขึ้นในทะเบียนทันทีที่ผู้ใช้กดปุ่ม ไม่ต้องรอ trigger รอบถัดไป
 * ให้เปิดไฟล์ SBConnect_Drive_Upload_API.gs หาฟังก์ชัน doPost
 * แล้วเพิ่ม 3 บรรทัดนี้ ถัดจากบล็อก  if (sessionUpload) { ... }
 *
 *     if (requestType === "it_request_sync") {
 *       return jsonOutput(itReqFlushRegister_(Number(body.limit) || 25));
 *     }
 *
 * หน้าเว็บจะยิง POST มาด้วย body:
 *     { "type": "it_request_sync", "sessionToken": "<token ของผู้ใช้>" }
 * ซึ่งผ่านการตรวจ session เรียบร้อยแล้วก่อนถึงบรรทัดนี้
 * ---------------------------------------------------------------------------
 */

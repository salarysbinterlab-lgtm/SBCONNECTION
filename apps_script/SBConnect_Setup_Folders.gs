// SBConnect_Setup_Folders.gs
// ─────────────────────────────────────────────────────────────────────────────
//  ตัวติดตั้ง / กู้คืน Script Properties ของ SB Connect
//
//  ใช้ตอนที่โปรเจกต์ Apps Script เดิมหายไป แล้วต้องเริ่ม Script Properties ใหม่
//  ไฟล์นี้จะ "หาโฟลเดอร์เดิมก่อน ถ้าหาไม่เจอค่อยสร้างใหม่" แล้วเขียน ID ลง
//  Script Properties ให้เอง จึงไม่ต้องก๊อป ID ทีละอันด้วยมืออีก
//
//  ลำดับที่ควรรัน (จากเมนู Run ด้านบนของ Apps Script Editor)
//    1) SB_CHECK_LEGACY()    ← ดูว่าโฟลเดอร์/ชีตเดิมยังเข้าถึงได้ไหม  (ไม่แก้อะไรเลย)
//    2) SB_SETUP_ALL()       ← ติดตั้งจริง สร้างที่ขาด เขียน Script Properties
//    3) SB_SHOW_CONFIG()     ← ดูผลลัพธ์ + ได้ SQL ไปวางใน Supabase
//
//  ค่าที่ไฟล์นี้ "ไม่" ตั้งให้ (ต้องใส่เองเพราะเป็นความลับ)
//    SUPABASE_URL
//    SUPABASE_SERVICE_ROLE_KEY
// ─────────────────────────────────────────────────────────────────────────────

/** ชื่อโฟลเดอร์แม่ที่จะสร้างใน My Drive ถ้ายังไม่ได้ตั้ง SB_ROOT_FOLDER_ID */
var SB_ROOT_FOLDER_NAME = 'SB_CONNECT_APP';

/** ชื่อไฟล์ Google Sheet สำหรับ audit log ถ้าต้องสร้างใหม่ */
var SB_AUDIT_SHEET_NAME = 'SB Connect Audit Log';

/**
 * ผังโฟลเดอร์ทั้งหมดของแอป
 *   key      = ชื่อ Script Property ที่จะถูกเขียน
 *   name     = ชื่อโฟลเดอร์ใน Drive
 *   parent   = key ของโฟลเดอร์แม่ (ว่าง = อยู่ใต้ root)
 *   legacy   = ID เดิมที่เคยใช้ (จะลองใช้ก่อนเสมอ ถ้ายังเข้าถึงได้)
 *   required = true คือขาดไม่ได้ อัปโหลดจะพังถ้าไม่มี
 */
var SB_FOLDER_PLAN = [
  { key: 'FOLDER_PROFILE_ID',          name: '01_profile',          parent: '',                  legacy: '1rYD6ys45AziVhhjZEczxejzW5i2YOljz', required: true  },
  { key: 'FOLDER_NEWS_ID',             name: '02_news',             parent: '',                  legacy: '',                                  required: true  },
  { key: 'FOLDER_MISSIONS_ID',         name: '03_missions',         parent: '',                  legacy: '',                                  required: true  },
  { key: 'FOLDER_REWARD_ID',           name: '04_rewards',          parent: '',                  legacy: '1lPC8VGyf6OQqomQgBRxHPJ8FgtcaVc5b', required: true  },
  { key: 'FOLDER_MISSION_EVIDENCE_ID', name: '05_mission_evidence', parent: '',                  legacy: '',                                  required: true  },
  { key: 'FOLDER_ATTACHMENTS_ID',      name: '06_attachments',      parent: '',                  legacy: '',                                  required: true  },

  // ── รูปของระบบเกม: แยกโฟลเดอร์แม่หนึ่งอัน แล้วแตกเป็นเกมละโฟลเดอร์ ──────────
  { key: 'FOLDER_GAMES_ID',            name: '07_games',            parent: '',                  legacy: '',                                  required: true  },
  { key: 'FOLDER_GAME_WHEEL_ID',       name: 'wheel',               parent: 'FOLDER_GAMES_ID',   legacy: '',                                  required: true  },

  // ── Quotation (ยัง hold อยู่ แต่ตั้งไว้ให้ครบกันลืม) ────────────────────────
  { key: 'FOLDER_QUOTATION_ID',        name: '08_quotation',        parent: '',                      legacy: '1AtmDwLBJmK9OTgkskEdHBxqMildr6msf', required: false },
  { key: 'FOLDER_QUOTATION_PDF_ID',    name: 'pdf',                 parent: 'FOLDER_QUOTATION_ID',   legacy: '1wIpoEPrDYCl6kOhPRTQKN4IEF6xObqnk', required: false },
  { key: 'FOLDER_QUOTATION_IMAGE_ID',  name: 'images',              parent: 'FOLDER_QUOTATION_ID',   legacy: '1WhQuee3dzCX63tvbqwYOIA8t67DeqhSc', required: false }
];

/** ชีต audit เดิม */
var SB_LEGACY_AUDIT_SHEET_ID = '1co7BNHIaMBu6In-CJe3U9wckjNgDJkSLFVKvuAIuuQs';

/** ID เดิมที่เคยบันทึกไว้ใน Supabase.app_settings — เอาไว้ตรวจว่ายังเข้าถึงได้ไหม */
var SB_LEGACY_APP_SETTINGS = [
  { key: 'UPLOAD_FOLDER_ID',       id: '1rYD6ys45AziVhhjZEczxejzW5i2YOljz' },
  { key: 'REWARD_FOLDER_ID',       id: '1lPC8VGyf6OQqomQgBRxHPJ8FgtcaVc5b' },
  { key: 'GOOGLE_DRIVE_FOLDER_ID', id: '1wOfrms0w-_LRvc0eUbwzGayco3NFakdU' },
  { key: 'USER_AVATAR_FOLDER_ID',  id: '1rYD6ys45AziVhhjZEczxejzW5i2YOljz' }
];

// ═══════════════════════════════════════════════════════════════════════════
//  1) ตรวจอย่างเดียว — ไม่สร้าง ไม่แก้ ไม่เขียนอะไรทั้งสิ้น
// ═══════════════════════════════════════════════════════════════════════════

function SB_CHECK_LEGACY() {
  var lines = [];
  lines.push('══ ตรวจของเดิมว่ายังเข้าถึงได้ไหม (ไม่มีการแก้ไขใดๆ) ══');
  lines.push('บัญชีที่กำลังรัน: ' + sbCurrentUser_());
  lines.push('');

  lines.push('── โฟลเดอร์ที่ Apps Script เดิมเคยใช้ ──');
  for (var i = 0; i < SB_FOLDER_PLAN.length; i += 1) {
    var item = SB_FOLDER_PLAN[i];
    if (!item.legacy) {
      lines.push('  -    ' + sbPad_(item.key, 30) + ' ไม่เคยบันทึก ID เดิมไว้ → จะสร้างใหม่');
      continue;
    }
    var probe = sbProbeFolder_(item.legacy);
    lines.push('  ' + (probe.ok ? 'OK  ' : 'พัง ') + sbPad_(item.key, 30) + probe.message);
  }

  lines.push('');
  lines.push('── ID ที่บันทึกไว้ใน Supabase.app_settings ──');
  for (var j = 0; j < SB_LEGACY_APP_SETTINGS.length; j += 1) {
    var row = SB_LEGACY_APP_SETTINGS[j];
    var p2 = sbProbeFolder_(row.id);
    lines.push('  ' + (p2.ok ? 'OK  ' : 'พัง ') + sbPad_(row.key, 30) + p2.message);
  }

  lines.push('');
  lines.push('── Google Sheet audit เดิม ──');
  var sheetProbe = sbProbeFile_(SB_LEGACY_AUDIT_SHEET_ID);
  lines.push('  ' + (sheetProbe.ok ? 'OK  ' : 'พัง ') + sbPad_('AUDIT_SHEET_ID', 30) + sheetProbe.message);

  lines.push('');
  lines.push('── Script Properties ที่มีอยู่ตอนนี้ ──');
  var props = PropertiesService.getScriptProperties().getProperties();
  var keys = Object.keys(props).sort();
  if (!keys.length) {
    lines.push('  (ว่างเปล่า — ยังไม่ได้ตั้งอะไรเลย)');
  } else {
    for (var k = 0; k < keys.length; k += 1) {
      lines.push('  ' + sbPad_(keys[k], 32) + sbMaskValue_(keys[k], props[keys[k]]));
    }
  }

  lines.push('');
  lines.push('อ่านผลยังไง:');
  lines.push('  OK  ทุกบรรทัด  → ของเดิมยังอยู่ครบ รัน SB_SETUP_ALL() แล้วจะใช้ของเดิมต่อ รูปเก่าไม่หาย');
  lines.push('  พัง ทุกบรรทัด  → บัญชีนี้เข้าไม่ถึงของเดิม SB_SETUP_ALL() จะสร้างชุดใหม่ให้ รูปเก่าต้องอัปใหม่');
  lines.push('  ปนกัน          → อันที่ OK จะถูกใช้ต่อ อันที่พังจะสร้างใหม่ทีละอัน');

  var text = lines.join('\n');
  Logger.log(text);
  return text;
}

// ═══════════════════════════════════════════════════════════════════════════
//  2) ติดตั้งจริง
// ═══════════════════════════════════════════════════════════════════════════

function SB_SETUP_ALL() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var store = PropertiesService.getScriptProperties();
    var lines = [];
    var resolved = {};
    var created = 0;
    var reused = 0;

    lines.push('══ ติดตั้ง SB Connect Script Properties ══');
    lines.push('บัญชีที่กำลังรัน: ' + sbCurrentUser_());
    lines.push('');

    // ── โฟลเดอร์แม่ ─────────────────────────────────────────────────────────
    var root = sbResolveRoot_(store);
    resolved.SB_ROOT_FOLDER_ID = root.folder.getId();
    store.setProperty('SB_ROOT_FOLDER_ID', resolved.SB_ROOT_FOLDER_ID);
    lines.push((root.created ? 'สร้างใหม่ ' : 'ใช้ของเดิม ') + 'โฟลเดอร์แม่: ' +
               root.folder.getName() + '  [' + resolved.SB_ROOT_FOLDER_ID + ']');
    lines.push('');

    // ── โฟลเดอร์ย่อยตามผัง ──────────────────────────────────────────────────
    lines.push('── โฟลเดอร์ของแอป ──');
    for (var i = 0; i < SB_FOLDER_PLAN.length; i += 1) {
      var item = SB_FOLDER_PLAN[i];
      var parentFolder = item.parent ? DriveApp.getFolderById(resolved[item.parent]) : root.folder;
      var outcome = sbEnsureFolder_(store, item, parentFolder);
      resolved[item.key] = outcome.id;
      store.setProperty(item.key, outcome.id);
      if (outcome.created) { created += 1; } else { reused += 1; }
      lines.push('  ' + sbPad_(outcome.created ? 'สร้างใหม่' : 'ใช้ของเดิม', 11) +
                 sbPad_(item.key, 30) + outcome.id + '   (' + outcome.source + ')');
    }

    // ── ชีต audit ───────────────────────────────────────────────────────────
    lines.push('');
    lines.push('── Google Sheet สำหรับ audit ──');
    var sheet = sbEnsureAuditSheet_(store, root.folder);
    resolved.AUDIT_SHEET_ID = sheet.id;
    store.setProperty('AUDIT_SHEET_ID', sheet.id);
    lines.push('  ' + sbPad_(sheet.created ? 'สร้างใหม่' : 'ใช้ของเดิม', 11) +
               sbPad_('AUDIT_SHEET_ID', 30) + sheet.id + '   (' + sheet.source + ')');

    // ── ค่าความลับที่ต้องใส่เอง ─────────────────────────────────────────────
    lines.push('');
    lines.push('── ค่าที่ตัวติดตั้งตั้งให้ไม่ได้ (ต้องใส่เองใน Script Properties) ──');
    var missingSecret = [];
    ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].forEach(function (name) {
      var value = store.getProperty(name);
      if (value) {
        lines.push('  OK  ' + sbPad_(name, 30) + sbMaskValue_(name, value));
      } else {
        lines.push('  ขาด ' + sbPad_(name, 30) + '<<< ยังไม่ได้ใส่ >>>');
        missingSecret.push(name);
      }
    });

    lines.push('');
    lines.push('สรุป: ใช้ของเดิม ' + reused + ' รายการ · สร้างใหม่ ' + created + ' รายการ');
    if (missingSecret.length) {
      lines.push('ยังขาด: ' + missingSecret.join(', ') + '  → ใส่ให้ครบก่อน แล้วค่อย Deploy');
    } else {
      lines.push('ครบแล้ว → ขั้นถัดไปคือ Deploy > New deployment > Web app');
    }
    lines.push('');
    lines.push('รัน SB_SHOW_CONFIG() เพื่อดูสรุป + คำสั่ง SQL สำหรับ Supabase');

    var text = lines.join('\n');
    Logger.log(text);
    return text;
  } finally {
    lock.releaseLock();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  3) ดูค่าปัจจุบัน + SQL ที่ต้องเอาไปรันใน Supabase
// ═══════════════════════════════════════════════════════════════════════════

function SB_SHOW_CONFIG() {
  var store = PropertiesService.getScriptProperties();
  var props = store.getProperties();
  var lines = [];

  lines.push('══ ค่าปัจจุบันของ SB Connect ══');
  lines.push('บัญชีที่กำลังรัน: ' + sbCurrentUser_());
  lines.push('');

  lines.push('── Script Properties ──');
  var keys = Object.keys(props).sort();
  for (var i = 0; i < keys.length; i += 1) {
    lines.push('  ' + sbPad_(keys[i], 32) + sbMaskValue_(keys[i], props[keys[i]]));
  }

  lines.push('');
  lines.push('── ตรวจว่าทุก ID ยังเปิดได้จริง ──');
  var broken = 0;
  for (var j = 0; j < SB_FOLDER_PLAN.length; j += 1) {
    var key = SB_FOLDER_PLAN[j].key;
    var probe = sbProbeFolder_(props[key] || '');
    if (!probe.ok) { broken += 1; }
    lines.push('  ' + (probe.ok ? 'OK  ' : 'พัง ') + sbPad_(key, 30) + probe.message);
  }
  var sheetProbe = sbProbeFile_(props.AUDIT_SHEET_ID || '');
  if (!sheetProbe.ok) { broken += 1; }
  lines.push('  ' + (sheetProbe.ok ? 'OK  ' : 'พัง ') + sbPad_('AUDIT_SHEET_ID', 30) + sheetProbe.message);
  lines.push(broken ? ('  >>> ยังพังอยู่ ' + broken + ' รายการ ให้รัน SB_SETUP_ALL() ซ้ำ') : '  ครบทุกรายการ');

  lines.push('');
  lines.push('── SQL: ก๊อปไปวางใน Supabase > SQL Editor แล้วกด Run ──');
  lines.push(sbBuildAppSettingsSql_(props));

  lines.push('');
  lines.push('── อย่าลืมหลัง Deploy ──');
  lines.push('  1) ก๊อป URL ที่ลงท้ายด้วย /exec');
  lines.push('  2) วางใน D:\\Projectsbconnect_app\\.env  →  VITE_DRIVE_UPLOAD_ENDPOINT=...');
  lines.push('  3) วางใน GitHub > repo > Settings > Secrets and variables > Actions > Variables');
  lines.push('     ชื่อตัวแปร VITE_DRIVE_UPLOAD_ENDPOINT');
  lines.push('  4) รัน push.bat เพื่อ build ใหม่ (ค่านี้ถูกฝังตอน build ไม่ใช่ตอนเปิดเว็บ)');

  var text = lines.join('\n');
  Logger.log(text);
  return text;
}

// ═══════════════════════════════════════════════════════════════════════════
//  4) เพิ่มเกมใหม่ทีหลัง — โฟลเดอร์รูปของเกมนั้นแยกของใครของมัน
//     ใช้: เปลี่ยนค่า 2 บรรทัดล่างแล้วกด Run ที่ฟังก์ชันนี้
// ═══════════════════════════════════════════════════════════════════════════

function SB_ADD_GAME() {
  var slug = 'quiz';          // ← ชื่อสั้นๆ ภาษาอังกฤษ ตัวเล็ก ใช้เป็นชื่อโฟลเดอร์และ bucket
  var propertyName = 'FOLDER_GAME_' + slug.toUpperCase().replace(/[^A-Z0-9]/g, '_') + '_ID';

  var store = PropertiesService.getScriptProperties();
  var gamesId = store.getProperty('FOLDER_GAMES_ID');
  if (!gamesId) {
    throw new Error('ยังไม่มี FOLDER_GAMES_ID — รัน SB_SETUP_ALL() ก่อน');
  }

  var parent = DriveApp.getFolderById(gamesId);
  var outcome = sbEnsureFolder_(store, { key: propertyName, name: slug, legacy: '' }, parent);
  store.setProperty(propertyName, outcome.id);

  var text = [
    'เพิ่มโฟลเดอร์เกมแล้ว',
    '  Script Property : ' + propertyName,
    '  โฟลเดอร์        : 07_games/' + slug,
    '  ID              : ' + outcome.id,
    '',
    'ต่อไปในแอปให้ส่ง bucket = "game_' + slug + '" ตอนอัปโหลดรูปของเกมนี้'
  ].join('\n');
  Logger.log(text);
  return text;
}

// ═══════════════════════════════════════════════════════════════════════════
//  เครื่องมือภายใน
// ═══════════════════════════════════════════════════════════════════════════

function sbCurrentUser_() {
  try {
    return Session.getEffectiveUser().getEmail() || '(ไม่ทราบ)';
  } catch (err) {
    return '(ไม่ทราบ)';
  }
}

/** หาโฟลเดอร์แม่: SB_ROOT_FOLDER_ID > โฟลเดอร์ชื่อ SB_CONNECT_APP ที่มีอยู่ > สร้างใหม่ */
function sbResolveRoot_(store) {
  var configured = sbDriveIdOnly_(store.getProperty('SB_ROOT_FOLDER_ID') || '');
  if (configured) {
    try {
      var existing = DriveApp.getFolderById(configured);
      existing.getName();
      return { folder: existing, created: false };
    } catch (err) { /* ตกไปหาทางอื่น */ }
  }

  var found = DriveApp.getFoldersByName(SB_ROOT_FOLDER_NAME);
  while (found.hasNext()) {
    var candidate = found.next();
    if (!sbIsTrashed_(candidate)) {
      return { folder: candidate, created: false };
    }
  }

  return { folder: DriveApp.createFolder(SB_ROOT_FOLDER_NAME), created: true };
}

/**
 * หาโฟลเดอร์ตามลำดับความสำคัญ
 *   1) ค่าที่อยู่ใน Script Property อยู่แล้ว (ถ้ายังเปิดได้)
 *   2) ID เดิมที่บันทึกไว้ในโค้ด (ถ้ายังเปิดได้) ← ทำให้รูปเก่าไม่หาย
 *   3) โฟลเดอร์ชื่อเดียวกันที่อยู่ใต้ parent อยู่แล้ว
 *   4) สร้างใหม่
 */
function sbEnsureFolder_(store, item, parent) {
  var current = sbDriveIdOnly_(store.getProperty(item.key) || '');
  if (current) {
    var probeCurrent = sbProbeFolder_(current);
    if (probeCurrent.ok) {
      return { id: current, created: false, source: 'Script Property เดิม' };
    }
  }

  if (item.legacy) {
    var probeLegacy = sbProbeFolder_(item.legacy);
    if (probeLegacy.ok) {
      return { id: item.legacy, created: false, source: 'โฟลเดอร์เดิมของระบบเก่า' };
    }
  }

  var children = parent.getFoldersByName(item.name);
  while (children.hasNext()) {
    var child = children.next();
    if (!sbIsTrashed_(child)) {
      return { id: child.getId(), created: false, source: 'เจอโฟลเดอร์ชื่อเดียวกันอยู่แล้ว' };
    }
  }

  var made = parent.createFolder(item.name);
  return { id: made.getId(), created: true, source: 'สร้างใหม่' };
}

function sbEnsureAuditSheet_(store, root) {
  var current = sbDriveIdOnly_(store.getProperty('AUDIT_SHEET_ID') || '');
  if (current && sbProbeFile_(current).ok) {
    return { id: current, created: false, source: 'Script Property เดิม' };
  }
  if (sbProbeFile_(SB_LEGACY_AUDIT_SHEET_ID).ok) {
    return { id: SB_LEGACY_AUDIT_SHEET_ID, created: false, source: 'ชีตเดิมของระบบเก่า' };
  }

  var existing = root.getFilesByName(SB_AUDIT_SHEET_NAME);
  while (existing.hasNext()) {
    var file = existing.next();
    if (!sbIsTrashed_(file)) {
      return { id: file.getId(), created: false, source: 'เจอชีตชื่อเดียวกันอยู่แล้ว' };
    }
  }

  var ss = SpreadsheetApp.create(SB_AUDIT_SHEET_NAME);
  var created = DriveApp.getFileById(ss.getId());
  root.addFile(created);
  try { DriveApp.getRootFolder().removeFile(created); } catch (err) { /* ไม่เป็นไร */ }
  return { id: ss.getId(), created: true, source: 'สร้างใหม่' };
}

function sbProbeFolder_(id) {
  var clean = sbDriveIdOnly_(id);
  if (!clean) return { ok: false, message: 'ไม่มีค่า' };
  try {
    var folder = DriveApp.getFolderById(clean);
    var name = folder.getName();
    if (sbIsTrashed_(folder)) return { ok: false, message: clean + ' อยู่ในถังขยะ' };
    return { ok: true, message: clean + '  "' + name + '"' };
  } catch (err) {
    return { ok: false, message: clean + ' เปิดไม่ได้ (ไม่มีสิทธิ์ หรือถูกลบถาวร)' };
  }
}

function sbProbeFile_(id) {
  var clean = sbDriveIdOnly_(id);
  if (!clean) return { ok: false, message: 'ไม่มีค่า' };
  try {
    var file = DriveApp.getFileById(clean);
    var name = file.getName();
    if (sbIsTrashed_(file)) return { ok: false, message: clean + ' อยู่ในถังขยะ' };
    return { ok: true, message: clean + '  "' + name + '"' };
  } catch (err) {
    return { ok: false, message: clean + ' เปิดไม่ได้ (ไม่มีสิทธิ์ หรือถูกลบถาวร)' };
  }
}

function sbIsTrashed_(item) {
  try { return item.isTrashed(); } catch (err) { return false; }
}

/** ตัดลิงก์ Drive ให้เหลือแต่ ID — ก๊อปลิงก์มาวางทั้งอันก็ใช้ได้ */
function sbDriveIdOnly_(value) {
  var text = String(value == null ? '' : value).trim();
  if (!text) return '';
  var patterns = [/\/folders\/([A-Za-z0-9_-]{10,})/, /\/d\/([A-Za-z0-9_-]{10,})/, /[?&]id=([A-Za-z0-9_-]{10,})/];
  for (var i = 0; i < patterns.length; i += 1) {
    var match = text.match(patterns[i]);
    if (match) return match[1];
  }
  text = text.split('?')[0].split('#')[0];
  var parts = text.split('/').filter(function (part) { return part !== ''; });
  var last = parts.length ? parts[parts.length - 1] : '';
  return last.replace(/[^A-Za-z0-9_-]/g, '');
}

function sbPad_(text, width) {
  var out = String(text == null ? '' : text);
  while (out.length < width) { out += ' '; }
  return out;
}

/** ไม่พิมพ์ค่าความลับลง Log */
function sbMaskValue_(key, value) {
  var name = String(key || '').toUpperCase();
  var text = String(value == null ? '' : value);
  if (name.indexOf('KEY') >= 0 || name.indexOf('SECRET') >= 0 || name.indexOf('TOKEN') >= 0 || name.indexOf('PASSWORD') >= 0) {
    return text ? ('(ซ่อนไว้ ยาว ' + text.length + ' ตัว)') : '(ว่าง)';
  }
  return text || '(ว่าง)';
}

function sbSqlText_(value) {
  return "'" + String(value == null ? '' : value).replace(/'/g, "''") + "'";
}

function sbBuildAppSettingsSql_(props) {
  var rows = [
    { key: 'UPLOAD_FOLDER_ID',       value: props.FOLDER_ATTACHMENTS_ID || '',      note: 'Drive: ไฟล์แนบทั่วไป' },
    { key: 'REWARD_FOLDER_ID',       value: props.FOLDER_REWARD_ID || '',           note: 'Drive: รูปของรางวัล' },
    { key: 'USER_AVATAR_FOLDER_ID',  value: props.FOLDER_PROFILE_ID || '',          note: 'Drive: รูปโปรไฟล์' },
    { key: 'GOOGLE_DRIVE_FOLDER_ID', value: props.SB_ROOT_FOLDER_ID || '',          note: 'Drive: โฟลเดอร์แม่ของแอป' },
    { key: 'NEWS_FOLDER_ID',         value: props.FOLDER_NEWS_ID || '',             note: 'Drive: รูปข่าว' },
    { key: 'MISSION_FOLDER_ID',      value: props.FOLDER_MISSIONS_ID || '',         note: 'Drive: รูปภารกิจ' },
    { key: 'GAME_FOLDER_ID',         value: props.FOLDER_GAMES_ID || '',            note: 'Drive: รูปของระบบเกม (โฟลเดอร์แม่)' },
    { key: 'GAME_WHEEL_FOLDER_ID',   value: props.FOLDER_GAME_WHEEL_ID || '',       note: 'Drive: รูปกงล้อรางวัล' },
    { key: 'AUDIT_SHEET_ID',         value: props.AUDIT_SHEET_ID || '',             note: 'Google Sheet: audit log' }
  ];

  var values = [];
  for (var i = 0; i < rows.length; i += 1) {
    if (!rows[i].value) continue;
    values.push('  (' + sbSqlText_(rows[i].key) + ', ' + sbSqlText_(rows[i].value) + ', ' + sbSqlText_(rows[i].note) + ', false)');
  }

  return [
    'insert into public.app_settings(key, value, description, is_public) values',
    values.join(',\n'),
    'on conflict (key) do update set',
    '  value = excluded.value,',
    '  description = excluded.description,',
    '  updated_at = now();'
  ].join('\n');
}

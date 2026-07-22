// SBConnect_Drive_Upload_API.gs
// Deploy: Web app / Execute as Me / Anyone with link
// Handles Drive uploads, audit logs, and the SB Connect Quotation service.
//
// Required Script Properties (legacy upload/audit):
//   UPLOAD_TOKEN, AUDIT_SHEET_ID, FOLDER_PROFILE_ID, FOLDER_NEWS_ID,
//   FOLDER_MISSIONS_ID, FOLDER_REWARD_ID
// Optional legacy properties:
//   FOLDER_MISSION_EVIDENCE_ID, FOLDER_ATTACHMENTS_ID
//
// Required Script Properties (Quotation):
//   FOLDER_QUOTATION_ID
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY   (server-side only; never put this value in the web app)
// Auto-created by setupQuotationSystem() or the first quotation request:
//   QUOTATION_INDEX_SHEET_ID
// Optional Quotation properties:
//   QUOTATION_SQL_SYNC_ENABLED=FALSE               (enabled by default)
//   QUOTATION_SHARE_MODE=ANYONE_WITH_LINK          (customer PDF only)
//   QUOTATION_INTERNAL_SHARE_MODE=ANYONE_WITH_LINK (internal XLSX; private by default)
//   QUOTATION_UPLOAD_SHARE_MODE=ANYONE_WITH_LINK   (bound uploads; private by default)
//   QUOTATION_COMPANY_NAME, QUOTATION_COMPANY_ADDRESS,
//   QUOTATION_COMPANY_PHONE, QUOTATION_COMPANY_TAX_ID,
//   QUOTATION_LOGO_FILE_ID

var DEFAULT_AUDIT_SHEET_ID = "1co7BNHIaMBu6In-CJe3U9wckjNgDJkSLFVKvuAIuuQs";
var DEFAULT_QUOTATION_FOLDER_ID = "1AtmDwLBJmK9OTgkskEdHBxqMildr6msf";
var QUOTATION_INDEX_PROPERTY = "QUOTATION_INDEX_SHEET_ID";
var QUOTATION_INDEX_TAB = "QUOTATIONS";
var QUOTATION_SQL_SYNC_RPC = "sync_quotation_from_drive";
var QUOTATION_SQL_RECONCILE_RPC = "reconcile_quotation_from_drive";
var QUOTATION_SESSION_VALIDATION_RPC = "validate_quotation_session_for_service";
var QUOTATION_MAX_JSON_BYTES = 40000;
var QUOTATION_MAX_ITEMS = 200;
var QUOTATION_MAX_COST_NOTES = 100;
var QUOTATION_MAX_ATTACHMENTS = 50;
var QUOTATION_UPLOAD_MAX_BYTES = 8 * 1024 * 1024;
var QUOTATION_ACTIONS = [
  "quotation_create",
  "quotation_save",
  "quotation_list",
  "quotation_get",
  "quotation_report",
  "quotation_delete_file"
];
var QUOTATION_INDEX_HEADERS = [
  "quotation_id",
  "quotation_no",
  "client_request_id",
  "status",
  "revision",
  "created_at",
  "updated_at",
  "created_by_emp_id",
  "updated_by_emp_id",
  "customer_name",
  "customer_company",
  "project_name",
  "currency",
  "subtotal",
  "vat_percent",
  "vat_amount",
  "grand_total",
  "proposed_cost",
  "total_cost",
  "gross_profit",
  "gp_percent",
  "payload_json",
  "pdf_file_id",
  "pdf_view_url",
  "pdf_download_url",
  "xlsx_file_id",
  "xlsx_view_url",
  "xlsx_download_url",
  "report_version",
  "last_report_at",
  "source_version",
  "sql_sync_status",
  "sql_sync_version",
  "sql_sync_error",
  "sql_synced_at",
  "sql_sync_attempts"
];

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
  var profileId = prop("FOLDER_PROFILE_ID");
  var newsId = prop("FOLDER_NEWS_ID");
  var missionsId = prop("FOLDER_MISSIONS_ID");
  var rewardId = prop("FOLDER_REWARD_ID");
  var quotationId = prop("FOLDER_QUOTATION_ID", DEFAULT_QUOTATION_FOLDER_ID);
  return {
    avatars: profileId,
    profile: profileId,
    news: newsId,
    missions: missionsId,
    rewards: rewardId,
    reward: rewardId,
    quotations: quotationId,
    quotation: quotationId,
    quotation_pdf: quotationId,
    quotation_images: quotationId,
    quotation_attachments: quotationId,
    mission_evidence: prop("FOLDER_MISSION_EVIDENCE_ID", missionsId),
    attachments: prop("FOLDER_ATTACHMENTS_ID", missionsId || newsId || rewardId || profileId)
  };
}

function doPost(e) {
  var body = {};
  var requestType = "";
  var quotationUpload = false;
  try {
    var rawBody = e && e.postData && e.postData.contents ? e.postData.contents : "{}";
    body = JSON.parse(rawBody || "{}");
    requestType = String(body.type || body.action || "").trim().toLowerCase();
    var legacyType = String(body.type || "").trim().toLowerCase();
    var resolvedBucket = body.bucket || legacyTypeToBucket(legacyType);
    var quotationAction = isQuotationAction_(requestType);
    quotationUpload = isQuotationBucket_(resolvedBucket);
    var sessionUpload = !quotationAction && !quotationUpload && isAppUploadRequest_(requestType, resolvedBucket);

    // Quotation requests use the user's live Supabase session. A service-role key
    // remains only in Script Properties and is never returned to the browser.
    if (quotationAction || quotationUpload) {
      body._validatedSession = validateQuotationSession_(body.sessionToken || body.session_token || "");
    } else if (sessionUpload && (body.sessionToken || body.session_token)) {
      body._validatedSession = validateQuotationSession_(body.sessionToken || body.session_token || "");
      validateAppUploadAuthorization_(body._validatedSession, resolvedBucket, body.meta || {});
    } else if (body.token !== uploadToken()) {
      return jsonOutput({ status: "error", ok: false, message: "Unauthorized" });
    }

    if (quotationAction) {
      return handleQuotationAction_(requestType, body);
    }
    if (requestType === "log") return appendAuditLog(body.log || body);
    if (requestType === "log_batch") return appendAuditLogBatch(body.logs || []);

    return handleDriveUpload_(body, legacyType, resolvedBucket, quotationUpload);
  } catch (err) {
    if (isQuotationAction_(requestType)) {
      writeQuotationAuditSafe_(requestType, "error", body, null, err.message || String(err));
    } else if (quotationUpload) {
      writeQuotationUploadAuditSafe_("error", body, null, err.message || String(err));
    }
    return jsonOutput({
      status: "error",
      ok: false,
      action: requestType,
      message: safeErrorMessage_(err)
    });
  }
}

function handleDriveUpload_(body, legacyType, resolvedBucket, quotationUpload) {
  var folders = driveFolders();
  if (!resolvedBucket || !folders[resolvedBucket]) {
    if (quotationUpload) throw new Error("Invalid quotation bucket or missing FOLDER_QUOTATION_ID");
    return jsonOutput({ status: "error", ok: false, message: "Invalid bucket or missing folder Script Property" });
  }

  if (body.image_base64 && !body.base64) body.base64 = body.image_base64;
  if (body.mime_type && !body.mimeType) body.mimeType = body.mime_type;
  if (!body.fileName) body.fileName = buildLegacyFileName(legacyType, body);
  if (!body.fileName || !body.mimeType || !body.base64) {
    if (quotationUpload) throw new Error("Missing quotation file data");
    return jsonOutput({ status: "error", ok: false, message: "Missing file data" });
  }

  var uploadBinding = null;
  var uploadSync = null;
  if (quotationUpload) {
    uploadBinding = validateQuotationUploadBinding_(body);
  }

  var mimeType = String(body.mimeType || "").toLowerCase().split(";")[0].trim();
  if (quotationUpload && !isAllowedQuotationMime_(mimeType)) {
    throw new Error("Unsupported quotation file type");
  }
  if (!quotationUpload && body._validatedSession && !isAllowedAppUploadMime_(resolvedBucket, mimeType)) {
    throw new Error("Unsupported app upload file type");
  }

  var sourceBase64 = String(body.base64 || "");
  var commaIndex = sourceBase64.indexOf(",");
  var cleanBase64 = commaIndex >= 0 ? sourceBase64.slice(commaIndex + 1) : sourceBase64;
  if ((quotationUpload || body._validatedSession) && cleanBase64.length > Math.ceil(QUOTATION_UPLOAD_MAX_BYTES * 4 / 3) + 8) {
    throw new Error("File exceeds 8 MB");
  }

  var bytes = Utilities.base64Decode(cleanBase64);
  if ((quotationUpload || body._validatedSession) && bytes.length > QUOTATION_UPLOAD_MAX_BYTES) {
    throw new Error("File exceeds 8 MB");
  }

  var safeName = Date.now() + "_" + sanitizeFileName(body.fileName);
  var blob = Utilities.newBlob(bytes, mimeType, safeName);
  var folder = DriveApp.getFolderById(folders[resolvedBucket]);
  var file = folder.createFile(blob);
  if (quotationUpload) {
    applyQuotationUploadSharing_(file);
  } else {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  }

  var fileId = file.getId();
  if (quotationUpload) {
    try {
      uploadBinding = registerQuotationUpload_(body, uploadBinding, file, resolvedBucket, mimeType);
    } catch (registerErr) {
      trashFileSafely_(fileId, "");
      throw registerErr;
    }
    uploadSync = syncQuotationRecordToSupabaseSafe_(uploadBinding.quotation_id, quotationSessionToken_(body));
    writeQuotationUploadAuditSafe_("success", body, {
      quotation_id: uploadBinding.quotation_id,
      quotation_no: uploadBinding.quotation_no,
      file_id: fileId,
      bucket: resolvedBucket
    }, "Uploaded bound quotation file");
  }
  var uploadResponse = {
    status: "success",
    ok: true,
    fileId: fileId,
    file_id: fileId,
    fileName: safeName,
    mimeType: mimeType,
    bucket: resolvedBucket,
    directUrl: "https://lh3.googleusercontent.com/d/" + fileId,
    viewUrl: driveViewUrl_(fileId),
    downloadUrl: driveDownloadUrl_(fileId),
    quotationId: uploadBinding ? String(uploadBinding.quotation_id || "") : "",
    quotationNo: uploadBinding ? String(uploadBinding.quotation_no || "") : "",
    meta: body.meta || {}
  };
  attachQuotationSyncWarning_(uploadResponse, uploadSync);
  return jsonOutput(uploadResponse);
}

function registerQuotationUpload_(body, initialRecord, file, bucket, mimeType) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var record = findQuotationRecord_(initialRecord.quotation_id || initialRecord.quotation_no);
    if (!record) throw new Error("QUOTATION_NOT_FOUND");
    assertQuotationAccess_(body._validatedSession, record, "upload_register");
    var quotation = parseQuotationPayload_(record.payload_json);
    var registry = Array.isArray(quotation.uploadedFiles) ? quotation.uploadedFiles :
      (Array.isArray(quotation.uploaded_files) ? quotation.uploaded_files : []);
    if (registry.length >= 250) throw new Error("Quotation upload registry limit reached (250 files)");
    var fileId = file.getId();
    var alreadyRegistered = registry.some(function(entry) { return quotationFileId_(entry) === fileId; });
    if (!alreadyRegistered) {
      registry.push({
        fileId: fileId,
        file_id: fileId,
        fileName: file.getName(),
        file_name: file.getName(),
        mimeType: mimeType,
        mime_type: mimeType,
        bucket: String(bucket || ""),
        viewUrl: driveViewUrl_(fileId),
        view_url: driveViewUrl_(fileId),
        uploadedByEmpId: String(body._validatedSession.emp_id || ""),
        uploaded_by_emp_id: String(body._validatedSession.emp_id || ""),
        uploadedAt: nowIso_(),
        uploaded_at: nowIso_(),
        registrySource: "BOUND_UPLOAD_V1",
        registry_source: "BOUND_UPLOAD_V1"
      });
    }
    quotation.uploadedFiles = registry;
    if (quotation.uploaded_files) delete quotation.uploaded_files;
    quotation.updatedAt = nowIso_();
    quotation.updated_at = quotation.updatedAt;
    quotation.updatedByEmpId = String(body._validatedSession.emp_id || "");
    quotation.updated_by_emp_id = quotation.updatedByEmpId;
    quotation.sourceVersion = quotationSourceVersion_(record) + 1;
    quotation.source_version = quotation.sourceVersion;
    var payloadJson = JSON.stringify(quotation);
    assertJsonSize_(payloadJson);
    updateQuotationIndexFields_(record._rowNumber, {
      payload_json: payloadJson,
      updated_at: quotation.updatedAt,
      updated_by_emp_id: quotation.updatedByEmpId,
      source_version: quotation.sourceVersion,
      sql_sync_status: "PENDING",
      sql_sync_error: ""
    });
    return findQuotationRecord_(record.quotation_id) || record;
  } finally {
    lock.releaseLock();
  }
}

function validateQuotationUploadBinding_(body) {
  var meta = body.meta && typeof body.meta === "object" ? body.meta : {};
  var quotationId = String(meta.quotationId || meta.quotation_id || meta.id || "").trim();
  var quotationNo = String(meta.quotationNo || meta.quotation_no || "").trim();
  if (!quotationId && !quotationNo) throw new Error("Quotation upload must include meta.quotation_id or meta.quotation_no");
  var record = findQuotationRecord_(quotationId || quotationNo);
  if (!record) throw new Error("QUOTATION_NOT_FOUND");
  if (quotationId && String(record.quotation_id) !== quotationId) throw new Error("QUOTATION_UPLOAD_BINDING_MISMATCH");
  if (quotationNo && String(record.quotation_no) !== quotationNo) throw new Error("QUOTATION_UPLOAD_BINDING_MISMATCH");
  assertQuotationAccess_(body._validatedSession, record, "upload");
  return record;
}

function isAllowedQuotationMime_(mimeType) {
  var allowed = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ];
  return allowed.indexOf(String(mimeType || "").toLowerCase()) >= 0;
}

function isQuotationAction_(type) {
  return QUOTATION_ACTIONS.indexOf(String(type || "").toLowerCase()) >= 0;
}

function isQuotationBucket_(bucket) {
  var key = String(bucket || "").toLowerCase();
  return ["quotation", "quotations", "quotation_pdf", "quotation_images", "quotation_attachments"].indexOf(key) >= 0;
}

function isAppUploadRequest_(requestType, bucket) {
  var type = String(requestType || "").toLowerCase();
  var key = String(bucket || "").toLowerCase();
  return type === "upload" && ["avatars", "profile", "news", "missions", "rewards", "reward", "mission_evidence", "attachments"].indexOf(key) >= 0;
}

function validateAppUploadAuthorization_(session, bucket, meta) {
  var role = String(session && session.role || "user").toLowerCase();
  var empId = String(session && session.emp_id || "");
  var key = String(bucket || "").toLowerCase();
  var requestedEmpId = String(meta && (meta.emp_id || meta.empId) || "");
  var isAdmin = ["admin", "admin_it", "dev"].indexOf(role) >= 0;

  if (!empId) throw new Error("SESSION_INVALID");
  if (["news", "missions", "rewards", "reward"].indexOf(key) >= 0 && !isAdmin) {
    throw new Error("ADMIN_ONLY");
  }
  if (["avatars", "profile"].indexOf(key) >= 0 && requestedEmpId && requestedEmpId !== empId && !isAdmin) {
    throw new Error("UPLOAD_OWNER_MISMATCH");
  }
  return true;
}

function isAllowedAppUploadMime_(bucket, mimeType) {
  var key = String(bucket || "").toLowerCase();
  var mime = String(mimeType || "").toLowerCase();
  var images = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (["attachments", "mission_evidence"].indexOf(key) >= 0) {
    return images.concat(["application/pdf"]).indexOf(mime) >= 0;
  }
  return images.indexOf(mime) >= 0;
}

function handleQuotationAction_(action, body) {
  validateQuotationRequestSize_(body.quotation || {});
  if (action === "quotation_create") return quotationCreate_(body);
  if (action === "quotation_save") return quotationSave_(body, false);
  if (action === "quotation_report") return quotationSave_(body, true);
  if (action === "quotation_list") return quotationList_(body);
  if (action === "quotation_get") return quotationGet_(body);
  if (action === "quotation_delete_file") return quotationDeleteFile_(body);
  throw new Error("Unsupported quotation action");
}

function quotationSupabaseConfig_() {
  var baseUrl = String(prop("SUPABASE_URL") || "").replace(/\/$/, "");
  var serviceKey = prop("SUPABASE_SERVICE_ROLE_KEY");
  if (!baseUrl || !serviceKey) {
    throw new Error("Quotation backend is not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Script Properties");
  }
  return { baseUrl: baseUrl, serviceKey: serviceKey };
}

function quotationSupabaseRequest_(relativePath, method, payload, extraHeaders) {
  var config = quotationSupabaseConfig_();
  var headers = {
    apikey: config.serviceKey,
    Authorization: "Bearer " + config.serviceKey,
    Accept: "application/json"
  };
  Object.keys(extraHeaders || {}).forEach(function(key) { headers[key] = extraHeaders[key]; });
  var options = {
    method: String(method || "get").toLowerCase(),
    headers: headers,
    muteHttpExceptions: true
  };
  if (payload !== undefined && payload !== null) {
    options.contentType = "application/json";
    options.payload = JSON.stringify(payload);
  }
  return UrlFetchApp.fetch(config.baseUrl + "/rest/v1/" + String(relativePath || "").replace(/^\/+/, ""), options);
}

function validateQuotationSession_(sessionToken) {
  var token = String(sessionToken || "").trim();
  if (!token) throw new Error("SESSION_REQUIRED");
  if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(token)) {
    throw new Error("SESSION_INVALID");
  }

  var response;
  try {
    // This service-role-only RPC joins public_sessions to the current app_users
    // row. It rejects revoked/expired sessions and disabled users, and returns
    // the current role rather than trusting the role snapshot in the session.
    response = quotationSupabaseRequest_(
      "rpc/" + QUOTATION_SESSION_VALIDATION_RPC,
      "post",
      { p_token: token }
    );
  } catch (fetchErr) {
    throw new Error("SESSION_VALIDATION_FAILED");
  }
  var code = response.getResponseCode();
  if (code < 200 || code >= 300) throw new Error("SESSION_VALIDATION_FAILED");

  var result;
  try {
    result = JSON.parse(response.getContentText() || "{}");
  } catch (parseErr) {
    throw new Error("SESSION_VALIDATION_FAILED");
  }
  if (Array.isArray(result)) result = result.length ? result[0] : {};
  if (result && result.result && typeof result.result === "object") result = result.result;
  var status = String(result && result.status || "success").toLowerCase();
  if (status !== "success" || !result || !result.emp_id) {
    var reason = String(result && (result.message || result.code) || "SESSION_EXPIRED").toUpperCase();
    if (["SESSION_REVOKED", "SESSION_EXPIRED", "SESSION_INVALID", "USER_DISABLED"].indexOf(reason) >= 0) {
      throw new Error(reason);
    }
    throw new Error("SESSION_VALIDATION_FAILED");
  }

  return {
    emp_id: String(result.emp_id),
    role: String(result.role || "user").toLowerCase(),
    expires_at: String(result.expires_at || "")
  };
}

function sessionActor_(body) {
  var session = body._validatedSession || {};
  return {
    emp_id: String(session.emp_id || ""),
    role: String(session.role || "user").toLowerCase(),
    // Identity comes only from the validated session. Request actor is never
    // trusted for authorization or ownership.
    name: String(session.emp_id || "")
  };
}

function isQuotationAdmin_(session) {
  var role = String(session && session.role || "").toLowerCase();
  return ["admin", "admin_it", "dev", "manager"].indexOf(role) >= 0;
}

function quotationSqlSyncEnabled_() {
  return String(prop("QUOTATION_SQL_SYNC_ENABLED", "TRUE")).trim().toUpperCase() !== "FALSE";
}

function quotationSessionToken_(body) {
  return String(body && (body.sessionToken || body.session_token) || "").trim();
}

function quotationSourceVersion_(record) {
  function valid(value) {
    var number = Number(value || 0);
    return isFinite(number) && number >= 0 ? Math.floor(number) : 0;
  }
  return Math.max(
    valid(record && record.source_version),
    valid(record && record.sql_sync_version),
    valid(record && record.report_version),
    1
  );
}

function prepareQuotationRecordForSync_(key) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var record = findQuotationRecord_(key);
    if (!record) throw new Error("QUOTATION_NOT_FOUND");
    var sourceVersion = quotationSourceVersion_(record);
    if (Number(record.source_version || 0) < 1) {
      var quotation = parseQuotationPayload_(record.payload_json);
      quotation.sourceVersion = sourceVersion;
      quotation.source_version = sourceVersion;
      var payloadJson = JSON.stringify(quotation);
      assertJsonSize_(payloadJson);
      updateQuotationIndexFields_(record._rowNumber, {
        payload_json: payloadJson,
        source_version: sourceVersion,
        sql_sync_status: "PENDING",
        sql_sync_error: ""
      });
      record = findQuotationRecord_(record.quotation_id);
    }
    return record;
  } finally {
    lock.releaseLock();
  }
}

function quotationSqlEnvelope_(record) {
  var q = parseQuotationPayload_(record.payload_json);
  var customer = q.customer && typeof q.customer === "object" ? q.customer : {};
  var terms = q.terms && typeof q.terms === "object" ? q.terms : {};
  var items = Array.isArray(q.items) ? q.items : (Array.isArray(q.quotation_items) ? q.quotation_items : []);
  var costNotes = Array.isArray(q.costNotes) ? q.costNotes : (Array.isArray(q.cost_notes) ? q.cost_notes : []);
  var itemCost = 0;
  var itemRows = items.map(function(item, index) {
    item = item && typeof item === "object" ? item : {};
    var costAmount = Number(item.costAmount || item.cost_amount || 0);
    itemCost = moneyRound_(itemCost + costAmount);
    return {
      id: String(item.id || item.itemId || item.item_id || ""),
      source_item_id: String(item.id || item.itemId || item.item_id || ""),
      item_no: Number(item.itemNo || item.item_no || index + 1),
      product_id: String(item.productId || item.product_id || ""),
      product_ref: String(item.productRef || item.product_ref || ""),
      product_name: String(item.productName || item.product_name || ""),
      description: String(item.description || ""),
      unit: String(item.unit || ""),
      quantity: Number(item.quantity || item.qty || 0),
      unit_price: Number(item.unitPrice || item.unit_price || 0),
      unit_cost: Number(item.unitCost || item.unit_cost || item.cost || 0),
      amount: Number(item.amount || item.lineAmount || 0),
      cost_amount: costAmount,
      remark: String(item.remark || ""),
      image_file_id: String(item.imageFileId || item.picture_file_id || ""),
      image_url: String(item.imageUrl || item.picture_url || ""),
      payload_json: cloneJson_(item)
    };
  });
  var costRows = costNotes.map(function(note, index) {
    note = note && typeof note === "object" ? note : {};
    return {
      id: String(note.id || note.costNoteId || note.cost_note_id || ""),
      source_cost_note_id: String(note.id || note.costNoteId || note.cost_note_id || ""),
      note_no: Number(note.noteNo || note.note_no || index + 1),
      description: String(note.description || ""),
      note: String(note.note || ""),
      sb_cost: Number(note.sbCost || note.sb_cost || note.sbcost || 0),
      proposed_cost: Number(note.proposedCost || note.proposed_cost || note.pcost || 0),
      gp_percent: Number(note.gpPercent || note.gp_percent || note.gp || 0),
      payload_json: cloneJson_(note)
    };
  });
  var sourceVersion = quotationSourceVersion_(record);
  var parent = {
    quotation_id: String(record.quotation_id || ""),
    quotation_no: String(record.quotation_no || ""),
    client_request_id: String(record.client_request_id || ""),
    source_version: sourceVersion,
    project_name: String(record.project_name || q.projectName || q.project_name || ""),
    revision: Number(record.revision || q.revision || 0),
    quotation_date: String(q.quotationDate || q.quotation_date || ""),
    status: String(record.status || q.status || "DRAFT"),
    currency: String(record.currency || q.currency || "THB"),
    customer_name: String(customer.name || record.customer_name || ""),
    customer_company: String(customer.company || record.customer_company || ""),
    customer_address: String(customer.address || ""),
    customer_phone: String(customer.phone || ""),
    customer_email: String(customer.email || ""),
    customer_tax_id: String(customer.taxId || customer.tax_id || ""),
    customer_contact_person: String(customer.contactPerson || customer.contact_person || ""),
    quotation_note: String(q.note || q.quotationNote || q.quotation_note || ""),
    validity_days: Number(terms.validityDays || terms.validity_days || 0),
    payment_terms: String(terms.paymentTerms || terms.payment_terms || ""),
    delivery_terms: String(terms.deliveryTerms || terms.delivery_terms || ""),
    vat_percent: Number(record.vat_percent || q.vatPercent || q.vat_percent || 0),
    subtotal: Number(record.subtotal || q.subtotal || 0),
    vat_amount: Number(record.vat_amount || q.vatAmount || q.vat_amount || 0),
    grand_total: Number(record.grand_total || q.grandTotal || q.grand_total || 0),
    total_proposed_cost: Number(record.proposed_cost || q.proposedCost || q.proposed_cost || 0),
    total_item_cost: itemCost,
    total_cost: Number(record.total_cost || q.totalCost || q.total_cost || 0),
    gross_profit: Number(record.gross_profit || q.grossProfit || q.gross_profit || 0),
    gp_percent: Number(record.gp_percent || q.gpPercent || q.gp_percent || 0),
    cost_basis: String(q.costBasis || q.cost_basis || ""),
    report_version: Number(record.report_version || q.reportVersion || q.report_version || 0),
    drive_folder_id: String(prop("FOLDER_QUOTATION_ID", DEFAULT_QUOTATION_FOLDER_ID)),
    pdf_file_id: String(record.pdf_file_id || ""),
    pdf_url: String(record.pdf_view_url || ""),
    pdf_download_url: String(record.pdf_download_url || ""),
    xlsx_file_id: String(record.xlsx_file_id || ""),
    xlsx_url: String(record.xlsx_view_url || ""),
    xlsx_download_url: String(record.xlsx_download_url || ""),
    source_created_at: String(record.created_at || q.createdAt || q.created_at || ""),
    source_updated_at: String(record.updated_at || q.updatedAt || q.updated_at || ""),
    created_by_emp_id: String(record.created_by_emp_id || q.createdByEmpId || q.created_by_emp_id || ""),
    created_by_name: String(q.createdByName || q.created_by_name || ""),
    updated_by_emp_id: String(record.updated_by_emp_id || q.updatedByEmpId || q.updated_by_emp_id || "")
  };
  var envelope = {
    record: parent,
    payload_json: q,
    items: itemRows,
    cost_notes: costRows,
    files: quotationSqlFiles_(record, q)
  };
  envelope.record.source_hash = quotationSqlSourceHash_(envelope);
  return envelope;
}

function quotationSqlFiles_(record, quotation) {
  var rows = [];
  var seen = {};
  function push(file, kind, generated) {
    file = file && typeof file === "object" ? file : {};
    var fileId = String(file.fileId || file.file_id || "");
    if (!fileId) return;
    var fileKind = String(kind || file.kind || file.bucket || "quotation_attachment");
    var dedupe = fileId + "|" + fileKind;
    if (seen[dedupe]) return;
    seen[dedupe] = true;
    rows.push({
      file_id: fileId,
      file_kind: fileKind,
      file_name: String(file.fileName || file.file_name || file.name || ""),
      mime_type: String(file.mimeType || file.mime_type || ""),
      bucket: String(file.bucket || ""),
      view_url: String(file.viewUrl || file.view_url || file.url || driveViewUrl_(fileId)),
      direct_url: String(file.directUrl || file.direct_url || file.downloadUrl || file.download_url || driveDownloadUrl_(fileId)),
      uploaded_by_emp_id: String(file.uploadedByEmpId || file.uploaded_by_emp_id || ""),
      source_created_at: String(file.uploadedAt || file.uploaded_at || file.createdAt || file.created_at || record.updated_at || ""),
      registry_source: String(file.registrySource || file.registry_source || (generated ? "GENERATED_REPORT" : "")),
      is_generated: !!generated,
      report_version: generated ? Number(record.report_version || 0) : null,
      payload_json: cloneJson_(file)
    });
  }
  push({ file_id: record.pdf_file_id, view_url: record.pdf_view_url, download_url: record.pdf_download_url, mime_type: "application/pdf" }, "quotation_pdf", true);
  push({ file_id: record.xlsx_file_id, view_url: record.xlsx_view_url, download_url: record.xlsx_download_url, mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }, "quotation_xlsx", true);
  var registry = Array.isArray(quotation.uploadedFiles) ? quotation.uploadedFiles : (Array.isArray(quotation.uploaded_files) ? quotation.uploaded_files : []);
  registry.forEach(function(file) {
    if (String(file.registrySource || file.registry_source || "") === "BOUND_UPLOAD_V1") {
      push(file, String(file.bucket || "quotation_attachment"), false);
    }
  });
  return rows;
}

function quotationSqlSourceHash_(envelope) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(envelope), Utilities.Charset.UTF_8);
  return digest.map(function(value) {
    var normalized = value < 0 ? value + 256 : value;
    var hex = normalized.toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  }).join("");
}

function safeQuotationSqlSyncError_(value) {
  var text = String(value || "SUPABASE_SYNC_FAILED").toUpperCase().replace(/[^A-Z0-9_:-]/g, "_");
  return text.slice(0, 300);
}

function markQuotationSqlSyncResult_(quotationId, attemptedVersion, outcome, errorCode) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var current = findQuotationRecord_(quotationId);
    if (!current) return;
    var currentVersion = quotationSourceVersion_(current);
    var previousAttempts = Number(current.sql_sync_attempts || 0);
    var attempts = (isFinite(previousAttempts) && previousAttempts >= 0 ? Math.floor(previousAttempts) : 0) + 1;
    var patch = { sql_sync_attempts: attempts };
    var normalizedOutcome = String(outcome || "PENDING").toUpperCase();
    if (currentVersion !== Number(attemptedVersion)) {
      patch.sql_sync_status = "PENDING";
      patch.sql_sync_error = "";
      if (normalizedOutcome === "SYNCED") patch.sql_sync_version = Math.max(Number(current.sql_sync_version || 0), Number(attemptedVersion || 0));
    } else if (normalizedOutcome === "SYNCED") {
      patch.sql_sync_status = "SYNCED";
      patch.sql_sync_version = attemptedVersion;
      patch.sql_sync_error = "";
      patch.sql_synced_at = nowIso_();
    } else if (normalizedOutcome === "DISABLED") {
      patch.sql_sync_status = "DISABLED";
      patch.sql_sync_error = "";
    } else if (normalizedOutcome === "PENDING") {
      patch.sql_sync_status = "PENDING";
      patch.sql_sync_error = safeQuotationSqlSyncError_(errorCode || "SUPABASE_SYNC_RETRY_PENDING");
    } else {
      patch.sql_sync_status = "ERROR";
      patch.sql_sync_error = safeQuotationSqlSyncError_(errorCode);
    }
    updateQuotationIndexFields_(current._rowNumber, patch);
  } finally {
    lock.releaseLock();
  }
}

function syncQuotationRecordToSupabaseSafe_(key, sessionToken) {
  var record;
  var attemptedVersion = 0;
  try {
    record = prepareQuotationRecordForSync_(key);
    attemptedVersion = quotationSourceVersion_(record);
    if (!quotationSqlSyncEnabled_()) {
      markQuotationSqlSyncResult_(record.quotation_id, attemptedVersion, "DISABLED", "");
      return { ok: false, status: "DISABLED", sourceVersion: attemptedVersion };
    }
    var envelope = quotationSqlEnvelope_(record);
    var isReconcile = !sessionToken;
    var response = quotationSupabaseRequest_(
      "rpc/" + (isReconcile ? QUOTATION_SQL_RECONCILE_RPC : QUOTATION_SQL_SYNC_RPC),
      "post",
      isReconcile ? { p_quotation: envelope } : { p_token: sessionToken, p_quotation: envelope }
    );
    var code = response.getResponseCode();
    var result = {};
    try { result = JSON.parse(response.getContentText() || "{}"); } catch (parseErr) { result = {}; }
    if (Array.isArray(result)) result = result.length ? result[0] : {};
    if (code < 200 || code >= 300) {
      var httpError = safeQuotationSqlSyncError_(result.message || result.code || ("SUPABASE_SYNC_HTTP_" + code));
      var retryable = code === 408 || code === 429 || code >= 500;
      var httpOutcome = retryable ? "PENDING" : "ERROR";
      markQuotationSqlSyncResult_(record.quotation_id, attemptedVersion, httpOutcome, httpError);
      return { ok: false, status: httpOutcome, sourceVersion: attemptedVersion, error: httpError };
    }
    var action = String(result.action || "").toLowerCase();
    var returnedVersion = Number(result.source_version || 0);
    var returnedId = String(result.quotation_id || "");
    var logicalMessage = safeQuotationSqlSyncError_(result.message || result.code || "SUPABASE_SYNC_REJECTED");
    if (action === "stale_noop" || result.stale === true || returnedVersion > attemptedVersion) {
      markQuotationSqlSyncResult_(record.quotation_id, attemptedVersion, "ERROR", "SUPABASE_SQL_AHEAD");
      return { ok: false, status: "ERROR", sourceVersion: attemptedVersion, error: "SUPABASE_SQL_AHEAD" };
    }
    if (String(result.status || "").toLowerCase() !== "success" || returnedId !== String(record.quotation_id) || returnedVersion !== attemptedVersion) {
      var logicalError = returnedId && returnedId !== String(record.quotation_id) ? "SUPABASE_SYNC_ID_MISMATCH" :
        (returnedVersion !== attemptedVersion ? "SUPABASE_SYNC_VERSION_MISMATCH" : logicalMessage);
      markQuotationSqlSyncResult_(record.quotation_id, attemptedVersion, "ERROR", logicalError);
      return { ok: false, status: "ERROR", sourceVersion: attemptedVersion, error: logicalError };
    }
    markQuotationSqlSyncResult_(record.quotation_id, attemptedVersion, "SYNCED", "");
    return { ok: true, status: "SYNCED", sourceVersion: attemptedVersion };
  } catch (err) {
    if (record && record.quotation_id) {
      try { markQuotationSqlSyncResult_(record.quotation_id, attemptedVersion, "PENDING", "SUPABASE_SYNC_UNAVAILABLE"); } catch (markErr) { /* best effort outbox marker */ }
    }
    return { ok: false, status: "PENDING", sourceVersion: attemptedVersion, error: "SUPABASE_SYNC_UNAVAILABLE" };
  }
}

function attachQuotationSyncWarning_(response, sync) {
  if (!response || !sync) return response;
  response.metadataSync = sync;
  response.metadata_sync = sync;
  if (!sync.ok) {
    response.warnings = Array.isArray(response.warnings) ? response.warnings : [];
    response.warnings.push("Quotation is saved in Google Drive; Supabase metadata sync is pending.");
  }
  return response;
}

// Run manually or from an Apps Script time trigger. This function is not an
// HTTP quotation action, so the browser cannot invoke background reconciliation.
function reconcileQuotationSqlSync(limit) {
  var requested = Number(limit || 20);
  var maxRows = isFinite(requested) ? Math.max(1, Math.min(50, Math.floor(requested))) : 20;
  if (!quotationSqlSyncEnabled_()) {
    return { status: "disabled", attempted: 0, synced: 0, pending: 0, rows: [] };
  }
  var candidates = getQuotationRecords_().filter(function(row) {
    var status = String(row.sql_sync_status || "PENDING").toUpperCase();
    return status === "PENDING" || status === "ERROR" ||
      (status !== "DISABLED" && Number(row.sql_sync_version || 0) < quotationSourceVersion_(row));
  }).sort(function(a, b) {
    var attemptDiff = Number(a.sql_sync_attempts || 0) - Number(b.sql_sync_attempts || 0);
    if (attemptDiff) return attemptDiff;
    return String(a.updated_at || "").localeCompare(String(b.updated_at || ""));
  }).slice(0, maxRows);
  var result = { status: "success", attempted: 0, synced: 0, pending: 0, rows: [] };
  candidates.forEach(function(row) {
    var sync = syncQuotationRecordToSupabaseSafe_(row.quotation_id, null);
    result.attempted += 1;
    if (sync.ok) result.synced += 1;
    else result.pending += 1;
    result.rows.push({ quotation_id: String(row.quotation_id || ""), status: sync.status, source_version: sync.sourceVersion });
  });
  Logger.log(JSON.stringify(result));
  return result;
}

function reconcileQuotationSupabase(limit) {
  return reconcileQuotationSqlSync(limit);
}

function quotationCreate_(body) {
  var artifacts = null;
  var quotation = null;
  var reservationKey = "";
  var recordCommitted = false;
  var actor = sessionActor_(body);
  var clientRequestId = quotationClientRequestId_(body, actor);
  var idempotentRecord = null;
  var allocationLock = LockService.getScriptLock();
  allocationLock.waitLock(30000);
  try {
    var existingRequest = findQuotationRecordByClientRequestId_(clientRequestId);
    if (existingRequest) {
      assertQuotationAccess_(body._validatedSession, existingRequest, "create_retry");
      idempotentRecord = existingRequest;
    } else {
      cleanupStaleCreateReservationsNoLock_();
      reservationKey = quotationCreateReservationKey_(clientRequestId);
      var activeReservation = readCreateReservation_(reservationKey);
      if (activeReservation && new Date().getTime() - Number(activeReservation.created_ms || 0) < 10 * 60 * 1000) {
        throw new Error("QUOTATION_CREATE_IN_PROGRESS");
      }
      var now = nowIso_();
      var createInput = cloneJson_(body.quotation || {});
      // Upload registry is server-owned and can only be populated by a bound
      // upload after the quotation record exists.
      if (createInput.uploadedFiles) delete createInput.uploadedFiles;
      if (createInput.uploaded_files) delete createInput.uploaded_files;
      quotation = normalizeAndCalculateQuotation_(createInput);
      quotation.clientRequestId = clientRequestId;
      quotation.client_request_id = clientRequestId;
      quotation.quotationId = makeQuotationId_();
      quotation.quotation_id = quotation.quotationId;
      quotation.quotationNo = allocateQuotationNoNoLock_();
      quotation.quotation_no = quotation.quotationNo;
      quotation.status = "DRAFT";
      quotation.createdAt = now;
      quotation.created_at = now;
      quotation.updatedAt = now;
      quotation.updated_at = now;
      quotation.createdByEmpId = actor.emp_id;
      quotation.created_by_emp_id = actor.emp_id;
      quotation.updatedByEmpId = actor.emp_id;
      quotation.updated_by_emp_id = actor.emp_id;
      quotation.createdByName = actor.name;
      quotation.reportVersion = 1;
      quotation.report_version = 1;
      quotation.sourceVersion = 1;
      quotation.source_version = 1;
      validateQuotationRequestSize_(quotation);
      scriptProps().setProperty(reservationKey, JSON.stringify({
        quotation_id: quotation.quotationId,
        quotation_no: quotation.quotationNo,
        created_ms: new Date().getTime()
      }));
    }
  } finally {
    allocationLock.releaseLock();
  }

  if (idempotentRecord) {
    var existingQuotation = parseQuotationPayload_(idempotentRecord.payload_json);
    var existingArtifacts = artifactsFromRecord_(idempotentRecord);
    attachArtifactsToQuotation_(existingQuotation, existingArtifacts);
    var idempotentSync = syncQuotationRecordToSupabaseSafe_(idempotentRecord.quotation_id, quotationSessionToken_(body));
    writeQuotationAuditSafe_("quotation_create", "success", body, existingQuotation, "Idempotent create retry returned existing quotation");
    return quotationSuccessResponse_("quotation_create", existingQuotation, existingArtifacts, true, idempotentSync);
  }

  try {
    artifacts = generateQuotationArtifacts_(quotation, 1);
    var concurrentIdempotent = false;
    var finalizeLock = LockService.getScriptLock();
    finalizeLock.waitLock(30000);
    try {
      var recordCreatedMeanwhile = findQuotationRecordByClientRequestId_(clientRequestId);
      if (recordCreatedMeanwhile) {
        trashArtifacts_(artifacts);
        artifacts = artifactsFromRecord_(recordCreatedMeanwhile);
        quotation = parseQuotationPayload_(recordCreatedMeanwhile.payload_json);
        attachArtifactsToQuotation_(quotation, artifacts);
        scriptProps().deleteProperty(reservationKey);
        concurrentIdempotent = true;
      } else {
        var reservation = readCreateReservation_(reservationKey);
        if (!reservation || String(reservation.quotation_id || "") !== String(quotation.quotationId)) {
          throw new Error("QUOTATION_CREATE_RESERVATION_LOST");
        }
        attachArtifactsToQuotation_(quotation, artifacts);
        appendQuotationRecord_(quotation, artifacts, quotation.updatedAt);
        recordCommitted = true;
        scriptProps().deleteProperty(reservationKey);
      }
    } finally {
      finalizeLock.releaseLock();
    }
    if (concurrentIdempotent) {
      var concurrentSync = syncQuotationRecordToSupabaseSafe_(quotation.quotationId || quotation.quotation_id, quotationSessionToken_(body));
      writeQuotationAuditSafe_("quotation_create", "success", body, quotation, "Concurrent idempotent retry returned existing quotation");
      return quotationSuccessResponse_("quotation_create", quotation, artifacts, true, concurrentSync);
    }
    var createSync = syncQuotationRecordToSupabaseSafe_(quotation.quotationId, quotationSessionToken_(body));
    writeQuotationAuditSafe_("quotation_create", "success", body, quotation, "Created draft and initial report files");
    return quotationSuccessResponse_("quotation_create", quotation, artifacts, false, createSync);
  } catch (err) {
    if (recordCommitted) {
      writeQuotationAuditSafe_("quotation_create", "success", body, quotation, "Created draft; reservation cleanup deferred");
      return quotationSuccessResponse_("quotation_create", quotation, artifacts, false);
    }
    if (artifacts) trashArtifacts_(artifacts);
    clearCreateReservationSafely_(reservationKey, quotation && quotation.quotationId);
    throw err;
  }
}

function quotationSave_(body, reportOnly) {
  var newArtifacts = null;
  var saveCommitted = false;
  var actor = sessionActor_(body);
  var key = quotationRequestKey_(body);
  if (!key) throw new Error("Quotation ID or quotation number is required");
  var existingRecord;
  var quotation;
  var version;
  var snapshotToken;
  var now;
  var snapshotLock = LockService.getScriptLock();
  snapshotLock.waitLock(30000);
  try {
    existingRecord = findQuotationRecord_(key);
    if (!existingRecord) throw new Error("QUOTATION_NOT_FOUND");
    assertQuotationAccess_(body._validatedSession, existingRecord, "save");

    var existingPayload = parseQuotationPayload_(existingRecord.payload_json);
    var incoming = body.quotation && typeof body.quotation === "object" ? body.quotation : {};
    var merged = reportOnly && !Object.keys(incoming).length ? existingPayload : mergePlainObjects_(existingPayload, incoming);
    var trustedUploadRegistry = Array.isArray(existingPayload.uploadedFiles) ? existingPayload.uploadedFiles :
      (Array.isArray(existingPayload.uploaded_files) ? existingPayload.uploaded_files : []);
    merged.uploadedFiles = trustedUploadRegistry;
    if (merged.uploaded_files) delete merged.uploaded_files;
    quotation = normalizeAndCalculateQuotation_(merged);
    now = nowIso_();
    version = nonNegativeInteger_(existingRecord.report_version, "report_version", 0) + 1;
    snapshotToken = quotationRecordSnapshotToken_(existingRecord);

    quotation.quotationId = String(existingRecord.quotation_id);
    quotation.quotation_id = quotation.quotationId;
    quotation.quotationNo = String(existingRecord.quotation_no);
    quotation.quotation_no = quotation.quotationNo;
    quotation.clientRequestId = String(existingRecord.client_request_id || existingPayload.clientRequestId || existingPayload.client_request_id || "");
    quotation.client_request_id = quotation.clientRequestId;
    quotation.createdAt = String(existingRecord.created_at || existingPayload.createdAt || existingPayload.created_at || now);
    quotation.created_at = quotation.createdAt;
    quotation.updatedAt = now;
    quotation.updated_at = now;
    quotation.createdByEmpId = String(existingRecord.created_by_emp_id);
    quotation.created_by_emp_id = quotation.createdByEmpId;
    quotation.updatedByEmpId = actor.emp_id;
    quotation.updated_by_emp_id = actor.emp_id;
    quotation.createdByName = existingPayload.createdByName || existingPayload.created_by_name || actor.name;
    quotation.reportVersion = version;
    quotation.report_version = version;
    quotation.sourceVersion = quotationSourceVersion_(existingRecord) + 1;
    quotation.source_version = quotation.sourceVersion;

    validateQuotationRequestSize_(quotation);
  } finally {
    snapshotLock.releaseLock();
  }

  try {
    newArtifacts = generateQuotationArtifacts_(quotation, version);
    var commitLock = LockService.getScriptLock();
    commitLock.waitLock(30000);
    try {
      var currentRecord = findQuotationRecord_(existingRecord.quotation_id);
      if (!currentRecord || quotationRecordSnapshotToken_(currentRecord) !== snapshotToken) {
        throw new Error("QUOTATION_CONFLICT_RELOAD_AND_RETRY");
      }
      attachArtifactsToQuotation_(quotation, newArtifacts);
      updateQuotationRecord_(currentRecord._rowNumber, quotation, newArtifacts, now);
      saveCommitted = true;
    } finally {
      commitLock.releaseLock();
    }

    // Trashing old tracked reports is outside the lock; the index already points
    // atomically to the new pair and uploaded source files are never touched.
    trashFileSafely_(existingRecord.pdf_file_id, newArtifacts.pdf.fileId);
    trashFileSafely_(existingRecord.xlsx_file_id, newArtifacts.xlsx.fileId);
    var saveSync = syncQuotationRecordToSupabaseSafe_(quotation.quotationId, quotationSessionToken_(body));
    writeQuotationAuditSafe_(reportOnly ? "quotation_report" : "quotation_save", "success", body, quotation, "Regenerated PDF and XLSX report files");
    return quotationSuccessResponse_(reportOnly ? "quotation_report" : "quotation_save", quotation, newArtifacts, false, saveSync);
  } catch (err) {
    if (saveCommitted) {
      writeQuotationAuditSafe_(reportOnly ? "quotation_report" : "quotation_save", "success", body, quotation, "Saved reports; post-commit cleanup deferred");
      return quotationSuccessResponse_(reportOnly ? "quotation_report" : "quotation_save", quotation, newArtifacts);
    }
    if (newArtifacts) trashArtifacts_(newArtifacts);
    throw err;
  }
}

function quotationList_(body) {
  var session = body._validatedSession;
  var actor = sessionActor_(body);
  var rows = getQuotationRecords_();
  if (!isQuotationAdmin_(session)) {
    rows = rows.filter(function(row) {
      return String(row.created_by_emp_id || "") === String(actor.emp_id);
    });
  }

  var filters = body.filters && typeof body.filters === "object" ? body.filters : {};
  var search = String(body.search || filters.search || body.key || "").trim().toLowerCase();
  var status = String(body.status || filters.status || "").trim().toUpperCase();
  if (status) {
    rows = rows.filter(function(row) { return String(row.status || "").toUpperCase() === status; });
  }
  if (search) {
    rows = rows.filter(function(row) {
      var haystack = [row.quotation_no, row.customer_name, row.customer_company, row.project_name].join(" ").toLowerCase();
      return haystack.indexOf(search) >= 0;
    });
  }

  rows.sort(function(a, b) { return String(b.updated_at || "").localeCompare(String(a.updated_at || "")); });
  var requestedLimit = Number(body.limit || filters.limit || 100);
  var limit = isFinite(requestedLimit) ? Math.max(1, Math.min(500, Math.floor(requestedLimit))) : 100;
  var total = rows.length;
  var summaries = rows.slice(0, limit).map(quotationSummaryFromRecord_);
  writeQuotationAuditSafe_("quotation_list", "success", body, null, "Listed " + summaries.length + " quotations");
  return jsonOutput({ status: "success", ok: true, action: "quotation_list", quotations: summaries, rows: summaries, total: total });
}

function quotationGet_(body) {
  var key = quotationRequestKey_(body);
  if (!key) throw new Error("Quotation ID or quotation number is required");
  var record = findQuotationRecord_(key);
  if (!record) throw new Error("QUOTATION_NOT_FOUND");
  assertQuotationAccess_(body._validatedSession, record, "get");
  var quotation = parseQuotationPayload_(record.payload_json);
  attachArtifactsToQuotation_(quotation, artifactsFromRecord_(record));
  writeQuotationAuditSafe_("quotation_get", "success", body, quotation, "Opened quotation");
  return jsonOutput({
    status: "success",
    ok: true,
    action: "quotation_get",
    quotation: quotation,
    record: quotationSummaryFromRecord_(record),
    artifacts: artifactsFromRecord_(record)
  });
}

function quotationDeleteFile_(body) {
  var nextQuotation = null;
  var fileId = "";
  var quotationId = "";
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var meta = body.meta && typeof body.meta === "object" ? body.meta : {};
    var key = quotationRequestKey_(body) || String(meta.quotationId || meta.quotation_id || meta.quotationNo || meta.quotation_no || "").trim();
    fileId = String(body.fileId || body.file_id || meta.fileId || meta.file_id || "").trim();
    if (!key) throw new Error("Quotation ID or quotation number is required");
    if (!fileId) throw new Error("File ID is required");

    var record = findQuotationRecord_(key);
    if (!record) throw new Error("QUOTATION_NOT_FOUND");
    assertQuotationAccess_(body._validatedSession, record, "delete_file");
    if (fileId === String(record.pdf_file_id || "") || fileId === String(record.xlsx_file_id || "")) {
      throw new Error("Current generated report files cannot be deleted");
    }

    var quotation = parseQuotationPayload_(record.payload_json);
    if (!quotationReferencesUploadedFile_(quotation, fileId)) {
      throw new Error("File is not a referenced quotation attachment or product image");
    }

    var file = DriveApp.getFileById(fileId);
    if (!fileIsInQuotationFolder_(file)) throw new Error("File is outside the quotation folder");
    nextQuotation = removeQuotationFileReference_(quotation, fileId);
    quotationId = String(record.quotation_id || "");
    var now = nowIso_();
    nextQuotation.updatedAt = now;
    nextQuotation.updated_at = now;
    nextQuotation.updatedByEmpId = String(body._validatedSession.emp_id || "");
    nextQuotation.updated_by_emp_id = nextQuotation.updatedByEmpId;
    nextQuotation.sourceVersion = quotationSourceVersion_(record) + 1;
    nextQuotation.source_version = nextQuotation.sourceVersion;
    var payloadJson = JSON.stringify(nextQuotation);
    assertJsonSize_(payloadJson);

    file.setTrashed(true);
    try {
      updateQuotationIndexFields_(record._rowNumber, {
        payload_json: payloadJson,
        updated_at: now,
        updated_by_emp_id: nextQuotation.updatedByEmpId,
        source_version: nextQuotation.sourceVersion,
        sql_sync_status: "PENDING",
        sql_sync_error: ""
      });
    } catch (updateErr) {
      try { file.setTrashed(false); } catch (restoreErr) { /* best effort rollback */ }
      throw updateErr;
    }

  } finally {
    lock.releaseLock();
  }

  var deleteSync = syncQuotationRecordToSupabaseSafe_(quotationId, quotationSessionToken_(body));
  writeQuotationAuditSafe_("quotation_delete_file", "success", body, nextQuotation, "Deleted owned quotation upload " + fileId);
  var response = {
    status: "success",
    ok: true,
    action: "quotation_delete_file",
    deletedFileId: fileId,
    deleted_file_id: fileId,
    quotation: nextQuotation
  };
  attachQuotationSyncWarning_(response, deleteSync);
  return jsonOutput(response);
}

function quotationReferencesUploadedFile_(quotation, fileId) {
  var target = String(fileId || "");
  var registry = Array.isArray(quotation.uploadedFiles) ? quotation.uploadedFiles :
    (Array.isArray(quotation.uploaded_files) ? quotation.uploaded_files : []);
  // Registry entries are created only after a session-authorized, quotation-bound
  // upload. Requiring the registry prevents a user from injecting another quote's
  // Drive file ID into arbitrary attachment metadata and deleting it.
  return registry.some(function(file) {
    var source = String(file.registrySource || file.registry_source || "");
    return quotationFileId_(file) === target && source === "BOUND_UPLOAD_V1";
  });
}

function quotationFileId_(file) {
  file = file && typeof file === "object" ? file : {};
  return String(file.fileId || file.file_id || file.driveFileId || file.drive_file_id || file.id || "");
}

function removeQuotationFileReference_(quotation, fileId) {
  var target = String(fileId || "");
  var next = cloneJson_(quotation || {});
  var attachmentKeys = ["attachments", "quotation_attachments"];
  attachmentKeys.forEach(function(key) {
    if (Array.isArray(next[key])) {
      next[key] = next[key].filter(function(file) { return quotationFileId_(file) !== target; });
    }
  });
  var registryKeys = ["uploadedFiles", "uploaded_files"];
  registryKeys.forEach(function(key) {
    if (Array.isArray(next[key])) {
      next[key] = next[key].filter(function(file) { return quotationFileId_(file) !== target; });
    }
  });
  var fileListKeys = ["files", "reportFiles", "report_files"];
  fileListKeys.forEach(function(key) {
    if (Array.isArray(next[key])) {
      next[key] = next[key].filter(function(file) { return quotationFileId_(file) !== target; });
    }
  });
  var itemKeys = ["items", "quotation_items"];
  itemKeys.forEach(function(key) {
    if (!Array.isArray(next[key])) return;
    next[key] = next[key].map(function(rawItem) {
      var item = rawItem && typeof rawItem === "object" ? cloneJson_(rawItem) : {};
      var itemFileId = String(item.imageFileId || item.pictureFileId || item.picture_file_id || "");
      if (itemFileId === target) {
        item.imageFileId = "";
        item.pictureFileId = "";
        item.picture_file_id = "";
        item.imageUrl = "";
        item.pictureUrl = "";
        item.picture_url = "";
      }
      return item;
    });
  });
  return next;
}

function assertQuotationAccess_(session, record, operation) {
  if (isQuotationAdmin_(session)) return;
  if (String(record.created_by_emp_id || "") !== String(session && session.emp_id || "")) {
    throw new Error("QUOTATION_ACCESS_DENIED:" + operation);
  }
}

function quotationRequestKey_(body) {
  var quotation = body.quotation && typeof body.quotation === "object" ? body.quotation : {};
  return String(
    body.key || body.quotationId || body.quotation_id || body.id ||
    body.quotationNo || body.quotation_no ||
    quotation.quotationId || quotation.quotation_id || quotation.id ||
    quotation.quotationNo || quotation.quotation_no || ""
  ).trim();
}

function normalizeAndCalculateQuotation_(raw) {
  var q = cloneJson_(raw && typeof raw === "object" ? raw : {});
  var rawItems = Array.isArray(q.items) ? q.items : (Array.isArray(q.quotation_items) ? q.quotation_items : []);
  var rawCostNotes = Array.isArray(q.costNotes) ? q.costNotes : (Array.isArray(q.cost_notes) ? q.cost_notes : []);
  var rawAttachments = Array.isArray(q.attachments) ? q.attachments : [];
  if (rawItems.length > QUOTATION_MAX_ITEMS) throw new Error("Too many quotation items (maximum 200)");
  if (rawCostNotes.length > QUOTATION_MAX_COST_NOTES) throw new Error("Too many cost notes (maximum 100)");
  if (rawAttachments.length > QUOTATION_MAX_ATTACHMENTS) throw new Error("Too many attachments (maximum 50)");
  rejectEmbeddedBinary_(q);

  var customerInput = q.customer && typeof q.customer === "object" ? q.customer : {};
  var customer = mergePlainObjects_(customerInput, {});
  customer.name = limitText_(customer.name || customer.customerName || customer.customer_name || q.customerName || q.customer_name || "", 1000);
  customer.company = limitText_(customer.company || customer.companyName || customer.company_name || q.customerCompany || q.customer_company || "", 1000);
  customer.address = limitText_(customer.address || q.customerAddress || q.customer_address || "", 5000);
  customer.phone = limitText_(customer.phone || q.customerPhone || q.customer_phone || "", 300);
  customer.email = limitText_(customer.email || q.customerEmail || q.customer_email || "", 500);
  customer.taxId = limitText_(customer.taxId || customer.tax_id || q.customerTaxId || q.customer_tax_id || "", 300);
  customer.contactPerson = limitText_(customer.contactPerson || customer.contact_person || q.contactPerson || q.contact_person || "", 500);

  var items = [];
  var itemCostTotal = 0;
  var i;
  for (i = 0; i < rawItems.length; i += 1) {
    var source = rawItems[i] && typeof rawItems[i] === "object" ? cloneJson_(rawItems[i]) : {};
    var qty = strictNonNegativeNumber_(firstDefined_(source.quantity, source.qty), "items[" + i + "].quantity", 0);
    var unitPrice = strictNonNegativeNumber_(firstDefined_(source.unitPrice, source.unit_price), "items[" + i + "].unitPrice", 0);
    var unitCost = strictNonNegativeNumber_(firstDefined_(source.unitCost, source.unit_cost, source.cost), "items[" + i + "].unitCost", 0);
    var lineAmount = moneyRound_(qty * unitPrice);
    var lineCost = moneyRound_(qty * unitCost);
    source.itemNo = i + 1;
    source.item_no = i + 1;
    source.quantity = qty;
    source.qty = qty;
    source.unitPrice = unitPrice;
    source.unit_price = unitPrice;
    source.unitCost = unitCost;
    source.unit_cost = unitCost;
    source.cost = unitCost;
    source.amount = lineAmount;
    source.lineAmount = lineAmount;
    source.costAmount = lineCost;
    source.cost_amount = lineCost;
    source.productName = limitText_(source.productName || source.product_name || source.description || "", 5000);
    source.product_name = source.productName;
    source.description = limitText_(source.description || source.productName || "", 5000);
    source.productRef = limitText_(source.productRef || source.product_ref || source.ref || source.sku || "", 500);
    source.product_ref = source.productRef;
    source.unit = limitText_(source.unit || "", 200);
    source.remark = limitText_(source.remark || "", 3000);
    source.imageFileId = limitText_(source.imageFileId || source.pictureFileId || source.picture_file_id || "", 300);
    source.picture_file_id = source.imageFileId;
    source.imageUrl = limitText_(source.imageUrl || source.pictureUrl || source.picture_url || "", 3000);
    source.picture_url = source.imageUrl;
    itemCostTotal = moneyRound_(itemCostTotal + lineCost);
    items.push(source);
  }

  var costNotes = [];
  var hasSbCost = false;
  var sbCostTotal = 0;
  var proposedCostTotal = 0;
  for (i = 0; i < rawCostNotes.length; i += 1) {
    var noteSource = rawCostNotes[i] && typeof rawCostNotes[i] === "object" ? cloneJson_(rawCostNotes[i]) : {};
    var sbCost = strictNonNegativeNumber_(firstDefined_(noteSource.sbCost, noteSource.sb_cost, noteSource.sbcost), "costNotes[" + i + "].sbCost", 0);
    var proposedCost = strictNonNegativeNumber_(firstDefined_(noteSource.proposedCost, noteSource.proposed_cost, noteSource.pcost), "costNotes[" + i + "].proposedCost", 0);
    noteSource.noteNo = i + 1;
    noteSource.note_no = i + 1;
    noteSource.description = limitText_(noteSource.description || "", 5000);
    noteSource.note = limitText_(noteSource.note || "", 5000);
    noteSource.sbCost = moneyRound_(sbCost);
    noteSource.sb_cost = noteSource.sbCost;
    noteSource.sbcost = noteSource.sbCost;
    noteSource.proposedCost = moneyRound_(proposedCost);
    noteSource.proposed_cost = noteSource.proposedCost;
    noteSource.pcost = noteSource.proposedCost;
    if (sbCost > 0) hasSbCost = true;
    sbCostTotal = moneyRound_(sbCostTotal + noteSource.sbCost);
    proposedCostTotal = moneyRound_(proposedCostTotal + noteSource.proposedCost);
    costNotes.push(noteSource);
  }

  var attachments = [];
  for (i = 0; i < rawAttachments.length; i += 1) {
    var attachment = rawAttachments[i] && typeof rawAttachments[i] === "object" ? cloneJson_(rawAttachments[i]) : {};
    attachment.fileId = limitText_(attachment.fileId || attachment.file_id || attachment.driveFileId || attachment.drive_file_id || "", 300);
    attachment.file_id = attachment.fileId;
    attachment.name = limitText_(attachment.name || attachment.fileName || attachment.file_name || ("Attachment " + (i + 1)), 1000);
    attachment.fileName = attachment.name;
    attachment.mimeType = limitText_(attachment.mimeType || attachment.mime_type || "", 300);
    attachment.url = limitText_(attachment.url || attachment.viewUrl || attachment.view_url || (attachment.fileId ? driveViewUrl_(attachment.fileId) : ""), 3000);
    attachments.push(attachment);
  }

  var vatPercent;
  if (hasDefinedValue_(q.vatPercent)) {
    vatPercent = strictNonNegativeNumber_(q.vatPercent, "vatPercent", 7);
  } else if (hasDefinedValue_(q.vat_percent)) {
    vatPercent = strictNonNegativeNumber_(q.vat_percent, "vat_percent", 7);
  } else if (hasDefinedValue_(q.vat_rate)) {
    vatPercent = strictNonNegativeNumber_(q.vat_rate, "vat_rate", 0);
    if (vatPercent <= 1) vatPercent = vatPercent * 100;
  } else {
    vatPercent = 7;
  }
  if (vatPercent > 100) throw new Error("VAT percent must be between 0 and 100");
  vatPercent = moneyRound_(vatPercent);

  var subtotal = 0;
  for (i = 0; i < items.length; i += 1) subtotal = moneyRound_(subtotal + items[i].amount);
  var vatAmount = moneyRound_(subtotal * vatPercent / 100);
  var grandTotal = moneyRound_(subtotal + vatAmount);
  var totalCost = hasSbCost ? moneyRound_(sbCostTotal) : moneyRound_(itemCostTotal);
  var grossProfit = moneyRound_(subtotal - totalCost);
  var gpPercent = subtotal > 0 ? moneyRound_(grossProfit / subtotal * 100) : 0;

  var rawTerms = q.terms && typeof q.terms === "object" ? q.terms : {};
  var terms = mergePlainObjects_(rawTerms, {});
  terms.validityDays = strictNonNegativeNumber_(firstDefined_(terms.validityDays, terms.validity_days, q.validityDays, q.validity_days), "terms.validityDays", 30);
  if (terms.validityDays > 3650) throw new Error("Validity days is too large");
  terms.validity_days = terms.validityDays;
  terms.paymentTerms = limitText_(terms.paymentTerms || terms.payment_terms || q.paymentTerms || q.payment_terms || "", 5000);
  terms.payment_terms = terms.paymentTerms;
  terms.deliveryTerms = limitText_(terms.deliveryTerms || terms.delivery_terms || q.deliveryTerms || q.delivery_terms || "", 5000);
  terms.delivery_terms = terms.deliveryTerms;

  q.customer = customer;
  q.customerName = customer.name;
  q.customer_name = customer.name;
  q.customerCompany = customer.company;
  q.customer_company = customer.company;
  q.projectName = limitText_(q.projectName || q.project_name || q.subject || "", 2000);
  q.project_name = q.projectName;
  q.quotationDate = limitText_(q.quotationDate || q.quotation_date || localDateText_(), 100);
  q.quotation_date = q.quotationDate;
  q.currency = limitText_(q.currency || "THB", 20).toUpperCase();
  q.status = normalizeQuotationStatus_(q.status || "DRAFT");
  q.revision = nonNegativeInteger_(q.revision, "revision", 0);
  q.note = limitText_(q.note || q.quotationNote || q.quotation_note || "", 10000);
  q.quotationNote = q.note;
  q.quotation_note = q.note;
  q.items = items;
  q.quotation_items = items;
  q.costNotes = costNotes;
  q.cost_notes = costNotes;
  q.attachments = attachments;
  q.terms = terms;
  q.vatPercent = vatPercent;
  q.vat_percent = vatPercent;
  q.vat_rate = vatPercent / 100;
  q.subtotal = subtotal;
  q.total_amount = subtotal;
  q.vatAmount = vatAmount;
  q.vat_amount = vatAmount;
  q.grandTotal = grandTotal;
  q.grand_total = grandTotal;
  q.proposedCost = proposedCostTotal;
  q.proposed_cost = proposedCostTotal;
  q.costBasis = hasSbCost ? "SB_COST_NOTES" : "ITEM_UNIT_COST";
  q.cost_basis = q.costBasis;
  q.totalCost = totalCost;
  q.total_cost = totalCost;
  q.grossProfit = grossProfit;
  q.gross_profit = grossProfit;
  q.gpPercent = gpPercent;
  q.gp_percent = gpPercent;
  q.totals = {
    subtotal: subtotal,
    vatPercent: vatPercent,
    vatAmount: vatAmount,
    grandTotal: grandTotal,
    proposedCost: proposedCostTotal,
    totalCost: totalCost,
    grossProfit: grossProfit,
    gpPercent: gpPercent
  };
  return q;
}

function normalizeQuotationStatus_(status) {
  var value = String(status || "DRAFT").trim().toUpperCase();
  var allowed = ["DRAFT", "PENDING", "SENT", "APPROVED", "REJECTED", "CANCELLED", "EXPIRED"];
  return allowed.indexOf(value) >= 0 ? value : "DRAFT";
}

function generateQuotationArtifacts_(quotation, version) {
  var folder = DriveApp.getFolderById(prop("FOLDER_QUOTATION_ID", DEFAULT_QUOTATION_FOLDER_ID));
  var tempSpreadsheet = null;
  var pdfFile = null;
  var xlsxFile = null;
  try {
    tempSpreadsheet = SpreadsheetApp.create("TEMP_" + sanitizeFileName(quotation.quotationNo) + "_v" + version);
    var tempDriveFile = DriveApp.getFileById(tempSpreadsheet.getId());
    tempDriveFile.moveTo(folder);
    buildQuotationReportSheet_(tempSpreadsheet, quotation);
    SpreadsheetApp.flush();

    var baseName = sanitizeFileName(quotation.quotationNo + "_v" + version);
    // Export the private internal workbook before adding the customer-only PDF
    // sheet, so the XLSX remains an auditable analysis workbook.
    var xlsxMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    var xlsxBlob = exportSpreadsheetBlob_(tempSpreadsheet, "xlsx", xlsxMime, baseName + ".xlsx");
    xlsxFile = folder.createFile(xlsxBlob);
    applyInternalQuotationSharing_(xlsxFile);

    var customerSheet = buildCustomerQuotationSheet_(tempSpreadsheet, quotation);
    SpreadsheetApp.flush();
    var pdfBlob = exportSpreadsheetBlob_(tempSpreadsheet, "pdf", "application/pdf", baseName + ".pdf", customerSheet);
    pdfFile = folder.createFile(pdfBlob);
    applyCustomerQuotationSharing_(pdfFile);

    return {
      pdf: artifactForFile_(pdfFile),
      xlsx: artifactForFile_(xlsxFile)
    };
  } catch (err) {
    if (pdfFile) trashFileSafely_(pdfFile.getId(), "");
    if (xlsxFile) trashFileSafely_(xlsxFile.getId(), "");
    throw err;
  } finally {
    if (tempSpreadsheet) trashFileSafely_(tempSpreadsheet.getId(), "");
  }
}

function buildQuotationReportSheet_(ss, q) {
  var sheet = ss.getSheets()[0];
  sheet.setName("Internal Analysis");
  sheet.clear();
  sheet.setHiddenGridlines(true);
  sheet.setTabColor("#0f766e");
  sheet.getRange("A:J").setFontFamily("Sarabun").setFontSize(10).setVerticalAlignment("middle");
  var widths = [45, 95, 250, 95, 65, 70, 100, 110, 100, 110];
  var c;
  for (c = 1; c <= widths.length; c += 1) sheet.setColumnWidth(c, widths[c - 1]);

  var companyName = prop("QUOTATION_COMPANY_NAME", "SB INTERLAB CO., LTD.");
  var companyAddress = prop("QUOTATION_COMPANY_ADDRESS", "");
  var companyPhone = prop("QUOTATION_COMPANY_PHONE", "");
  var companyTaxId = prop("QUOTATION_COMPANY_TAX_ID", "");
  var logoFileId = prop("QUOTATION_LOGO_FILE_ID", "");

  sheet.getRange("C1:J2").merge();
  sheet.getRange("C1").setValue("ใบเสนอราคา / QUOTATION").setFontSize(22).setFontWeight("bold").setFontColor("#0f766e").setHorizontalAlignment("right");
  sheet.getRange("C3:J3").merge();
  sheet.getRange("C3").setValue(safeSpreadsheetText_(companyName)).setFontSize(14).setFontWeight("bold").setHorizontalAlignment("right");
  sheet.getRange("C4:J4").merge();
  sheet.getRange("C4").setValue(safeSpreadsheetText_(companyAddress)).setHorizontalAlignment("right");
  sheet.getRange("C5:J5").merge();
  sheet.getRange("C5").setValue(safeSpreadsheetText_([companyPhone ? "Tel: " + companyPhone : "", companyTaxId ? "Tax ID: " + companyTaxId : ""].filter(function(x) { return !!x; }).join("  |  "))).setHorizontalAlignment("right");
  if (logoFileId) insertTrustedLogo_(sheet, logoFileId);

  setLabelValueRow_(sheet, 7, 1, 2, "เลขที่ / No.", q.quotationNo);
  setLabelValueRow_(sheet, 7, 6, 7, "วันที่ / Date", q.quotationDate);
  setLabelValueRow_(sheet, 8, 1, 2, "ลูกค้า / Customer", q.customer.name || q.customer.company || "");
  setLabelValueRow_(sheet, 8, 6, 7, "โครงการ / Project", q.projectName || "");
  setLabelValueRow_(sheet, 9, 1, 2, "บริษัท / Company", q.customer.company || "");
  setLabelValueRow_(sheet, 9, 6, 7, "ผู้ติดต่อ / Contact", q.customer.contactPerson || "");
  setLabelValueRow_(sheet, 10, 1, 2, "ที่อยู่ / Address", q.customer.address || "");
  setLabelValueRow_(sheet, 10, 6, 7, "โทร / Phone", q.customer.phone || "");
  setLabelValueRow_(sheet, 11, 1, 2, "Tax ID", q.customer.taxId || "");
  setLabelValueRow_(sheet, 11, 6, 7, "Email", q.customer.email || "");

  var itemHeaderRow = 13;
  var headers = ["ลำดับ\nNo.", "รูป\nImage", "รายละเอียดสินค้า / บริการ\nDescription", "รหัส\nRef.", "จำนวน\nQty", "หน่วย\nUnit", "ราคาต่อหน่วย\nUnit Price", "จำนวนเงิน\nAmount", "ต้นทุน/หน่วย\nUnit Cost", "ต้นทุนรวม\nItem Cost"];
  sheet.getRange(itemHeaderRow, 1, 1, 10).setValues([headers]).setBackground("#0f766e").setFontColor("#ffffff").setFontWeight("bold").setHorizontalAlignment("center").setWrap(true);
  sheet.setRowHeight(itemHeaderRow, 42);

  var itemStart = itemHeaderRow + 1;
  var itemCount = Math.max(q.items.length, 1);
  var i;
  for (i = 0; i < itemCount; i += 1) {
    var row = itemStart + i;
    var item = q.items[i] || {};
    sheet.getRange(row, 1, 1, 10).setValues([[
      i + 1,
      safeSpreadsheetText_(item.imageUrl || ""),
      safeSpreadsheetText_(item.description || item.productName || ""),
      safeSpreadsheetText_(item.productRef || ""),
      Number(item.quantity || 0),
      safeSpreadsheetText_(item.unit || ""),
      Number(item.unitPrice || 0),
      "",
      Number(item.unitCost || 0),
      ""
    ]]);
    sheet.getRange(row, 8).setFormula("=ROUND(E" + row + "*G" + row + ",2)");
    sheet.getRange(row, 10).setFormula("=ROUND(E" + row + "*I" + row + ",2)");
    sheet.getRange(row, 1, 1, 10).setBorder(true, true, true, true, true, true, "#cbd5e1", SpreadsheetApp.BorderStyle.SOLID).setWrap(true);
    sheet.getRange(row, 5, 1, 6).setNumberFormat("#,##0.00");
    sheet.setRowHeight(row, 68);
    if (item.imageFileId) insertQuotationProductImage_(sheet, item.imageFileId, row);
  }
  var itemEnd = itemStart + itemCount - 1;

  var costTitleRow = itemEnd + 2;
  sheet.getRange(costTitleRow, 1, 1, 10).merge();
  sheet.getRange(costTitleRow, 1).setValue("วิเคราะห์ต้นทุน / COST ANALYSIS").setBackground("#e2e8f0").setFontWeight("bold").setFontColor("#0f172a");
  var costHeaderRow = costTitleRow + 1;
  sheet.getRange(costHeaderRow, 1, 1, 10).setValues([["No.", "Description", "", "", "", "", "Proposed Cost", "SB Cost", "Note", ""]]).setBackground("#f1f5f9").setFontWeight("bold").setHorizontalAlignment("center");
  var costStart = costHeaderRow + 1;
  var costCount = Math.max(q.costNotes.length, 1);
  for (i = 0; i < costCount; i += 1) {
    var costRow = costStart + i;
    var costNote = q.costNotes[i] || {};
    sheet.getRange(costRow, 1, 1, 10).setValues([[
      i + 1,
      safeSpreadsheetText_(costNote.description || ""), "", "", "", "",
      Number(costNote.proposedCost || 0),
      Number(costNote.sbCost || 0),
      safeSpreadsheetText_(costNote.note || ""), ""
    ]]);
    sheet.getRange(costRow, 1, 1, 10).setBorder(true, true, true, true, true, true, "#e2e8f0", SpreadsheetApp.BorderStyle.SOLID).setWrap(true);
    sheet.getRange(costRow, 7, 1, 2).setNumberFormat("#,##0.00");
  }
  var costEnd = costStart + costCount - 1;

  var totalsStart = costEnd + 2;
  setTotalFormulaRow_(sheet, totalsStart, "ยอดก่อน VAT / SUBTOTAL", "=ROUND(SUM(H" + itemStart + ":H" + itemEnd + "),2)", false);
  setTotalFormulaRow_(sheet, totalsStart + 1, "VAT " + q.vatPercent + "%", "=ROUND(J" + totalsStart + "*" + Number(q.vatPercent) + "/100,2)", false);
  setTotalFormulaRow_(sheet, totalsStart + 2, "ยอดสุทธิ / GRAND TOTAL", "=ROUND(J" + totalsStart + "+J" + (totalsStart + 1) + ",2)", true);
  var totalCostFormula = q.costBasis === "SB_COST_NOTES" ?
    "=ROUND(SUM(H" + costStart + ":H" + costEnd + "),2)" :
    "=ROUND(SUM(J" + itemStart + ":J" + itemEnd + "),2)";
  setTotalFormulaRow_(sheet, totalsStart + 3, "ต้นทุนรวม / TOTAL COST", totalCostFormula, false);
  setTotalFormulaRow_(sheet, totalsStart + 4, "กำไรขั้นต้น / GROSS PROFIT", "=ROUND(J" + totalsStart + "-J" + (totalsStart + 3) + ",2)", false);
  setTotalFormulaRow_(sheet, totalsStart + 5, "GP %", "=IFERROR(ROUND(J" + (totalsStart + 4) + "/J" + totalsStart + "*100,2),0)", true);

  var noteRow = totalsStart + 8;
  sheet.getRange(noteRow, 1, 1, 10).merge();
  sheet.getRange(noteRow, 1).setValue("หมายเหตุ / NOTE").setBackground("#e2e8f0").setFontWeight("bold");
  sheet.getRange(noteRow + 1, 1, 2, 10).merge();
  sheet.getRange(noteRow + 1, 1).setValue(safeSpreadsheetText_(q.note || "-")).setWrap(true).setVerticalAlignment("top");

  var termsRow = noteRow + 4;
  sheet.getRange(termsRow, 1, 1, 10).merge();
  sheet.getRange(termsRow, 1).setValue("เงื่อนไข / TERMS").setBackground("#e2e8f0").setFontWeight("bold");
  var termsText = [
    "Validity / อายุใบเสนอราคา: " + q.terms.validityDays + " days",
    "Payment / การชำระเงิน: " + (q.terms.paymentTerms || "-"),
    "Delivery / การส่งมอบ: " + (q.terms.deliveryTerms || "-")
  ].join("\n");
  sheet.getRange(termsRow + 1, 1, 3, 10).merge();
  sheet.getRange(termsRow + 1, 1).setValue(safeSpreadsheetText_(termsText)).setWrap(true).setVerticalAlignment("top");

  var attachmentRow = termsRow + 5;
  sheet.getRange(attachmentRow, 1, 1, 10).merge();
  sheet.getRange(attachmentRow, 1).setValue("เอกสารแนบ / ATTACHMENTS").setBackground("#e2e8f0").setFontWeight("bold");
  if (q.attachments.length) {
    for (i = 0; i < q.attachments.length; i += 1) {
      sheet.getRange(attachmentRow + 1 + i, 1, 1, 10).merge();
      sheet.getRange(attachmentRow + 1 + i, 1).setValue(safeSpreadsheetText_((i + 1) + ". " + q.attachments[i].name + (q.attachments[i].url ? " — " + q.attachments[i].url : ""))).setWrap(true);
    }
  } else {
    sheet.getRange(attachmentRow + 1, 1, 1, 10).merge();
    sheet.getRange(attachmentRow + 1, 1).setValue("-");
  }

  var lastRow = attachmentRow + Math.max(q.attachments.length, 1) + 2;
  sheet.getRange(lastRow, 1, 1, 10).merge();
  sheet.getRange(lastRow, 1).setValue("Generated by SB Connect • " + nowIso_()).setFontColor("#64748b").setFontSize(8).setHorizontalAlignment("center");
  sheet.setFrozenRows(itemHeaderRow);
}

// Customer-facing sheet: intentionally contains no internal unit cost, item
// cost, SB cost, gross profit, GP%, or cost-analysis section.
function buildCustomerQuotationSheet_(ss, q) {
  var sheet = ss.insertSheet("Customer Quotation");
  sheet.setHiddenGridlines(true);
  sheet.setTabColor("#2563eb");
  sheet.getRange("A:H").setFontFamily("Sarabun").setFontSize(10).setVerticalAlignment("middle");
  var widths = [45, 95, 270, 95, 65, 70, 105, 120];
  var column;
  for (column = 1; column <= widths.length; column += 1) sheet.setColumnWidth(column, widths[column - 1]);

  var companyName = prop("QUOTATION_COMPANY_NAME", "SB INTERLAB CO., LTD.");
  var companyAddress = prop("QUOTATION_COMPANY_ADDRESS", "");
  var companyPhone = prop("QUOTATION_COMPANY_PHONE", "");
  var companyTaxId = prop("QUOTATION_COMPANY_TAX_ID", "");
  var logoFileId = prop("QUOTATION_LOGO_FILE_ID", "");

  sheet.getRange("C1:H2").merge();
  sheet.getRange("C1").setValue("ใบเสนอราคา / QUOTATION").setFontSize(22).setFontWeight("bold").setFontColor("#1d4ed8").setHorizontalAlignment("right");
  sheet.getRange("C3:H3").merge();
  sheet.getRange("C3").setValue(safeSpreadsheetText_(companyName)).setFontSize(14).setFontWeight("bold").setHorizontalAlignment("right");
  sheet.getRange("C4:H4").merge();
  sheet.getRange("C4").setValue(safeSpreadsheetText_(companyAddress)).setHorizontalAlignment("right");
  sheet.getRange("C5:H5").merge();
  sheet.getRange("C5").setValue(safeSpreadsheetText_([companyPhone ? "Tel: " + companyPhone : "", companyTaxId ? "Tax ID: " + companyTaxId : ""].filter(function(value) { return !!value; }).join("  |  "))).setHorizontalAlignment("right");
  if (logoFileId) insertTrustedLogo_(sheet, logoFileId);

  setCustomerLabelValueRow_(sheet, 7, 1, 2, 3, "เลขที่ / No.", q.quotationNo);
  setCustomerLabelValueRow_(sheet, 7, 5, 6, 3, "วันที่ / Date", q.quotationDate);
  setCustomerLabelValueRow_(sheet, 8, 1, 2, 3, "ลูกค้า / Customer", q.customer.name || q.customer.company || "");
  setCustomerLabelValueRow_(sheet, 8, 5, 6, 3, "โครงการ / Project", q.projectName || "");
  setCustomerLabelValueRow_(sheet, 9, 1, 2, 3, "บริษัท / Company", q.customer.company || "");
  setCustomerLabelValueRow_(sheet, 9, 5, 6, 3, "ผู้ติดต่อ / Contact", q.customer.contactPerson || "");
  setCustomerLabelValueRow_(sheet, 10, 1, 2, 3, "ที่อยู่ / Address", q.customer.address || "");
  setCustomerLabelValueRow_(sheet, 10, 5, 6, 3, "โทร / Phone", q.customer.phone || "");
  setCustomerLabelValueRow_(sheet, 11, 1, 2, 3, "Tax ID", q.customer.taxId || "");
  setCustomerLabelValueRow_(sheet, 11, 5, 6, 3, "Email", q.customer.email || "");

  var itemHeaderRow = 13;
  var headers = ["ลำดับ\nNo.", "รูป\nImage", "รายละเอียดสินค้า / บริการ\nDescription", "รหัส\nRef.", "จำนวน\nQty", "หน่วย\nUnit", "ราคาต่อหน่วย\nUnit Price", "จำนวนเงิน\nAmount"];
  sheet.getRange(itemHeaderRow, 1, 1, 8).setValues([headers]).setBackground("#1d4ed8").setFontColor("#ffffff").setFontWeight("bold").setHorizontalAlignment("center").setWrap(true);
  sheet.setRowHeight(itemHeaderRow, 42);

  var itemStart = itemHeaderRow + 1;
  var itemCount = Math.max(q.items.length, 1);
  var i;
  for (i = 0; i < itemCount; i += 1) {
    var row = itemStart + i;
    var item = q.items[i] || {};
    sheet.getRange(row, 1, 1, 8).setValues([[
      i + 1,
      safeSpreadsheetText_(item.imageUrl || ""),
      safeSpreadsheetText_(item.description || item.productName || ""),
      safeSpreadsheetText_(item.productRef || ""),
      Number(item.quantity || 0),
      safeSpreadsheetText_(item.unit || ""),
      Number(item.unitPrice || 0),
      ""
    ]]);
    sheet.getRange(row, 8).setFormula("=ROUND(E" + row + "*G" + row + ",2)");
    sheet.getRange(row, 1, 1, 8).setBorder(true, true, true, true, true, true, "#cbd5e1", SpreadsheetApp.BorderStyle.SOLID).setWrap(true);
    sheet.getRange(row, 5, 1, 4).setNumberFormat("#,##0.00");
    sheet.setRowHeight(row, 68);
    if (item.imageFileId) insertQuotationProductImage_(sheet, item.imageFileId, row);
  }
  var itemEnd = itemStart + itemCount - 1;
  var totalsStart = itemEnd + 2;
  setCustomerTotalFormulaRow_(sheet, totalsStart, "ยอดก่อน VAT / SUBTOTAL", "=ROUND(SUM(H" + itemStart + ":H" + itemEnd + "),2)", false);
  setCustomerTotalFormulaRow_(sheet, totalsStart + 1, "VAT " + q.vatPercent + "%", "=ROUND(H" + totalsStart + "*" + Number(q.vatPercent) + "/100,2)", false);
  setCustomerTotalFormulaRow_(sheet, totalsStart + 2, "ยอดสุทธิ / GRAND TOTAL", "=ROUND(H" + totalsStart + "+H" + (totalsStart + 1) + ",2)", true);

  var noteRow = totalsStart + 5;
  sheet.getRange(noteRow, 1, 1, 8).merge();
  sheet.getRange(noteRow, 1).setValue("หมายเหตุ / NOTE").setBackground("#dbeafe").setFontWeight("bold");
  sheet.getRange(noteRow + 1, 1, 2, 8).merge();
  sheet.getRange(noteRow + 1, 1).setValue(safeSpreadsheetText_(q.note || "-")).setWrap(true).setVerticalAlignment("top");

  var termsRow = noteRow + 4;
  sheet.getRange(termsRow, 1, 1, 8).merge();
  sheet.getRange(termsRow, 1).setValue("เงื่อนไข / TERMS").setBackground("#dbeafe").setFontWeight("bold");
  var termsText = [
    "Validity / อายุใบเสนอราคา: " + q.terms.validityDays + " days",
    "Payment / การชำระเงิน: " + (q.terms.paymentTerms || "-"),
    "Delivery / การส่งมอบ: " + (q.terms.deliveryTerms || "-")
  ].join("\n");
  sheet.getRange(termsRow + 1, 1, 3, 8).merge();
  sheet.getRange(termsRow + 1, 1).setValue(safeSpreadsheetText_(termsText)).setWrap(true).setVerticalAlignment("top");

  var footerRow = termsRow + 5;
  sheet.getRange(footerRow, 1, 1, 8).merge();
  sheet.getRange(footerRow, 1).setValue("Generated by SB Connect • " + nowIso_()).setFontColor("#64748b").setFontSize(8).setHorizontalAlignment("center");
  sheet.setFrozenRows(itemHeaderRow);
  return sheet;
}

function setCustomerLabelValueRow_(sheet, row, labelColumn, valueColumn, valueWidth, label, value) {
  sheet.getRange(row, labelColumn).setValue(label).setFontWeight("bold").setFontColor("#475569");
  sheet.getRange(row, valueColumn, 1, valueWidth).merge();
  sheet.getRange(row, valueColumn).setValue(safeSpreadsheetText_(value || "-")).setWrap(true);
}

function setCustomerTotalFormulaRow_(sheet, row, label, formula, strong) {
  sheet.getRange(row, 6, 1, 2).merge();
  sheet.getRange(row, 6).setValue(label).setFontWeight("bold").setHorizontalAlignment("right");
  sheet.getRange(row, 8).setFormula(formula).setNumberFormat("#,##0.00").setFontWeight("bold");
  if (strong) sheet.getRange(row, 6, 1, 3).setBackground("#dbeafe").setFontColor("#1e3a8a");
}

function setLabelValueRow_(sheet, row, labelStart, valueStart, label, value) {
  sheet.getRange(row, labelStart).setValue(label).setFontWeight("bold").setFontColor("#475569");
  sheet.getRange(row, valueStart, 1, 4).merge();
  sheet.getRange(row, valueStart).setValue(safeSpreadsheetText_(value || "-")).setWrap(true);
}

function setTotalFormulaRow_(sheet, row, label, formula, strong) {
  sheet.getRange(row, 8, 1, 2).merge();
  sheet.getRange(row, 8).setValue(label).setFontWeight("bold").setHorizontalAlignment("right");
  sheet.getRange(row, 10).setFormula(formula).setNumberFormat("#,##0.00").setFontWeight("bold");
  if (strong) sheet.getRange(row, 8, 1, 3).setBackground("#ccfbf1").setFontColor("#115e59");
}

function insertTrustedLogo_(sheet, fileId) {
  try {
    var file = DriveApp.getFileById(fileId);
    var mime = String(file.getMimeType() || "").toLowerCase();
    if (mime.indexOf("image/") !== 0) return;
    sheet.insertImage(file.getBlob(), 1, 1).setWidth(120).setHeight(70);
  } catch (err) {
    // Optional configured logo should never block report generation.
  }
}

function insertQuotationProductImage_(sheet, fileId, row) {
  try {
    var file = DriveApp.getFileById(String(fileId));
    if (!fileIsInQuotationFolder_(file)) return;
    var mime = String(file.getMimeType() || "").toLowerCase();
    if (mime.indexOf("image/") !== 0) return;
    sheet.insertImage(file.getBlob(), 2, row).setWidth(75).setHeight(55);
  } catch (err) {
    // Missing/unsupported product image is rendered as its URL text only.
  }
}

function fileIsInQuotationFolder_(file) {
  var expected = prop("FOLDER_QUOTATION_ID", DEFAULT_QUOTATION_FOLDER_ID);
  var parents = file.getParents();
  while (parents.hasNext()) {
    if (parents.next().getId() === expected) return true;
  }
  return false;
}

function exportSpreadsheetBlob_(ss, format, mimeType, fileName, targetSheet) {
  var gid = (targetSheet || ss.getSheets()[0]).getSheetId();
  var url = "https://docs.google.com/spreadsheets/d/" + ss.getId() + "/export?format=" + encodeURIComponent(format);
  if (format === "pdf") {
    url += "&size=A4&portrait=false&fitw=true&sheetnames=false&printtitle=false&pagenumbers=true&gridlines=false&fzr=true&single=true&gid=" + gid;
  }
  var response = UrlFetchApp.fetch(url, {
    headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  });
  var code = response.getResponseCode();
  if (code < 200 || code >= 300) throw new Error("Report export failed (" + format + ", HTTP " + code + ")");
  return response.getBlob().setContentType(mimeType).setName(fileName);
}

function artifactForFile_(file) {
  var id = file.getId();
  return {
    fileId: id,
    file_id: id,
    name: file.getName(),
    viewUrl: driveViewUrl_(id),
    view_url: driveViewUrl_(id),
    downloadUrl: driveDownloadUrl_(id),
    download_url: driveDownloadUrl_(id)
  };
}

function quotationArtifactFileRef_(quotation, artifact, format) {
  artifact = artifact && typeof artifact === "object" ? artifact : {};
  var fileId = String(artifact.fileId || artifact.file_id || "");
  var viewUrl = String(artifact.viewUrl || artifact.view_url || artifact.url || "");
  var directUrl = String(artifact.downloadUrl || artifact.download_url || artifact.directUrl || artifact.direct_url || viewUrl);
  if (!fileId && !viewUrl && !directUrl) return null;

  var isPdf = format === "pdf";
  var extension = isPdf ? "pdf" : "xlsx";
  var mimeType = isPdf
    ? "application/pdf"
    : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  var fileName = String(artifact.name || artifact.fileName || artifact.file_name ||
    ((quotation.quotationNo || quotation.quotation_no || "quotation") + "." + extension));
  return {
    fileId: fileId,
    file_id: fileId,
    fileName: fileName,
    file_name: fileName,
    name: fileName,
    mimeType: mimeType,
    mime_type: mimeType,
    kind: isPdf ? "quotation_pdf" : "quotation_xlsx",
    url: viewUrl || directUrl,
    viewUrl: viewUrl || directUrl,
    view_url: viewUrl || directUrl,
    directUrl: directUrl,
    direct_url: directUrl,
    downloadUrl: directUrl,
    download_url: directUrl,
    createdAt: String(quotation.updatedAt || quotation.updated_at || ""),
    created_at: String(quotation.updatedAt || quotation.updated_at || "")
  };
}

function attachArtifactsToQuotation_(quotation, artifacts) {
  artifacts = artifacts || { pdf: {}, xlsx: {} };
  quotation.artifacts = artifacts;
  quotation.pdfFileId = artifacts.pdf && artifacts.pdf.fileId || "";
  quotation.pdf_file_id = quotation.pdfFileId;
  quotation.pdfUrl = artifacts.pdf && artifacts.pdf.viewUrl || "";
  quotation.pdf_url = quotation.pdfUrl;
  quotation.xlsxFileId = artifacts.xlsx && artifacts.xlsx.fileId || "";
  quotation.xlsx_file_id = quotation.xlsxFileId;
  quotation.xlsxUrl = artifacts.xlsx && artifacts.xlsx.viewUrl || "";
  quotation.xlsx_url = quotation.xlsxUrl;

  // Persist only the report pair currently tracked by the quotation index.
  // Incoming/legacy `files` arrays may point at report versions that have just
  // been trashed during regeneration, so they must never win on the next read.
  var currentFiles = [
    quotationArtifactFileRef_(quotation, artifacts.pdf, "pdf"),
    quotationArtifactFileRef_(quotation, artifacts.xlsx, "xlsx")
  ].filter(function(file) { return file !== null; });
  quotation.files = currentFiles;
  quotation.reportFiles = cloneJson_(currentFiles);
  quotation.report_files = cloneJson_(currentFiles);
  artifacts.files = cloneJson_(currentFiles);
}

function quotationSuccessResponse_(action, quotation, artifacts, idempotent, sync) {
  var response = {
    status: "success",
    ok: true,
    action: action,
    idempotent: idempotent === true,
    quotation: quotation,
    quotation_id: quotation.quotationId,
    quotation_no: quotation.quotationNo,
    totals: quotation.totals,
    artifacts: artifacts,
    pdf: artifacts.pdf,
    xlsx: artifacts.xlsx
  };
  attachQuotationSyncWarning_(response, sync);
  return jsonOutput(response);
}

function getQuotationIndexSpreadsheet_() {
  var storedId = prop(QUOTATION_INDEX_PROPERTY);
  var ss = null;
  if (storedId) {
    try {
      ss = SpreadsheetApp.openById(storedId);
    } catch (err) {
      scriptProps().deleteProperty(QUOTATION_INDEX_PROPERTY);
    }
  }
  if (!ss) {
    var folder = DriveApp.getFolderById(prop("FOLDER_QUOTATION_ID", DEFAULT_QUOTATION_FOLDER_ID));
    ss = SpreadsheetApp.create("SBConnect_Quotation_Index");
    DriveApp.getFileById(ss.getId()).moveTo(folder);
    scriptProps().setProperty(QUOTATION_INDEX_PROPERTY, ss.getId());
  }
  ensureQuotationIndexSheet_(ss);
  return ss;
}

function ensureQuotationIndexSheet_(ss) {
  var sheet = ss.getSheetByName(QUOTATION_INDEX_TAB);
  if (!sheet) {
    var first = ss.getSheets()[0];
    if (first && first.getLastRow() === 0) {
      first.setName(QUOTATION_INDEX_TAB);
      sheet = first;
    } else {
      sheet = ss.insertSheet(QUOTATION_INDEX_TAB);
    }
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, QUOTATION_INDEX_HEADERS.length).setValues([QUOTATION_INDEX_HEADERS]);
  } else {
    var existing = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0].map(function(value) { return String(value || "").trim(); });
    var missing = QUOTATION_INDEX_HEADERS.filter(function(header) { return existing.indexOf(header) < 0; });
    if (missing.length) sheet.getRange(1, existing.length + 1, 1, missing.length).setValues([missing]);
  }
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, sheet.getLastColumn()).setBackground("#0f766e").setFontColor("#ffffff").setFontWeight("bold");
  return sheet;
}

function quotationIndexSheet_() {
  return ensureQuotationIndexSheet_(getQuotationIndexSpreadsheet_());
}

function quotationIndexHeaders_(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(value) { return String(value || "").trim(); });
}

function getQuotationRecords_() {
  var sheet = quotationIndexSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var headers = quotationIndexHeaders_(sheet);
  var values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return values.filter(function(row) {
    return String(row[headers.indexOf("quotation_id")] || "").trim() !== "";
  }).map(function(row, index) {
    var record = { _rowNumber: index + 2 };
    headers.forEach(function(header, col) { if (header) record[header] = row[col]; });
    return record;
  });
}

function findQuotationRecord_(key) {
  var target = String(key || "").trim();
  var rows = getQuotationRecords_();
  var i;
  for (i = 0; i < rows.length; i += 1) {
    if (String(rows[i].quotation_id) === target || String(rows[i].quotation_no) === target) return rows[i];
  }
  return null;
}

function findQuotationRecordByClientRequestId_(clientRequestId) {
  var target = String(clientRequestId || "").trim();
  if (!target) return null;
  var rows = getQuotationRecords_();
  var i;
  for (i = 0; i < rows.length; i += 1) {
    if (String(rows[i].client_request_id || "") === target) return rows[i];
  }
  return null;
}

function appendQuotationRecord_(q, artifacts, now) {
  var sheet = quotationIndexSheet_();
  var headers = quotationIndexHeaders_(sheet);
  var obj = quotationRecordObject_(q, artifacts, now);
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, headers.length).setValues([headers.map(function(header) {
    return indexCellValue_(header, obj[header]);
  })]);
}

function updateQuotationRecord_(rowNumber, q, artifacts, now) {
  var sheet = quotationIndexSheet_();
  var headers = quotationIndexHeaders_(sheet);
  var obj = quotationRecordObject_(q, artifacts, now);
  var previous = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
  var attemptsColumn = headers.indexOf("sql_sync_attempts");
  var syncVersionColumn = headers.indexOf("sql_sync_version");
  var syncedAtColumn = headers.indexOf("sql_synced_at");
  if (attemptsColumn >= 0) obj.sql_sync_attempts = Number(previous[attemptsColumn] || 0);
  if (syncVersionColumn >= 0) obj.sql_sync_version = Number(previous[syncVersionColumn] || 0);
  if (syncedAtColumn >= 0) obj.sql_synced_at = String(previous[syncedAtColumn] || "");
  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([headers.map(function(header) {
    return indexCellValue_(header, obj[header]);
  })]);
}

function updateQuotationIndexFields_(rowNumber, patch) {
  var sheet = quotationIndexSheet_();
  var headers = quotationIndexHeaders_(sheet);
  var range = sheet.getRange(rowNumber, 1, 1, headers.length);
  var row = range.getValues()[0];
  Object.keys(patch || {}).forEach(function(header) {
    var column = headers.indexOf(header);
    if (column >= 0) row[column] = indexCellValue_(header, patch[header]);
  });
  range.setValues([row]);
}

function quotationRecordObject_(q, artifacts, now) {
  var payloadJson = JSON.stringify(q);
  assertJsonSize_(payloadJson);
  return {
    quotation_id: q.quotationId,
    quotation_no: q.quotationNo,
    client_request_id: q.clientRequestId || q.client_request_id || "",
    status: q.status,
    revision: q.revision,
    created_at: q.createdAt,
    updated_at: q.updatedAt,
    created_by_emp_id: q.createdByEmpId,
    updated_by_emp_id: q.updatedByEmpId,
    customer_name: q.customer.name,
    customer_company: q.customer.company,
    project_name: q.projectName,
    currency: q.currency,
    subtotal: q.subtotal,
    vat_percent: q.vatPercent,
    vat_amount: q.vatAmount,
    grand_total: q.grandTotal,
    proposed_cost: q.proposedCost,
    total_cost: q.totalCost,
    gross_profit: q.grossProfit,
    gp_percent: q.gpPercent,
    payload_json: payloadJson,
    pdf_file_id: artifacts.pdf.fileId,
    pdf_view_url: artifacts.pdf.viewUrl,
    pdf_download_url: artifacts.pdf.downloadUrl,
    xlsx_file_id: artifacts.xlsx.fileId,
    xlsx_view_url: artifacts.xlsx.viewUrl,
    xlsx_download_url: artifacts.xlsx.downloadUrl,
    report_version: q.reportVersion,
    last_report_at: now,
    source_version: Number(q.sourceVersion || q.source_version || 1),
    sql_sync_status: "PENDING",
    sql_sync_version: 0,
    sql_sync_error: "",
    sql_synced_at: "",
    sql_sync_attempts: 0
  };
}

function indexCellValue_(header, value) {
  var numeric = ["revision", "subtotal", "vat_percent", "vat_amount", "grand_total", "proposed_cost", "total_cost", "gross_profit", "gp_percent", "report_version", "source_version", "sql_sync_version", "sql_sync_attempts"];
  if (numeric.indexOf(header) >= 0) return Number(value || 0);
  return safeSpreadsheetText_(value === null || value === undefined ? "" : String(value));
}

function quotationSummaryFromRecord_(row) {
  var payload = {};
  try {
    payload = JSON.parse(String(row.payload_json || "{}")) || {};
  } catch (err) {
    payload = {};
  }
  var customer = payload.customer && typeof payload.customer === "object" ? payload.customer : {};
  var items = Array.isArray(payload.items) ? payload.items : (Array.isArray(payload.quotation_items) ? payload.quotation_items : []);
  var quotationDate = String(payload.quotationDate || payload.quotation_date || "");
  var revision = Number(hasDefinedValue_(payload.revision) ? payload.revision : row.revision || 0);
  var createdByName = String(payload.createdByName || payload.created_by_name || row.created_by_emp_id || "");
  return {
    quotationId: String(row.quotation_id || ""),
    quotation_id: String(row.quotation_id || ""),
    quotationNo: String(row.quotation_no || ""),
    quotation_no: String(row.quotation_no || ""),
    status: String(row.status || "DRAFT"),
    revision: revision,
    quotationDate: quotationDate,
    quotation_date: quotationDate,
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || ""),
    createdByEmpId: String(row.created_by_emp_id || ""),
    created_by_emp_id: String(row.created_by_emp_id || ""),
    createdByName: createdByName,
    created_by_name: createdByName,
    customerName: String(row.customer_name || ""),
    customerCompany: String(row.customer_company || ""),
    customer: {
      name: String(customer.name || row.customer_name || ""),
      company: String(customer.company || row.customer_company || ""),
      address: String(customer.address || ""),
      phone: String(customer.phone || ""),
      email: String(customer.email || ""),
      taxId: String(customer.taxId || customer.tax_id || ""),
      contactPerson: String(customer.contactPerson || customer.contact_person || "")
    },
    projectName: String(row.project_name || ""),
    currency: String(row.currency || "THB"),
    subtotal: Number(row.subtotal || 0),
    vatPercent: Number(row.vat_percent || 0),
    vatAmount: Number(row.vat_amount || 0),
    grandTotal: Number(row.grand_total || 0),
    totalCost: Number(row.total_cost || 0),
    grossProfit: Number(row.gross_profit || 0),
    gpPercent: Number(row.gp_percent || 0),
    itemCount: items.length,
    item_count: items.length,
    reportVersion: Number(row.report_version || 0),
    artifacts: artifactsFromRecord_(row)
  };
}

function artifactsFromRecord_(row) {
  return {
    pdf: {
      fileId: String(row.pdf_file_id || ""),
      file_id: String(row.pdf_file_id || ""),
      viewUrl: String(row.pdf_view_url || ""),
      view_url: String(row.pdf_view_url || ""),
      downloadUrl: String(row.pdf_download_url || ""),
      download_url: String(row.pdf_download_url || "")
    },
    xlsx: {
      fileId: String(row.xlsx_file_id || ""),
      file_id: String(row.xlsx_file_id || ""),
      viewUrl: String(row.xlsx_view_url || ""),
      view_url: String(row.xlsx_view_url || ""),
      downloadUrl: String(row.xlsx_download_url || ""),
      download_url: String(row.xlsx_download_url || "")
    }
  };
}

function parseQuotationPayload_(text) {
  try {
    var parsed = JSON.parse(String(text || "{}"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (err) {
    throw new Error("Stored quotation payload is invalid");
  }
}

function quotationClientRequestId_(body, actor) {
  var quotation = body.quotation && typeof body.quotation === "object" ? body.quotation : {};
  var supplied = String(
    body.clientRequestId || body.client_request_id || body.requestId || body.request_id ||
    quotation.clientRequestId || quotation.client_request_id || ""
  ).trim();
  var requestMaterial = supplied ? "supplied:" + supplied.slice(0, 500) : "derived:" + JSON.stringify(quotation);
  var digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(actor.emp_id || "") + "|" + requestMaterial,
    Utilities.Charset.UTF_8
  );
  return "CR-" + digest.map(function(value) {
    var normalized = value < 0 ? value + 256 : value;
    var hex = normalized.toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  }).join("");
}

function quotationCreateReservationKey_(clientRequestId) {
  return "QUOTATION_CREATE_RESERVATION_" + String(clientRequestId || "").slice(0, 100);
}

function readCreateReservation_(key) {
  if (!key) return null;
  var raw = scriptProps().getProperty(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function cleanupStaleCreateReservationsNoLock_() {
  var properties = scriptProps().getProperties();
  var now = new Date().getTime();
  Object.keys(properties).forEach(function(key) {
    if (key.indexOf("QUOTATION_CREATE_RESERVATION_") !== 0) return;
    var value;
    try { value = JSON.parse(properties[key] || "{}"); } catch (err) { value = {}; }
    if (!value.created_ms || now - Number(value.created_ms) >= 10 * 60 * 1000) {
      scriptProps().deleteProperty(key);
    }
  });
}

function clearCreateReservationSafely_(key, quotationId) {
  if (!key) return;
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var reservation = readCreateReservation_(key);
    if (!reservation || !quotationId || String(reservation.quotation_id || "") === String(quotationId)) {
      scriptProps().deleteProperty(key);
    }
  } catch (err) {
    // Stale reservations are cleaned automatically on the next create request.
  } finally {
    try { lock.releaseLock(); } catch (releaseErr) { /* lock was not acquired */ }
  }
}

function quotationRecordSnapshotToken_(record) {
  var material = [
    String(record.quotation_id || ""),
    String(record.updated_at || ""),
    String(record.report_version || ""),
    String(record.pdf_file_id || ""),
    String(record.xlsx_file_id || ""),
    String(record.payload_json || "")
  ].join("|");
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, material, Utilities.Charset.UTF_8);
  return digest.map(function(value) {
    var normalized = value < 0 ? value + 256 : value;
    var hex = normalized.toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  }).join("");
}

function allocateQuotationNoNoLock_() {
  // Caller holds LockService.getScriptLock() for the complete create transaction.
  var timeZone = Session.getScriptTimeZone() || "Asia/Bangkok";
  var christianYear = Number(Utilities.formatDate(new Date(), timeZone, "yyyy"));
  var buddhistYear = christianYear + 543;
  var period = String(buddhistYear).slice(-2) + Utilities.formatDate(new Date(), timeZone, "MM");
  var key = "QUOTATION_SEQUENCE_" + period;
  var last = Number(prop(key, "0")) || 0;
  var rows = getQuotationRecords_();
  var pattern = new RegExp("^Q" + period + "(\\d{4})$");
  rows.forEach(function(row) {
    var match = String(row.quotation_no || "").match(pattern);
    if (match) last = Math.max(last, Number(match[1]) || 0);
  });
  last += 1;
  if (last > 9999) throw new Error("Quotation running number exhausted for " + period);
  scriptProps().setProperty(key, String(last));
  return "Q" + period + padNumber_(last, 4);
}

function checkQuotationSqlSyncHealth_() {
  if (!quotationSqlSyncEnabled_()) return { configured: true, enabled: false, reachable: false, status: "DISABLED" };
  try {
    var response = quotationSupabaseRequest_("quotations?select=quotation_id,source_version&limit=1", "get", null);
    var code = response.getResponseCode();
    return {
      configured: true,
      enabled: true,
      reachable: code >= 200 && code < 300,
      status: code >= 200 && code < 300 ? "READY" : "HTTP_" + code
    };
  } catch (err) {
    return { configured: false, enabled: true, reachable: false, status: "UNAVAILABLE" };
  }
}

// Run once from the Apps Script editor if automatic retry is desired.
function setupQuotationSqlReconcileTrigger() {
  var handler = "reconcileQuotationSupabase";
  var exists = ScriptApp.getProjectTriggers().some(function(trigger) {
    return trigger.getHandlerFunction() === handler || trigger.getHandlerFunction() === "reconcileQuotationSqlSync";
  });
  if (!exists) ScriptApp.newTrigger(handler).timeBased().everyHours(1).create();
  var result = { status: "success", ok: true, handler: handler, created: !exists };
  Logger.log(JSON.stringify(result));
  return result;
}

function setupQuotationSystem() {
  var result = {
    status: "error",
    ok: false,
    folderId: prop("FOLDER_QUOTATION_ID", DEFAULT_QUOTATION_FOLDER_ID),
    indexSheetId: "",
    message: ""
  };
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var folder = DriveApp.getFolderById(result.folderId);
    folder.getName();
    var ss = getQuotationIndexSpreadsheet_();
    ensureQuotationIndexSheet_(ss);
    result.status = "success";
    result.ok = true;
    result.indexSheetId = ss.getId();
    result.message = "Quotation folder and index are ready";
  } catch (err) {
    result.message = safeErrorMessage_(err);
  } finally {
    lock.releaseLock();
  }
  result.sqlSync = checkQuotationSqlSyncHealth_();
  result.sql_sync = result.sqlSync;
  if (result.ok && quotationSqlSyncEnabled_() && !!prop("SUPABASE_URL") && !!prop("SUPABASE_SERVICE_ROLE_KEY")) {
    try {
      result.sqlReconcileTrigger = setupQuotationSqlReconcileTrigger();
    } catch (triggerErr) {
      result.sqlReconcileTrigger = { status: "error", ok: false, message: "TRIGGER_SETUP_FAILED" };
    }
  } else {
    result.sqlReconcileTrigger = { status: "skipped", ok: false, message: "SQL_SYNC_NOT_ENABLED_OR_CONFIGURED" };
  }
  result.sql_reconcile_trigger = result.sqlReconcileTrigger;
  Logger.log(JSON.stringify(result));
  return result;
}

function validateQuotationRequestSize_(quotation) {
  var json = JSON.stringify(quotation || {});
  assertJsonSize_(json);
  rejectEmbeddedBinary_(quotation || {});
}

function assertJsonSize_(json) {
  var bytes = Utilities.newBlob(String(json || "")).getBytes().length;
  if (bytes > QUOTATION_MAX_JSON_BYTES) throw new Error("Quotation payload exceeds 40 KB; upload files separately and keep only metadata/URLs");
}

function rejectEmbeddedBinary_(value) {
  if (!value || typeof value !== "object") return;
  Object.keys(value).forEach(function(key) {
    var lowered = String(key).toLowerCase();
    if (/base64|image_data|file_data|binary/.test(lowered) && value[key]) {
      throw new Error("Embedded file data is not allowed in quotation payload; upload it first");
    }
    if (value[key] && typeof value[key] === "object") rejectEmbeddedBinary_(value[key]);
  });
}

function strictNonNegativeNumber_(value, label, fallback) {
  if (!hasDefinedValue_(value)) return Number(fallback || 0);
  var cleaned = typeof value === "number" ? value : Number(String(value).replace(/,/g, "").trim());
  if (!isFinite(cleaned) || isNaN(cleaned)) throw new Error(label + " must be a valid number");
  if (cleaned < 0) throw new Error(label + " cannot be negative");
  if (cleaned > 999999999999) throw new Error(label + " is too large");
  return cleaned;
}

function nonNegativeInteger_(value, label, fallback) {
  return Math.floor(strictNonNegativeNumber_(value, label, fallback));
}

function moneyRound_(value) {
  var number = Number(value || 0);
  return Math.round((number + (number >= 0 ? 0.000000001 : -0.000000001)) * 100) / 100;
}

function hasDefinedValue_(value) {
  return value !== undefined && value !== null && value !== "";
}

function firstDefined_() {
  var i;
  for (i = 0; i < arguments.length; i += 1) {
    if (hasDefinedValue_(arguments[i])) return arguments[i];
  }
  return undefined;
}

function mergePlainObjects_(base, patch) {
  var out = {};
  var source = base && typeof base === "object" && !Array.isArray(base) ? base : {};
  Object.keys(source).forEach(function(key) { out[key] = cloneValue_(source[key]); });
  var incoming = patch && typeof patch === "object" && !Array.isArray(patch) ? patch : {};
  Object.keys(incoming).forEach(function(key) {
    if (incoming[key] && typeof incoming[key] === "object" && !Array.isArray(incoming[key]) && out[key] && typeof out[key] === "object" && !Array.isArray(out[key])) {
      out[key] = mergePlainObjects_(out[key], incoming[key]);
    } else {
      out[key] = cloneValue_(incoming[key]);
    }
  });
  return out;
}

function cloneValue_(value) {
  if (!value || typeof value !== "object") return value;
  return cloneJson_(value);
}

function cloneJson_(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function makeQuotationId_() {
  return "QTN-" + Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "Asia/Bangkok", "yyyyMMddHHmmss") + "-" + Utilities.getUuid().split("-")[0].toUpperCase();
}

function nowIso_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "Asia/Bangkok", "yyyy-MM-dd'T'HH:mm:ssXXX");
}

function localDateText_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "Asia/Bangkok", "yyyy-MM-dd");
}

function padNumber_(number, size) {
  var text = String(number);
  while (text.length < size) text = "0" + text;
  return text;
}

function limitText_(value, maxLength) {
  return String(value === null || value === undefined ? "" : value).slice(0, maxLength);
}

function safeSpreadsheetText_(value) {
  var text = String(value === null || value === undefined ? "" : value);
  var trimmed = text.replace(/^\s+/, "");
  if (/^[=+\-@]/.test(trimmed)) return "'" + text;
  return text;
}

function applyCustomerQuotationSharing_(file) {
  if (String(prop("QUOTATION_SHARE_MODE", "")).toUpperCase() !== "ANYONE_WITH_LINK") return;
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (err) {
    // Domain/shared-drive policy can disallow public sharing; file still exists.
  }
}

function applyInternalQuotationSharing_(file) {
  if (String(prop("QUOTATION_INTERNAL_SHARE_MODE", "")).toUpperCase() !== "ANYONE_WITH_LINK") return;
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (err) {
    // Internal files remain private if domain/shared-drive policy blocks sharing.
  }
}

function applyQuotationUploadSharing_(file) {
  if (String(prop("QUOTATION_UPLOAD_SHARE_MODE", "")).toUpperCase() !== "ANYONE_WITH_LINK") return;
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (err) {
    // Uploaded files remain private if domain/shared-drive policy blocks sharing.
  }
}

function trashFileSafely_(fileId, keepId) {
  var id = String(fileId || "").trim();
  if (!id || id === String(keepId || "")) return;
  try {
    DriveApp.getFileById(id).setTrashed(true);
  } catch (err) {
    // Stale/missing file references do not invalidate the newly generated report.
  }
}

function trashArtifacts_(artifacts) {
  if (!artifacts) return;
  trashFileSafely_(artifacts.pdf && artifacts.pdf.fileId, "");
  trashFileSafely_(artifacts.xlsx && artifacts.xlsx.fileId, "");
}

function driveViewUrl_(fileId) {
  return fileId ? "https://drive.google.com/file/d/" + encodeURIComponent(fileId) + "/view" : "";
}

function driveDownloadUrl_(fileId) {
  return fileId ? "https://drive.google.com/uc?export=download&id=" + encodeURIComponent(fileId) : "";
}

function safeErrorMessage_(err) {
  var message = err && err.message ? String(err.message) : String(err || "Unknown error");
  return message.slice(0, 1000);
}

function writeQuotationAuditSafe_(action, status, body, quotation, description) {
  try {
    var session = body && body._validatedSession || {};
    var q = quotation || body && body.quotation || {};
    var row = normalizeLogRow({
      action_group: "quotation",
      action: action,
      status: status,
      actor_emp_id: session.emp_id || "",
      target_table: "quotation_index",
      target_id: q.quotationId || q.quotation_id || q.quotationNo || q.quotation_no || "",
      description: description || "",
      metadata: {
        quotation_no: q.quotationNo || q.quotation_no || "",
        role: session.role || ""
      }
    });
    appendRowsToSheet("ALL", [row]);
    appendRowsToSheet("QUOTATIONS", [row]);
  } catch (auditErr) {
    // Audit availability must not destroy an otherwise valid quotation transaction.
  }
}

function writeQuotationUploadAuditSafe_(status, body, details, description) {
  var meta = body && body.meta && typeof body.meta === "object" ? body.meta : {};
  details = details || {};
  var quotation = {
    quotationId: details.quotation_id || meta.quotationId || meta.quotation_id || meta.id || "",
    quotationNo: details.quotation_no || meta.quotationNo || meta.quotation_no || ""
  };
  var bucket = String(details.bucket || body && body.bucket || "quotation_upload");
  var fileId = String(details.file_id || "");
  var message = String(description || "Quotation upload") + " [" + bucket + "]" + (fileId ? " file=" + fileId : "");
  writeQuotationAuditSafe_("quotation_upload", status, body || {}, quotation, message);
}

function appendAuditLog(raw) {
  var row = normalizeLogRow(raw);
  appendRowsToSheet("ALL", [row]);
  appendRowsToSheet(sheetNameForGroup(row[2]), [row]);
  return jsonOutput({ status: "success", ok: true, logged: 1 });
}

function appendAuditLogBatch(logs) {
  if (!Array.isArray(logs)) logs = [];
  var rows = logs.map(normalizeLogRow);
  if (!rows.length) return jsonOutput({ status: "success", ok: true, logged: 0 });
  appendRowsToSheet("ALL", rows);
  var grouped = {};
  rows.forEach(function(row) {
    var sheet = sheetNameForGroup(row[2]);
    if (!grouped[sheet]) grouped[sheet] = [];
    grouped[sheet].push(row);
  });
  Object.keys(grouped).forEach(function(sheet) { appendRowsToSheet(sheet, grouped[sheet]); });
  return jsonOutput({ status: "success", ok: true, logged: rows.length });
}

function normalizeLogRow(log) {
  log = log || {};
  var now = new Date();
  var metadata = scrubObject(log.metadata || log.payload || {});
  return [
    Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss"),
    safeSpreadsheetText_(log.session_id || log.request_id || ""),
    safeSpreadsheetText_(log.action_group || log.group || groupFromAction(log.action || log.rpc || "")),
    safeSpreadsheetText_(log.action || log.rpc || ""),
    safeSpreadsheetText_(log.status || "success"),
    safeSpreadsheetText_(log.actor_emp_id || log.emp_id || ""),
    safeSpreadsheetText_(log.target_emp_id || log.target_id || ""),
    safeSpreadsheetText_(log.target_table || ""),
    safeSpreadsheetText_(log.target_id || ""),
    safeSpreadsheetText_(log.description || log.message || ""),
    safeSpreadsheetText_(JSON.stringify(metadata).slice(0, 45000))
  ];
}

function appendRowsToSheet(sheetName, rows) {
  var ss = SpreadsheetApp.openById(auditSheetId());
  var sheet = getOrCreateSheet(ss, sheetName);
  if (!rows.length) return;
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

function getOrCreateSheet(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["created_at", "session_id", "action_group", "action", "status", "actor_emp_id", "target_emp_id", "target_table", "target_id", "description", "metadata_json"]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function sheetNameForGroup(group) {
  var g = String(group || "system").toLowerCase();
  if (g.indexOf("login") >= 0 || g.indexOf("auth") >= 0) return "AUTH_LOGIN";
  if (g.indexOf("admin") >= 0) return "ADMIN";
  if (g.indexOf("point") >= 0) return "POINTS";
  if (g.indexOf("news") >= 0) return "NEWS";
  if (g.indexOf("mission") >= 0) return "MISSIONS";
  if (g.indexOf("reward") >= 0 || g.indexOf("redeem") >= 0) return "REWARDS";
  if (g.indexOf("quotation") >= 0 || g.indexOf("quote") >= 0) return "QUOTATIONS";
  if (g.indexOf("ranking") >= 0) return "RANKING";
  if (g.indexOf("profile") >= 0) return "PROFILE";
  return "SYSTEM";
}

function groupFromAction(action) {
  var a = String(action || "").toLowerCase();
  if (a.indexOf("login") >= 0 || a.indexOf("session") >= 0) return "auth";
  if (a.indexOf("admin") >= 0) return "admin";
  if (a.indexOf("point") >= 0 || a.indexOf("checkin") >= 0) return "points";
  if (a.indexOf("news") >= 0) return "news";
  if (a.indexOf("mission") >= 0) return "missions";
  if (a.indexOf("reward") >= 0 || a.indexOf("redeem") >= 0) return "rewards";
  if (a.indexOf("quotation") >= 0 || a.indexOf("quote") >= 0) return "quotation";
  if (a.indexOf("ranking") >= 0) return "ranking";
  if (a.indexOf("profile") >= 0 || a.indexOf("avatar") >= 0) return "profile";
  return "system";
}

function scrubObject(obj) {
  var blocked = /password|pass|token|secret|key|authorization|image_base64|base64/i;
  if (!obj || typeof obj !== "object") return obj;
  var out = Array.isArray(obj) ? [] : {};
  Object.keys(obj).forEach(function(k) {
    if (blocked.test(k)) out[k] = "[redacted]";
    else if (obj[k] && typeof obj[k] === "object") out[k] = scrubObject(obj[k]);
    else out[k] = obj[k];
  });
  return out;
}

function legacyTypeToBucket(type) {
  if (type === "profile") return "avatars";
  if (type === "reward") return "rewards";
  if (type === "news") return "news";
  if (type === "mission") return "missions";
  if (type === "quotation" || type === "quotation_pdf") return "quotation_pdf";
  if (type === "quotation_image" || type === "quotation_images") return "quotation_images";
  if (type === "quotation_attachment" || type === "quotation_attachments") return "quotation_attachments";
  return "";
}

function buildLegacyFileName(type, body) {
  var ext = getExt(body.mimeType || body.mime_type || "image/png");
  if (type === "profile") return sanitizeFileName(body.emp_id || "profile") + "." + ext;
  if (type) return type + "_" + sanitizeFileName(body.record_id || body.file_id || Date.now()) + "." + ext;
  return "upload_" + Date.now() + "." + ext;
}

function getExt(mimeType) {
  var type = String(mimeType || "").toLowerCase();
  if (type.indexOf("jpeg") >= 0 || type.indexOf("jpg") >= 0) return "jpg";
  if (type.indexOf("webp") >= 0) return "webp";
  if (type.indexOf("gif") >= 0) return "gif";
  if (type.indexOf("pdf") >= 0) return "pdf";
  if (type.indexOf("spreadsheetml") >= 0) return "xlsx";
  if (type.indexOf("wordprocessingml") >= 0) return "docx";
  return "png";
}

function sanitizeFileName(name) {
  return String(name || "file").replace(/[\\\/:*?"<>|#%{}~&]/g, "_").replace(/\s+/g, "_").slice(0, 120);
}

function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  var folders = driveFolders();
  return jsonOutput({
    status: "success",
    service: "SB Connect Drive Upload + Sheet Audit + Quotation API",
    sheetId: auditSheetId(),
    buckets: Object.keys(folders).filter(function(key) { return !!folders[key]; }),
    logTypes: ["log", "log_batch"],
    quotationFolderConfigured: !!folders.quotation,
    quotationIndexConfigured: !!prop(QUOTATION_INDEX_PROPERTY),
    quotationSessionValidationConfigured: !!prop("SUPABASE_URL") && !!prop("SUPABASE_SERVICE_ROLE_KEY"),
    quotationSqlSyncConfigured: !!prop("SUPABASE_URL") && !!prop("SUPABASE_SERVICE_ROLE_KEY"),
    quotationSqlSyncEnabled: quotationSqlSyncEnabled_(),
    quotationActions: QUOTATION_ACTIONS.slice(0),
    quotationBuckets: ["quotation", "quotations", "quotation_pdf", "quotation_images", "quotation_attachments"]
  });
}

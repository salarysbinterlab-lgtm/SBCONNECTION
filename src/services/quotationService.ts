import { getConfig, getCurrentUser, getToken } from '../helpers/api';

export type QuotationUploadKind = 'quotation_images' | 'quotation_attachments';

export interface QuotationFileRef {
  fileId: string;
  fileName: string;
  mimeType: string;
  kind: string;
  url: string;
  viewUrl: string;
  directUrl: string;
  createdAt: string;
}

export type QuotationReportFileRef = QuotationFileRef;

export interface QuotationAttachment {
  fileId: string;
  fileName: string;
  mimeType: string;
  viewUrl: string;
  directUrl: string;
  kind: string;
}

export interface QuotationItem {
  id: string;
  lineNo: number;
  productId: string;
  productRef: string;
  productName: string;
  description: string;
  pictureFileId: string;
  pictureUrl: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  amount: number;
  unitCost: number;
  costAmount: number;
  remark: string;
}

export interface QuotationCostNote {
  id: string;
  lineNo: number;
  description: string;
  proposedCost: number;
  sbCost: number;
  gpPercent: number;
  note: string;
}

export interface QuotationCustomer {
  id: string;
  code: string;
  name: string;
  branch: string;
  address: string;
  phone: string;
  email: string;
  taxId: string;
  contactPerson: string;
  note: string;
}

export interface QuotationTotals {
  subtotal: number;
  vatPercent: number;
  vatAmount: number;
  grandTotal: number;
  totalProposedCost: number;
  totalItemCost: number;
  totalCost: number;
  grossProfit: number;
  gpPercent: number;
}

export interface QuotationTerms {
  validityDays: number;
  paymentTerms: string;
  deliveryTerms: string;
}

export interface QuotationRecord {
  id: string;
  clientRequestId: string;
  quotationNo: string;
  projectName: string;
  revision: number;
  quotationDate: string;
  status: string;
  customer: QuotationCustomer;
  note: string;
  terms: QuotationTerms;
  vatPercent: number;
  items: QuotationItem[];
  costNotes: QuotationCostNote[];
  totals: QuotationTotals;
  files: QuotationFileRef[];
  attachments: QuotationAttachment[];
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuotationListItem {
  id: string;
  quotationNo: string;
  projectName: string;
  revision: number;
  quotationDate: string;
  status: string;
  customer: QuotationCustomer;
  totals: QuotationTotals;
  itemCount: number;
  files: QuotationFileRef[];
  pdfUrl: string;
  xlsxUrl: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuotationReportResult {
  quotationId: string;
  quotationNo: string;
  files: QuotationReportFileRef[];
  pdf: QuotationReportFileRef | null;
  xlsx: QuotationReportFileRef | null;
  message: string;
  record?: QuotationRecord;
}

export interface QuotationDeleteFileResult {
  ok: boolean;
  key: string;
  fileId: string;
  message: string;
}

export interface QuotationFileMetadata {
  quotationId?: string;
  quotationNo?: string;
  id?: string;
  quotation_id?: string;
  quotation_no?: string;
  [key: string]: unknown;
}

type UnknownRecord = Record<string, unknown>;
type NumericInput = number | string | null | undefined;

const MOCK_STORAGE_KEY = 'sb_mock_quotations_v1';
const REQUEST_TIMEOUT_MS = 60_000;
const REPORT_REQUEST_TIMEOUT_MS = 180_000;
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
let memoryMockRecords: QuotationRecord[] = [];

function isObject(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asObject(value: unknown): UnknownRecord {
  return isObject(value) ? value : {};
}

function hasOwn(value: unknown, key: string): boolean {
  return isObject(value) && Object.prototype.hasOwnProperty.call(value, key);
}

function firstDefined(...values: unknown[]): unknown {
  return values.find((value) => value !== undefined && value !== null);
}

function firstNonEmpty(...values: unknown[]): unknown {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== '');
}

function text(value: unknown, fallback = ''): string {
  if (value === undefined || value === null) return fallback;
  return String(value).trim();
}

/** Converts formatted user input to a finite number and never returns NaN/Infinity. */
export function normalizeQuotationNumber(value: NumericInput, fallback = 0): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (value === null || value === undefined) return fallback;

  const thaiDigits = '๐๑๒๓๔๕๖๗๘๙';
  let source = String(value).trim();
  if (!source) return fallback;

  const negativeByParentheses = /^\(.*\)$/.test(source);
  source = source
    .replace(/[๐-๙]/g, (digit) => String(thaiDigits.indexOf(digit)))
    .replace(/[,%฿\s]/g, '')
    .replace(/[()]/g, '');

  const parsed = Number(source);
  if (!Number.isFinite(parsed)) return fallback;
  return negativeByParentheses ? -Math.abs(parsed) : parsed;
}

function round(value: number, digits = 2): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round((value + Math.sign(value || 1) * Number.EPSILON) * factor) / factor;
}

function normalizeVatPercent(value: unknown): number {
  return round(Math.min(100, Math.max(0, normalizeQuotationNumber(value as NumericInput))), 4);
}

function normalizeVatFromFields(percentValue: unknown, legacyRateValue: unknown, fallback: unknown = 7): number {
  if (percentValue !== undefined && percentValue !== null && text(percentValue) !== '') {
    return normalizeVatPercent(percentValue);
  }
  if (legacyRateValue !== undefined && legacyRateValue !== null && text(legacyRateValue) !== '') {
    const rate = normalizeQuotationNumber(legacyRateValue as NumericInput);
    return normalizeVatPercent(Math.abs(rate) <= 1 ? rate * 100 : rate);
  }
  return normalizeVatPercent(fallback);
}

function normalizeItem(raw: unknown, index: number): QuotationItem {
  const item = asObject(raw);
  const quantity = Math.max(0, round(normalizeQuotationNumber(
    firstDefined(item.quantity, item.qty) as NumericInput,
  ), 4));
  const unitPrice = Math.max(0, round(normalizeQuotationNumber(
    firstDefined(item.unitPrice, item.unit_price, item.price) as NumericInput,
  ), 4));
  const unitCost = Math.max(0, round(normalizeQuotationNumber(
    firstDefined(item.unitCost, item.unit_cost, item.cost) as NumericInput,
  ), 4));

  return {
    id: text(firstDefined(item.id, item.itemId, item.item_id)),
    lineNo: Math.max(1, Math.trunc(normalizeQuotationNumber(
      firstDefined(item.lineNo, item.line_no, item.itemNo, item.item_no) as NumericInput,
      index + 1,
    ))),
    productId: text(firstDefined(item.productId, item.product_id)),
    productRef: text(firstDefined(item.productRef, item.product_ref, item.reference, item.ref, item.sku)),
    productName: text(firstDefined(item.productName, item.product_name, item.name, item.description)),
    description: text(firstDefined(item.description, item.detail, item.productName, item.product_name, item.name)),
    pictureFileId: text(firstDefined(item.pictureFileId, item.picture_file_id, item.imageFileId, item.image_file_id)),
    pictureUrl: text(firstDefined(item.pictureUrl, item.picture_url, item.imageUrl, item.image_url, item.imageDirectUrl)),
    quantity,
    unit: text(firstDefined(item.unit, item.uom)),
    unitPrice,
    amount: round(quantity * unitPrice),
    unitCost,
    costAmount: round(quantity * unitCost),
    remark: text(firstDefined(item.remark, item.note)),
  };
}

function normalizeCostNote(raw: unknown, index: number): QuotationCostNote {
  const note = asObject(raw);
  return {
    id: text(firstDefined(note.id, note.costNoteId, note.cost_note_id)),
    lineNo: Math.max(1, Math.trunc(normalizeQuotationNumber(
      firstDefined(note.lineNo, note.line_no, note.noteNo, note.note_no) as NumericInput,
      index + 1,
    ))),
    description: text(firstDefined(note.description, note.detail)),
    proposedCost: Math.max(0, round(normalizeQuotationNumber(
      firstDefined(note.proposedCost, note.proposed_cost, note.pcost) as NumericInput,
    ))),
    sbCost: Math.max(0, round(normalizeQuotationNumber(
      firstDefined(note.sbCost, note.sb_cost, note.sbcost, note.cost) as NumericInput,
    ))),
    gpPercent: round(normalizeQuotationNumber(
      firstDefined(note.gpPercent, note.gp_percent, note.gp) as NumericInput,
    ), 4),
    note: text(firstDefined(note.note, note.remark)),
  };
}

/**
 * Calculates the canonical UI totals. Positive SB costs are the GP cost basis;
 * item unit-cost totals are used when no positive SB cost has been supplied.
 */
export function computeQuotationTotals(
  rawItemsOrRecord: readonly (QuotationItem | unknown)[] | Pick<QuotationRecord, 'items' | 'costNotes' | 'vatPercent'> | UnknownRecord,
  rawCostNotes: readonly (QuotationCostNote | unknown)[] = [],
  rawVatPercent: NumericInput = 7,
): QuotationTotals {
  const recordInput: UnknownRecord | null = Array.isArray(rawItemsOrRecord)
    ? null
    : asObject(rawItemsOrRecord);
  const rawItems: readonly unknown[] = recordInput
    ? (Array.isArray(recordInput.items) ? recordInput.items : [])
    : rawItemsOrRecord as readonly unknown[];
  const costNoteInput = recordInput
    ? firstDefined(recordInput.costNotes, recordInput.cost_notes, [])
    : rawCostNotes;
  const normalizedCostNoteInput = Array.isArray(costNoteInput) ? costNoteInput : [];
  const vatInput = recordInput
    ? normalizeVatFromFields(
      firstDefined(recordInput.vatPercent, recordInput.vat_percent),
      firstDefined(recordInput.vatRate, recordInput.vat_rate),
      rawVatPercent,
    )
    : rawVatPercent;
  const items = rawItems.map(normalizeItem);
  const costNotes = normalizedCostNoteInput.map(normalizeCostNote);
  const vatPercent = normalizeVatPercent(vatInput);
  const subtotal = round(items.reduce((sum, item) => sum + item.amount, 0));
  const vatAmount = round(subtotal * vatPercent / 100);
  const grandTotal = round(subtotal + vatAmount);
  const totalProposedCost = round(costNotes.reduce((sum, note) => sum + note.proposedCost, 0));
  const totalItemCost = round(items.reduce((sum, item) => sum + item.costAmount, 0));
  const totalCost = costNotes.some((note) => note.sbCost > 0)
    ? round(costNotes.reduce((sum, note) => sum + note.sbCost, 0))
    : totalItemCost;
  const grossProfit = round(subtotal - totalCost);
  const gpPercent = subtotal === 0 ? 0 : round(grossProfit / subtotal * 100, 2);

  return {
    subtotal,
    vatPercent,
    vatAmount,
    grandTotal,
    totalProposedCost,
    totalItemCost,
    totalCost,
    grossProfit,
    gpPercent,
  };
}

function normalizeCustomer(raw: unknown, header: unknown = {}): QuotationCustomer {
  const customer = asObject(raw);
  const record = asObject(header);
  return {
    id: text(firstNonEmpty(customer.id, customer.customerId, customer.customer_id, record.customerId, record.customer_id)),
    code: text(firstNonEmpty(customer.code, customer.customerCode, customer.customer_code, record.customerCode, record.customer_code)),
    name: text(firstNonEmpty(
      customer.companyName,
      customer.name,
      customer.customerName,
      customer.customer_name,
      record.customerName,
      record.customer_name,
      record.customer_name_snapshot,
    )),
    branch: text(firstNonEmpty(customer.branch, record.customerBranch, record.customer_branch, record.branch)),
    address: text(firstNonEmpty(
      customer.address,
      customer.customerAddress,
      customer.customer_address,
      record.customerAddress,
      record.customer_address,
      record.customer_address_snapshot,
    )),
    phone: text(firstNonEmpty(
      customer.phone,
      customer.customerPhone,
      customer.customer_phone,
      record.customerPhone,
      record.customer_phone,
      record.customer_phone_snapshot,
    )),
    email: text(firstNonEmpty(customer.email, record.customerEmail, record.customer_email)),
    taxId: text(firstNonEmpty(customer.taxId, customer.tax_id, record.customerTaxId, record.customer_tax_id, record.tax_id)),
    contactPerson: text(firstNonEmpty(
      customer.contactName,
      customer.contactPerson,
      customer.contact_person,
      record.contactPerson,
      record.contact_person,
    )),
    note: text(firstNonEmpty(
      customer.note,
      customer.customerNote,
      customer.customer_note,
      record.customerNote,
      record.customer_note,
    )),
  };
}

function inferFileKind(file: UnknownRecord, name: string, mimeType: string): string {
  const explicit = text(firstDefined(file.kind, file.bucket, file.reportType, file.report_type, file.type));
  if (explicit) return explicit;
  const signature = `${name} ${mimeType}`.toLowerCase();
  if (signature.includes('pdf')) return 'quotation_pdf';
  if (signature.includes('xlsx') || signature.includes('spreadsheet')) return 'quotation_xlsx';
  if (signature.match(/image|\.png|\.jpe?g|\.webp/)) return 'quotation_images';
  return 'quotation_attachments';
}

function normalizeFileRef(raw: unknown, fallback: Partial<QuotationFileRef> = {}): QuotationFileRef {
  if (typeof raw === 'string') {
    const url = raw.trim();
    const fileName = url.split('/').pop()?.split('?')[0] || fallback.fileName || '';
    return {
      fileId: fallback.fileId || '',
      fileName,
      mimeType: fallback.mimeType || '',
      kind: fallback.kind || inferFileKind({}, fileName, fallback.mimeType || ''),
      url,
      viewUrl: url,
      directUrl: url,
      createdAt: fallback.createdAt || '',
    };
  }

  const file = asObject(raw);
  const fileName = text(firstDefined(file.fileName, file.file_name, file.name), fallback.fileName || '');
  const mimeType = text(firstDefined(file.mimeType, file.mime_type), fallback.mimeType || '');
  const viewUrl = text(firstNonEmpty(file.viewUrl, file.view_url, file.url, file.fileUrl, file.file_url), fallback.viewUrl || '');
  const directUrl = text(firstNonEmpty(file.directUrl, file.direct_url, file.downloadUrl, file.download_url), fallback.directUrl || '');
  const url = text(firstNonEmpty(file.url, file.fileUrl, file.file_url, viewUrl, directUrl), fallback.url || '');
  return {
    fileId: text(firstDefined(file.fileId, file.file_id, file.id), fallback.fileId || ''),
    fileName,
    mimeType,
    kind: inferFileKind(file, fileName, mimeType) || fallback.kind || 'quotation_attachments',
    url,
    viewUrl: viewUrl || url,
    directUrl: directUrl || url,
    createdAt: text(firstDefined(file.createdAt, file.created_at), fallback.createdAt || ''),
  };
}

function normalizeFiles(raw: unknown): QuotationFileRef[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((file) => normalizeFileRef(file));
}

type ReportFileKind = 'pdf' | 'xlsx';

function reportFileKind(file: QuotationFileRef): ReportFileKind | null {
  const explicitKind = file.kind.toLowerCase();
  // Uploaded source files are not generated reports, even when an attachment is
  // itself a PDF or spreadsheet.
  if (explicitKind.includes('attachment') || explicitKind.includes('image')) return null;

  const signature = `${explicitKind} ${file.mimeType} ${file.fileName}`.toLowerCase();
  if (signature.includes('pdf')) return 'pdf';
  if (signature.includes('xlsx') || signature.includes('spreadsheet') || signature.includes('excel')) return 'xlsx';
  return null;
}

function fillMissingFileRef(primary: QuotationFileRef, fallback: QuotationFileRef): QuotationFileRef {
  return {
    fileId: primary.fileId || fallback.fileId,
    fileName: primary.fileName || fallback.fileName,
    mimeType: primary.mimeType || fallback.mimeType,
    kind: primary.kind || fallback.kind,
    url: primary.url || fallback.url,
    viewUrl: primary.viewUrl || fallback.viewUrl,
    directUrl: primary.directUrl || fallback.directUrl,
    createdAt: primary.createdAt || fallback.createdAt,
  };
}

function collectReportFileRefs(
  raw: unknown,
  fallbackFiles: readonly QuotationFileRef[] = [],
  fallbackQuotationNo = '',
): QuotationFileRef[] {
  const envelope = asObject(raw);
  const artifacts = asObject(firstDefined(envelope.artifacts, envelope.reportArtifacts, envelope.report_artifacts));
  const reports = asObject(firstDefined(envelope.reports, envelope.report));
  const sources: Array<{ value: unknown; fallback?: Partial<QuotationFileRef> }> = [];

  const reportKinds = [
    {
      name: 'pdf',
      mimeType: 'application/pdf',
      kind: 'quotation_pdf',
      objectKeys: ['pdf', 'pdfFile', 'pdf_file'],
      urlKeys: ['pdfUrl', 'pdf_url'],
      idKeys: ['pdfFileId', 'pdf_file_id'],
    },
    {
      name: 'xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      kind: 'quotation_xlsx',
      objectKeys: ['xlsx', 'xlsxFile', 'xlsx_file', 'workbook', 'workbookFile', 'workbook_file'],
      urlKeys: ['xlsxUrl', 'xlsx_url', 'workbookUrl', 'workbook_url'],
      idKeys: ['xlsxFileId', 'xlsx_file_id', 'workbookFileId', 'workbook_file_id'],
    },
  ] as const;

  for (const reportKind of reportKinds) {
    const fallback: Partial<QuotationFileRef> = {
      fileName: `${fallbackQuotationNo || 'quotation'}.${reportKind.name}`,
      mimeType: reportKind.mimeType,
      kind: reportKind.kind,
    };
    // Artifact objects and direct fields describe the currently tracked report.
    // They must be collected before legacy `files` arrays, which can contain the
    // previous (already trashed) report version.
    const containers = [artifacts, reports, envelope];
    const objectValue = firstNonEmpty(...containers.flatMap((container) => (
      reportKind.objectKeys.map((key) => container[key])
    )));
    if (objectValue !== undefined && objectValue !== null && objectValue !== '') {
      sources.push({ value: objectValue, fallback });
    }

    const directUrl = text(firstNonEmpty(...containers.flatMap((container) => (
      reportKind.urlKeys.map((key) => container[key])
    ))));
    if (directUrl) {
      const fileId = firstNonEmpty(...containers.flatMap((container) => (
        reportKind.idKeys.map((key) => container[key])
      )));
      sources.push({
        value: { fileId, url: directUrl, viewUrl: directUrl },
        fallback,
      });
    }
  }

  for (const listed of [
    artifacts.files,
    reports.files,
    envelope.reportFiles,
    envelope.report_files,
    envelope.files,
  ]) {
    if (Array.isArray(listed)) listed.forEach((value) => sources.push({ value }));
  }

  const normalized = sources.map(({ value, fallback }) => normalizeFileRef(value, fallback));
  normalized.push(...fallbackFiles.map((file) => normalizeFileRef(file)));

  const deduplicated: QuotationFileRef[] = [];
  const indexByIdentity = new Map<string, number>();
  const indexByReportKind = new Map<ReportFileKind, number>();
  normalized.forEach((file, index) => {
    const identity = file.fileId || file.url || file.viewUrl || file.directUrl || `${file.kind}-${file.fileName}-${index}`;
    const kind = reportFileKind(file);
    const existingIndex = kind !== null
      ? indexByReportKind.get(kind)
      : indexByIdentity.get(identity);

    if (existingIndex !== undefined) {
      deduplicated[existingIndex] = fillMissingFileRef(deduplicated[existingIndex], file);
      indexByIdentity.set(identity, existingIndex);
      return;
    }

    const nextIndex = deduplicated.length;
    deduplicated.push(file);
    indexByIdentity.set(identity, nextIndex);
    if (kind !== null) indexByReportKind.set(kind, nextIndex);
  });
  return deduplicated;
}

function normalizeAttachments(raw: unknown): QuotationAttachment[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => {
    const file = normalizeFileRef(entry);
    return {
      fileId: file.fileId,
      fileName: file.fileName,
      mimeType: file.mimeType,
      viewUrl: file.viewUrl,
      directUrl: file.directUrl,
      kind: file.kind,
    };
  });
}

function cleanQuotationStatus(raw: unknown, fallback = 'DRAFT'): string {
  const status = text(raw, fallback).toUpperCase();
  if (!status || status === 'SUCCESS' || status === 'ERROR') return fallback;
  return status;
}

function localDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeRecord(raw: unknown, fallback?: Partial<QuotationRecord>): QuotationRecord {
  const record = asObject(raw);
  const fallbackRecord = asObject(fallback);
  const rawCustomer = firstDefined(record.customer, fallbackRecord.customer, {});

  const itemSource = hasOwn(record, 'items')
    ? record.items
    : firstDefined(record.quotation_items, fallbackRecord.items, []);
  const costNoteSource = hasOwn(record, 'costNotes')
    ? record.costNotes
    : hasOwn(record, 'cost_notes')
      ? record.cost_notes
      : firstDefined(record.quotation_cost_notes, fallbackRecord.costNotes, []);

  const items = (Array.isArray(itemSource) ? itemSource : []).map(normalizeItem);
  const costNotes = (Array.isArray(costNoteSource) ? costNoteSource : []).map(normalizeCostNote);
  const rawTotals = asObject(firstDefined(record.totals, fallbackRecord.totals));
  const explicitVatPercent = firstDefined(
    record.vatPercent,
    record.vat_percent,
    rawTotals.vatPercent,
    rawTotals.vat_percent,
    fallbackRecord.vatPercent,
  );
  const vatPercent = normalizeVatFromFields(
    explicitVatPercent,
    firstDefined(record.vatRate, record.vat_rate, rawTotals.vatRate, rawTotals.vat_rate),
    7,
  );
  const statusFallback = cleanQuotationStatus(fallbackRecord.status, 'DRAFT');
  const fileSource = hasOwn(record, 'files')
    ? record.files
    : firstDefined(record.reportFiles, record.report_files, []);
  const quotationNoForFiles = text(firstDefined(record.quotationNo, record.quotation_no, fallbackRecord.quotationNo));
  const normalizedFiles = collectReportFileRefs(
    record,
    [...normalizeFiles(fileSource), ...normalizeFiles(fallbackRecord.files)],
    quotationNoForFiles,
  );
  const attachmentSource = hasOwn(record, 'attachments')
    ? record.attachments
    : firstDefined(
      record.quotationAttachments,
      record.quotation_attachments,
      fallbackRecord.attachments,
      normalizedFiles.filter((file) => file.kind === 'quotation_images' || file.kind === 'quotation_attachments'),
    );
  const terms = asObject(firstDefined(record.terms, fallbackRecord.terms));

  return {
    id: text(firstDefined(record.id, record.quotationId, record.quotation_id, fallbackRecord.id)),
    clientRequestId: text(firstDefined(
      record.clientRequestId,
      record.client_request_id,
      fallbackRecord.clientRequestId,
    )),
    quotationNo: text(firstDefined(record.quotationNo, record.quotation_no, fallbackRecord.quotationNo)),
    projectName: text(firstDefined(record.projectName, record.project_name, fallbackRecord.projectName)),
    revision: Math.max(0, Math.trunc(normalizeQuotationNumber(
      firstDefined(record.revision, record.rev, fallbackRecord.revision) as NumericInput,
    ))),
    quotationDate: text(firstDefined(
      record.quotationDate,
      record.quotation_date,
      fallbackRecord.quotationDate,
      localDate(),
    )),
    status: cleanQuotationStatus(
      firstDefined(record.quotationStatus, record.quotation_status, record.status),
      statusFallback,
    ),
    customer: normalizeCustomer(rawCustomer, { ...asObject(fallback), ...record }),
    note: text(firstDefined(record.note, record.notes, record.quotationNote, record.quotation_note, fallbackRecord.note)),
    terms: {
      validityDays: Math.max(0, Math.trunc(normalizeQuotationNumber(firstDefined(
        terms.validityDays,
        terms.validity_days,
        record.validityDays,
        record.validity_days,
        30,
      ) as NumericInput, 30))),
      paymentTerms: text(firstDefined(
        terms.paymentTerms,
        terms.payment_terms,
        record.paymentTerms,
        record.payment_terms,
      )),
      deliveryTerms: text(firstDefined(
        terms.deliveryTerms,
        terms.delivery_terms,
        record.deliveryTerms,
        record.delivery_terms,
      )),
    },
    vatPercent,
    items,
    costNotes,
    totals: computeQuotationTotals(items, costNotes, vatPercent),
    files: normalizedFiles,
    attachments: normalizeAttachments(attachmentSource),
    createdBy: text(firstDefined(record.createdBy, record.created_by, fallbackRecord.createdBy)),
    createdByName: text(firstDefined(record.createdByName, record.created_by_name, fallbackRecord.createdByName)),
    createdAt: text(firstDefined(record.createdAt, record.created_at, fallbackRecord.createdAt)),
    updatedAt: text(firstDefined(record.updatedAt, record.updated_at, fallbackRecord.updatedAt)),
  };
}

function totalsFromSummary(raw: UnknownRecord): QuotationTotals {
  const values = asObject(raw.totals);
  const subtotal = round(normalizeQuotationNumber(firstDefined(
    values.subtotal,
    values.totalAmount,
    values.total_amount,
    raw.subtotal,
    raw.totalAmount,
    raw.total_amount,
  ) as NumericInput));
  const vatPercent = normalizeVatFromFields(firstDefined(
    values.vatPercent,
    values.vat_percent,
    raw.vatPercent,
    raw.vat_percent,
  ), firstDefined(values.vatRate, values.vat_rate, raw.vatRate, raw.vat_rate), 7);
  const vatAmount = round(normalizeQuotationNumber(firstDefined(
    values.vatAmount,
    values.vat_amount,
    raw.vatAmount,
    raw.vat_amount,
    subtotal * vatPercent / 100,
  ) as NumericInput));
  const totalProposedCost = round(normalizeQuotationNumber(firstDefined(
    values.totalProposedCost,
    values.total_proposed_cost,
    values.totalPcost,
    values.total_pcost,
    raw.total_pcost,
  ) as NumericInput));
  const totalItemCost = round(normalizeQuotationNumber(firstDefined(
    values.totalItemCost,
    values.total_item_cost,
    raw.total_item_cost,
  ) as NumericInput));
  const totalCost = round(normalizeQuotationNumber(firstDefined(
    values.totalCost,
    values.total_cost,
    values.totalSbcost,
    values.total_sbcost,
    raw.total_cost,
    raw.total_sbcost,
    totalItemCost,
  ) as NumericInput));
  const grossProfit = round(normalizeQuotationNumber(firstDefined(
    values.grossProfit,
    values.gross_profit,
    raw.gross_profit,
    subtotal - totalCost,
  ) as NumericInput));
  const gpPercent = round(normalizeQuotationNumber(firstDefined(
    values.gpPercent,
    values.gp_percent,
    raw.gp_percent,
    subtotal === 0 ? 0 : grossProfit / subtotal * 100,
  ) as NumericInput), 2);
  const grandTotal = round(normalizeQuotationNumber(firstDefined(
    values.grandTotal,
    values.grand_total,
    raw.grandTotal,
    raw.grand_total,
    subtotal + vatAmount,
  ) as NumericInput));

  return { subtotal, vatPercent, vatAmount, grandTotal, totalProposedCost, totalItemCost, totalCost, grossProfit, gpPercent };
}

function normalizeListItem(raw: unknown): QuotationListItem {
  const value = asObject(raw);
  const hasDetailRows = Array.isArray(value.items) || Array.isArray(value.costNotes) || Array.isArray(value.cost_notes);
  const full = normalizeRecord(value);
  const files = reportFilesFromResponse(value, full);
  const pdf = files.find((file) => `${file.kind} ${file.mimeType} ${file.fileName}`.toLowerCase().includes('pdf'));
  const xlsx = files.find((file) => {
    const signature = `${file.kind} ${file.mimeType} ${file.fileName}`.toLowerCase();
    return signature.includes('xlsx') || signature.includes('spreadsheet') || signature.includes('excel');
  });
  return {
    id: full.id,
    quotationNo: full.quotationNo,
    projectName: full.projectName,
    revision: full.revision,
    quotationDate: full.quotationDate,
    status: full.status,
    customer: full.customer,
    totals: hasDetailRows ? full.totals : totalsFromSummary(value),
    itemCount: Math.max(0, Math.trunc(normalizeQuotationNumber(firstDefined(
      value.itemCount,
      value.item_count,
      value.items_count,
      Array.isArray(value.items) ? value.items.length : 0,
    ) as NumericInput))),
    files,
    pdfUrl: text(firstDefined(value.pdfUrl, value.pdf_url, pdf?.viewUrl, pdf?.url, pdf?.directUrl)),
    xlsxUrl: text(firstDefined(
      value.xlsxUrl,
      value.xlsx_url,
      value.workbookUrl,
      value.workbook_url,
      xlsx?.viewUrl,
      xlsx?.url,
      xlsx?.directUrl,
    )),
    createdBy: full.createdBy,
    createdByName: full.createdByName,
    createdAt: full.createdAt,
    updatedAt: full.updatedAt,
  };
}

function currentActor(): { emp_id: string; name: string; role: string } {
  let user: UnknownRecord = {};
  try {
    user = asObject(getCurrentUser());
  } catch {
    // A service worker/test environment may not expose localStorage.
  }
  return {
    emp_id: text(firstDefined(user.emp_id, user.empId, user.user_code, user.id)),
    name: text(firstDefined(user.name, user.full_name, user.display_name)),
    role: text(firstDefined(user.role, user.user_role)),
  };
}

function sessionToken(): string {
  try {
    return getToken();
  } catch {
    return '';
  }
}

function endpointLooksLikePlaceholder(endpoint: string): boolean {
  return !endpoint || /PASTE_|YOUR_|EXAMPLE|WEB_APP_URL_HERE/i.test(endpoint);
}

function tokenLooksLikePlaceholder(token: string): boolean {
  return !token || /CHANGE_|PASTE_|YOUR_|MATCH_APPS_SCRIPT/i.test(token);
}

function transportSettings(): { endpoint: string; token: string; mock: boolean } {
  const config = getConfig() as { driveUploadEndpoint?: string; driveUploadToken?: string };
  const endpoint = text(config.driveUploadEndpoint);
  const token = text(config.driveUploadToken);
  if (endpointLooksLikePlaceholder(endpoint)) return { endpoint, token, mock: true };

  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    throw new Error('Quotation API endpoint is not a valid URL.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Quotation API endpoint must use HTTP or HTTPS.');
  }
  return { endpoint: parsed.toString(), token, mock: false };
}

export function isQuotationMockMode(): boolean {
  return transportSettings().mock;
}

function errorMessage(value: unknown, fallback: string): string {
  const data = asObject(value);
  return text(firstDefined(data.message, data.error, data.details), fallback);
}

function unwrapData(value: unknown): unknown {
  const root = asObject(value);
  return root.data !== undefined && root.data !== null ? root.data : value;
}

async function postJson(payload: UnknownRecord): Promise<unknown> {
  const settings = transportSettings();
  if (settings.mock) throw new Error('Quotation API is unavailable in offline/mock mode.');

  const requestType = text(firstDefined(payload.type, payload.action));
  const timeoutMs = requestType === 'quotation_create' || requestType === 'quotation_report'
    ? REPORT_REQUEST_TIMEOUT_MS
    : REQUEST_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(settings.endpoint, {
      method: 'POST',
      // text/plain is CORS-safelisted; Apps Script web apps do not reliably answer OPTIONS preflights.
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      redirect: 'follow',
      signal: controller.signal,
      body: JSON.stringify({
        ...payload,
        ...(!tokenLooksLikePlaceholder(settings.token) ? { token: settings.token } : {}),
        sessionToken: sessionToken(),
        actor: currentActor(),
      }),
    });

    const responseText = await response.text();
    let data: unknown = null;
    if (responseText.trim()) {
      try {
        data = JSON.parse(responseText.replace(/^\)\]\}',?\s*/, ''));
      } catch {
        const preview = responseText.replace(/\s+/g, ' ').trim().slice(0, 180);
        throw new Error(`Quotation API returned invalid JSON${preview ? `: ${preview}` : '.'}`);
      }
    }

    if (!response.ok) {
      throw new Error(errorMessage(data, `Quotation API request failed (HTTP ${response.status}).`));
    }
    const envelope = asObject(data);
    if (text(envelope.status).toLowerCase() === 'error' || envelope.ok === false) {
      throw new Error(errorMessage(data, 'Quotation API rejected the request.'));
    }
    if (data === null) throw new Error('Quotation API returned an empty response.');
    return data;
  } catch (error) {
    if (isObject(error) && error.name === 'AbortError') {
      throw new Error(`Quotation API timed out after ${timeoutMs / 1000} seconds.`);
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

function serializeItem(item: QuotationItem): UnknownRecord {
  return {
    ...item,
    item_id: item.id,
    item_no: item.lineNo,
    product_id: item.productId,
    product_ref: item.productRef,
    product_name: item.productName,
    picture_file_id: item.pictureFileId,
    picture_url: item.pictureUrl,
    qty: item.quantity,
    unit_price: item.unitPrice,
    cost: item.unitCost,
    cost_amount: item.costAmount,
  };
}

function serializeCostNote(note: QuotationCostNote): UnknownRecord {
  return {
    ...note,
    cost_note_id: note.id,
    note_no: note.lineNo,
    pcost: note.proposedCost,
    sbcost: note.sbCost,
    gp: note.gpPercent,
  };
}

function serializeRecord(input: Partial<QuotationRecord>): UnknownRecord {
  const record = normalizeRecord(input, input);
  const items = record.items.map(serializeItem);
  const costNotes = record.costNotes.map(serializeCostNote);
  const customer = {
    ...record.customer,
    customer_id: record.customer.id,
    customer_code: record.customer.code,
    customer_name: record.customer.name,
    tax_id: record.customer.taxId,
    contact_person: record.customer.contactPerson,
    customer_note: record.customer.note,
  };
  return {
    ...record,
    quotation_id: record.id,
    client_request_id: record.clientRequestId,
    quotation_no: record.quotationNo,
    project_name: record.projectName,
    quotation_date: record.quotationDate,
    quotationNote: record.note,
    quotation_note: record.note,
    notes: record.note,
    terms: record.terms,
    validity_days: record.terms.validityDays,
    payment_terms: record.terms.paymentTerms,
    delivery_terms: record.terms.deliveryTerms,
    vat_percent: record.vatPercent,
    vat_rate: record.vatPercent / 100,
    customer,
    customer_id: record.customer.id,
    customer_name: record.customer.name,
    customer_branch: record.customer.branch,
    customer_address: record.customer.address,
    customer_phone: record.customer.phone,
    customer_note: record.customer.note,
    items,
    costNotes,
    cost_notes: costNotes,
    attachments: record.attachments,
    quotation_attachments: record.attachments,
    totals: {
      ...record.totals,
      total_amount: record.totals.subtotal,
      vat_percent: record.totals.vatPercent,
      vat_amount: record.totals.vatAmount,
      grand_total: record.totals.grandTotal,
      total_pcost: record.totals.totalProposedCost,
      total_item_cost: record.totals.totalItemCost,
      total_cost: record.totals.totalCost,
      total_sbcost: record.totals.totalCost,
      gross_profit: record.totals.grossProfit,
      gp_percent: record.totals.gpPercent,
    },
    created_by: record.createdBy,
    created_by_name: record.createdByName,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

function extractRecord(response: unknown, fallback?: Partial<QuotationRecord>): QuotationRecord {
  const payload = unwrapData(response);
  const envelope = asObject(payload);
  // Backend `quotation_get` returns the full detail in `quotation` and a list
  // summary in `record`; always prefer the full object when both are present.
  const nested = asObject(firstDefined(envelope.quotation, envelope.record));
  const candidate: UnknownRecord = Object.keys(nested).length > 0
    ? { ...envelope, ...nested }
    : envelope;

  for (const key of ['items', 'costNotes', 'cost_notes', 'files', 'reportFiles', 'report_files', 'attachments', 'quotation_attachments']) {
    if (hasOwn(envelope, key)) candidate[key] = envelope[key];
  }
  return normalizeRecord(candidate, fallback);
}

function extractList(response: unknown): QuotationListItem[] {
  const payload = unwrapData(response);
  if (Array.isArray(payload)) return payload.map(normalizeListItem);
  const envelope = asObject(payload);
  const rows = firstDefined(envelope.quotations, envelope.records, envelope.results, envelope.list);
  if (!Array.isArray(rows)) return [];
  return rows.map(normalizeListItem);
}

function readMockRecords(): QuotationRecord[] {
  if (typeof localStorage === 'undefined') return memoryMockRecords.map((record) => normalizeRecord(record));
  try {
    const stored = JSON.parse(localStorage.getItem(MOCK_STORAGE_KEY) || '[]');
    if (!Array.isArray(stored)) return [];
    return stored.map((record) => normalizeRecord(record));
  } catch {
    return [];
  }
}

function writeMockRecords(records: QuotationRecord[]): void {
  memoryMockRecords = records.map((record) => normalizeRecord(record));
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(memoryMockRecords));
  } catch {
    // The in-memory copy still keeps mock mode usable if storage is unavailable/full.
  }
}

function localId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return `LOCAL-${crypto.randomUUID()}`;
  return `LOCAL-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function newClientRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `QREQ-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function nextMockQuotationNo(records: readonly QuotationRecord[]): string {
  const now = new Date();
  const buddhistYear = (now.getFullYear() + 543) % 100;
  const prefix = `Q${String(buddhistYear).padStart(2, '0')}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const max = records.reduce((current, record) => {
    const match = record.quotationNo.match(new RegExp(`^${prefix}(\\d{4})$`));
    return match ? Math.max(current, Number(match[1])) : current;
  }, 0);
  return `${prefix}${String(max + 1).padStart(4, '0')}`;
}

function createMockQuotation(initial: Partial<QuotationRecord>): QuotationRecord {
  const records = readMockRecords();
  const now = new Date().toISOString();
  const actor = currentActor();
  const requestedNo = text(initial.quotationNo);
  const requestedClientId = text(initial.clientRequestId) || newClientRequestId();
  const record = normalizeRecord({
    ...initial,
    id: text(initial.id) || localId(),
    clientRequestId: requestedClientId,
    quotationNo: requestedNo && requestedNo.toUpperCase() !== 'AUTO' ? requestedNo : nextMockQuotationNo(records),
    status: initial.status || 'DRAFT',
    quotationDate: initial.quotationDate || localDate(),
    createdBy: initial.createdBy || actor.emp_id,
    createdByName: initial.createdByName || actor.name,
    createdAt: initial.createdAt || now,
    updatedAt: now,
  }, initial);
  writeMockRecords([record, ...records.filter((row) => row.id !== record.id)]);
  return record;
}

function saveMockQuotation(input: QuotationRecord): QuotationRecord {
  const records = readMockRecords();
  const existing = records.find((row) => row.id === input.id || (
    input.quotationNo && row.quotationNo === input.quotationNo
  ));
  const actor = currentActor();
  const now = new Date().toISOString();
  const record = normalizeRecord({
    ...existing,
    ...input,
    id: text(input.id) || existing?.id || localId(),
    clientRequestId: text(input.clientRequestId) || existing?.clientRequestId || newClientRequestId(),
    quotationNo: text(input.quotationNo) || existing?.quotationNo || nextMockQuotationNo(records),
    createdBy: input.createdBy || existing?.createdBy || actor.emp_id,
    createdByName: input.createdByName || existing?.createdByName || actor.name,
    createdAt: input.createdAt || existing?.createdAt || now,
    updatedAt: now,
  }, existing);
  writeMockRecords([record, ...records.filter((row) => row.id !== record.id)]);
  return record;
}

/** Creates a new quotation and, in connected mode, asks Apps Script to create its workbook. */
export async function createQuotation(initial: Partial<QuotationRecord> = {}): Promise<QuotationRecord> {
  if (transportSettings().mock) return createMockQuotation(initial);
  const actor = currentActor();
  const now = new Date().toISOString();
  const initialObject = asObject(initial);
  const clientRequestId = text(firstDefined(initial.clientRequestId, initialObject.client_request_id)) || newClientRequestId();
  const draft = normalizeRecord({
    ...initial,
    clientRequestId,
    status: initial.status || 'DRAFT',
    quotationDate: initial.quotationDate || localDate(),
    createdBy: initial.createdBy || actor.emp_id,
    createdByName: initial.createdByName || actor.name,
    createdAt: initial.createdAt || now,
    updatedAt: now,
  }, initial);
  const response = await postJson({
    type: 'quotation_create',
    clientRequestId,
    quotation: serializeRecord(draft),
  });
  return extractRecord(response, draft);
}

export async function saveQuotation(record: QuotationRecord): Promise<QuotationRecord> {
  const normalized = normalizeRecord(record, record);
  if (transportSettings().mock) return saveMockQuotation(normalized);
  const response = await postJson({ type: 'quotation_save', quotation: serializeRecord(normalized) });
  return extractRecord(response, normalized);
}

export async function listQuotations(search = ''): Promise<QuotationListItem[]> {
  const query = text(search).toLocaleLowerCase('th-TH');
  if (transportSettings().mock) {
    return readMockRecords()
      .filter((record) => !query || [
        record.id,
        record.quotationNo,
        record.projectName,
        record.customer.name,
        record.customer.phone,
        record.status,
      ].some((value) => value.toLocaleLowerCase('th-TH').includes(query)))
      .sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt))
      .map(normalizeListItem);
  }
  return extractList(await postJson({ type: 'quotation_list', search: text(search) }));
}

export async function getQuotation(idOrNo: string): Promise<QuotationRecord> {
  const key = text(idOrNo);
  if (!key) throw new Error('Quotation ID or quotation number is required.');
  if (transportSettings().mock) {
    const record = readMockRecords().find((row) => row.id === key || row.quotationNo === key);
    if (!record) throw new Error(`Quotation not found: ${key}`);
    return normalizeRecord(record);
  }
  return extractRecord(await postJson({ type: 'quotation_get', key }));
}

function reportFilesFromResponse(response: unknown, fallbackRecord?: QuotationRecord): QuotationFileRef[] {
  const payload = unwrapData(response);
  return collectReportFileRefs(payload, fallbackRecord?.files || [], fallbackRecord?.quotationNo || '');
}

export async function generateQuotationReport(
  recordOrId: QuotationRecord | string,
): Promise<QuotationReportResult> {
  const suppliedRecord = typeof recordOrId === 'string' ? undefined : normalizeRecord(recordOrId, recordOrId);
  const key = typeof recordOrId === 'string'
    ? text(recordOrId)
    : suppliedRecord?.id || suppliedRecord?.quotationNo || '';
  if (!key && !suppliedRecord) throw new Error('Quotation ID, number, or record is required to generate a report.');

  if (transportSettings().mock) {
    // Keep the edited draft durable even though mock mode cannot emit binary reports.
    const record = suppliedRecord ? saveMockQuotation(suppliedRecord) : await getQuotation(key);
    return {
      quotationId: record.id,
      quotationNo: record.quotationNo,
      files: [],
      pdf: null,
      xlsx: null,
      message: 'บันทึกใบเสนอราคาไว้ในเครื่องแล้ว แต่โหมด Offline/Mock ไม่สามารถสร้างไฟล์ PDF หรือ XLSX ได้',
      record,
    };
  }

  const response = await postJson({
    type: 'quotation_report',
    key,
    ...(suppliedRecord ? { quotation: serializeRecord(suppliedRecord) } : {}),
  });
  const payload = asObject(unwrapData(response));
  const responseRecord = (payload.record || payload.quotation)
    ? extractRecord(response, suppliedRecord)
    : suppliedRecord;
  const files = reportFilesFromResponse(response, responseRecord);
  const pdf = files.find((file) => `${file.kind} ${file.mimeType} ${file.fileName}`.toLowerCase().includes('pdf')) || null;
  const xlsx = files.find((file) => {
    const signature = `${file.kind} ${file.mimeType} ${file.fileName}`.toLowerCase();
    return signature.includes('xlsx') || signature.includes('spreadsheet');
  }) || null;
  return {
    quotationId: text(firstDefined(payload.quotationId, payload.quotation_id, responseRecord?.id, suppliedRecord?.id)),
    quotationNo: text(firstDefined(payload.quotationNo, payload.quotation_no, responseRecord?.quotationNo, suppliedRecord?.quotationNo)),
    files,
    pdf,
    xlsx,
    message: errorMessage(payload, files.length ? 'Quotation report created.' : 'Report request completed without file references.'),
    ...(responseRecord ? { record: responseRecord } : {}),
  };
}

function fileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error(`Unable to read file: ${file.name}`));
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const marker = result.indexOf(',');
      if (!result || marker < 0) {
        reject(new Error(`Unable to encode file: ${file.name}`));
        return;
      }
      resolve(result.slice(marker + 1));
    };
    reader.readAsDataURL(file);
  });
}

function inferQuotationMimeType(fileName: string): string {
  const extension = fileName.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || '';
  const byExtension: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    jfif: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    pdf: 'application/pdf',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  return byExtension[extension] || '';
}

function quotationFileMimeType(file: File): string {
  const declared = text(file.type).toLowerCase();
  if (declared === 'image/jpg' || declared === 'image/pjpeg') return 'image/jpeg';
  return declared || inferQuotationMimeType(file.name);
}

function isUnsupportedHeic(file: File): boolean {
  return /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

function isSupportedQuotationFile(file: File): boolean {
  return [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ].includes(quotationFileMimeType(file));
}

export async function uploadQuotationFile(
  file: File,
  kind: QuotationUploadKind,
  metadata: QuotationFileMetadata,
): Promise<QuotationFileRef> {
  if (!file || !file.name) throw new Error('Please select a file to upload.');
  if (file.size <= 0) throw new Error('The selected file is empty.');
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('ไฟล์มีขนาดเกิน 8 MB กรุณาลดขนาดไฟล์ก่อนอัปโหลด');
  }
  if (isUnsupportedHeic(file)) {
    throw new Error('ไม่รองรับไฟล์ HEIC/HEIF กรุณาแปลงเป็น JPEG, PNG หรือ WebP ก่อนอัปโหลด');
  }
  if (!isSupportedQuotationFile(file)) {
    throw new Error('รองรับเฉพาะไฟล์รูปภาพ, PDF, XLSX และ DOCX เท่านั้น');
  }
  const settings = transportSettings();
  if (settings.mock) throw new Error('File upload is unavailable until the Apps Script endpoint is configured.');

  const quotationId = text(firstDefined(metadata.quotationId, metadata.quotation_id, metadata.id));
  const quotationNo = text(firstDefined(metadata.quotationNo, metadata.quotation_no));
  const mimeType = quotationFileMimeType(file);
  const base64 = await fileAsBase64(file);
  const response = await postJson({
    bucket: kind,
    fileName: file.name,
    mimeType,
    base64,
    meta: {
      ...metadata,
      quotation_id: quotationId,
      quotation_no: quotationNo,
      kind,
    },
  });
  const payload = unwrapData(response);
  const fileRef = normalizeFileRef(payload, {
    fileName: file.name,
    mimeType,
    kind,
    createdAt: new Date().toISOString(),
  });
  if (!fileRef.fileId && !fileRef.url && !fileRef.viewUrl && !fileRef.directUrl) {
    throw new Error('Upload completed but Apps Script did not return a file reference.');
  }
  return fileRef;
}

export async function deleteQuotationFile(
  recordKey: string,
  fileId: string,
): Promise<QuotationDeleteFileResult> {
  const key = text(recordKey);
  const normalizedFileId = text(fileId);
  if (!key) throw new Error('Quotation ID or quotation number is required.');
  if (!normalizedFileId) throw new Error('Drive file ID is required.');

  if (transportSettings().mock) {
    return {
      ok: true,
      key,
      fileId: normalizedFileId,
      message: 'Offline/Mock mode: no Drive file was deleted.',
    };
  }

  const response = await postJson({
    type: 'quotation_delete_file',
    action: 'quotation_delete_file',
    key,
    fileId: normalizedFileId,
  });
  const payload = asObject(unwrapData(response));
  return {
    ok: payload.ok !== false,
    key: text(firstDefined(payload.key, payload.quotationId, payload.quotation_id), key),
    fileId: text(firstDefined(payload.fileId, payload.file_id), normalizedFileId),
    message: errorMessage(payload, 'Quotation file deleted.'),
  };
}

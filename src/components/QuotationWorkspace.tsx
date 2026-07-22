import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Calculator,
  Check,
  ChevronRight,
  CircleDollarSign,
  ExternalLink,
  FileImage,
  FilePlus2,
  FileSpreadsheet,
  FileText,
  ImagePlus,
  Loader2,
  Mail,
  MapPin,
  PackagePlus,
  Paperclip,
  Phone,
  Plus,
  ReceiptText,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
  X,
} from 'lucide-react';
import * as quotationApiModule from '../services/quotationService';
import type {
  QuotationFileRef as ServiceQuotationFileRef,
  QuotationReportResult as ServiceQuotationReportResult,
  QuotationUploadKind,
} from '../services/quotationService';

type WorkspaceView = 'editor' | 'reports';
type ToastKind = 'success' | 'error' | 'info';
type QuotationStatus = 'draft' | 'pending' | 'sent' | 'approved' | 'rejected' | 'cancelled';
type UploadKind = QuotationUploadKind;

type QuotationCustomer = {
  companyName: string;
  taxId: string;
  branch: string;
  address: string;
  contactName: string;
  phone: string;
  email: string;
  [key: string]: unknown;
};

type QuotationItem = {
  id: string;
  description: string;
  reference: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  unitCost: number;
  remark: string;
  imageUrl?: string;
  imageFileId?: string;
  [key: string]: unknown;
};

type QuotationCostNote = {
  id: string;
  description: string;
  proposedCost: number;
  sbCost: number;
  remark: string;
  [key: string]: unknown;
};

type QuotationAttachment = {
  id: string;
  name: string;
  url: string;
  fileId?: string;
  fileName?: string;
  mimeType?: string;
  viewUrl?: string;
  directUrl?: string;
  kind?: string;
  [key: string]: unknown;
};

type QuotationTotals = {
  subtotal: number;
  vatAmount: number;
  grandTotal: number;
  totalProposedCost: number;
  totalCost: number;
  grossProfit: number;
  gpPercent: number;
};

type QuotationRecord = {
  id: string;
  quotationNo: string;
  projectName: string;
  quotationDate: string;
  revision: number;
  status: QuotationStatus;
  customer: QuotationCustomer;
  items: QuotationItem[];
  costNotes: QuotationCostNote[];
  attachments: QuotationAttachment[];
  vatPercent: number;
  notes: string;
  paymentTerms: string;
  deliveryTerms: string;
  validityDays: number;
  totals?: QuotationTotals;
  pdfUrl?: string;
  xlsxUrl?: string;
  updatedAt?: string;
  createdAt?: string;
  [key: string]: unknown;
};

type QuotationListItem = {
  id: string;
  quotationNo: string;
  projectName: string;
  quotationDate: string;
  status: QuotationStatus;
  customerName: string;
  grandTotal: number;
  pdfUrl?: string;
  xlsxUrl?: string;
  updatedAt?: string;
};

type QuotationApi = {
  checkQuotationService: () => Promise<void>;
  createQuotation: (initial?: Partial<QuotationRecord>) => Promise<unknown>;
  saveQuotation: (record: QuotationRecord) => Promise<unknown>;
  listQuotations: (search?: string) => Promise<unknown>;
  getQuotation: (key: string) => Promise<unknown>;
  generateQuotationReport: (recordOrKey: QuotationRecord | string) => Promise<ServiceQuotationReportResult>;
  uploadQuotationFile: (
    file: File,
    kind: UploadKind,
    meta?: Record<string, unknown>,
  ) => Promise<ServiceQuotationFileRef>;
  deleteQuotationFile: (recordKey: string, fileId: string) => Promise<unknown>;
  computeQuotationTotals: (recordOrItems: unknown, ...args: unknown[]) => unknown;
};

type QuotationWorkspaceProps = {
  user: any;
  onClose: () => void;
  dark?: boolean;
  lang?: 'th' | 'en';
};

type RemovalRequest = {
  kind: 'item' | 'cost' | 'attachment' | 'image';
  id: string;
  label: string;
} | null;

type PendingNavigation =
  | { kind: 'close' }
  | { kind: 'new' }
  | { kind: 'open'; item: QuotationListItem }
  | null;

const quotationApi = quotationApiModule as unknown as QuotationApi;
const INITIAL_DRAFT_CACHE_MS = 30_000;
const initialDraftCache = new Map<string, { createdAt: number; promise: Promise<unknown> }>();

const INPUT_CLASS =
  'min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:disabled:bg-slate-800';
const BUTTON_BASE =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-50';

const STATUS_META: Record<QuotationStatus, { label: string; className: string }> = {
  draft: { label: 'ฉบับร่าง', className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200' },
  pending: { label: 'รอตรวจสอบ', className: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200' },
  sent: { label: 'ส่งแล้ว', className: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200' },
  approved: { label: 'อนุมัติ', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' },
  rejected: { label: 'ไม่อนุมัติ', className: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200' },
  cancelled: { label: 'ยกเลิก', className: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
};

function objectValue(value: unknown): Record<string, any> {
  return value && typeof value === 'object' ? (value as Record<string, any>) : {};
}

function unwrapRecord(value: unknown): Record<string, any> {
  const root = objectValue(value);
  if (root.quotation && typeof root.quotation === 'object') return objectValue(root.quotation);
  if (root.data && typeof root.data === 'object' && !Array.isArray(root.data)) {
    const data = objectValue(root.data);
    return data.quotation && typeof data.quotation === 'object' ? objectValue(data.quotation) : data;
  }
  return root;
}

function asNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asText(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function makeId(prefix: string): string {
  const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}

function localDate(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function dateInputValue(value: unknown): string {
  const text = asText(value);
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : localDate();
}

function createEmptyItem(): QuotationItem {
  return {
    id: makeId('item'),
    description: '',
    reference: '',
    quantity: 1,
    unit: 'ชิ้น',
    unitPrice: 0,
    unitCost: 0,
    remark: '',
    productRef: '',
    pictureUrl: '',
    pictureFileId: '',
  };
}

function createEmptyCostNote(): QuotationCostNote {
  return {
    id: makeId('cost'),
    description: '',
    proposedCost: 0,
    sbCost: 0,
    remark: '',
  };
}

function normalizeStatus(value: unknown): QuotationStatus {
  const status = asText(value, 'draft').toLowerCase() as QuotationStatus;
  return status in STATUS_META ? status : 'draft';
}

function normalizeItem(value: unknown, index: number): QuotationItem {
  const raw = objectValue(value);
  return {
    ...raw,
    id: asText(raw.id || raw.itemId, `item-${index + 1}-${makeId('row')}`),
    description: asText(raw.description || raw.productName || raw.name),
    reference: asText(raw.reference || raw.productRef || raw.ref || raw.sku),
    quantity: Math.max(0, asNumber(raw.quantity ?? raw.qty, 1)),
    unit: asText(raw.unit, 'ชิ้น'),
    unitPrice: Math.max(0, asNumber(raw.unitPrice ?? raw.price)),
    unitCost: Math.max(0, asNumber(raw.unitCost ?? raw.cost)),
    remark: asText(raw.remark || raw.note),
    imageUrl: asText(raw.imageUrl || raw.pictureUrl || raw.imageDirectUrl) || undefined,
    imageFileId: asText(raw.imageFileId || raw.pictureFileId || raw.fileId) || undefined,
  };
}

function normalizeCostNote(value: unknown, index: number): QuotationCostNote {
  const raw = objectValue(value);
  return {
    ...raw,
    id: asText(raw.id || raw.costId, `cost-${index + 1}-${makeId('row')}`),
    description: asText(raw.description || raw.title || raw.name),
    proposedCost: Math.max(0, asNumber(raw.proposedCost ?? raw.pcost)),
    sbCost: Math.max(0, asNumber(raw.sbCost ?? raw.amount ?? raw.cost)),
    remark: asText(raw.remark || raw.note),
  };
}

function normalizeAttachment(value: unknown, index: number): QuotationAttachment {
  const raw = objectValue(value);
  return {
    ...raw,
    id: asText(raw.id || raw.fileId, `attachment-${index + 1}-${makeId('file')}`),
    name: asText(raw.name || raw.fileName, `ไฟล์แนบ ${index + 1}`),
    url: asText(raw.url || raw.viewUrl || raw.directUrl),
    fileId: asText(raw.fileId) || undefined,
    fileName: asText(raw.fileName || raw.name) || undefined,
    mimeType: asText(raw.mimeType || raw.type) || undefined,
    viewUrl: asText(raw.viewUrl || raw.url) || undefined,
    directUrl: asText(raw.directUrl || raw.url) || undefined,
    kind: asText(raw.kind, 'quotation_attachments'),
  };
}

function reportUrl(raw: Record<string, any>, kind: 'pdf' | 'xlsx'): string | undefined {
  const reports = objectValue(raw.reports || raw.report);
  const direct = kind === 'pdf'
    ? raw.pdfUrl || raw.reportPdfUrl || raw.pdf || reports.pdfUrl || reports.pdf
    : raw.xlsxUrl || raw.excelUrl || raw.reportXlsxUrl || raw.xlsx || reports.xlsxUrl || reports.excelUrl || reports.xlsx;
  const nested = objectValue(direct);
  const directUrl = asText(typeof direct === 'string' ? direct : nested.viewUrl || nested.url || nested.directUrl);
  if (directUrl) return directUrl;

  const files = Array.isArray(raw.files) ? raw.files : [];
  const matching = files.find((file) => {
    const entry = objectValue(file);
    const signature = `${asText(entry.kind)} ${asText(entry.mimeType)} ${asText(entry.fileName || entry.name)}`.toLowerCase();
    return kind === 'pdf'
      ? signature.includes('pdf')
      : signature.includes('xlsx') || signature.includes('spreadsheet') || signature.includes('excel');
  });
  const file = objectValue(matching);
  return asText(file.viewUrl || file.url || file.directUrl) || undefined;
}

function normalizeQuotation(value: unknown, base?: QuotationRecord): QuotationRecord {
  const incoming = unwrapRecord(value);
  const embeddedRecord = objectValue(incoming.record);
  const raw = { ...(base || {}), ...embeddedRecord, ...incoming } as Record<string, any>;
  const rawCustomer = objectValue(raw.customer);
  const rawTerms = objectValue(raw.terms);
  const customer: QuotationCustomer = {
    ...rawCustomer,
    companyName: asText(rawCustomer.companyName || rawCustomer.name || raw.customerName),
    taxId: asText(rawCustomer.taxId || raw.taxId),
    branch: asText(rawCustomer.branch || rawCustomer.note || raw.branch),
    address: asText(rawCustomer.address || raw.customerAddress),
    contactName: asText(rawCustomer.contactName || rawCustomer.contactPerson || raw.contactName),
    phone: asText(rawCustomer.phone || raw.phone),
    email: asText(rawCustomer.email || raw.email),
  };
  const sourceItems = Array.isArray(raw.items) ? raw.items : [];
  const sourceCosts = Array.isArray(raw.costNotes) ? raw.costNotes : [];
  const sourceAttachments = Array.isArray(raw.attachments) ? raw.attachments : [];

  return {
    ...raw,
    id: asText(raw.id || raw.quotationId || raw.quotationNo, makeId('quotation')),
    quotationNo: asText(raw.quotationNo || raw.quoteNo, 'กำลังออกเลข...'),
    projectName: asText(raw.projectName || raw.project_name || raw.subject || raw.title),
    quotationDate: dateInputValue(raw.quotationDate || raw.date),
    revision: Math.max(0, Math.floor(asNumber(raw.revision, 0))),
    status: normalizeStatus(raw.status),
    customer,
    items: sourceItems.length > 0 ? sourceItems.map(normalizeItem) : [createEmptyItem()],
    costNotes: sourceCosts.map(normalizeCostNote),
    attachments: sourceAttachments.map(normalizeAttachment),
    vatPercent: Math.min(100, Math.max(0, asNumber(raw.vatPercent ?? raw.vatRate, 7))),
    notes: asText(raw.notes || raw.note),
    paymentTerms: asText(raw.paymentTerms || rawTerms.paymentTerms),
    deliveryTerms: asText(raw.deliveryTerms || rawTerms.deliveryTerms),
    validityDays: Math.max(0, Math.floor(asNumber(raw.validityDays ?? rawTerms.validityDays, 30))),
    pdfUrl: reportUrl(raw, 'pdf'),
    xlsxUrl: reportUrl(raw, 'xlsx'),
    updatedAt: asText(raw.updatedAt || raw.updated_at) || undefined,
    createdAt: asText(raw.createdAt || raw.created_at) || undefined,
  };
}

function serviceReadyRecord(record: QuotationRecord, totals: QuotationTotals): QuotationRecord {
  return {
    ...record,
    customer: {
      ...record.customer,
      name: record.customer.companyName,
      contactPerson: record.customer.contactName,
      note: record.customer.branch,
    },
    items: record.items.map((item, index) => ({
      ...item,
      lineNo: index + 1,
      productRef: item.reference,
      pictureUrl: item.imageUrl || '',
      pictureFileId: item.imageFileId || '',
    })),
    costNotes: record.costNotes.map((note, index) => ({
      ...note,
      lineNo: index + 1,
      proposedCost: note.proposedCost,
      gpPercent: note.proposedCost > 0
        ? ((note.proposedCost - note.sbCost) / note.proposedCost) * 100
        : 0,
      note: note.remark,
    })),
    attachments: record.attachments.map((attachment) => ({
      ...attachment,
      fileId: attachment.fileId || attachment.id,
      fileName: attachment.fileName || attachment.name,
      mimeType: attachment.mimeType || 'application/octet-stream',
      viewUrl: attachment.viewUrl || attachment.url,
      directUrl: attachment.directUrl || attachment.url,
      kind: attachment.kind || 'quotation_attachments',
    })),
    note: record.notes,
    terms: {
      validityDays: record.validityDays,
      paymentTerms: record.paymentTerms,
      deliveryTerms: record.deliveryTerms,
    },
    totals,
  };
}

function normalizeList(value: unknown): QuotationListItem[] {
  const root = objectValue(value);
  const values = Array.isArray(value)
    ? value
    : Array.isArray(root.items)
      ? root.items
      : Array.isArray(root.quotations)
        ? root.quotations
        : Array.isArray(root.data)
          ? root.data
          : [];

  return values.map((entry, index) => {
    const raw = objectValue(entry);
    const customer = objectValue(raw.customer);
    const totals = objectValue(raw.totals);
    return {
      id: asText(raw.id || raw.quotationId || raw.quotationNo, `quotation-${index + 1}`),
      quotationNo: asText(raw.quotationNo || raw.quoteNo, `Quotation ${index + 1}`),
      projectName: asText(raw.projectName || raw.project_name || raw.subject || raw.title),
      quotationDate: dateInputValue(raw.quotationDate || raw.date),
      status: normalizeStatus(raw.status),
      customerName: asText(raw.customerName || customer.companyName || customer.name, 'ยังไม่ระบุลูกค้า'),
      grandTotal: asNumber(raw.grandTotal ?? totals.grandTotal ?? raw.total),
      pdfUrl: reportUrl(raw, 'pdf'),
      xlsxUrl: reportUrl(raw, 'xlsx'),
      updatedAt: asText(raw.updatedAt || raw.updated_at) || undefined,
    };
  });
}

function fallbackTotals(record: QuotationRecord): QuotationTotals {
  const subtotal = record.items.reduce(
    (sum, item) => sum + Math.max(0, asNumber(item.quantity)) * Math.max(0, asNumber(item.unitPrice)),
    0,
  );
  const itemCost = record.items.reduce(
    (sum, item) => sum + Math.max(0, asNumber(item.quantity)) * Math.max(0, asNumber(item.unitCost)),
    0,
  );
  const totalProposedCost = record.costNotes.reduce(
    (sum, note) => sum + Math.max(0, asNumber(note.proposedCost)),
    0,
  );
  const hasSbCostBasis = record.costNotes.some((note) => asNumber(note.sbCost) > 0);
  const totalCost = hasSbCostBasis
    ? record.costNotes.reduce((sum, note) => sum + Math.max(0, asNumber(note.sbCost)), 0)
    : itemCost;
  const vatAmount = subtotal * Math.max(0, asNumber(record.vatPercent)) / 100;
  const grandTotal = subtotal + vatAmount;
  const grossProfit = subtotal - totalCost;
  const gpPercent = subtotal > 0 ? (grossProfit / subtotal) * 100 : 0;
  return { subtotal, vatAmount, grandTotal, totalProposedCost, totalCost, grossProfit, gpPercent };
}

function validateQuotationForReport(record: QuotationRecord): string | null {
  if (!record.customer.companyName.trim()) return 'กรุณาระบุชื่อบริษัทหรือชื่อลูกค้าก่อนสร้างรายงาน';
  const hasValidItem = record.items.some(
    (item) => item.description.trim().length > 0 && asNumber(item.quantity) > 0,
  );
  if (!hasValidItem) return 'กรุณาเพิ่มอย่างน้อย 1 รายการที่มีรายละเอียดและจำนวนมากกว่า 0';
  const vatPercent = asNumber(record.vatPercent, Number.NaN);
  if (!Number.isFinite(vatPercent) || vatPercent < 0 || vatPercent > 100) {
    return 'VAT ต้องอยู่ระหว่าง 0 ถึง 100%';
  }
  return null;
}

function isHeicFile(file: File): boolean {
  return /image\/hei[cf]/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
}

function isSupportedQuotationImage(file: File): boolean {
  const supportedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
  return supportedMimeTypes.has(file.type.toLowerCase()) || /\.(jpe?g|png|webp|gif)$/i.test(file.name);
}

function imageFormatError(file: File): string {
  return isHeicFile(file)
    ? 'ยังไม่รองรับรูป HEIC/HEIF กรุณาแปลงเป็น JPG, PNG, WebP หรือ GIF ก่อนอัปโหลด'
    : 'รองรับเฉพาะรูป JPG, PNG, WebP และ GIF เท่านั้น';
}

function normalizeTotals(value: unknown, fallback: QuotationTotals): QuotationTotals {
  const raw = objectValue(value);
  return {
    subtotal: asNumber(raw.subtotal ?? raw.totalAmount, fallback.subtotal),
    vatAmount: asNumber(raw.vatAmount, fallback.vatAmount),
    grandTotal: asNumber(raw.grandTotal ?? raw.total, fallback.grandTotal),
    totalProposedCost: asNumber(raw.totalProposedCost ?? raw.totalPcost, fallback.totalProposedCost),
    totalCost: asNumber(raw.totalCost ?? raw.costTotal, fallback.totalCost),
    grossProfit: asNumber(raw.grossProfit ?? raw.profit, fallback.grossProfit),
    gpPercent: asNumber(raw.gpPercent ?? raw.gp, fallback.gpPercent),
  };
}

function currency(value: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function compactCurrency(value: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Number.isFinite(value) ? value : 0);
}

function displayDate(value?: string): string {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }).format(parsed);
}

function userKey(user: any): string {
  return asText(
    user?.emp_id || user?.empId || user?.id || user?.user_id || user?.employee_id || user?.email || user?.username,
    'anonymous',
  );
}

function userDisplayName(user: any): string {
  return asText(user?.full_name || user?.display_name || user?.name || user?.username, 'ผู้ใช้งาน SB Connect');
}

function getInitialDraft(key: string, initial: Partial<QuotationRecord>): Promise<unknown> {
  const cached = initialDraftCache.get(key);
  if (cached && Date.now() - cached.createdAt < INITIAL_DRAFT_CACHE_MS) return cached.promise;
  const promise = quotationApi.createQuotation(initial);
  initialDraftCache.set(key, { createdAt: Date.now(), promise });
  const releaseAfterStrictModeReplay = () => {
    globalThis.setTimeout(() => {
      if (initialDraftCache.get(key)?.promise === promise) initialDraftCache.delete(key);
    }, 0);
  };
  promise.then(releaseAfterStrictModeReplay, releaseAfterStrictModeReplay);
  return promise;
}

function SectionCard({
  icon,
  title,
  description,
  action,
  children,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5 dark:border-slate-800">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
            {icon}
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">{title}</h2>
            {description ? <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</p> : null}
          </div>
        </div>
        {action}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  required,
  children,
  className = '',
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
        {label}
        {required ? <span className="ml-1 text-rose-500" aria-hidden="true">*</span> : null}
      </span>
      {children}
      {hint ? <span className="mt-1.5 block text-xs leading-5 text-slate-500 dark:text-slate-400">{hint}</span> : null}
    </label>
  );
}

function StatusBadge({ status }: { status: QuotationStatus }) {
  const meta = STATUS_META[status];
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${meta.className}`}>{meta.label}</span>;
}

function Metric({
  label,
  value,
  emphasis,
  tone = 'default',
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  tone?: 'default' | 'positive' | 'negative' | 'teal';
}) {
  const toneClass = tone === 'positive'
    ? 'text-emerald-600 dark:text-emerald-400'
    : tone === 'negative'
      ? 'text-rose-600 dark:text-rose-400'
      : tone === 'teal'
        ? 'text-teal-700 dark:text-teal-300'
        : 'text-slate-900 dark:text-white';
  return (
    <div className={`flex items-center justify-between gap-3 ${emphasis ? 'rounded-xl bg-teal-50 px-3 py-3 dark:bg-teal-950/60' : 'py-2'}`}>
      <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
      <span className={`${emphasis ? 'text-lg' : 'text-sm'} font-bold tabular-nums ${toneClass}`}>{value}</span>
    </div>
  );
}

function ReportLink({
  href,
  kind,
  compact = false,
}: {
  href?: string;
  kind: 'pdf' | 'xlsx';
  compact?: boolean;
}) {
  const isPdf = kind === 'pdf';
  if (!href) {
    return compact ? null : (
      <div className="flex min-h-11 items-center gap-3 rounded-xl border border-dashed border-slate-300 px-3 text-sm text-slate-400 dark:border-slate-700 dark:text-slate-500">
        {isPdf ? <FileText size={18} /> : <FileSpreadsheet size={18} />}
        ยังไม่มีไฟล์ {isPdf ? 'PDF' : 'Excel'}
      </div>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`${BUTTON_BASE} ${compact ? 'px-3 text-xs' : ''} border ${isPdf ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 focus:ring-rose-500/15 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 focus:ring-emerald-500/15 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300'}`}
    >
      {isPdf ? <FileText size={18} /> : <FileSpreadsheet size={18} />}
      {isPdf ? 'เปิด PDF' : 'เปิด Excel'}
      <ExternalLink size={14} />
    </a>
  );
}

export default function QuotationWorkspace({
  user,
  onClose,
  dark = false,
  lang = 'th',
}: QuotationWorkspaceProps) {
  const [view, setView] = useState<WorkspaceView>('editor');
  const [quotation, setQuotation] = useState<QuotationRecord | null>(null);
  const [reports, setReports] = useState<QuotationListItem[]>([]);
  const [search, setSearch] = useState('');
  const [booting, setBooting] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [deletingFile, setDeletingFile] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ kind: ToastKind; message: string } | null>(null);
  const [removal, setRemoval] = useState<RemovalRequest>(null);
  const [pendingNavigation, setPendingNavigation] = useState<PendingNavigation>(null);
  const [bootstrapVersion, setBootstrapVersion] = useState(0);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const historyMarkerRef = useRef<string | null>(null);
  const requestCloseRef = useRef<() => void>(() => undefined);
  const draftClientRequestIdRef = useRef<string>(makeId('quotation-open'));
  const currentUserKey = userKey(user);
  const isEnglish = lang === 'en';

  const showToast = (kind: ToastKind, message: string) => setToast({ kind, message });

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4_000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    let active = true;
    setBooting(true);
    setError('');

    const initial: Partial<QuotationRecord> = {
      quotationDate: localDate(),
      projectName: '',
      revision: 0,
      status: 'draft',
      vatPercent: 7,
      customer: {
        companyName: '',
        taxId: '',
        branch: '',
        address: '',
        contactName: '',
        phone: '',
        email: '',
      },
      items: [],
      costNotes: [],
      attachments: [],
      notes: '',
      paymentTerms: '',
      deliveryTerms: '',
      validityDays: 30,
      clientRequestId: draftClientRequestIdRef.current,
      createdBy: currentUserKey,
      createdByName: userDisplayName(user),
    };

    const serviceReady = quotationApi.checkQuotationService();
    Promise.allSettled([
      serviceReady.then(() => getInitialDraft(`${currentUserKey}:${bootstrapVersion}`, initial)),
      serviceReady.then(() => quotationApi.listQuotations('')),
    ])
      .then(([createdResult, listResult]) => {
        if (!active) return;
        if (createdResult.status === 'fulfilled') {
          setQuotation(normalizeQuotation(createdResult.value));
          setDirty(false);
        } else {
          const reason = createdResult.reason;
          setError(reason instanceof Error ? reason.message : 'ไม่สามารถเปิดระบบใบเสนอราคาได้');
        }
        if (listResult.status === 'fulfilled') {
          setReports(normalizeList(listResult.value));
        } else if (createdResult.status === 'fulfilled') {
          const reason = listResult.reason;
          showToast('info', reason instanceof Error
            ? `เปิดใบใหม่แล้ว แต่โหลดรายการเก่าไม่สำเร็จ: ${reason.message}`
            : 'เปิดใบใหม่แล้ว แต่ยังโหลดรายการใบเสนอราคาเก่าไม่ได้');
        }
      })
      .finally(() => {
        if (active) setBooting(false);
      });

    return () => {
      active = false;
    };
  }, [bootstrapVersion, currentUserKey]);

  useEffect(() => {
    if (view !== 'reports' || booting) return;
    let active = true;
    const timer = window.setTimeout(() => {
      setListLoading(true);
      quotationApi.listQuotations(search.trim())
        .then((value) => {
          if (active) setReports(normalizeList(value));
        })
        .catch((caught: unknown) => {
          if (active) showToast('error', caught instanceof Error ? caught.message : 'ค้นหารายงานไม่สำเร็จ');
        })
        .finally(() => {
          if (active) setListLoading(false);
        });
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [booting, search, view]);

  const totals = useMemo(() => {
    if (!quotation) return fallbackTotals(normalizeQuotation({}));
    const fallback = fallbackTotals(quotation);
    try {
      return normalizeTotals(
        quotationApi.computeQuotationTotals(quotation.items, quotation.costNotes, quotation.vatPercent),
        fallback,
      );
    } catch {
      return fallback;
    }
  }, [quotation]);

  const updateQuotation = (patch: Partial<QuotationRecord>) => {
    setDirty(true);
    setQuotation((current) => (current ? { ...current, ...patch } : current));
  };

  const updateCustomer = (field: keyof QuotationCustomer, value: string) => {
    setDirty(true);
    setQuotation((current) => current ? {
      ...current,
      customer: {
        ...current.customer,
        [field]: value,
        ...(field === 'companyName' ? { name: value } : {}),
        ...(field === 'contactName' ? { contactPerson: value } : {}),
        ...(field === 'branch' ? { note: value } : {}),
      },
    } : current);
  };

  const updateItem = <K extends keyof QuotationItem>(id: string, field: K, value: QuotationItem[K]) => {
    setDirty(true);
    setQuotation((current) => current ? {
      ...current,
      items: current.items.map((item) => item.id === id ? {
        ...item,
        [field]: value,
        ...(field === 'reference' ? { productRef: value } : {}),
      } : item),
    } : current);
  };

  const updateCostNote = <K extends keyof QuotationCostNote>(id: string, field: K, value: QuotationCostNote[K]) => {
    setDirty(true);
    setQuotation((current) => current ? {
      ...current,
      costNotes: current.costNotes.map((note) => note.id === id ? { ...note, [field]: value } : note),
    } : current);
  };

  const refreshList = async (term = search) => {
    setListLoading(true);
    try {
      const value = await quotationApi.listQuotations(term.trim());
      setReports(normalizeList(value));
    } catch (caught) {
      showToast('error', caught instanceof Error ? caught.message : 'โหลดรายการใบเสนอราคาไม่สำเร็จ');
    } finally {
      setListLoading(false);
    }
  };

  const saveCurrent = async (silent = false): Promise<QuotationRecord | null> => {
    if (!quotation) return null;
    setSaving(true);
    setError('');
    try {
      const payload = serviceReadyRecord(quotation, totals);
      const saved = normalizeQuotation(await quotationApi.saveQuotation(payload), payload);
      setQuotation(saved);
      setDirty(false);
      if (!silent) showToast('success', 'บันทึกฉบับร่างเรียบร้อยแล้ว');
      void refreshList('');
      return saved;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'บันทึกใบเสนอราคาไม่สำเร็จ';
      setError(message);
      showToast('error', message);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const generateReports = async () => {
    if (!quotation) return;
    const validationError = validateQuotationForReport(quotation);
    if (validationError) {
      setError(validationError);
      showToast('error', validationError);
      return;
    }
    setGenerating(true);
    setError('');
    try {
      const payload = serviceReadyRecord(quotation, totals);
      const generated = await quotationApi.generateQuotationReport(payload);
      const next = normalizeQuotation(generated, payload);
      setQuotation(next);
      const hasGeneratedFile = (Array.isArray(generated.files) && generated.files.length > 0)
        || Boolean(generated.pdf || generated.xlsx);
      if (hasGeneratedFile) {
        setDirty(false);
        showToast('success', generated.message || 'สร้าง PDF และ Excel เวอร์ชันล่าสุดแล้ว');
      } else {
        showToast(
          'info',
          generated.message || 'ยังไม่ได้รับไฟล์รายงาน กรุณาตรวจสอบ Apps Script endpoint และ Deploy เวอร์ชันล่าสุด',
        );
      }
      void refreshList('');
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'สร้างรายงาน PDF / Excel ไม่สำเร็จ';
      setError(message);
      showToast('error', message);
    } finally {
      setGenerating(false);
    }
  };

  const createNewQuotation = async () => {
    setBooting(true);
    setError('');
    draftClientRequestIdRef.current = makeId('quotation-open');
    try {
      const created = await quotationApi.createQuotation({
        quotationDate: localDate(),
        projectName: '',
        revision: 0,
        status: 'draft',
        vatPercent: 7,
        clientRequestId: draftClientRequestIdRef.current,
        createdBy: currentUserKey,
        createdByName: userDisplayName(user),
      });
      setQuotation(normalizeQuotation(created));
      setDirty(false);
      setView('editor');
      showToast('success', 'เปิดใบเสนอราคาใหม่แล้ว');
      void refreshList('');
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'เปิดใบเสนอราคาใหม่ไม่สำเร็จ';
      setError(message);
      showToast('error', message);
    } finally {
      setBooting(false);
    }
  };

  const loadQuotation = async (item: QuotationListItem) => {
    setOpeningId(item.id);
    setError('');
    try {
      const loaded = await quotationApi.getQuotation(item.id || item.quotationNo);
      setQuotation(normalizeQuotation(loaded));
      setDirty(false);
      setView('editor');
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'เปิดใบเสนอราคาไม่สำเร็จ';
      setError(message);
      showToast('error', message);
    } finally {
      setOpeningId(null);
    }
  };

  const uploadItemImage = async (itemId: string, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !quotation) return;
    if (!isSupportedQuotationImage(file)) {
      showToast('error', imageFormatError(file));
      return;
    }
    setUploadingItemId(itemId);
    try {
      const uploaded = await quotationApi.uploadQuotationFile(file, 'quotation_images', {
        quotationId: quotation.id,
        quotationNo: quotation.quotationNo,
        itemId,
      });
      const imageUrl = uploaded.directUrl || uploaded.viewUrl || uploaded.url;
      if (!imageUrl) throw new Error('อัปโหลดสำเร็จแต่ไม่พบ URL ของรูป');
      setQuotation((current) => current ? {
        ...current,
        items: current.items.map((item) => item.id === itemId ? {
          ...item,
          imageUrl,
          imageFileId: uploaded.fileId,
          pictureUrl: imageUrl,
          pictureFileId: uploaded.fileId,
        } : item),
      } : current);
      setDirty(true);
      showToast('success', 'อัปโหลดรูปสินค้าแล้ว');
    } catch (caught) {
      showToast('error', caught instanceof Error ? caught.message : 'อัปโหลดรูปไม่สำเร็จ');
    } finally {
      setUploadingItemId(null);
    }
  };

  const uploadAttachment = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !quotation) return;
    if ((file.type.startsWith('image/') || /\.(heic|heif|jpe?g|png|webp|gif)$/i.test(file.name))
      && !isSupportedQuotationImage(file)) {
      showToast('error', imageFormatError(file));
      return;
    }
    setUploadingAttachment(true);
    try {
      const uploaded = await quotationApi.uploadQuotationFile(file, 'quotation_attachments', {
        quotationId: quotation.id,
        quotationNo: quotation.quotationNo,
      });
      const url = uploaded.viewUrl || uploaded.directUrl || uploaded.url;
      if (!url) throw new Error('อัปโหลดสำเร็จแต่ไม่พบ URL ของไฟล์');
      const attachment: QuotationAttachment = {
        id: uploaded.fileId || makeId('attachment'),
        name: asText(uploaded.fileName, file.name),
        url,
        fileId: uploaded.fileId,
        fileName: asText(uploaded.fileName, file.name),
        mimeType: asText(uploaded.mimeType, file.type),
        viewUrl: uploaded.viewUrl || url,
        directUrl: uploaded.directUrl || url,
        kind: asText(uploaded.kind, 'quotation_attachments'),
      };
      updateQuotation({ attachments: [...quotation.attachments, attachment] });
      showToast('success', 'แนบไฟล์เรียบร้อยแล้ว');
    } catch (caught) {
      showToast('error', caught instanceof Error ? caught.message : 'แนบไฟล์ไม่สำเร็จ');
    } finally {
      setUploadingAttachment(false);
    }
  };

  const confirmRemoval = async () => {
    if (!removal || deletingFile) return;

    if ((removal.kind === 'image' || removal.kind === 'attachment') && quotation) {
      const fileId = removal.kind === 'image'
        ? quotation.items.find((item) => item.id === removal.id)?.imageFileId
        : quotation.attachments.find((file) => file.id === removal.id)?.fileId;
      if (fileId) {
        setDeletingFile(true);
        try {
          if (typeof quotationApi.deleteQuotationFile !== 'function') {
            throw new Error('ระบบลบไฟล์บน Drive ยังไม่พร้อม กรุณา Deploy Apps Script เวอร์ชันล่าสุด');
          }
          const deleted = objectValue(await quotationApi.deleteQuotationFile(
            quotation.id || quotation.quotationNo,
            fileId,
          ));
          if (deleted.ok === false) {
            throw new Error(asText(deleted.message, 'ลบไฟล์บน Drive ไม่สำเร็จ'));
          }
        } catch (caught) {
          const message = caught instanceof Error ? caught.message : 'ลบไฟล์บน Drive ไม่สำเร็จ';
          setError(message);
          showToast('error', message);
          setDeletingFile(false);
          return;
        }
        setDeletingFile(false);
      }
    }

    setQuotation((current) => {
      if (!current) return current;
      if (removal.kind === 'item') {
        const remaining = current.items.filter((item) => item.id !== removal.id);
        return { ...current, items: remaining.length > 0 ? remaining : [createEmptyItem()] };
      }
      if (removal.kind === 'cost') {
        return { ...current, costNotes: current.costNotes.filter((note) => note.id !== removal.id) };
      }
      if (removal.kind === 'attachment') {
        return { ...current, attachments: current.attachments.filter((file) => file.id !== removal.id) };
      }
      return {
        ...current,
        items: current.items.map((item) => item.id === removal.id
          ? {
            ...item,
            imageUrl: undefined,
            imageFileId: undefined,
            pictureUrl: '',
            pictureFileId: '',
          }
          : item),
      };
    });
    setDirty(true);
    setRemoval(null);
    showToast('info', 'นำรายการออกจากใบเสนอราคาแล้ว กดบันทึกเพื่อยืนยันการเปลี่ยนแปลง');
  };

  const closeWorkspace = () => {
    const marker = historyMarkerRef.current;
    const currentHistory = objectValue(window.history.state);
    const shouldRemoveGuard = Boolean(marker && currentHistory.__sbQuotationWorkspaceGuard === marker);
    historyMarkerRef.current = null;
    onClose();
    if (shouldRemoveGuard) window.setTimeout(() => window.history.back(), 0);
  };

  const requestClose = () => {
    if (saving || generating || uploadingAttachment || Boolean(uploadingItemId) || deletingFile) {
      showToast('info', 'กรุณารอให้การบันทึกหรืออัปโหลดปัจจุบันเสร็จก่อน');
      return;
    }
    if (dirty) {
      setPendingNavigation({ kind: 'close' });
      return;
    }
    closeWorkspace();
  };

  requestCloseRef.current = requestClose;

  const requestNewQuotation = () => {
    if (saving || generating || uploadingAttachment || Boolean(uploadingItemId) || deletingFile) {
      showToast('info', 'กรุณารอให้การบันทึกหรืออัปโหลดปัจจุบันเสร็จก่อน');
      return;
    }
    if (dirty) {
      setPendingNavigation({ kind: 'new' });
      return;
    }
    void createNewQuotation();
  };

  const requestOpenQuotation = (item: QuotationListItem) => {
    if (saving || generating || uploadingAttachment || Boolean(uploadingItemId) || deletingFile) {
      showToast('info', 'กรุณารอให้การบันทึกหรืออัปโหลดปัจจุบันเสร็จก่อน');
      return;
    }
    if (dirty) {
      setPendingNavigation({ kind: 'open', item });
      return;
    }
    void loadQuotation(item);
  };

  const discardChangesAndContinue = () => {
    const navigation = pendingNavigation;
    if (!navigation) return;
    setPendingNavigation(null);
    setDirty(false);
    if (navigation.kind === 'close') {
      closeWorkspace();
    } else if (navigation.kind === 'new') {
      void createNewQuotation();
    } else {
      void loadQuotation(navigation.item);
    }
  };

  useEffect(() => {
    const currentHistory = objectValue(window.history.state);
    const existingMarker = asText(currentHistory.__sbQuotationWorkspaceGuard);
    const marker = existingMarker || makeId('quotation-history');
    historyMarkerRef.current = marker;
    if (!existingMarker) {
      window.history.pushState(
        { ...currentHistory, __sbQuotationWorkspaceGuard: marker },
        '',
        window.location.href,
      );
    }

    const handlePopState = () => {
      const activeMarker = historyMarkerRef.current;
      if (!activeMarker) return;
      window.history.pushState(
        { ...objectValue(window.history.state), __sbQuotationWorkspaceGuard: activeMarker },
        '',
        window.location.href,
      );
      requestCloseRef.current();
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      if (deletingFile) return;
      if (removal) {
        setRemoval(null);
      } else if (pendingNavigation) {
        setPendingNavigation(null);
      } else {
        requestCloseRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deletingFile, pendingNavigation, removal]);

  const retryBootstrap = () => {
    initialDraftCache.delete(`${currentUserKey}:${bootstrapVersion}`);
    setBootstrapVersion((value) => value + 1);
  };

  const busy = booting || saving || generating || uploadingAttachment || Boolean(uploadingItemId) || deletingFile;

  return (
    <div className={dark ? 'dark' : ''}>
      <div className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <header
          className="relative z-20 shrink-0 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/95"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <div className="mx-auto flex h-16 max-w-[1500px] items-center gap-2 px-3 sm:px-5">
            <button
              type="button"
              onClick={requestClose}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-teal-500/15 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label={isEnglish ? 'Back to Services' : 'กลับไปหน้า Services'}
            >
              <ArrowLeft size={22} />
            </button>
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-md shadow-teal-500/20 sm:flex">
                <ReceiptText size={22} />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-base font-extrabold sm:text-lg">Quotation Workspace</h1>
                <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                  {quotation?.quotationNo || 'กำลังเตรียมใบเสนอราคา'} · {userDisplayName(user)}
                  {dirty ? <span className="ml-1 font-bold text-amber-600 dark:text-amber-400">· ยังไม่บันทึก</span> : null}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={requestNewQuotation}
              disabled={busy}
              className={`${BUTTON_BASE} hidden border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus:ring-slate-500/10 sm:inline-flex dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800`}
            >
              <FilePlus2 size={18} />
              {isEnglish ? 'New' : 'ใบใหม่'}
            </button>
            <button
              type="button"
              onClick={() => void saveCurrent()}
              disabled={!quotation || busy}
              className={`${BUTTON_BASE} bg-teal-600 text-white shadow-sm hover:bg-teal-700 focus:ring-teal-500/20`}
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              <span className="hidden sm:inline">บันทึกร่าง</span>
              <span className="sm:hidden">บันทึก</span>
            </button>
          </div>
          <nav className="mx-auto flex max-w-[1500px] gap-1 px-3 pb-2 sm:px-5" aria-label={isEnglish ? 'Quotation views' : 'มุมมองใบเสนอราคา'}>
            <button
              type="button"
              onClick={() => setView('editor')}
              className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition sm:flex-none ${view === 'editor' ? 'bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'}`}
              aria-current={view === 'editor' ? 'page' : undefined}
            >
              <FileText size={18} />
              {isEnglish ? 'Create / Edit' : 'สร้าง / แก้ไข'}
            </button>
            <button
              type="button"
              onClick={() => setView('reports')}
              className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition sm:flex-none ${view === 'reports' ? 'bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'}`}
              aria-current={view === 'reports' ? 'page' : undefined}
            >
              <FileSpreadsheet size={18} />
              {isEnglish ? 'All reports' : 'รายงานทั้งหมด'}
            </button>
          </nav>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {booting ? (
            <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
                <Loader2 size={30} className="animate-spin" />
              </span>
              <div>
                <p className="font-bold text-slate-900 dark:text-white">กำลังเปิดใบเสนอราคาใหม่</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">ระบบกำลังออกเลขเอกสารและเตรียมพื้นที่รายงานบน Drive</p>
              </div>
            </div>
          ) : error && !quotation ? (
            <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-300">
                <AlertCircle size={30} />
              </span>
              <h2 className="mt-4 text-lg font-bold">เปิดระบบ Quotation ไม่สำเร็จ</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{error}</p>
              <button
                type="button"
                onClick={retryBootstrap}
                className={`${BUTTON_BASE} mt-5 bg-teal-600 text-white hover:bg-teal-700 focus:ring-teal-500/20`}
              >
                <RefreshCw size={18} />
                ลองใหม่
              </button>
            </div>
          ) : view === 'reports' ? (
            <div className="mx-auto max-w-6xl px-3 py-4 pb-24 sm:px-5 sm:py-6">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">รายงานใบเสนอราคา</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">ค้นหา เปิดแก้ไข และเรียกดูไฟล์ PDF / Excel จาก Drive</p>
                </div>
                <button
                  type="button"
                  onClick={requestNewQuotation}
                  disabled={busy}
                  className={`${BUTTON_BASE} bg-teal-600 text-white hover:bg-teal-700 focus:ring-teal-500/20`}
                >
                  <Plus size={18} />
                  {isEnglish ? 'New quotation' : 'เปิดใบใหม่'}
                </button>
              </div>

              <div className="mb-4 flex gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <label className="relative min-w-0 flex-1">
                  <span className="sr-only">ค้นหาใบเสนอราคา</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={19} />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className={`${INPUT_CLASS} border-0 pl-10 focus:ring-0`}
                    placeholder="ค้นหาเลขที่ใบเสนอราคา โครงการ หรือลูกค้า..."
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void refreshList()}
                  disabled={listLoading}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-teal-500/15 dark:text-slate-300 dark:hover:bg-slate-800"
                  aria-label="รีเฟรชรายการ"
                >
                  <RefreshCw size={19} className={listLoading ? 'animate-spin' : ''} />
                </button>
              </div>

              {listLoading && reports.length === 0 ? (
                <div className="flex min-h-48 items-center justify-center text-slate-500">
                  <Loader2 size={24} className="mr-2 animate-spin" /> กำลังโหลดรายงาน...
                </div>
              ) : reports.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center dark:border-slate-700 dark:bg-slate-900">
                  <FileText className="mx-auto text-slate-300 dark:text-slate-600" size={42} />
                  <h3 className="mt-4 font-bold">ไม่พบใบเสนอราคา</h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">ลองเปลี่ยนคำค้นหา หรือเปิดใบเสนอราคาใหม่</p>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {reports.map((item) => (
                    <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-teal-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-teal-800">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate font-extrabold text-slate-900 dark:text-white">{item.quotationNo}</h3>
                            <StatusBadge status={item.status} />
                          </div>
                          {item.projectName ? (
                            <p className="mt-2 truncate text-xs font-bold text-teal-700 dark:text-teal-300">{item.projectName}</p>
                          ) : null}
                          <p className={`${item.projectName ? 'mt-1' : 'mt-2'} truncate text-sm font-semibold text-slate-700 dark:text-slate-200`}>{item.customerName}</p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">วันที่ {displayDate(item.quotationDate)}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xs text-slate-500 dark:text-slate-400">ยอดสุทธิ</p>
                          <p className="mt-1 font-extrabold tabular-nums text-teal-700 dark:text-teal-300">{compactCurrency(item.grandTotal)}</p>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() => requestOpenQuotation(item)}
                          disabled={openingId === item.id || busy}
                          className={`${BUTTON_BASE} flex-1 bg-slate-900 text-white hover:bg-slate-800 focus:ring-slate-500/20 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100`}
                        >
                          {openingId === item.id ? <Loader2 size={17} className="animate-spin" /> : <FileText size={17} />}
                          เปิดใบนี้
                          <ChevronRight size={16} />
                        </button>
                        <ReportLink href={item.pdfUrl} kind="pdf" compact />
                        <ReportLink href={item.xlsxUrl} kind="xlsx" compact />
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          ) : quotation ? (
            <div className="mx-auto grid max-w-[1500px] gap-4 px-3 py-4 pb-32 sm:px-5 sm:py-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
              <div className="min-w-0 space-y-4">
                {error ? (
                  <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200" role="alert">
                    <AlertCircle className="mt-0.5 shrink-0" size={18} />
                    <span className="min-w-0 flex-1">{error}</span>
                    <button type="button" onClick={() => setError('')} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900" aria-label="ปิดข้อความผิดพลาด">
                      <X size={16} />
                    </button>
                  </div>
                ) : null}

                <SectionCard icon={<ReceiptText size={20} />} title="ข้อมูลใบเสนอราคา" description="เลขที่เอกสารถูกออกให้อัตโนมัติ และบันทึกเป็นฉบับร่างได้ตลอดเวลา">
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                    <Field label="เลขที่ใบเสนอราคา" className="sm:col-span-2 xl:col-span-1">
                      <input value={quotation.quotationNo} readOnly className={`${INPUT_CLASS} font-bold text-teal-700 dark:text-teal-300`} />
                    </Field>
                    <Field label="วันที่">
                      <input type="date" value={quotation.quotationDate} onChange={(event) => updateQuotation({ quotationDate: event.target.value })} className={INPUT_CLASS} />
                    </Field>
                    <Field label="Revision">
                      <input type="number" min="0" step="1" value={quotation.revision} onChange={(event) => updateQuotation({ revision: Math.max(0, asNumber(event.target.value)) })} className={INPUT_CLASS} />
                    </Field>
                    <Field label="VAT (%)">
                      <input type="number" min="0" max="100" step="0.01" value={quotation.vatPercent} onChange={(event) => updateQuotation({ vatPercent: Math.min(100, Math.max(0, asNumber(event.target.value))) })} className={INPUT_CLASS} />
                    </Field>
                    <Field label="สถานะ">
                      <select value={quotation.status} onChange={(event) => updateQuotation({ status: normalizeStatus(event.target.value) })} className={INPUT_CLASS}>
                        {Object.entries(STATUS_META).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
                      </select>
                    </Field>
                    <Field label="โครงการ / หัวข้องาน" className="sm:col-span-2 xl:col-span-5">
                      <input
                        value={quotation.projectName}
                        onChange={(event) => updateQuotation({ projectName: event.target.value })}
                        className={INPUT_CLASS}
                        placeholder="เช่น Project Quotation – ติดตั้งระบบคลังสินค้า"
                      />
                    </Field>
                  </div>
                </SectionCard>

                <SectionCard icon={<Building2 size={20} />} title="ข้อมูลลูกค้า" description="ข้อมูลส่วนนี้จะแสดงบนหัวเอกสาร PDF และ Excel">
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    <Field label="บริษัท / ชื่อลูกค้า" required className="sm:col-span-2">
                      <div className="relative">
                        <Building2 className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                        <input value={quotation.customer.companyName} onChange={(event) => updateCustomer('companyName', event.target.value)} className={`${INPUT_CLASS} pl-10`} placeholder="ชื่อบริษัทหรือลูกค้า" />
                      </div>
                    </Field>
                    <Field label="เลขประจำตัวผู้เสียภาษี">
                      <input value={quotation.customer.taxId} onChange={(event) => updateCustomer('taxId', event.target.value)} className={INPUT_CLASS} inputMode="numeric" placeholder="13 หลัก" />
                    </Field>
                    <Field label="สาขา">
                      <input value={quotation.customer.branch} onChange={(event) => updateCustomer('branch', event.target.value)} className={INPUT_CLASS} placeholder="สำนักงานใหญ่ / สาขา..." />
                    </Field>
                    <Field label="ผู้ติดต่อ">
                      <div className="relative">
                        <UserRound className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                        <input value={quotation.customer.contactName} onChange={(event) => updateCustomer('contactName', event.target.value)} className={`${INPUT_CLASS} pl-10`} placeholder="ชื่อผู้ติดต่อ" />
                      </div>
                    </Field>
                    <Field label="โทรศัพท์">
                      <div className="relative">
                        <Phone className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                        <input type="tel" value={quotation.customer.phone} onChange={(event) => updateCustomer('phone', event.target.value)} className={`${INPUT_CLASS} pl-10`} placeholder="0xx-xxx-xxxx" />
                      </div>
                    </Field>
                    <Field label="อีเมล">
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                        <input type="email" value={quotation.customer.email} onChange={(event) => updateCustomer('email', event.target.value)} className={`${INPUT_CLASS} pl-10`} placeholder="customer@example.com" />
                      </div>
                    </Field>
                    <Field label="ที่อยู่" className="sm:col-span-2 xl:col-span-3">
                      <div className="relative">
                        <MapPin className="pointer-events-none absolute left-3 top-3 text-slate-400" size={17} />
                        <textarea value={quotation.customer.address} onChange={(event) => updateCustomer('address', event.target.value)} className={`${INPUT_CLASS} min-h-24 resize-y pl-10`} placeholder="ที่อยู่สำหรับออกใบเสนอราคา" />
                      </div>
                    </Field>
                  </div>
                </SectionCard>

                <SectionCard
                  icon={<PackagePlus size={20} />}
                  title="รายการสินค้า / บริการ"
                  description="เพิ่มรายละเอียด ราคา ต้นทุน และรูปประกอบของแต่ละรายการ"
                  action={(
                    <button
                      type="button"
                      onClick={() => updateQuotation({ items: [...quotation.items, createEmptyItem()] })}
                      className={`${BUTTON_BASE} border border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100 focus:ring-teal-500/15 dark:border-teal-900 dark:bg-teal-950 dark:text-teal-300`}
                    >
                      <Plus size={17} /> เพิ่มรายการ
                    </button>
                  )}
                >
                  <div className="space-y-4">
                    {quotation.items.map((item, index) => {
                      const lineTotal = item.quantity * item.unitPrice;
                      const lineCost = item.quantity * item.unitCost;
                      return (
                        <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4 dark:border-slate-700 dark:bg-slate-950/50">
                          <div className="mb-4 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-sm font-extrabold text-teal-700 shadow-sm dark:bg-slate-900 dark:text-teal-300">{index + 1}</span>
                              <div>
                                <h3 className="text-sm font-bold">รายการที่ {index + 1}</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">ยอดขาย {currency(lineTotal)} · ต้นทุน {currency(lineCost)}</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setRemoval({ kind: 'item', id: item.id, label: `รายการที่ ${index + 1}` })}
                              className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 focus:outline-none focus:ring-4 focus:ring-rose-500/15 dark:hover:bg-rose-950"
                              aria-label={`ลบรายการที่ ${index + 1}`}
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>

                          <div className="grid gap-4 md:grid-cols-[150px_minmax(0,1fr)]">
                            <div>
                              <div className="relative flex aspect-square min-h-[150px] items-center justify-center overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900">
                                {item.imageUrl ? (
                                  <img src={item.imageUrl} alt={`รูปประกอบ ${item.description || `รายการที่ ${index + 1}`}`} className="h-full w-full object-cover" />
                                ) : (
                                  <div className="px-4 text-center text-slate-400">
                                    <FileImage className="mx-auto" size={34} />
                                    <span className="mt-2 block text-xs">ยังไม่มีรูป</span>
                                  </div>
                                )}
                                {uploadingItemId === item.id ? (
                                  <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-slate-900/80">
                                    <Loader2 className="animate-spin text-teal-600" size={28} />
                                  </div>
                                ) : null}
                              </div>
                              <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                                <label className={`${BUTTON_BASE} cursor-pointer border border-slate-200 bg-white px-3 text-slate-700 hover:bg-slate-50 focus-within:ring-4 focus-within:ring-teal-500/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200`}>
                                  <ImagePlus size={17} />
                                  {item.imageUrl ? 'เปลี่ยนรูป' : 'เพิ่มรูป'}
                                  <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
                                    className="sr-only"
                                    onChange={(event) => void uploadItemImage(item.id, event)}
                                    disabled={uploadingItemId === item.id}
                                  />
                                </label>
                                {item.imageUrl ? (
                                  <button
                                    type="button"
                                    onClick={() => setRemoval({ kind: 'image', id: item.id, label: `รูปของรายการที่ ${index + 1}` })}
                                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 focus:outline-none focus:ring-4 focus:ring-rose-500/15 dark:border-slate-700 dark:bg-slate-900"
                                    aria-label={`ลบรูปของรายการที่ ${index + 1}`}
                                  >
                                    <Trash2 size={17} />
                                  </button>
                                ) : null}
                              </div>
                            </div>

                            <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-6">
                              <Field label="รายละเอียดสินค้า / บริการ" required className="sm:col-span-2 xl:col-span-4">
                                <input value={item.description} onChange={(event) => updateItem(item.id, 'description', event.target.value)} className={INPUT_CLASS} placeholder="ชื่อสินค้า รุ่น หรืองานบริการ" />
                              </Field>
                              <Field label="Ref. / SKU" className="xl:col-span-2">
                                <input value={item.reference} onChange={(event) => updateItem(item.id, 'reference', event.target.value)} className={INPUT_CLASS} placeholder="รหัสอ้างอิง" />
                              </Field>
                              <Field label="จำนวน" className="xl:col-span-1">
                                <input type="number" min="0" step="0.01" value={item.quantity} onChange={(event) => updateItem(item.id, 'quantity', Math.max(0, asNumber(event.target.value)))} className={INPUT_CLASS} inputMode="decimal" />
                              </Field>
                              <Field label="หน่วย" className="xl:col-span-1">
                                <input value={item.unit} onChange={(event) => updateItem(item.id, 'unit', event.target.value)} className={INPUT_CLASS} placeholder="ชิ้น" />
                              </Field>
                              <Field label="ราคาต่อหน่วย" className="xl:col-span-2">
                                <input type="number" min="0" step="0.01" value={item.unitPrice} onChange={(event) => updateItem(item.id, 'unitPrice', Math.max(0, asNumber(event.target.value)))} className={INPUT_CLASS} inputMode="decimal" />
                              </Field>
                              <Field label="ต้นทุนต่อหน่วย" hint="ใช้คำนวณ GP เมื่อไม่มี SB Cost Note" className="xl:col-span-2">
                                <input type="number" min="0" step="0.01" value={item.unitCost} onChange={(event) => updateItem(item.id, 'unitCost', Math.max(0, asNumber(event.target.value)))} className={INPUT_CLASS} inputMode="decimal" />
                              </Field>
                              <Field label="หมายเหตุรายการ" className="sm:col-span-2 xl:col-span-6">
                                <textarea value={item.remark} onChange={(event) => updateItem(item.id, 'remark', event.target.value)} className={`${INPUT_CLASS} min-h-20 resize-y`} placeholder="รายละเอียดเพิ่มเติม เงื่อนไข หรือข้อมูลเฉพาะรายการ" />
                              </Field>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </SectionCard>

                <SectionCard
                  icon={<CircleDollarSign size={20} />}
                  title="SB Cost Notes (ฐานคำนวณ GP)"
                  description="เมื่อมี SB Cost มากกว่า 0 ระบบจะใช้ยอด SB Cost รวมเป็นต้นทุนทั้งหมดแทนต้นทุนต่อหน่วยในรายการสินค้า"
                  action={(
                    <button
                      type="button"
                      onClick={() => updateQuotation({ costNotes: [...quotation.costNotes, createEmptyCostNote()] })}
                      className={`${BUTTON_BASE} border border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100 focus:ring-teal-500/15 dark:border-teal-900 dark:bg-teal-950 dark:text-teal-300`}
                    >
                      <Plus size={17} /> เพิ่ม Cost
                    </button>
                  )}
                >
                  {quotation.costNotes.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      ยังไม่มี SB Cost Note — GP กำลังคำนวณจากจำนวน × ต้นทุนต่อหน่วยของสินค้า
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {quotation.costNotes.map((note, index) => {
                        const rowGp = note.proposedCost > 0
                          ? ((note.proposedCost - note.sbCost) / note.proposedCost) * 100
                          : 0;
                        return (
                          <div key={note.id} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_minmax(130px,1fr)_minmax(130px,1fr)_100px_44px] dark:border-slate-700 dark:bg-slate-950/50">
                            <Field label={`รายละเอียด Cost ${index + 1}`}>
                              <input value={note.description} onChange={(event) => updateCostNote(note.id, 'description', event.target.value)} className={INPUT_CLASS} placeholder="เช่น ค่าขนส่ง ค่าแรง วัตถุดิบ" />
                            </Field>
                            <Field label="Proposed Cost">
                              <input type="number" min="0" step="0.01" value={note.proposedCost} onChange={(event) => updateCostNote(note.id, 'proposedCost', Math.max(0, asNumber(event.target.value)))} className={INPUT_CLASS} inputMode="decimal" />
                            </Field>
                            <Field label="SB Cost">
                              <input type="number" min="0" step="0.01" value={note.sbCost} onChange={(event) => updateCostNote(note.id, 'sbCost', Math.max(0, asNumber(event.target.value)))} className={INPUT_CLASS} inputMode="decimal" />
                            </Field>
                            <div>
                              <span className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">GP ต่อรายการ</span>
                              <div className={`flex min-h-11 items-center justify-center rounded-xl px-3 text-sm font-extrabold tabular-nums ${rowGp >= 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'}`}>
                                {rowGp.toFixed(2)}%
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setRemoval({ kind: 'cost', id: note.id, label: `Cost Note ${index + 1}` })}
                              className="mt-auto flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600 focus:outline-none focus:ring-4 focus:ring-rose-500/15 dark:hover:bg-rose-950"
                              aria-label={`ลบ Cost Note ${index + 1}`}
                            >
                              <Trash2 size={18} />
                            </button>
                            <Field label="หมายเหตุ Cost" className="sm:col-span-2 xl:col-span-5">
                              <input value={note.remark} onChange={(event) => updateCostNote(note.id, 'remark', event.target.value)} className={INPUT_CLASS} placeholder="รายละเอียดหรือที่มาของต้นทุน (ถ้ามี)" />
                            </Field>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </SectionCard>

                <SectionCard
                  icon={<Paperclip size={20} />}
                  title="ไฟล์แนบ"
                  description="แนบรูป เอกสาร หรือไฟล์อ้างอิงไว้กับใบเสนอราคาเดียวกันบน Google Drive"
                  action={(
                    <>
                      <input
                        ref={attachmentInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif,.pdf,.xlsx,.docx,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        className="sr-only"
                        onChange={(event) => void uploadAttachment(event)}
                      />
                      <button
                        type="button"
                        onClick={() => attachmentInputRef.current?.click()}
                        disabled={uploadingAttachment}
                        className={`${BUTTON_BASE} border border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100 focus:ring-teal-500/15 dark:border-teal-900 dark:bg-teal-950 dark:text-teal-300`}
                      >
                        {uploadingAttachment ? <Loader2 size={17} className="animate-spin" /> : <Upload size={17} />}
                        แนบไฟล์
                      </button>
                    </>
                  )}
                >
                  {quotation.attachments.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">ยังไม่มีไฟล์แนบ</div>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {quotation.attachments.map((attachment) => (
                        <div key={attachment.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 p-2 dark:border-slate-700">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                            <Paperclip size={18} />
                          </span>
                          <a href={attachment.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm font-semibold text-teal-700 hover:underline dark:text-teal-300">{attachment.name}</a>
                          <button
                            type="button"
                            onClick={() => setRemoval({ kind: 'attachment', id: attachment.id, label: attachment.name })}
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600 focus:outline-none focus:ring-4 focus:ring-rose-500/15 dark:hover:bg-rose-950"
                            aria-label={`ลบไฟล์ ${attachment.name}`}
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>

                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <button
                    type="button"
                    onClick={() => setTermsOpen((open) => !open)}
                    className="flex min-h-[72px] w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-inset focus:ring-teal-500/10 sm:px-5 dark:hover:bg-slate-800/60"
                    aria-expanded={termsOpen}
                    aria-controls="quotation-terms-panel"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
                      <ShieldCheck size={20} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-bold text-slate-900 dark:text-white">เงื่อนไขและหมายเหตุ</span>
                      <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
                        อายุ {quotation.validityDays} วัน{quotation.paymentTerms ? ` · ${quotation.paymentTerms}` : ''}
                      </span>
                    </span>
                    <ChevronRight size={20} className={`shrink-0 text-slate-400 transition-transform ${termsOpen ? 'rotate-90' : ''}`} />
                  </button>
                  {termsOpen ? (
                    <div id="quotation-terms-panel" className="grid gap-4 border-t border-slate-100 p-4 sm:grid-cols-2 sm:p-5 dark:border-slate-800">
                      <Field label="เงื่อนไขการชำระเงิน">
                        <input value={quotation.paymentTerms} onChange={(event) => updateQuotation({ paymentTerms: event.target.value })} className={INPUT_CLASS} placeholder="เช่น เครดิต 30 วัน" />
                      </Field>
                      <Field label="กำหนดส่งมอบ">
                        <input value={quotation.deliveryTerms} onChange={(event) => updateQuotation({ deliveryTerms: event.target.value })} className={INPUT_CLASS} placeholder="เช่น ภายใน 14 วัน" />
                      </Field>
                      <Field label="ใบเสนอราคามีอายุ (วัน)">
                        <input type="number" min="0" step="1" value={quotation.validityDays} onChange={(event) => updateQuotation({ validityDays: Math.max(0, Math.floor(asNumber(event.target.value))) })} className={INPUT_CLASS} />
                      </Field>
                      <Field label="หมายเหตุ" className="sm:col-span-2">
                        <textarea value={quotation.notes} onChange={(event) => updateQuotation({ notes: event.target.value })} className={`${INPUT_CLASS} min-h-28 resize-y`} placeholder="หมายเหตุเพิ่มเติมสำหรับลูกค้าหรือทีมงาน" />
                      </Field>
                    </div>
                  ) : null}
                </section>
              </div>

              <aside className="min-w-0 space-y-4 lg:sticky lg:top-4 lg:self-start">
                <section className="overflow-hidden rounded-2xl border border-teal-200 bg-white shadow-lg shadow-teal-950/5 dark:border-teal-900 dark:bg-slate-900">
                  <div className="bg-gradient-to-br from-teal-600 to-emerald-600 px-5 py-5 text-white">
                    <div className="flex items-center gap-2 text-sm font-semibold text-teal-50">
                      <Calculator size={18} /> สรุปยอดแบบเรียลไทม์
                    </div>
                    <p className="mt-3 text-3xl font-black tracking-tight tabular-nums">{currency(totals.grandTotal)}</p>
                    <p className="mt-1 text-xs text-teal-50">ยอดสุทธิรวม VAT {quotation.vatPercent}%</p>
                  </div>
                  <div className="p-4">
                    <Metric label="ยอดก่อน VAT" value={currency(totals.subtotal)} />
                    <Metric label={`VAT ${quotation.vatPercent}%`} value={currency(totals.vatAmount)} />
                    <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                    {quotation.costNotes.length > 0 ? (
                      <Metric label="Proposed Cost รวม" value={currency(totals.totalProposedCost)} />
                    ) : null}
                    <Metric label="ต้นทุนรวม" value={currency(totals.totalCost)} />
                    <Metric label="กำไรขั้นต้น" value={currency(totals.grossProfit)} tone={totals.grossProfit >= 0 ? 'positive' : 'negative'} />
                    <Metric label="GP%" value={`${totals.gpPercent.toFixed(2)}%`} emphasis tone={totals.gpPercent >= 0 ? 'teal' : 'negative'} />
                    <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-[11px] leading-5 text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                      GP คำนวณจากยอดก่อน VAT หากมี SB Cost มากกว่า 0 จะใช้ยอด SB Cost รวม มิฉะนั้นใช้จำนวน × ต้นทุนต่อหน่วย
                    </p>
                  </div>
                </section>

                <SectionCard icon={<Sparkles size={20} />} title="PDF & Excel" description="สร้างรายงานจากข้อมูลที่บันทึกล่าสุด โดยแยก PDF ไปยังโฟลเดอร์สำหรับลูกค้า">
                  <button
                    type="button"
                    onClick={() => void generateReports()}
                    disabled={busy}
                    className={`${BUTTON_BASE} w-full bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-md shadow-teal-500/20 hover:from-teal-700 hover:to-emerald-700 focus:ring-teal-500/20`}
                  >
                    {generating ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                    {quotation.pdfUrl || quotation.xlsxUrl ? 'สร้างรายงานเวอร์ชันล่าสุด' : 'สร้าง PDF และ Excel'}
                  </button>
                  <div className="mt-3 grid gap-2">
                    <ReportLink href={quotation.pdfUrl} kind="pdf" />
                    <ReportLink href={quotation.xlsxUrl} kind="xlsx" />
                  </div>
                  <div className="mt-3 flex items-start gap-2 rounded-xl bg-blue-50 px-3 py-2.5 text-xs leading-5 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                    <ShieldCheck className="mt-0.5 shrink-0" size={15} />
                    PDF, ไฟล์วิเคราะห์ภายใน และรูปประกอบถูกแยกเก็บตามโฟลเดอร์ที่กำหนดบน Google Drive
                  </div>
                </SectionCard>

                <button
                  type="button"
                  onClick={requestNewQuotation}
                  disabled={busy}
                  className={`${BUTTON_BASE} w-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus:ring-slate-500/10 sm:hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800`}
                >
                  <FilePlus2 size={18} /> เปิดใบเสนอราคาใหม่
                </button>
              </aside>
            </div>
          ) : null}
        </main>

        {view === 'editor' && quotation && !booting ? (
          <div className="absolute inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-950/95">
            <div className="mx-auto grid max-w-xl grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void saveCurrent()}
                disabled={busy}
                className={`${BUTTON_BASE} border border-slate-200 bg-white text-slate-700 focus:ring-slate-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200`}
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} บันทึกร่าง
              </button>
              <button
                type="button"
                onClick={() => void generateReports()}
                disabled={busy}
                className={`${BUTTON_BASE} bg-teal-600 text-white focus:ring-teal-500/20`}
              >
                {generating ? <Loader2 size={18} className="animate-spin" /> : <FileText size={18} />} สร้างรายงาน
              </button>
            </div>
          </div>
        ) : null}

        {toast ? (
          <div
            className="pointer-events-none fixed inset-x-0 z-[130] flex justify-center px-3"
            style={{ top: 'max(0.75rem, env(safe-area-inset-top))' }}
            aria-live="polite"
          >
            <div className={`pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-xl ${toast.kind === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200' : toast.kind === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200' : 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200'}`}>
              {toast.kind === 'success' ? <Check size={18} /> : toast.kind === 'error' ? <AlertCircle size={18} /> : <Sparkles size={18} />}
              <span>{toast.message}</span>
              <button type="button" onClick={() => setToast(null)} className="ml-1 flex h-8 w-8 items-center justify-center rounded-lg hover:bg-black/5" aria-label="ปิดข้อความ">
                <X size={15} />
              </button>
            </div>
          </div>
        ) : null}

        {removal ? (
          <div className="fixed inset-0 z-[140] flex items-end justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:items-center" role="presentation" onMouseDown={(event) => { if (!deletingFile && event.target === event.currentTarget) setRemoval(null); }}>
            <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900" role="dialog" aria-modal="true" aria-labelledby="remove-title">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-300">
                <Trash2 size={22} />
              </span>
              <h2 id="remove-title" className="mt-4 text-lg font-extrabold">ยืนยันการนำออก?</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">ต้องการนำ “{removal.label}” ออกจากใบเสนอราคานี้หรือไม่?</p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button type="button" disabled={deletingFile} onClick={() => setRemoval(null)} className={`${BUTTON_BASE} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus:ring-slate-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200`}>ยกเลิก</button>
                <button type="button" disabled={deletingFile} onClick={() => void confirmRemoval()} className={`${BUTTON_BASE} bg-rose-600 text-white hover:bg-rose-700 focus:ring-rose-500/20`}>
                  {deletingFile ? <Loader2 size={17} className="animate-spin" /> : <Trash2 size={17} />}
                  {deletingFile ? 'กำลังลบ...' : 'นำออก'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {pendingNavigation ? (
          <div className="fixed inset-0 z-[150] flex items-end justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:items-center" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPendingNavigation(null); }}>
            <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900" role="dialog" aria-modal="true" aria-labelledby="unsaved-title">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                <AlertCircle size={22} />
              </span>
              <h2 id="unsaved-title" className="mt-4 text-lg font-extrabold">มีข้อมูลที่ยังไม่ได้บันทึก</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                หากดำเนินการต่อ การแก้ไขล่าสุดในใบนี้จะหายไป ต้องการทิ้งการแก้ไขหรือไม่?
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setPendingNavigation(null)} className={`${BUTTON_BASE} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus:ring-slate-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200`}>กลับไปบันทึก</button>
                <button type="button" onClick={discardChangesAndContinue} className={`${BUTTON_BASE} bg-amber-600 text-white hover:bg-amber-700 focus:ring-amber-500/20`}>ทิ้งการแก้ไข</button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

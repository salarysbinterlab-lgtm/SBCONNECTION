import { useEffect, useState, useRef } from 'react';
import {
  Users, Newspaper, Award, ShoppingBag, History, Network, LogOut,
  Search, Plus, RefreshCw, PieChart, Key, ShieldCheck, Menu, X,
  Trophy, CalendarDays, ChevronLeft, ChevronRight, Globe, Check, Edit2, Trash2, ArrowUpDown,
  BookOpen, Palette
} from 'lucide-react';
import { rpc, logout, getCurrentUser } from '../helpers/api';
import AppLoader from './AppLoader';

// ─────────────────────────────────────────────────────────────────────────────
// Types & Themes
// ─────────────────────────────────────────────────────────────────────────────
type Lang = 'th' | 'en';
type ThemeColor = 'mint' | 'ocean' | 'sunset' | 'lavender';
type ModuleType = 'dashboard' | 'users' | 'news' | 'missions' | 'rewards' | 'ledger' | 'manager_depts' | 'calendar' | 'rules';
type CalendarEventType = 'holiday' | 'event' | 'note';

const TRANS: Record<Lang, Record<string, string>> = {
  th: {
    app_name: 'SB ADMIN', app_sub: 'ผู้ดูแลระบบ',
    search: 'ค้นหา...', refresh: 'รีเฟรช', logout_btn: 'ออกจากระบบ',
    dashboard: 'แดชบอร์ด', users: 'จัดการพนักงาน', news: 'จัดการข่าวสาร',
    missions: 'จัดการภารกิจ', rewards: 'จัดการของรางวัล', ledger: 'ประวัติรับแต้ม',
    manager_depts: 'ผู้จัดการแผนก', calendar: 'ปฏิทินวันหยุด', rules: 'กฎระเบียบ',
    total_users: 'พนักงานทั้งหมด', total_news: 'ข่าวสารทั้งหมด',
    total_missions: 'ภารกิจทั้งหมด', total_rewards: 'ของรางวัลทั้งหมด',
    reset_pass_title: 'รีเซ็ตรหัสผ่าน', reset_pass_desc: 'ตั้งรหัสผ่านใหม่ให้กับพนักงานทันที',
    change_theme: 'เปลี่ยนธีมสี', save: 'บันทึก', cancel: 'ยกเลิก',
    add_item: 'เพิ่มรายการใหม่', edit: 'แก้ไข', delete: 'ลบ',
    points_required: 'แต้มที่ต้องใช้', points_reward: 'แต้มที่ได้รับ',
    read_only_points: 'คะแนนสะสม (คำนวณอัตโนมัติ - ไม่สามารถแก้ไขได้)',
    drag_drop_title: 'มอบหมายผู้จัดการแผนก (Drag & Drop)',
    drag_drop_desc: 'ลากแผนก/บทบาทจากกล่องซ้ายมือ ไปวางที่ผู้จัดการขวามือเพื่อมอบหมายการดูแล',
    calendar_note_title: 'จัดการวันหยุด / กิจกรรมประจำวัน',
    calendar_note_desc: 'คลิกที่วันใดก็ได้บนปฏิทินเพื่อเพิ่มบันทึก วันสำคัญ หรือกิจกรรมพิเศษ',
    user_detail_title: 'ประวัติแต้มและกิจกรรมของพนักงาน',
    rule_board_title: 'จัดการบอร์ดกฎระเบียบ / 5ส / ISO-GMP / เกี่ยวกับบริษัท',
    rule_board_desc: 'แก้ไขเนื้อหาหลังบ้านแล้วแสดงที่เมนูกฎระเบียบฝั่งพนักงานทันที',
    no_logs: 'ไม่พบประวัติกิจกรรมของพนักงานคนนี้',
  },
  en: {
    app_name: 'SB ADMIN', app_sub: 'Management Portal',
    search: 'Search...', refresh: 'Refresh', logout_btn: 'Log Out',
    dashboard: 'Dashboard', users: 'User Manage', news: 'News Manage',
    missions: 'Missions Manage', rewards: 'Rewards Shop', ledger: 'Point Ledger',
    manager_depts: 'Manager Depts', calendar: 'Holiday Calendar', rules: 'Rule Board',
    total_users: 'Total Employees', total_news: 'Total News articles',
    total_missions: 'Missions created', total_rewards: 'Rewards available',
    reset_pass_title: 'Reset Password', reset_pass_desc: 'Reset a user password to temporary credentials',
    change_theme: 'Theme Settings', save: 'Save', cancel: 'Cancel',
    add_item: 'Add New Item', edit: 'Edit', delete: 'Delete',
    points_required: 'Points Required', points_reward: 'Points Gained',
    read_only_points: 'Current Points (Auto-calculated - Read Only)',
    drag_drop_title: 'Assign Department Managers (Drag & Drop)',
    drag_drop_desc: 'Drag departments/roles from the left side and drop them onto managers on the right.',
    calendar_note_title: 'Add Holidays & Company Events',
    calendar_note_desc: 'Click on any calendar day cell to create, edit, or delete notes and holidays.',
    user_detail_title: 'Employee Activity & Point Ledger',
    rule_board_title: 'Manage Rules / 5S / ISO-GMP / Company Board',
    rule_board_desc: 'Edit admin content and publish it to the user rule board.',
    no_logs: 'No transaction history found for this user.',
  }
};

const THEMES: Record<ThemeColor, {
  primary: string; bg: string; light: string; border: string; text: string; subtext: string; cardBorder: string;
}> = {
  mint:     { primary:'#10b981', bg:'#f0fdfa', light:'#ecfdf5', border:'#6ee7b7', text:'#065f46', subtext:'#059669', cardBorder:'#a7f3d0' },
  ocean:    { primary:'#3b82f6', bg:'#eff6ff', light:'#dbeafe', border:'#93c5fd', text:'#1e3a8a', subtext:'#2563eb', cardBorder:'#bfdbfe' },
  sunset:   { primary:'#f97316', bg:'#fff7ed', light:'#ffedd5', border:'#fdba74', text:'#7c2d12', subtext:'#ea580c', cardBorder:'#fed7aa' },
  lavender: { primary:'#8b5cf6', bg:'#f5f3ff', light:'#ede9fe', border:'#c4b5fd', text:'#4c1d95', subtext:'#7c3aed', cardBorder:'#ddd6fe' },
};

const MONTH_TH = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const MONTH_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WD_TH = ['จ','อ','พ','พฤ','ศ','ส','อา'];
const WD_EN = ['M','T','W','T','F','S','S'];

const COMPANY_LOGO_URL = 'https://lh3.googleusercontent.com/d/1SqzBIsXwfMzd91mgBepq6O2-nbGaZR4s';
const SOFT_DARK_HEADER = 'linear-gradient(135deg, rgba(7,95,86,0.96), rgba(20,184,166,0.9) 48%, rgba(153,246,228,0.82))';
const SOFT_DARK_NAV = 'linear-gradient(135deg, rgba(6,78,59,0.92), rgba(13,148,136,0.86) 58%, rgba(94,234,212,0.72))';
const CALENDAR_COLOR_PRESETS = ['#ef4444', '#22c55e', '#8b5cf6', '#f59e0b', '#0ea5e9', '#ec4899'];
const CARD_THEME_KEY = 'sb_admin_card_theme';
const DEFAULT_CARD_COLORS = {
  card1: '#052f3a',
  card2: '#0e98a8',
  accent1: '#b7791f',
  accent2: '#fff4b0',
};

function readCardTheme() {
  try {
    return { ...DEFAULT_CARD_COLORS, ...JSON.parse(localStorage.getItem(CARD_THEME_KEY) || '{}') };
  } catch {
    return DEFAULT_CARD_COLORS;
  }
}

function transparentize(hex: string, alpha: number) {
  const raw = String(hex || '').replace('#', '');
  if (raw.length !== 6) return `rgba(139,92,246,${alpha})`;
  const n = Number.parseInt(raw, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function calendarColorFor(evt: any) {
  if (evt?.color) return evt.color;
  if (evt?.type === 'holiday') return '#ef4444';
  if (evt?.type === 'note') return '#22c55e';
  return '#8b5cf6';
}

export default function AdminDashboard({ user: initialUser, onLogout }: AdminDashboardProps) {
  // ── Styling states matching user dashboard ────────────────────────────────
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('sb_lang') as Lang) || 'th');
  const [theme, setTheme] = useState<ThemeColor>(() => (localStorage.getItem('sb_theme') as ThemeColor) || 'mint');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('sb_dark') === 'true');
  const [cardTheme, setCardTheme] = useState(() => readCardTheme());

  const [user, setUser] = useState(initialUser || getCurrentUser());
  const [activeModule, setActiveModule] = useState<ModuleType>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Stats & listings
  const [stats, setStats] = useState<any>({});
  const [moduleRows, setModuleRows] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActiveOnly, setFilterActiveOnly] = useState(false);

  // Users Page inspection / Ledger
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [selectedUserLogs, setSelectedUserLogs] = useState<any[]>([]);
  
  // Pagination (10 per page as requested)
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  // Form Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<any | null>(null);

  // Reset Password State
  const [resetEmpId, setResetEmpId] = useState('');
  const [resetTempPass, setResetTempPass] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  // Interactive calendar click-to-note states
  const [calMonth, setCalMonth] = useState(() => new Date());
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [calEventLabel, setCalEventLabel] = useState('');
  const [calEventType, setCalEventType] = useState<CalendarEventType>('holiday');
  const [calEventColor, setCalEventColor] = useState('#ef4444');
  const [calEventModalOpen, setCalEventModalOpen] = useState(false);

  // Drag and Drop Mapping states
  const [allDepts, setAllDepts] = useState<string[]>(['QC', 'Production', 'Logistics', 'Marketing', 'Accounting', 'IT', 'HR']);
  const [draggedDept, setDraggedDept] = useState<string | null>(null);

  const token = localStorage.getItem('sb_session_token') || '';
  const t = (key: string) => TRANS[lang][key] || key;
  const thm = THEMES[theme];

  // ── Persist theme/styles ──────────────────────────────────────────────────
  useEffect(() => { localStorage.setItem('sb_lang', lang); }, [lang]);
  useEffect(() => { localStorage.setItem('sb_theme', theme); }, [theme]);
  useEffect(() => { localStorage.setItem('sb_dark', String(darkMode)); }, [darkMode]);
  useEffect(() => { localStorage.setItem(CARD_THEME_KEY, JSON.stringify(cardTheme)); }, [cardTheme]);

  // Synchronize Tab from URL hash
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '');
      const validModules: ModuleType[] = ['users', 'news', 'missions', 'rewards', 'ledger', 'manager_depts', 'calendar', 'rules'];
      if (validModules.includes(hash as any)) {
        setActiveModule(hash as any);
      } else if (hash === 'admin' || hash === 'homeAdmin') {
        setActiveModule('dashboard');
      }
    };
    window.addEventListener('hashchange', handleHash);
    handleHash();
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Update hash when module changes
  useEffect(() => {
    if (activeModule === 'dashboard') {
      window.location.hash = 'admin';
    } else {
      window.location.hash = activeModule;
    }
    setSearchQuery('');
    setCurrentPage(1);
    fetchData();
  }, [activeModule]);

  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      if (activeModule === 'dashboard') {
        const data = await rpc<any>('get_admin_dashboard', { p_token: token });
        setStats(data || {});
        // Also fetch calendar events to populate dashboard charts/stats
        const cal = await rpc<any>('list_calendar_events', { p_token: token });
        setCalendarEvents(Array.isArray(cal) ? cal : []);
      } else {
        const config = getModuleConfig(activeModule);
        const data = await rpc<any>(config.list, { p_token: token });
        setModuleRows(Array.isArray(data) ? data : (data?.items || data?.rows || []));
        if (activeModule === 'calendar') {
          setCalendarEvents(Array.isArray(data) ? data : []);
        }
      }
    } catch (err) {
      showError(err);
    } finally {
      setLoading(false);
    }
  };

  const getModuleConfig = (mod: ModuleType) => {
    const configs: Record<string, { list: string; save?: string; delete?: string; title: string; columns: string[] }> = {
      users: {
        list: 'admin_list_users',
        save: 'admin_upsert_user',
        delete: 'admin_delete_user',
        title: 'User Management',
        columns: ['emp_id', 'full_name', 'department', 'role', 'status', 'points']
      },
      news: {
        list: 'admin_list_news',
        save: 'admin_upsert_news',
        delete: 'admin_delete_news',
        title: 'News Management',
        columns: ['id', 'topic', 'points', 'is_active', 'publish_date']
      },
      missions: {
        list: 'admin_list_missions',
        save: 'admin_upsert_mission',
        delete: 'admin_delete_mission',
        title: 'Missions Management',
        columns: ['id', 'title', 'points', 'is_active', 'created_at']
      },
      rewards: {
        list: 'admin_list_rewards',
        save: 'admin_upsert_reward',
        delete: 'admin_delete_reward',
        title: 'Rewards Shop Management',
        columns: ['id', 'name', 'points_required', 'stock', 'is_active']
      },
      ledger: {
        list: 'admin_list_ledger',
        title: 'Ledger History (Point transactions)',
        columns: ['created_at', 'emp_id', 'amount', 'source_type', 'description']
      },
      manager_depts: {
        list: 'admin_list_manager_depts',
        save: 'admin_save_manager_depts_batch',
        title: 'Department Managers Map',
        columns: ['manager_emp_id', 'department_id', 'department_name', 'is_active']
      },
      calendar: {
        list: 'admin_list_calendar_events',
        save: 'admin_upsert_calendar_event',
        delete: 'admin_delete_calendar_event',
        title: 'ปฏิทิน วันหยุด/กิจกรรม (Calendar Events)',
        columns: ['date', 'type', 'label', 'color', 'is_active', 'created_by']
      },
      rules: {
        list: 'admin_list_rule_board',
        save: 'admin_upsert_rule_board',
        delete: 'admin_delete_rule_board',
        title: 'Rule Board Management',
        columns: ['category', 'title', 'sort_order', 'is_active', 'updated_at']
      }
    };
    return configs[mod] || configs.users;
  };

  // Reset Password Action
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmpId.trim()) {
      showError(lang === 'th' ? 'กรุณากรอกรหัสพนักงาน (emp_id)' : 'Please enter Employee ID');
      return;
    }
    setResetLoading(true);
    try {
      await rpc('admin_reset_password', {
        p_token: token,
        p_emp_id: resetEmpId.trim(),
        p_temp_password: resetTempPass.trim()
      });
      showSuccess(lang === 'th' ? `รีเซ็ตรหัสผ่านพนักงาน ${resetEmpId} เรียบร้อยแล้ว!` : `Reset password for ${resetEmpId} successfully!`);
      setResetEmpId('');
      setResetTempPass('');
      if (activeModule === 'dashboard') fetchData();
    } catch (err) {
      showError(err);
    } finally {
      setResetLoading(false);
    }
  };

  // Upsert / Edit Actions
  const handleOpenForm = (row: any = null) => {
    setEditingRow(row ? { ...row } : {});
    setModalOpen(true);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const config = getModuleConfig(activeModule);
    if (!config.save) return;

    setLoading(true);
    try {
      let payload: any = {};
      const isContent = ['news', 'missions', 'rewards'].includes(activeModule);
      
      if (isContent) {
        payload = {
          id: editingRow.id || undefined,
          title: editingRow.topic || editingRow.title || editingRow.name,
          topic: editingRow.topic || editingRow.title || editingRow.name,
          name: editingRow.topic || editingRow.title || editingRow.name,
          detail: editingRow.detail || editingRow.description,
          description: editingRow.detail || editingRow.description,
          points: Number(editingRow.points || editingRow.points_required || 0),
          points_required: Number(editingRow.points || editingRow.points_required || 0),
          image_url: editingRow.image_url || editingRow.cover_url || '',
          cover_url: editingRow.image_url || editingRow.cover_url || '',
          publish_date: editingRow.publish_date || undefined,
          stock: editingRow.stock !== undefined && editingRow.stock !== null ? Number(editingRow.stock) : null,
          is_active: editingRow.is_active !== false
        };
      } else if (activeModule === 'users') {
        // As requested: points is read-only. We don't save points from editingRow, api.ts handles keeping points unchanged.
        payload = {
          emp_id: editingRow.emp_id,
          full_name: editingRow.full_name,
          department: editingRow.department,
          role: editingRow.role || 'user',
          status: editingRow.status || 'ACTIVE'
        };
      } else if (activeModule === 'manager_depts') {
        payload = {
          manager_emp_id: editingRow.manager_emp_id,
          department_id: editingRow.department_id,
          department_name: editingRow.department_name,
          is_active: editingRow.is_active !== false
        };
      } else if (activeModule === 'calendar') {
        payload = {
          id: editingRow.id || undefined,
          date: editingRow.date,
          type: editingRow.type || 'holiday',
          label: editingRow.label || '',
          color: editingRow.color || '#ef4444',
          is_active: editingRow.is_active !== false
        };
      } else if (activeModule === 'rules') {
        payload = {
          id: editingRow.id || undefined,
          category: editingRow.category || 'policy',
          title: editingRow.title || '',
          body_html: editingRow.body_html || editingRow.body || '',
          color: editingRow.color || thm.primary,
          sort_order: Number(editingRow.sort_order || 0),
          is_active: editingRow.is_active !== false
        };
      }

      await rpc(config.save, { p_token: token, p_payload: payload });
      showSuccess(lang === 'th' ? 'บันทึกข้อมูลเรียบร้อยแล้ว!' : 'Saved successfully!');
      setModalOpen(false);
      setEditingRow(null);
      fetchData();
    } catch (err) {
      showError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async (row: any) => {
    const config = getModuleConfig(activeModule);
    if (!config.delete) return;

    if (!confirm(lang === 'th' ? 'ยืนยันการลบรายการนี้?' : 'Are you sure you want to delete this?')) return;

    setLoading(true);
    try {
      const keyArg: Record<string, any> = {};
      if (activeModule === 'users') {
        keyArg.p_emp_id = row.emp_id;
      } else {
        keyArg.p_id = row.id;
      }
      keyArg.p_token = token;

      await rpc(config.delete, keyArg);
      showSuccess(lang === 'th' ? 'ลบข้อมูลเรียบร้อยแล้ว!' : 'Deleted successfully!');
      fetchData();
    } catch (err) {
      showError(err);
    } finally {
      setLoading(false);
    }
  };

  // Inspect User logs
  const handleInspectUser = async (u: any) => {
    setSelectedUser(u);
    try {
      const allLogs = await rpc<any[]>('admin_list_ledger', { p_token: token });
      const userLogs = Array.isArray(allLogs) ? allLogs.filter((l: any) => l.emp_id === u.emp_id) : [];
      setSelectedUserLogs(userLogs);
    } catch {
      setSelectedUserLogs([]);
    }
  };

  // ── Drag and Drop Department manager map implementation ───────────────
  const handleDragStart = (dept: string) => {
    setDraggedDept(dept);
  };

  const handleDrop = async (e: React.DragEvent, managerEmpId: string, managerName: string) => {
    e.preventDefault();
    if (!draggedDept) return;

    const existingMappings = [...moduleRows];
    // Add mapping
    const newMapping = {
      manager_emp_id: managerEmpId,
      department_id: `DEPT_${draggedDept.toUpperCase()}`,
      department_name: draggedDept,
      is_active: true
    };

    // Prevent duplicates
    const duplicate = existingMappings.some(m => m.manager_emp_id === managerEmpId && m.department_name === draggedDept);
    if (duplicate) return;

    const updated = [...existingMappings, newMapping];
    setLoading(true);
    try {
      await rpc('admin_save_manager_depts_batch', { p_token: token, p_mappings: updated });
      showSuccess(lang === 'th' ? `มอบหมายแผนก ${draggedDept} ให้ ${managerName} เรียบร้อย` : `Assigned ${draggedDept} to ${managerName}`);
      fetchData();
    } catch (err) {
      showError(err);
    } finally {
      setLoading(false);
      setDraggedDept(null);
    }
  };

  const handleRemoveMapping = async (managerEmpId: string, deptName: string) => {
    const updated = moduleRows.filter(m => !(m.manager_emp_id === managerEmpId && m.department_name === deptName));
    setLoading(true);
    try {
      await rpc('admin_save_manager_depts_batch', { p_token: token, p_mappings: updated });
      showSuccess(lang === 'th' ? 'ลบสิทธิ์ผู้ดูแลเรียบร้อย' : 'Removed assignment successfully');
      fetchData();
    } catch (err) {
      showError(err);
    } finally {
      setLoading(false);
    }
  };

  // ── Interactive calendar notes actions ────────────────────────────────
  const handleCalendarCellClick = (dateStr: string) => {
    const existing = calendarEvents.find(e => e.date === dateStr);
    setSelectedCalendarDate(dateStr);
    if (existing) {
      setCalEventLabel(existing.label || '');
      setCalEventType(existing.type || 'holiday');
      setCalEventColor(calendarColorFor(existing));
    } else {
      setCalEventLabel('');
      setCalEventType('holiday');
      setCalEventColor('#ef4444');
    }
    setCalEventModalOpen(true);
  };

  const handleSaveCalendarEvent = async () => {
    if (!selectedCalendarDate) return;
    setLoading(true);
    try {
      const existing = calendarEvents.find(e => e.date === selectedCalendarDate);
      const payload = {
        id: existing?.id || undefined,
        date: selectedCalendarDate,
        type: calEventType,
        label: calEventLabel.trim() || (calEventType === 'holiday' ? 'วันหยุด' : calEventType === 'note' ? 'บันทึก' : 'กิจกรรม'),
        color: calEventColor,
        is_active: true
      };
      await rpc('admin_upsert_calendar_event', { p_token: token, p_payload: payload });
      showSuccess(lang === 'th' ? 'บันทึกวันหยุด/กิจกรรมลงปฏิทินสำเร็จ!' : 'Calendar event saved!');
      setCalEventModalOpen(false);
      fetchData();
    } catch (err) {
      showError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCalendarEvent = async () => {
    if (!selectedCalendarDate) return;
    const existing = calendarEvents.find(e => e.date === selectedCalendarDate);
    if (!existing) return;

    if (!confirm(lang === 'th' ? 'ลบบันทึกวันหยุด/กิจกรรมนี้?' : 'Delete this calendar event?')) return;

    setLoading(true);
    try {
      await rpc('admin_delete_calendar_event', { p_token: token, p_id: existing.id });
      showSuccess(lang === 'th' ? 'ลบข้อมูลสำเร็จ' : 'Deleted successfully');
      setCalEventModalOpen(false);
      fetchData();
    } catch (err) {
      showError(err);
    } finally {
      setLoading(false);
    }
  };

  // Helper alerts & dates
  const showError = (error: any) => {
    const msg = error instanceof Error ? error.message : String(error || 'ล้มเหลว');
    const swal = (window as any).Swal;
    if (swal) swal.fire({ icon: 'error', title: 'ล้มเหลว', text: msg, background: darkMode ? '#0f172a' : '#fff', color: darkMode ? '#fff' : '#0f172a' });
    else alert(msg);
  };
  const showSuccess = (msg: string) => {
    const swal = (window as any).Swal;
    if (swal) swal.fire({ icon: 'success', title: 'สำเร็จ', text: msg, timer: 1800, showConfirmButton: false, background: darkMode ? '#0f172a' : '#fff', color: darkMode ? '#fff' : '#0f172a' });
    else alert(msg);
  };
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return dateStr; }
  };

  // Calendar dates helpers
  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDayMon = (y: number, m: number) => { const d = new Date(y, m, 1).getDay(); return d === 0 ? 6 : d - 1; };
  const eventMap: Record<string, any> = {};
  calendarEvents.forEach(ev => { if (ev.date) eventMap[ev.date] = ev; });

  // Filtering & Search
  const filteredRows = moduleRows.filter(row => {
    const matchesSearch = Object.entries(row).some(([k, val]) => 
      k !== 'avatar_url' && String(val || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
    if (filterActiveOnly) {
      return matchesSearch && (row.is_active !== false && row.status !== 'INACTIVE');
    }
    return matchesSearch;
  });

  // Pagination Logic (10 rows per page)
  const totalPages = Math.ceil(filteredRows.length / rowsPerPage) || 1;
  const paginatedRows = filteredRows.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  // App Theme setup matching user theme
  const appBg = darkMode ? '#0f172a' : thm.bg;
  const textColor = darkMode ? '#f1f5f9' : '#1e293b';
  const sidebarStyle: React.CSSProperties = darkMode
    ? { background: 'rgba(15,23,42,0.97)', borderRight: '1px solid rgba(255,255,255,0.06)' }
    : { background: 'rgba(255,255,255,0.93)', borderRight: `1px solid ${thm.border}50` };
  const headerStyle: React.CSSProperties = {
    background: SOFT_DARK_HEADER,
    borderBottom: '1px solid rgba(255,255,255,0.10)',
    boxShadow: '0 10px 24px rgba(15,23,42,0.10)',
  };
  const cardStyle: React.CSSProperties = darkMode
    ? { background: '#1e293b', border: `1px solid rgba(255,255,255,0.07)` }
    : { background: '#fff', border: `1px solid ${thm.cardBorder}60` };

  const sidebarItems = [
    { id: 'dashboard',     label: t('dashboard'),     icon: <PieChart size={17} />, color: '#0ea5e9' },
    { id: 'users',         label: t('users'),         icon: <Users size={17} />, color: '#14b8a6' },
    { id: 'news',          label: t('news'),          icon: <Newspaper size={17} />, color: '#f97316' },
    { id: 'missions',      label: t('missions'),      icon: <Award size={17} />, color: '#8b5cf6' },
    { id: 'rewards',       label: t('rewards'),       icon: <ShoppingBag size={17} />, color: '#f59e0b' },
    { id: 'ledger',        label: t('ledger'),        icon: <History size={17} />, color: '#64748b' },
    { id: 'manager_depts', label: t('manager_depts'), icon: <Network size={17} />, color: '#22c55e' },
    { id: 'calendar',      label: t('calendar'),      icon: <CalendarDays size={17} />, color: '#ef4444' },
    { id: 'rules',         label: t('rules'),         icon: <BookOpen size={17} />, color: '#6366f1' },
  ];

  return (
    <div
      className="min-h-screen flex flex-col font-sans relative overflow-x-hidden"
      style={{ backgroundColor: appBg, color: textColor, fontFamily: "'Prompt','Sarabun',sans-serif" }}
    >
      <AppLoader
        visible={loading || resetLoading}
        color={thm.primary}
        darkMode={darkMode}
        label={resetLoading ? (lang === 'th' ? 'กำลังรีเซ็ตรหัสผ่าน' : 'Resetting password') : (lang === 'th' ? 'กำลังโหลดข้อมูล' : 'Loading data')}
      />

      <div className="pointer-events-none fixed inset-0 z-0 sb-backdrop-pattern opacity-70" />

      <div className="w-full flex flex-1 relative min-h-screen z-10">

        {/* ── LEFT SIDEBAR (≥ lg) ──────────────────────────────────────── */}
        <aside className="w-64 hidden lg:flex flex-col shrink-0 sticky top-0 h-screen overflow-y-auto" style={sidebarStyle}>
          {/* Brand header */}
          <div className="px-5 py-4 flex items-center gap-3 border-b" style={{ borderColor: thm.border + '40' }}>
            <div className="min-w-0">
              <img
                src={COMPANY_LOGO_URL}
                alt="SB Connect"
                className="h-8 max-w-[150px] object-contain object-left"
                style={{ background: 'transparent', filter: 'drop-shadow(0 1px 1px rgba(255,255,255,0.16))' }}
              />
              <h1 className="font-black text-sm tracking-wider leading-none" style={{ color: thm.text }}>{t('app_name')}</h1>
              <span className="text-[9px] font-extrabold uppercase tracking-[0.2em] opacity-55" style={{ color: thm.subtext }}>{t('app_sub')}</span>
            </div>
          </div>

          {/* Admin profile snippet */}
          <div className="mx-3 my-3 p-3 rounded-2xl border flex items-center gap-3"
            style={{ background: thm.light, borderColor: thm.border + '60' }}>
            <div className="w-10 h-10 rounded-full border-2 p-[2px] shrink-0" style={{ borderColor: thm.primary }}>
              <img src={user?.avatar_url || 'https://api.dicebear.com/7.x/adventurer/svg?seed=admin'} className="w-full h-full rounded-full object-cover" />
            </div>
            <div className="truncate">
              <h4 className="text-xs font-black truncate" style={{ color: textColor }}>{user?.full_name || 'Admin User'}</h4>
              <span className="text-[9px] font-extrabold uppercase tracking-wider opacity-60" style={{ color: thm.subtext }}>ROLE: {user?.role || 'Admin'}</span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
            {sidebarItems.map(item => (
              <button key={item.id} onClick={() => setActiveModule(item.id as ModuleType)}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-xs font-black transition-all text-left relative"
                style={activeModule === item.id
                  ? { background: `${SOFT_DARK_NAV}, ${transparentize(item.color, 0.18)}`, color: '#f8fafc', boxShadow: `inset 3px 0 0 ${item.color}, inset 0 0 0 1px rgba(255,255,255,0.08)` }
                  : { background: 'linear-gradient(135deg, rgba(15,23,42,0.045), rgba(51,65,85,0.08))', color: darkMode ? '#cbd5e1' : '#475569' }}>
                <span className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: transparentize(item.color, activeModule === item.id ? 0.18 : 0.1), color: item.color }}>
                  {item.icon}
                </span>
                <span className="truncate sb-nav-label">{item.label}</span>
              </button>
            ))}
          </nav>

          {/* Logout */}
          <div className="p-3 border-t" style={{ borderColor: thm.border + '40' }}>
            <button onClick={logout}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl text-xs font-black transition active:scale-95 border text-red-500 border-red-200 hover:bg-red-50">
              <LogOut size={14} /> {t('logout_btn')}
            </button>
          </div>
        </aside>

        {/* ── MAIN CONTENT VIEWPORT ───────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 min-h-screen">

          {/* ── STICKY HEADER ─────────────────────────────────────────── */}
          <header className="sticky top-0 z-40 h-14 px-4 flex items-center justify-between gap-3 backdrop-blur-md" style={headerStyle}>
            <div className="flex items-center gap-2.5 lg:hidden">
              <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-xl border text-slate-500">
                <Menu size={16} />
              </button>
              <img
                src={COMPANY_LOGO_URL}
                alt="SB Connect"
                className="h-6 max-w-[126px] object-contain object-left"
                style={{ background: 'transparent', filter: 'drop-shadow(0 1px 1px rgba(255,255,255,0.18))' }}
              />
            </div>

            <div className="hidden lg:block truncate">
              <img
                src={COMPANY_LOGO_URL}
                alt="SB Connect Management"
                className="h-5 max-w-[136px] object-contain object-left"
                style={{ background: 'transparent', filter: 'drop-shadow(0 1px 1px rgba(255,255,255,0.18))' }}
              />
              <h2 className="text-xs font-black" style={{ color: '#f8fafc' }}>{sidebarItems.find(x => x.id === activeModule)?.label}</h2>
            </div>

            <div className="flex items-center gap-2">
              {/* Theme Settings Preset switches */}
              <div className="flex gap-1 border rounded-full p-1" style={{ borderColor: thm.border + '30', background: thm.light }}>
                {(['mint', 'ocean', 'sunset', 'lavender'] as ThemeColor[]).map(tc => (
                  <button key={tc} onClick={() => setTheme(tc)}
                    className="w-4 h-4 rounded-full transition hover:scale-115 relative flex items-center justify-center"
                    style={{ background: THEMES[tc].primary }}>
                    {theme === tc && <Check size={8} className="text-white font-bold" />}
                  </button>
                ))}
              </div>

              {/* TH/EN switch */}
              <button onClick={() => setLang(l => l === 'th' ? 'en' : 'th')}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black border transition"
                style={{ background: darkMode ? 'rgba(255,255,255,0.06)' : thm.light, borderColor: thm.border + '60', color: thm.subtext }}>
                <Globe size={11} /> {lang.toUpperCase()}
              </button>

              {/* Dark mode switch */}
              <button onClick={() => setDarkMode(!darkMode)}
                className="p-1.5 rounded-full border transition"
                style={{ background: darkMode ? 'rgba(255,255,255,0.06)' : thm.light, borderColor: thm.border + '60' }}>
                <span className="text-xs">{darkMode ? '🌙' : '☀️'}</span>
              </button>

              <button onClick={logout}
                className="p-1.5 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 lg:hidden">
                <LogOut size={14} />
              </button>
            </div>
          </header>

          {/* Subheader action line */}
          <div className="px-6 py-2 border-b flex justify-between items-center gap-4 flex-wrap z-30 sticky top-14"
            style={{ borderColor: 'rgba(255,255,255,0.08)', background: SOFT_DARK_NAV, backdropFilter: 'blur(10px)' }}>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-extrabold text-slate-200/70">{lang === 'th' ? 'การจัดการโมดูล:' : 'Active module:'}</span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black text-white" style={{ background: sidebarItems.find(x => x.id === activeModule)?.color || thm.primary }}>{activeModule.toUpperCase()}</span>
            </div>

            <div className="flex gap-2">
              {activeModule !== 'dashboard' && getModuleConfig(activeModule).save && activeModule !== 'manager_depts' && (
                <button onClick={() => handleOpenForm()}
                  className="flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-black text-white transition active:scale-95"
                  style={{ background: thm.primary }}>
                  <Plus size={13} /> {t('add_item')}
                </button>
              )}
              <button onClick={fetchData} disabled={loading}
                className="flex items-center gap-1 text-xs font-black px-2.5 py-1 rounded-xl border transition active:scale-95 disabled:opacity-40"
                style={{ color: thm.subtext, borderColor: thm.border + '60', background: thm.light }}>
                <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> {t('refresh')}
              </button>
            </div>
          </div>

          {/* ── MAIN CONTENT GRID ──────────────────────────────────────── */}
          <main className="flex-1 p-4 lg:p-6 overflow-y-auto space-y-6">

            {/* ── MODULE: DASHBOARD ────────────────────────────────────── */}
            {activeModule === 'dashboard' && (
              <div className="space-y-6 animate-fade-in">

                {/* 4 Stats Cards */}
                <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: t('total_users'), val: stats.total_users || 0, icon: <Users size={22} />, labelSub: 'Accounts' },
                    { label: t('total_news'), val: stats.total_news || 0, icon: <Newspaper size={22} />, labelSub: 'Articles' },
                    { label: t('total_missions'), val: stats.total_missions || 0, icon: <Award size={22} />, labelSub: 'Missions' },
                    { label: t('total_rewards'), val: stats.total_rewards || 0, icon: <ShoppingBag size={22} />, labelSub: 'Products' },
                  ].map((item, idx) => (
                    <div key={idx} className="rounded-3xl p-5 shadow-sm relative overflow-hidden border transition hover:translate-y-[-2px]" style={cardStyle}>
                      <span className="text-[10px] font-extrabold opacity-55 uppercase tracking-wider">{item.label}</span>
                      <strong className="text-3xl font-black mt-2 block" style={{ color: thm.text }}>{Number(item.val).toLocaleString()}</strong>
                      <span className="text-[9px] font-bold opacity-35 block mt-1">{item.labelSub}</span>
                      <div className="absolute right-3 bottom-3 opacity-15" style={{ color: thm.primary }}>{item.icon}</div>
                    </div>
                  ))}
                </section>

                <section className="rounded-3xl p-5 shadow-sm border" style={cardStyle}>
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-black flex items-center gap-1.5" style={{ color: thm.text }}>
                        <Palette size={16} /> Card Color Control
                      </h4>
                      <p className="text-xs opacity-55 font-medium mt-0.5">
                        {lang === 'th' ? 'สีการ์ดพนักงานเป็นค่าส่วนกลาง ฝั่ง user ปรับเองไม่ได้' : 'Employee card colors are centrally controlled by admin.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCardTheme(DEFAULT_CARD_COLORS)}
                      className="px-3 py-2 rounded-2xl text-xs font-black border transition active:scale-95"
                      style={{ color: thm.subtext, borderColor: thm.border + '60', background: thm.light }}>
                      Reset Card
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mt-4">
                    {([
                      ['card1', 'Card #1'],
                      ['card2', 'Card #2'],
                      ['accent1', 'Accent #1'],
                      ['accent2', 'Accent #2'],
                    ] as [keyof typeof DEFAULT_CARD_COLORS, string][]).map(([key, label]) => (
                      <label key={key} className="rounded-2xl border p-3 flex items-center gap-3"
                        style={{ borderColor: thm.border + '50', background: darkMode ? 'rgba(255,255,255,0.04)' : '#f8fafc' }}>
                        <input
                          type="color"
                          value={cardTheme[key]}
                          onChange={e => setCardTheme(prev => ({ ...prev, [key]: e.target.value }))}
                          className="w-10 h-10 rounded-xl bg-transparent border-0 p-0 cursor-pointer shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-[11px] font-black" style={{ color: textColor }}>{label}</p>
                          <p className="text-[10px] font-black uppercase opacity-45">{cardTheme[key]}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                  <div className="mt-4 h-16 rounded-2xl overflow-hidden border relative"
                    style={{ borderColor: thm.border + '50', background: `linear-gradient(155deg, ${cardTheme.card1}, ${cardTheme.card2})` }}>
                    <div className="absolute top-0 right-0 w-32 h-full"
                      style={{ background: `linear-gradient(135deg, ${cardTheme.accent1}, ${cardTheme.accent2})`, clipPath: 'polygon(35% 0%,100% 0%,100% 100%,0% 100%)' }} />
                    <div className="relative z-10 h-full flex items-center px-4">
                      <span className="text-xs font-black text-white sb-nav-label">SB CONNECT CARD PREVIEW</span>
                    </div>
                  </div>
                </section>

                {/* Charts & Reset Password Panel */}
                <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                  {/* Reset Password Card */}
                  <div className="rounded-3xl p-5 shadow-sm border flex flex-col justify-between" style={cardStyle}>
                    <div>
                      <h4 className="text-sm font-black flex items-center gap-1.5" style={{ color: thm.text }}>
                        <Key size={16} /> {t('reset_pass_title')}
                      </h4>
                      <p className="text-xs opacity-55 font-medium mt-0.5">{t('reset_pass_desc')}</p>

                      <form onSubmit={handleResetPassword} className="mt-4 space-y-3">
                        <div>
                          <label className="text-[9px] font-black opacity-45 uppercase block mb-1">Employee ID</label>
                          <input required value={resetEmpId} onChange={e => setResetEmpId(e.target.value)}
                            placeholder="e.g. 3672"
                            className="w-full bg-slate-950/5 border rounded-2xl h-10 px-4 text-xs font-bold outline-none focus:border-emerald-500"
                            style={{ color: textColor, borderColor: thm.border + '60' }} />
                        </div>
                        <div>
                          <label className="text-[9px] font-black opacity-45 uppercase block mb-1">Temporary Password</label>
                          <input value={resetTempPass} onChange={e => setResetTempPass(e.target.value.replace(/[^A-Za-z0-9]/g, ''))}
                            placeholder="เว้นว่าง = ใช้รหัสพนักงาน"
                            className="w-full bg-slate-950/5 border rounded-2xl h-10 px-4 text-xs font-bold outline-none focus:border-emerald-500"
                            style={{ color: textColor, borderColor: thm.border + '60' }} />
                        </div>
                        <button type="submit" disabled={resetLoading}
                          className="w-full py-2.5 rounded-2xl text-xs font-black text-white transition active:scale-95"
                          style={{ background: thm.primary }}>
                          {resetLoading ? 'Saving...' : 'Reset User Password'}
                        </button>
                      </form>
                    </div>
                  </div>

                  {/* Top leaderboard chart snippet */}
                  <div className="rounded-3xl p-5 shadow-sm border flex flex-col" style={cardStyle}>
                    <h4 className="text-sm font-black flex items-center gap-1.5 mb-3" style={{ color: thm.text }}>
                      <Trophy size={16} /> Top Earners & Departments
                    </h4>
                    <div className="space-y-3 flex-1 overflow-y-auto max-h-56 pr-1">
                      {stats.ranking && stats.ranking.length > 0 ? (
                        stats.ranking.slice(0, 5).map((item: any, idx: number) => {
                          const pct = Math.min(100, Math.max(10, (item.points / (stats.ranking[0].points || 1)) * 100));
                          return (
                            <div key={idx} className="space-y-1">
                              <div className="flex justify-between text-xs font-bold">
                                <span className="truncate">{idx + 1}. {item.full_name} ({item.department})</span>
                                <span style={{ color: thm.subtext }}>{Number(item.points).toLocaleString()}</span>
                              </div>
                              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-500"
                                  style={{ width: `${pct}%`, background: thm.primary }} />
                              </div>
                            </div>
                          );
                        })
                      ) : <p className="text-xs opacity-45">{lang === 'th' ? 'ไม่มีข้อมูล' : 'No data'}</p>}
                    </div>
                  </div>

                  {/* Calendar notes preview */}
                  <div className="rounded-3xl p-5 shadow-sm border flex flex-col" style={cardStyle}>
                    <h4 className="text-sm font-black flex items-center gap-1.5 mb-3" style={{ color: thm.text }}>
                      <CalendarDays size={16} /> Holidays & Note Activities
                    </h4>
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {calendarEvents.length > 0 ? (
                        calendarEvents.slice(0, 5).map((ev: any, idx: number) => (
                          <div key={idx} className="p-2.5 rounded-2xl border flex items-center gap-2"
                            style={{ background: thm.light + '40', borderColor: thm.border + '30' }}>
                            <div className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ background: calendarColorFor(ev) }} />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold truncate">{ev.label}</p>
                              <span className="text-[9px] opacity-35 font-bold">{ev.date}</span>
                            </div>
                          </div>
                        ))
                      ) : <p className="text-xs opacity-45">{lang === 'th' ? 'ไม่มีบันทึกข้อมูลปฏิทิน' : 'No calendar notes yet'}</p>}
                    </div>
                  </div>

                </section>
              </div>
            )}

            {/* ── MODULE: USERS ───────────────────────────────────────── */}
            {activeModule === 'users' && (
              <div className="space-y-4 animate-fade-in">
                {/* Search / Filter toolbar */}
                <div className="flex gap-3 flex-wrap items-center">
                  <div className="flex-1 min-w-[200px] flex items-center gap-2 rounded-2xl px-3 py-2 border"
                    style={{ background: darkMode ? 'rgba(255,255,255,0.03)' : thm.light, borderColor: thm.border + '50' }}>
                    <Search size={14} className="opacity-35 shrink-0" />
                    <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                      className="bg-transparent border-0 outline-none w-full text-xs font-bold" placeholder={t('search')} style={{ color: textColor }} />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={filterActiveOnly} onChange={e => setFilterActiveOnly(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 bg-slate-900 border-slate-700" />
                    <span className="text-xs font-bold opacity-60">Active Users Only</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                  {/* Users Table listing paginated (10 per page) */}
                  <div className="xl:col-span-2 rounded-3xl border overflow-hidden shadow-sm flex flex-col justify-between" style={cardStyle}>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b" style={{ background: thm.light + '80', borderColor: thm.border + '30' }}>
                            {['EMP ID', 'Name', 'Department', 'Role', 'Status', 'Points', 'Actions'].map((h, i) => (
                              <th key={i} className="px-4 py-3 text-[10px] font-black uppercase tracking-wider opacity-55">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedRows.length > 0 ? paginatedRows.map((u, i) => (
                            <tr key={u.emp_id} className="border-b hover:bg-slate-500/5 transition cursor-pointer"
                              style={{ borderColor: thm.border + '20' }}
                              onClick={() => handleInspectUser(u)}>
                              <td className="px-4 py-3 text-xs font-bold">{u.emp_id}</td>
                              <td className="px-4 py-3 text-xs font-black truncate max-w-[120px]">{u.full_name}</td>
                              <td className="px-4 py-3 text-xs font-bold opacity-75">{u.department || '-'}</td>
                              <td className="px-4 py-3 text-xs font-bold uppercase">{u.role}</td>
                              <td className="px-4 py-3 text-xs">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${u.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                                  {u.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-xs font-black" style={{ color: thm.subtext }}>{(u.points || 0).toLocaleString()}</td>
                              <td className="px-4 py-3 text-xs space-x-1.5 flex" onClick={e => e.stopPropagation()}>
                                <button onClick={() => handleOpenForm(u)} className="p-1 rounded-md border text-slate-500 hover:text-emerald-500">
                                  <Edit2 size={12} />
                                </button>
                                <button onClick={() => handleDeleteItem(u)} className="p-1 rounded-md border text-red-400 hover:text-red-600">
                                  <Trash2 size={12} />
                                </button>
                              </td>
                            </tr>
                          )) : (
                            <tr><td colSpan={7} className="text-center py-10 opacity-30 text-xs font-bold">No Users Found</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination indicators (10 per page) */}
                    <div className="p-4 border-t flex justify-between items-center" style={{ borderColor: thm.border + '30' }}>
                      <span className="text-xs font-bold opacity-45">Showing {paginatedRows.length} of {filteredRows.length} users</span>
                      <div className="flex gap-1">
                        <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}
                          className="p-1.5 rounded-lg border text-xs disabled:opacity-40"><ChevronLeft size={14} /></button>
                        <span className="px-3 py-1.5 rounded-lg border text-xs font-bold bg-slate-900/5">{currentPage} / {totalPages}</span>
                        <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}
                          className="p-1.5 rounded-lg border text-xs disabled:opacity-40"><ChevronRight size={14} /></button>
                      </div>
                    </div>
                  </div>

                  {/* User inspection side panel/ledger */}
                  <div className="rounded-3xl border p-5 shadow-sm flex flex-col" style={cardStyle}>
                    <h4 className="text-sm font-black flex items-center gap-1.5 mb-3" style={{ color: thm.text }}>
                      <History size={16} /> {t('user_detail_title')}
                    </h4>
                    {selectedUser ? (
                      <div className="space-y-4 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-3 pb-3 border-b" style={{ borderColor: thm.border + '30' }}>
                            <div className="w-11 h-11 rounded-full border-2 p-[2px]" style={{ borderColor: thm.primary }}>
                              <img src={selectedUser.avatar_url || 'https://api.dicebear.com/7.x/adventurer/svg?seed=' + selectedUser.emp_id} className="w-full h-full rounded-full object-cover" />
                            </div>
                            <div>
                              <h5 className="text-xs font-black">{selectedUser.full_name}</h5>
                              <p className="text-[10px] opacity-45">{selectedUser.emp_id} • {selectedUser.department}</p>
                              <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: thm.subtext }}>{selectedUser.points} Points</span>
                            </div>
                          </div>

                          <div className="space-y-2 mt-4 max-h-72 overflow-y-auto pr-1">
                            {selectedUserLogs.length > 0 ? selectedUserLogs.map((log, idx) => {
                              const isPos = Number(log.amount) >= 0;
                              return (
                                <div key={idx} className="p-2.5 rounded-2xl border flex items-center justify-between gap-2"
                                  style={{ background: thm.light + '40', borderColor: thm.border + '20' }}>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold truncate">{log.title || log.source_type}</p>
                                    {log.description && <p className="text-[10px] opacity-45 truncate">{log.description}</p>}
                                    <span className="text-[9px] opacity-35 font-bold block">{formatDate(log.created_at)}</span>
                                  </div>
                                  <strong className="text-xs shrink-0 font-black" style={{ color: isPos ? '#16a34a' : '#dc2626' }}>
                                    {isPos ? '+' : ''}{log.amount}
                                  </strong>
                                </div>
                              );
                            }) : <p className="text-xs opacity-40 text-center py-10 font-bold">{t('no_logs')}</p>}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center justify-center py-20 text-xs font-bold opacity-35">
                        Select a user from the list to view their ledger logs.
                      </div>
                    )}
                  </div>

                </div>
              </div>
            )}

            {/* ── MODULE: NEWS, MISSIONS, REWARDS, LEDGER ─────────────── */}
            {['news', 'missions', 'rewards', 'ledger', 'rules'].includes(activeModule) && (
              <div className="space-y-4 animate-fade-in">
                {activeModule === 'rules' && (
                  <section className="rounded-3xl p-5 border shadow-sm" style={cardStyle}>
                    <h3 className="text-sm font-black flex items-center gap-2" style={{ color: thm.text }}>
                      <BookOpen size={16} /> {t('rule_board_title')}
                    </h3>
                    <p className="text-xs opacity-55 font-bold mt-1">{t('rule_board_desc')}</p>
                  </section>
                )}

                {/* Search bar toolbar */}
                <div className="flex gap-2 max-w-sm">
                  <div className="flex-1 flex items-center gap-2 rounded-2xl px-3 py-2 border animate-fade-in"
                    style={{ background: darkMode ? 'rgba(255,255,255,0.03)' : thm.light, borderColor: thm.border + '50' }}>
                    <Search size={14} className="opacity-35 shrink-0" />
                    <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                      className="bg-transparent border-0 outline-none w-full text-xs font-bold" placeholder={t('search')} style={{ color: textColor }} />
                  </div>
                </div>

                <div className="rounded-3xl border overflow-hidden shadow-sm flex flex-col justify-between" style={cardStyle}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b" style={{ background: thm.light + '80', borderColor: thm.border + '30' }}>
                          {getModuleConfig(activeModule).columns.map((h, i) => (
                            <th key={i} className="px-4 py-3 text-[10px] font-black uppercase tracking-wider opacity-55">{h}</th>
                          ))}
                          {getModuleConfig(activeModule).save && (
                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider opacity-55">Actions</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedRows.length > 0 ? paginatedRows.map((row, idx) => (
                          <tr key={idx} className="border-b hover:bg-slate-500/5 transition"
                            style={{ borderColor: thm.border + '20' }}>
                            {getModuleConfig(activeModule).columns.map((col, i) => {
                              let val = row[col];
                              if (col === 'is_active') {
                                return (
                                  <td key={i} className="px-4 py-3 text-xs">
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${val !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                                      {val !== false ? 'ACTIVE' : 'INACTIVE'}
                                    </span>
                                  </td>
                                );
                              }
                              if (col === 'color') {
                                return (
                                  <td key={i} className="px-4 py-3 text-xs">
                                    <span className="inline-flex items-center gap-2 font-bold">
                                      <span className="w-4 h-4 rounded-full border" style={{ background: val || thm.primary, borderColor: thm.border + '60' }} />
                                      {String(val || '-')}
                                    </span>
                                  </td>
                                );
                              }
                              if (col === 'created_at' || col === 'publish_date' || col === 'updated_at') {
                                return <td key={i} className="px-4 py-3 text-[10px] opacity-45 font-bold">{formatDate(val)}</td>;
                              }
                              return <td key={i} className="px-4 py-3 text-xs font-bold">{String(val !== null && val !== undefined ? val : '-')}</td>;
                            })}
                            {getModuleConfig(activeModule).save && (
                              <td className="px-4 py-3 text-xs space-x-1.5 flex">
                                <button onClick={() => handleOpenForm(row)} className="p-1 rounded-md border text-slate-500 hover:text-emerald-500">
                                  <Edit2 size={12} />
                                </button>
                                <button onClick={() => handleDeleteItem(row)} className="p-1 rounded-md border text-red-400 hover:text-red-600">
                                  <Trash2 size={12} />
                                </button>
                              </td>
                            )}
                          </tr>
                        )) : (
                          <tr><td colSpan={10} className="text-center py-10 opacity-30 text-xs font-bold">No Data Found</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination control */}
                  <div className="p-4 border-t flex justify-between items-center" style={{ borderColor: thm.border + '30' }}>
                    <span className="text-xs font-bold opacity-45">Showing {paginatedRows.length} of {filteredRows.length} items</span>
                    <div className="flex gap-1">
                      <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}
                        className="p-1.5 rounded-lg border text-xs disabled:opacity-40"><ChevronLeft size={14} /></button>
                      <span className="px-3 py-1.5 rounded-lg border text-xs font-bold bg-slate-900/5">{currentPage} / {totalPages}</span>
                      <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}
                        className="p-1.5 rounded-lg border text-xs disabled:opacity-40"><ChevronRight size={14} /></button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── MODULE: DEPT MANAGERS (DRAG & DROP) ─────────────────── */}
            {activeModule === 'manager_depts' && (
              <div className="space-y-6 animate-fade-in">
                {/* Intro details banner */}
                <div className="rounded-3xl p-5 border relative overflow-hidden" style={cardStyle}>
                  <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl pointer-events-none opacity-25" style={{ background: thm.primary }} />
                  <h3 className="text-sm font-black flex items-center gap-1.5" style={{ color: thm.text }}>
                    <Network size={16} /> {t('drag_drop_title')}
                  </h3>
                  <p className="text-xs opacity-55 font-medium mt-0.5">{t('drag_drop_desc')}</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                  {/* Left panel: Drag tags of Departments */}
                  <div className="rounded-3xl border p-5 shadow-sm flex flex-col gap-4" style={cardStyle}>
                    <h4 className="text-xs font-black uppercase tracking-wider opacity-60">Departments & Roles Available</h4>
                    <div className="flex flex-wrap gap-2.5">
                      {allDepts.map(dept => (
                        <div key={dept} draggable onDragStart={() => handleDragStart(dept)}
                          className="px-3.5 py-2 rounded-2xl font-black text-xs border bg-emerald-500/10 text-emerald-600 border-emerald-500/30 cursor-grab active:cursor-grabbing hover:bg-emerald-500/25 transition select-none flex items-center gap-1 shadow-sm">
                          <span>🌿</span>
                          <span>{dept}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right panel: Managers dropzones cards */}
                  <div className="lg:col-span-2 space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-wider opacity-60">Active Manager Mappings</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Let's list potential managers (e.g. all admin/admin_it users or general managers list) */}
                      {[
                        { emp_id: 'EMP005', full_name: 'ผู้จัดการแผนกฝ่ายผลิต' },
                        { emp_id: 'EMP006', full_name: 'ผู้จัดการแผนก QC' },
                        { emp_id: 'EMP001', full_name: 'แอดมินระบบหลัก (IT Head)' },
                      ].map(mgr => {
                        const myDepts = moduleRows.filter(m => m.manager_emp_id === mgr.emp_id);
                        return (
                          <div key={mgr.emp_id}
                            onDragOver={e => e.preventDefault()}
                            onDrop={e => handleDrop(e, mgr.emp_id, mgr.full_name)}
                            className="rounded-3xl border p-5 transition flex flex-col justify-between min-h-[140px]"
                            style={{
                              background: darkMode ? '#1e293b' : '#fff',
                              border: `2px dashed ${draggedDept ? thm.primary : thm.border + '60'}`,
                              boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
                            }}>
                            <div>
                              <div className="flex items-center justify-between gap-2 border-b pb-2" style={{ borderColor: thm.border + '30' }}>
                                <h5 className="text-xs font-black leading-tight" style={{ color: thm.text }}>{mgr.full_name}</h5>
                                <span className="text-[9px] font-black opacity-35">{mgr.emp_id}</span>
                              </div>

                              {/* Mapping items lists */}
                              <div className="flex flex-wrap gap-1.5 mt-3">
                                {myDepts.length > 0 ? myDepts.map((d, i) => (
                                  <div key={i} className="px-2.5 py-1 rounded-xl text-[10px] font-black bg-slate-100 dark:bg-slate-800 border flex items-center gap-1">
                                    <span>{d.department_name}</span>
                                    <button onClick={() => handleRemoveMapping(mgr.emp_id, d.department_name)}
                                      className="text-red-400 hover:text-red-600 font-extrabold ml-1">×</button>
                                  </div>
                                )) : (
                                  <span className="text-[10px] font-bold opacity-35">Drag department tags here to assign</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* ── MODULE: CALENDAR (INTERACTIVE MAP) ──────────────────── */}
            {activeModule === 'calendar' && (
              <div className="space-y-6 animate-fade-in">
                {/* Intro details calendar note */}
                <div className="rounded-3xl p-5 border relative overflow-hidden" style={cardStyle}>
                  <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl pointer-events-none opacity-25" style={{ background: thm.primary }} />
                  <h3 className="text-sm font-black flex items-center gap-1.5" style={{ color: thm.text }}>
                    <CalendarDays size={16} /> {t('calendar_note_title')}
                  </h3>
                  <p className="text-xs opacity-55 font-medium mt-0.5">{t('calendar_note_desc')}</p>
                </div>

                {/* Calendar monthly mapping layout */}
                <div className="rounded-3xl border p-5 shadow-sm" style={cardStyle}>
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-sm font-black" style={{ color: thm.text }}>
                      {lang === 'th' ? MONTH_TH[calMonth.getMonth()] : MONTH_EN[calMonth.getMonth()]} {calMonth.getFullYear()}
                    </h4>
                    <div className="flex gap-1.5">
                      <button onClick={() => setCalMonth(m => { const n = new Date(m); n.setMonth(n.getMonth() - 1); return n; })}
                        className="p-2 rounded-xl border text-xs transition hover:opacity-75"
                        style={{ borderColor: thm.border + '60', color: thm.subtext }}><ChevronLeft size={14} /></button>
                      <button onClick={() => setCalMonth(m => { const n = new Date(m); n.setMonth(n.getMonth() + 1); return n; })}
                        className="p-2 rounded-xl border text-xs transition hover:opacity-75"
                        style={{ borderColor: thm.border + '60', color: thm.subtext }}><ChevronRight size={14} /></button>
                    </div>
                  </div>

                  {/* Weekday titles */}
                  <div className="grid grid-cols-7 gap-1.5 mb-1.5 text-center">
                    {(lang === 'th' ? WD_TH : WD_EN).map((d, i) => (
                      <div key={i} className="text-xs font-black uppercase opacity-45">{d}</div>
                    ))}
                  </div>

                  {/* Calendar cells grids */}
                  <div className="grid grid-cols-7 gap-1.5">
                    {Array.from({ length: getFirstDayMon(calMonth.getFullYear(), calMonth.getMonth()) }).map((_, i) => <div key={`e${i}`} />)}
                    {Array.from({ length: getDaysInMonth(calMonth.getFullYear(), calMonth.getMonth()) }).map((_, i) => {
                      const dayNum = i + 1;
                      const dateStr = `${calMonth.getFullYear()}-${String(calMonth.getMonth()+1).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`;
                      const evt = eventMap[dateStr];
                      const evtColor = calendarColorFor(evt);
                      const today = new Date().toISOString().split('T')[0];
                      const isToday = dateStr === today;

                      let bg = 'transparent', clr = darkMode ? '#64748b' : '#94a3b8', bdr = 'transparent';
                      if (evt) {
                        bg = transparentize(evtColor, darkMode ? 0.24 : 0.15);
                        clr = evtColor;
                        bdr = evtColor;
                      }
                      if (isToday) bdr = thm.primary;

                      return (
                        <div key={dayNum} onClick={() => handleCalendarCellClick(dateStr)}
                          className="aspect-square flex flex-col justify-between p-2 rounded-2xl border cursor-pointer hover:scale-102 transition duration-200 select-none min-h-[80px]"
                          style={{ background: bg, color: clr, borderColor: bdr || 'rgba(255,255,255,0.06)' }}>
                          <span className="text-xs font-black leading-none">{dayNum}</span>
                          {evt && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-lg text-white truncate max-w-full text-center block mt-1"
                              style={{ background: evtColor }}>
                              {evt.label}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

          </main>
        </div>
      </div>

      {/* ── CALENDAR EVENT MODAL (CLICK-TO-NOTE) ────────────────────── */}
      {calEventModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backdropFilter: 'blur(10px)', background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-md rounded-3xl shadow-2xl overflow-hidden relative animate-fade-in" style={cardStyle}>
            <div className="h-1.5 w-full" style={{ background: thm.primary }} />
            <div className="p-6 space-y-4">
              <h3 className="text-base font-black flex items-center gap-1.5" style={{ color: thm.text }}>
                <CalendarDays size={18} /> {lang === 'th' ? 'วันและกิจกรรมปฏิทิน' : 'Calendar Event Note'}
              </h3>
              <div>
                <label className="text-[10px] font-black opacity-45 block mb-1">วันที่ / Date</label>
                <input type="date" value={selectedCalendarDate || ''}
                  onChange={e => setSelectedCalendarDate(e.target.value)}
                  className="w-full bg-slate-950/5 border rounded-2xl h-11 px-4 text-xs font-bold outline-none"
                  style={{ color: textColor, borderColor: thm.border + '60' }} />
              </div>

              <div>
                <label className="text-[10px] font-black opacity-45 block mb-1">ประเภทวัน / Type</label>
                <select value={calEventType} onChange={e => setCalEventType(e.target.value as any)}
                  className="w-full bg-slate-950/5 border rounded-2xl h-11 px-3 text-xs font-bold outline-none"
                  style={{ color: textColor, borderColor: thm.border + '60' }}>
                  <option value="holiday">วันหยุด (Holiday)</option>
                  <option value="event">กิจกรรมบริษัท (Company Event)</option>
                  <option value="note">โน้ต / หมายเหตุ (Note)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black opacity-45 block mb-2">สีไฮไลท์ / Highlight Color</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {CALENDAR_COLOR_PRESETS.map(color => (
                    <button key={color} type="button" onClick={() => setCalEventColor(color)}
                      className="w-9 h-9 rounded-xl border flex items-center justify-center transition active:scale-95"
                      style={{ background: color, borderColor: calEventColor === color ? textColor : 'transparent' }}>
                      {calEventColor === color && <Check size={14} className="text-white" />}
                    </button>
                  ))}
                  <label className="h-9 px-2 rounded-xl border flex items-center gap-2 text-xs font-black"
                    style={{ borderColor: thm.border + '60' }}>
                    <Palette size={13} />
                    <input type="color" value={calEventColor} onChange={e => setCalEventColor(e.target.value)}
                      className="w-8 h-7 bg-transparent border-0 p-0" />
                  </label>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black opacity-45 block mb-1">บันทึกข้อความ / Event Note Description</label>
                <input required value={calEventLabel} onChange={e => setCalEventLabel(e.target.value)}
                  placeholder="เช่น วันหยุดราชการ, กิจกรรมส่งแต้มพิเศษ"
                  className="w-full bg-slate-950/5 border rounded-2xl h-11 px-4 text-xs font-bold outline-none"
                  style={{ color: textColor, borderColor: thm.border + '60' }} />
              </div>

              <div className="flex gap-2.5 pt-4 border-t" style={{ borderColor: thm.border + '30' }}>
                {calendarEvents.some(e => e.date === selectedCalendarDate) && (
                  <button onClick={handleDeleteCalendarEvent}
                    className="px-4 py-2.5 rounded-2xl text-xs font-black border text-red-500 border-red-200 hover:bg-red-50">
                    {t('delete')}
                  </button>
                )}
                <button onClick={() => setCalEventModalOpen(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 font-black text-xs py-2.5 rounded-2xl transition">
                  {t('cancel')}
                </button>
                <button onClick={handleSaveCalendarEvent}
                  className="flex-1 text-white font-black text-xs py-2.5 rounded-2xl transition"
                  style={{ background: thm.primary }}>
                  {t('save')}
                </button>
              </div>
            </div>
            <button onClick={() => setCalEventModalOpen(false)} className="absolute top-4 right-4 opacity-40 hover:opacity-80 transition">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── GENERIC EDIT/ADD FORM MODAL ────────────────────────────── */}
      {modalOpen && editingRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
          style={{ backdropFilter: 'blur(10px)', background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-lg rounded-3xl shadow-2xl relative my-8 animate-fade-in" style={cardStyle}>
            <div className="h-1.5 w-full" style={{ background: thm.primary }} />
            <div className="p-6">
              <h3 className="text-base font-black mb-4 flex items-center gap-1.5" style={{ color: thm.text }}>
                <Edit2 size={16} /> Edit Data Entry — {activeModule.toUpperCase()}
              </h3>

              <form onSubmit={handleSaveForm} className="space-y-4">
                {activeModule === 'users' && (
                  <>
                    <div>
                      <label className="text-[10px] font-black opacity-45 block mb-1">Employee ID *</label>
                      <input required disabled={editingRow.emp_id !== undefined} value={editingRow.emp_id || ''}
                        onChange={e => setEditingRow({ ...editingRow, emp_id: e.target.value })}
                        className="w-full bg-slate-950/5 border disabled:opacity-50 rounded-2xl h-11 px-4 text-xs font-bold outline-none"
                        style={{ color: textColor, borderColor: thm.border + '60' }} />
                    </div>
                    <div>
                      <label className="text-[10px] font-black opacity-45 block mb-1">Full Name *</label>
                      <input required value={editingRow.full_name || ''}
                        onChange={e => setEditingRow({ ...editingRow, full_name: e.target.value })}
                        className="w-full bg-slate-950/5 border rounded-2xl h-11 px-4 text-xs font-bold outline-none"
                        style={{ color: textColor, borderColor: thm.border + '60' }} />
                    </div>
                    <div>
                      <label className="text-[10px] font-black opacity-45 block mb-1">Department</label>
                      <input value={editingRow.department || ''}
                        onChange={e => setEditingRow({ ...editingRow, department: e.target.value })}
                        className="w-full bg-slate-950/5 border rounded-2xl h-11 px-4 text-xs font-bold outline-none"
                        style={{ color: textColor, borderColor: thm.border + '60' }} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-black opacity-45 block mb-1">Role</label>
                        <select value={editingRow.role || 'user'} onChange={e => setEditingRow({ ...editingRow, role: e.target.value })}
                          className="w-full bg-slate-950/5 dark:bg-slate-800 border rounded-2xl h-11 px-3 text-xs font-bold outline-none"
                          style={{ color: textColor, borderColor: thm.border + '60' }}>
                          <option value="user">USER</option>
                          <option value="admin">ADMIN</option>
                          <option value="admin_it">ADMIN_IT</option>
                          <option value="dev">DEV</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-black opacity-45 block mb-1">Status</label>
                        <select value={editingRow.status || 'ACTIVE'} onChange={e => setEditingRow({ ...editingRow, status: e.target.value })}
                          className="w-full bg-slate-950/5 dark:bg-slate-800 border rounded-2xl h-11 px-3 text-xs font-bold outline-none"
                          style={{ color: textColor, borderColor: thm.border + '60' }}>
                          <option value="ACTIVE">ACTIVE</option>
                          <option value="INACTIVE">INACTIVE</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black opacity-45 block mb-1">{t('read_only_points')}</label>
                      <input disabled value={editingRow.points || 0}
                        className="w-full bg-slate-950/5 border opacity-50 rounded-2xl h-11 px-4 text-xs font-bold outline-none"
                        style={{ color: textColor, borderColor: thm.border + '60' }} />
                    </div>
                  </>
                )}

                {['news', 'missions', 'rewards'].includes(activeModule) && (
                  <>
                    <div>
                      <label className="text-[10px] font-black opacity-45 block mb-1">{activeModule === 'rewards' ? 'Reward Item Name *' : 'Title / Topic *'}</label>
                      <input required value={editingRow.topic || editingRow.title || editingRow.name || ''}
                        onChange={e => setEditingRow({ ...editingRow, topic: e.target.value, title: e.target.value, name: e.target.value })}
                        className="w-full bg-slate-950/5 border rounded-2xl h-11 px-4 text-xs font-bold outline-none"
                        style={{ color: textColor, borderColor: thm.border + '60' }} />
                    </div>
                    <div>
                      <label className="text-[10px] font-black opacity-45 block mb-1">Details / Description</label>
                      <textarea rows={3} value={editingRow.detail || editingRow.description || ''}
                        onChange={e => setEditingRow({ ...editingRow, detail: e.target.value, description: e.target.value })}
                        className="w-full bg-slate-950/5 border rounded-2xl p-3 text-xs font-bold outline-none"
                        style={{ color: textColor, borderColor: thm.border + '60' }} />
                    </div>
                    {activeModule === 'news' && (
                      <div>
                        <label className="text-[10px] font-black opacity-45 block mb-1">Publish Date</label>
                        <input type="date" value={editingRow.publish_date ? String(editingRow.publish_date).split('T')[0] : ''}
                          onChange={e => setEditingRow({ ...editingRow, publish_date: e.target.value })}
                          className="w-full bg-slate-950/5 border rounded-2xl h-11 px-4 text-xs font-bold outline-none"
                          style={{ color: textColor, borderColor: thm.border + '60' }} />
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-black opacity-45 block mb-1">
                          {activeModule === 'rewards' ? t('points_required') : t('points_reward')}
                        </label>
                        <input type="number" value={editingRow.points !== undefined ? editingRow.points : (editingRow.points_required || 0)}
                          onChange={e => setEditingRow({ ...editingRow, points: Number(e.target.value), points_required: Number(e.target.value) })}
                          className="w-full bg-slate-950/5 border rounded-2xl h-11 px-4 text-xs font-bold outline-none"
                          style={{ color: textColor, borderColor: thm.border + '60' }} />
                      </div>
                      {activeModule === 'rewards' && (
                        <div>
                          <label className="text-[10px] font-black opacity-45 block mb-1">Stock count</label>
                          <input type="number" value={editingRow.stock !== undefined && editingRow.stock !== null ? editingRow.stock : ''}
                            onChange={e => setEditingRow({ ...editingRow, stock: e.target.value === '' ? null : Number(e.target.value) })}
                            className="w-full bg-slate-950/5 border rounded-2xl h-11 px-4 text-xs font-bold outline-none"
                            placeholder="Unlimited"
                            style={{ color: textColor, borderColor: thm.border + '60' }} />
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="text-[10px] font-black opacity-45 block mb-1">Image URL / Cover Link</label>
                      <input value={editingRow.image_url || editingRow.cover_url || ''}
                        onChange={e => setEditingRow({ ...editingRow, image_url: e.target.value, cover_url: e.target.value })}
                        className="w-full bg-slate-950/5 border rounded-2xl h-11 px-4 text-xs font-bold outline-none"
                        placeholder="https://image-url-link.com/file.jpg"
                        style={{ color: textColor, borderColor: thm.border + '60' }} />
                    </div>
                    <label className="flex items-center gap-2 pt-2 cursor-pointer">
                      <input type="checkbox" checked={editingRow.is_active !== false}
                        onChange={e => setEditingRow({ ...editingRow, is_active: e.target.checked })}
                        className="w-4 h-4 rounded text-emerald-600 bg-slate-900 border-slate-700" />
                      <span className="text-xs font-bold opacity-60">Publish / Active entry</span>
                    </label>
                  </>
                )}

                {activeModule === 'rules' && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-black opacity-45 block mb-1">Category *</label>
                        <select value={editingRow.category || 'policy'}
                          onChange={e => setEditingRow({ ...editingRow, category: e.target.value })}
                          className="w-full bg-slate-950/5 dark:bg-slate-800 border rounded-2xl h-11 px-3 text-xs font-bold outline-none"
                          style={{ color: textColor, borderColor: thm.border + '60' }}>
                          <option value="policy">กฎระเบียบ</option>
                          <option value="5s">5ส</option>
                          <option value="iso_gmp">ISO/GMP</option>
                          <option value="company">เกี่ยวกับบริษัท</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-black opacity-45 block mb-1">Sort Order</label>
                        <input type="number" value={editingRow.sort_order || 0}
                          onChange={e => setEditingRow({ ...editingRow, sort_order: Number(e.target.value) })}
                          className="w-full bg-slate-950/5 border rounded-2xl h-11 px-4 text-xs font-bold outline-none"
                          style={{ color: textColor, borderColor: thm.border + '60' }} />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black opacity-45 block mb-1">Board Title *</label>
                      <input required value={editingRow.title || ''}
                        onChange={e => setEditingRow({ ...editingRow, title: e.target.value })}
                        className="w-full bg-slate-950/5 border rounded-2xl h-11 px-4 text-xs font-bold outline-none"
                        style={{ color: textColor, borderColor: thm.border + '60' }} />
                    </div>
                    <div>
                      <label className="text-[10px] font-black opacity-45 block mb-1">HTML Content</label>
                      <textarea rows={7} value={editingRow.body_html || editingRow.body || ''}
                        onChange={e => setEditingRow({ ...editingRow, body_html: e.target.value })}
                        className="w-full bg-slate-950/5 border rounded-2xl p-3 text-xs font-bold outline-none leading-relaxed"
                        placeholder="<p>รายละเอียดที่ต้องการแสดงในหน้ากฎระเบียบ</p>"
                        style={{ color: textColor, borderColor: thm.border + '60' }} />
                    </div>
                    <div>
                      <label className="text-[10px] font-black opacity-45 block mb-1">Accent Color</label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={editingRow.color || thm.primary}
                          onChange={e => setEditingRow({ ...editingRow, color: e.target.value })}
                          className="h-10 w-14 rounded-xl border bg-transparent p-1"
                          style={{ borderColor: thm.border + '60' }} />
                        <input value={editingRow.color || thm.primary}
                          onChange={e => setEditingRow({ ...editingRow, color: e.target.value })}
                          className="flex-1 bg-slate-950/5 border rounded-2xl h-11 px-4 text-xs font-bold outline-none"
                          style={{ color: textColor, borderColor: thm.border + '60' }} />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 pt-2 cursor-pointer">
                      <input type="checkbox" checked={editingRow.is_active !== false}
                        onChange={e => setEditingRow({ ...editingRow, is_active: e.target.checked })}
                        className="w-4 h-4 rounded text-emerald-600 bg-slate-900 border-slate-700" />
                      <span className="text-xs font-bold opacity-60">Publish to user rule board</span>
                    </label>
                  </>
                )}

                <div className="flex gap-3 pt-4 border-t" style={{ borderColor: thm.border + '30' }}>
                  <button type="button" onClick={() => { setModalOpen(false); setEditingRow(null); }}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 font-black text-xs py-3 rounded-2xl transition">
                    {t('cancel')}
                  </button>
                  <button type="submit" className="flex-1 text-white font-black text-xs py-3 rounded-2xl transition"
                    style={{ background: thm.primary }}>
                    {t('save')}
                  </button>
                </div>
              </form>
            </div>
            <button onClick={() => { setModalOpen(false); setEditingRow(null); }} className="absolute top-4 right-4 opacity-40 hover:opacity-80 transition">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Sidebar - Mobile drawer overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden animate-fade-in" onClick={() => setSidebarOpen(false)}>
          <aside className="w-64 h-full bg-slate-900 flex flex-col p-4 relative" style={sidebarStyle} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <img
                  src={COMPANY_LOGO_URL}
                  alt="SB Connect"
                  className="h-7 max-w-[142px] object-contain object-left"
                  style={{ background: 'transparent', filter: 'drop-shadow(0 1px 1px rgba(255,255,255,0.18))' }}
                />
              </div>
              <button onClick={() => setSidebarOpen(false)} className="p-1 rounded-lg border">
                <X size={16} />
              </button>
            </div>

            <nav className="flex-1 space-y-1">
              {sidebarItems.map(item => (
                <button key={item.id} onClick={() => { setActiveModule(item.id as ModuleType); setSidebarOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-black transition-all text-left"
                  style={{
                    background: activeModule === item.id ? `${SOFT_DARK_NAV}, ${transparentize(item.color, 0.18)}` : 'linear-gradient(135deg, rgba(15,23,42,0.045), rgba(51,65,85,0.08))',
                    color: activeModule === item.id ? '#f8fafc' : (darkMode ? '#cbd5e1' : '#475569'),
                  }}>
                  <span className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: transparentize(item.color, activeModule === item.id ? 0.2 : 0.1), color: item.color }}>
                    {item.icon}
                  </span>
                  <span className="truncate sb-nav-label">{item.label}</span>
                </button>
              ))}
            </nav>

            <button onClick={logout}
              className="w-full flex items-center justify-center gap-2 py-3 bg-red-500/10 text-red-400 border border-red-500/20 rounded-2xl text-xs font-black mt-4">
              <LogOut size={16} /> {t('logout_btn')}
            </button>
          </aside>
        </div>
      )}

    </div>
  );
}

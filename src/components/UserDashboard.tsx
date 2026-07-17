import { useEffect, useState, useRef } from 'react';
import {
  Bell, Coins, CalendarCheck, Award, Newspaper, ShoppingBag, Trophy, History,
  LogOut, Search, RefreshCw, User, CheckCircle2, ShieldAlert,
  X, ChevronLeft, ChevronRight, Globe, Camera, Settings, Check, Star, Sun, Moon, List,
  Wrench, FileText, ClipboardList, Building2, BookOpen, Sparkles, Crown
} from 'lucide-react';
import { rpc, logout, getCurrentUser } from '../helpers/api';
import AppLoader from './AppLoader';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type Lang = 'th' | 'en';
type ThemeColor = 'mint' | 'ocean' | 'sunset' | 'lavender';
type TabType = 'home' | 'news' | 'mission' | 'rewards' | 'ranking' | 'tools' | 'rules' | 'notifications' | 'logs' | 'settings';
type RuleCategory = 'policy' | '5s' | 'iso_gmp' | 'company';
type CustomTheme = {
  topBar1: string;
  topBar2: string;
  nav1: string;
  nav2: string;
};
type WelcomeConfig = {
  title: string;
  message: string;
  video_url: string;
  is_active: boolean;
};

type UserDashboardProps = {
  user: any;
  onLogout: () => void;
};

// ─────────────────────────────────────────────────────────────────────────────
// Translation Table
// ─────────────────────────────────────────────────────────────────────────────
const TRANS: Record<Lang, Record<string, string>> = {
  th: {
    app_name: 'SB CONNECT', app_sub: 'พอร์ทัลพนักงาน',
    home: 'หน้าหลัก', news: 'ข่าวสาร', tasks: 'ภารกิจ', shop: 'ร้านรางวัล',
    rank: 'อันดับ', history: 'ประวัติ', settings: 'ตั้งค่า', notifications: 'แจ้งเตือน',
    tools: 'เครื่องมือ', services: 'Services', quotation: 'เปิดใบ Quotation', it_request: 'ใบคำร้องขอ IT',
    rules: 'กฎระเบียบ', five_s: '5ส', iso_gmp: 'ISO/GMP', about_company: 'เกี่ยวกับบริษัท',
    ranking_full: 'Ranking Full', filter_department: 'แผนก', filter_role: 'บทบาท',
    checkin: 'เช็คอินประจำวัน', checkin_desc: 'รับคะแนนสะสมพิเศษและบันทึกกิจกรรมประจำวัน',
    checkin_done: 'เช็คอินวันนี้แล้ว ✓', checkin_btn: 'เช็คอินวันนี้', checkin_loading: 'กำลังบันทึก...',
    pts: 'แต้ม', read_btn: 'อ่านข่าว', read_done: 'อ่านแล้ว ✓',
    submit: 'ส่งภารกิจ', done: 'สำเร็จแล้ว ✓', redeem: 'แลกรางวัล', not_enough: 'แต้มไม่พอ',
    leaderboard: 'ผู้นำตาราง', leaderboard_sub: 'รายชื่อผู้สะสมคะแนนสูงสุดใน SB Connect',
    no_data: 'ยังไม่มีข้อมูล', search: 'ค้นหา...', refresh: 'รีเฟรช', logout_btn: 'ออกจากระบบ',
    profile_photo: 'เปลี่ยนรูปโปรไฟล์', photo_hint: 'คลิกที่รูปเพื่ออัปโหลด',
    dark_mode: 'โหมดมืด', lang_switch: 'ภาษา / Language',
    theme_color: 'ธีมสี', theme_mint: 'มินต์เขียว', theme_ocean: 'น้ำทะเล',
    theme_sunset: 'ซันเซ็ต', theme_lavender: 'ลาเวนเดอร์',
    notif_toggle: 'การแจ้งเตือน',
    welcome_title: 'ยินดีต้อนรับ! 🎉', welcome_sub: 'มีอัปเดตใหม่ในระบบ SB Connect วันนี้',
    welcome_skip: 'ไม่ต้องแสดงอีกวันนี้', welcome_start: 'เริ่มใช้งาน',
    mark_read: 'อ่านทั้งหมด', no_notif: 'ไม่มีการแจ้งเตือน',
    cal_title: 'ปฏิทินเช็คอิน', cal_ok: 'เช็คอิน', cal_miss: 'ไม่ได้เช็คอิน', cal_event: 'กิจกรรม/หยุด',
    remaining: 'แต้มคงเหลือ', news_read_ct: 'ข่าวที่อ่าน', missions_ct: 'ภารกิจสำเร็จ', rewards_ct: 'การแลก',
    flip_hint: 'แตะเพื่อพลิกบัตร', flip_back: 'แตะเพื่อพลิกกลับ',
    work_info: 'ข้อมูลการเข้าทำงาน', total_checkin: 'เช็คอินสะสม', last_checkin_lbl: 'เช็คอินล่าสุด',
    latest_news: 'ข่าวล่าสุด', top_employees: 'พนักงานระดับท็อป', see_all: 'ดูทั้งหมด →',
    filter_all: 'ทั้งหมด', filter_pending: 'ยังไม่ทำ', filter_done: 'เสร็จสิ้น',
    stock: 'คงเหลือ:', unlimited: 'ไม่จำกัด', pcs: 'ชิ้น',
    table_view: 'ตาราง', grid_view: 'การ์ด',
    appearance: 'การแสดงผล', account_section: 'บัญชีผู้ใช้', system_section: 'ระบบ',
    connect_label: 'CAREBEAU CONNECT', role_badge: 'ROLE:',
    history_empty: 'ยังไม่มีรายการบันทึกคะแนน', notif_empty: 'ไม่มีการแจ้งเตือน',
    version_label: 'เวอร์ชัน', mode_label: 'โหมด', emp_label: 'รหัสพนักงาน', role_label: 'บทบาท',
  },
  en: {
    app_name: 'SB CONNECT', app_sub: 'User Portal',
    home: 'Home', news: 'News', tasks: 'Tasks', shop: 'Shop',
    rank: 'Rank', history: 'History', settings: 'Settings', notifications: 'Alerts',
    tools: 'Tools', services: 'Services', quotation: 'Quotation Request', it_request: 'IT Request',
    rules: 'Rules', five_s: '5S', iso_gmp: 'ISO/GMP', about_company: 'Company',
    ranking_full: 'Ranking Full', filter_department: 'Department', filter_role: 'Role',
    checkin: 'Daily Check-In', checkin_desc: 'Earn bonus points by checking in every day',
    checkin_done: 'Checked In ✓', checkin_btn: 'Check In Now', checkin_loading: 'Saving...',
    pts: 'Pts', read_btn: 'Read', read_done: 'Read ✓',
    submit: 'Submit', done: 'Done ✓', redeem: 'Redeem', not_enough: 'Not Enough',
    leaderboard: 'Leaderboard', leaderboard_sub: 'Top point earners in SB Connect',
    no_data: 'No data yet', search: 'Search...', refresh: 'Refresh', logout_btn: 'Log Out',
    profile_photo: 'Change Profile Photo', photo_hint: 'Click photo to upload',
    dark_mode: 'Dark Mode', lang_switch: 'ภาษา / Language',
    theme_color: 'Theme Color', theme_mint: 'Mint Green', theme_ocean: 'Ocean Blue',
    theme_sunset: 'Sunset Orange', theme_lavender: 'Lavender',
    notif_toggle: 'Notifications',
    welcome_title: 'Welcome! 🎉', welcome_sub: "New updates in SB Connect today",
    welcome_skip: "Don't show again today", welcome_start: 'Get Started',
    mark_read: 'Mark all read', no_notif: 'No notifications',
    cal_title: 'Check-In Calendar', cal_ok: 'Checked In', cal_miss: 'Missed', cal_event: 'Holiday/Event',
    remaining: 'Points', news_read_ct: 'News Read', missions_ct: 'Missions', rewards_ct: 'Redeemed',
    flip_hint: 'Tap to flip', flip_back: 'Tap to flip back',
    work_info: 'Attendance Info', total_checkin: 'Total Check-Ins', last_checkin_lbl: 'Last Check-In',
    latest_news: 'Latest News', top_employees: 'Top Employees', see_all: 'See all →',
    filter_all: 'All', filter_pending: 'Pending', filter_done: 'Completed',
    stock: 'Stock:', unlimited: 'Unlimited', pcs: 'pcs',
    table_view: 'Table', grid_view: 'Cards',
    appearance: 'Appearance', account_section: 'Account', system_section: 'System',
    connect_label: 'CAREBEAU CONNECT', role_badge: 'ROLE:',
    history_empty: 'No point transactions yet', notif_empty: 'No notifications at this time',
    version_label: 'Version', mode_label: 'Mode', emp_label: 'Employee ID', role_label: 'Role',
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Theme System
// ─────────────────────────────────────────────────────────────────────────────
const THEMES: Record<ThemeColor, {
  primary: string; bg: string; light: string; border: string; text: string; subtext: string; cardBorder: string;
}> = {
  mint:     { primary:'#10b981', bg:'#f0fdfa', light:'#ecfdf5', border:'#6ee7b7', text:'#065f46', subtext:'#059669', cardBorder:'#a7f3d0' },
  ocean:    { primary:'#3b82f6', bg:'#eff6ff', light:'#dbeafe', border:'#93c5fd', text:'#1e3a8a', subtext:'#2563eb', cardBorder:'#bfdbfe' },
  sunset:   { primary:'#f97316', bg:'#fff7ed', light:'#ffedd5', border:'#fdba74', text:'#7c2d12', subtext:'#ea580c', cardBorder:'#fed7aa' },
  lavender: { primary:'#8b5cf6', bg:'#f5f3ff', light:'#ede9fe', border:'#c4b5fd', text:'#4c1d95', subtext:'#7c3aed', cardBorder:'#ddd6fe' },
};

const MONTH_TH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const MONTH_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const WD_TH = ['จ','อ','พ','พฤ','ศ','ส','อา'];
const WD_EN = ['M','T','W','T','F','S','S'];

const ICON_BASE = `${import.meta.env.BASE_URL || './'}icons/`;
const COMPANY_LOGO_URL = 'https://lh3.googleusercontent.com/d/1SqzBIsXwfMzd91mgBepq6O2-nbGaZR4s';
const NAV_LOGO_HOME = `${ICON_BASE}SB INTERLAB 3D.png`;
const NAV_LOGO_NEWS = `${ICON_BASE}icon_news-removebg-preview.png`;
const NAV_LOGO_TASK = `${ICON_BASE}icon_task-removebg-preview.png`;
const NAV_LOGO_REWARDS = `${ICON_BASE}icon_transfer-removebg-preview.png`;
const NAV_LOGO_RANKING = `${ICON_BASE}icon_ranking-removebg-preview.png`;
const POINT_RABBIT_URL = `${ICON_BASE}icon_point-removebg-preview.png`;
const DEFAULT_CARD_COLORS = {
  card1: '#052f3a',
  card2: '#0e98a8',
  accent1: '#b7791f',
  accent2: '#fff4b0',
};
const CARD_THEME_KEY = 'sb_admin_card_theme';
const DEFAULT_CUSTOM_THEME: CustomTheme = {
  topBar1: '#075f56',
  topBar2: '#99f6e4',
  nav1: '#064e3b',
  nav2: '#5eead4',
};
const THEME_PRESET_COLORS: Record<ThemeColor, CustomTheme> = {
  mint: DEFAULT_CUSTOM_THEME,
  ocean: {
    topBar1: '#1e3a8a',
    topBar2: '#93c5fd',
    nav1: '#172554',
    nav2: '#60a5fa',
  },
  sunset: {
    topBar1: '#9a3412',
    topBar2: '#fed7aa',
    nav1: '#7c2d12',
    nav2: '#fb923c',
  },
  lavender: {
    topBar1: '#5b21b6',
    topBar2: '#ddd6fe',
    nav1: '#3b0764',
    nav2: '#a78bfa',
  },
};

const RULE_CATEGORIES: { id: RuleCategory; th: string; en: string; icon: any }[] = [
  { id: 'policy', th: 'กฎระเบียบ', en: 'Rules', icon: BookOpen },
  { id: '5s', th: '5ส', en: '5S', icon: Sparkles },
  { id: 'iso_gmp', th: 'ISO/GMP', en: 'ISO/GMP', icon: ShieldAlert },
  { id: 'company', th: 'เกี่ยวกับบริษัท', en: 'Company', icon: Building2 },
];

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

function customThemeKey(empId?: string) {
  return `sb_custom_theme_${empId || 'guest'}`;
}

function selectedThemeKey(empId?: string) {
  return `sb_theme_${empId || 'guest'}`;
}

function readCustomTheme(empId?: string): CustomTheme {
  try {
    return { ...DEFAULT_CUSTOM_THEME, ...JSON.parse(localStorage.getItem(customThemeKey(empId)) || '{}') };
  } catch {
    return DEFAULT_CUSTOM_THEME;
  }
}

function readSelectedTheme(empId?: string): ThemeColor {
  const saved = localStorage.getItem(selectedThemeKey(empId)) || localStorage.getItem('sb_theme') || 'mint';
  return (['mint', 'ocean', 'sunset', 'lavender'] as ThemeColor[]).includes(saved as ThemeColor) ? saved as ThemeColor : 'mint';
}

function readCardTheme() {
  try {
    return { ...DEFAULT_CARD_COLORS, ...JSON.parse(localStorage.getItem(CARD_THEME_KEY) || '{}') };
  } catch {
    return DEFAULT_CARD_COLORS;
  }
}

function gradient(from: string, to: string, angle = 135) {
  return `linear-gradient(${angle}deg, ${from}, ${to})`;
}

function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function videoEmbedUrl(url?: string) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  const yt = raw.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/);
  if (yt?.[1]) return `https://www.youtube.com/embed/${yt[1]}?autoplay=1&mute=1&playsinline=1&rel=0`;
  return raw;
}

function normalizeProfile(record: any = {}) {
  return {
    ...record,
    emp_id: record.emp_id || record.empId || record.employee_id || '',
    full_name: record.full_name || record.name || record.display_name || `${record.name_th || ''} ${record.surname_th || ''}`.trim(),
    department: record.department || record.dept || record.dept_th || record.department_name || '',
    position: record.position || record.pos_th || record.position_name || '',
    role: record.role || record.app_role || 'user',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function UserDashboard({ user: initialUser, onLogout }: UserDashboardProps) {

  // ── Existing state ──────────────────────────────────────────────────────
  const [user, setUser] = useState(() => normalizeProfile(initialUser || getCurrentUser()));
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [loading, setLoading] = useState(false);
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);

  // Data states
  const [dashboardData, setDashboardData] = useState<any>({});
  const [newsList, setNewsList]             = useState<any[]>([]);
  const [missionsList, setMissionsList]     = useState<any[]>([]);
  const [rewardsList, setRewardsList]       = useState<any[]>([]);
  const [rankingList, setRankingList]       = useState<any[]>([]);
  const [notifications, setNotifications]   = useState<any[]>([]);
  const [logsList, setLogsList]             = useState<any[]>([]);
  const [rulesList, setRulesList]           = useState<any[]>([]);

  // ── NEW state ───────────────────────────────────────────────────────────
  const [lang, setLang]             = useState<Lang>(() => (localStorage.getItem('sb_lang') as Lang) || 'th');
  const [theme, setTheme]           = useState<ThemeColor>(() => readSelectedTheme(initialUser?.emp_id || getCurrentUser()?.emp_id || ''));
  const [customTheme, setCustomTheme] = useState<CustomTheme>(() => readCustomTheme(initialUser?.emp_id || getCurrentUser()?.emp_id || ''));
  const [cardTheme, setCardTheme] = useState(() => readCardTheme());
  const [darkMode, setDarkMode]     = useState(() => localStorage.getItem('sb_dark') === 'true');
  const [notifEnabled, setNotifEnabled] = useState(() => localStorage.getItem('sb_notif') !== 'false');
  const [avatarUrl, setAvatarUrl]   = useState(() => localStorage.getItem('sb_avatar_' + (initialUser?.emp_id || '')) || '');

  const [showWelcome, setShowWelcome]         = useState(false);
  const [welcomeSkip, setWelcomeSkip]         = useState(false);
  const [notifPanelOpen, setNotifPanelOpen]   = useState(false);
  const [lightboxItem, setLightboxItem]       = useState<any | null>(null);
  const [lightboxList, setLightboxList]       = useState<any[]>([]);
  const [lightboxIdx, setLightboxIdx]         = useState(0);
  const [newsViewMode, setNewsViewMode]       = useState<'grid' | 'table'>('grid');
  const [carouselIdx, setCarouselIdx]         = useState(0);
  const [calMonth, setCalMonth]               = useState(() => new Date());
  const [calendarEvents, setCalendarEvents]   = useState<any[]>([]);
  const [welcomeConfig, setWelcomeConfig] = useState<WelcomeConfig>({
    title: 'SB CONNECT',
    message: '',
    video_url: '',
    is_active: true,
  });
  const [cardPreviewOpen, setCardPreviewOpen] = useState(false);
  const [toolsModalOpen, setToolsModalOpen]   = useState(false);
  const [rulesCategory, setRulesCategory]     = useState<RuleCategory>('policy');

  const fileInputRef  = useRef<HTMLInputElement>(null);
  const notifPanelRef = useRef<HTMLDivElement>(null);
  const token = localStorage.getItem('sb_session_token') || '';
  const t = (key: string) => TRANS[lang][key] || key;
  const thm = THEMES[theme];
  const profile = normalizeProfile(user);
  const topBarGradient = gradient(customTheme.topBar1, customTheme.topBar2, 135);
  const navGradient = gradient(customTheme.nav1, customTheme.nav2, 135);
  const cardGradient = gradient(cardTheme.card1, cardTheme.card2, 155);
  const accentGradient = gradient(cardTheme.accent1, cardTheme.accent2, 135);

  // ── Persist settings ────────────────────────────────────────────────────
  useEffect(() => { localStorage.setItem('sb_lang', lang); }, [lang]);
  useEffect(() => {
    localStorage.setItem(selectedThemeKey(profile.emp_id), theme);
    localStorage.setItem('sb_theme', theme);
  }, [theme, profile.emp_id]);
  useEffect(() => { localStorage.setItem(customThemeKey(profile.emp_id), JSON.stringify(customTheme)); }, [customTheme, profile.emp_id]);
  useEffect(() => { localStorage.setItem('sb_dark', String(darkMode)); }, [darkMode]);
  useEffect(() => { localStorage.setItem('sb_notif', String(notifEnabled)); }, [notifEnabled]);

  useEffect(() => {
    setTheme(readSelectedTheme(profile.emp_id));
    setCustomTheme(readCustomTheme(profile.emp_id));
  }, [profile.emp_id]);

  // ── Hash routing ─────────────────────────────────────────────────────────
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '');
      const valid: TabType[] = ['home','news','mission','rewards','ranking','tools','rules','notifications','logs','settings'];
      if (valid.includes(hash as any)) setActiveTab(hash as TabType);
      else if (hash === 'overall_log') setActiveTab('logs');
    };
    window.addEventListener('hashchange', handleHash);
    handleHash();
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  useEffect(() => {
    window.location.hash = activeTab === 'logs' ? 'overall_log' : activeTab;
  }, [activeTab]);

  // ── Welcome screen — show once per day ──────────────────────────────────
  useEffect(() => {
    const today = localDateKey();
    const dismissed = localStorage.getItem('sb_welcome_dismissed');
    if (dismissed !== today) setTimeout(() => setShowWelcome(true), 900);
  }, []);

  useEffect(() => {
    fetchWelcomeConfig();
    setCardTheme(readCardTheme());
  }, []);

  // ── Carousel auto-advance ─────────────────────────────────────────────
  useEffect(() => {
    const count = dashboardData?.latest_news?.length || 0;
    if (count < 2) return;
    const t = setInterval(() => setCarouselIdx(p => (p + 1) % count), 3500);
    return () => clearInterval(t);
  }, [dashboardData?.latest_news?.length]);

  // ── Close notif panel on outside click ────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifPanelRef.current && !notifPanelRef.current.contains(e.target as Node))
        setNotifPanelOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Data fetching ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    if (activeTab === 'home')               { fetchDashboard(); fetchLogs(); fetchCalendarEvents(); fetchMissions(); }
    else if (activeTab === 'news')          fetchNews();
    else if (activeTab === 'mission')       fetchMissions();
    else if (activeTab === 'rewards')       fetchRewards();
    else if (activeTab === 'ranking')       fetchRanking();
    else if (activeTab === 'rules')         fetchRules();
    else if (activeTab === 'notifications') fetchNotifications();
    else if (activeTab === 'logs')          fetchLogs();
    else if (activeTab === 'settings')      fetchCalendarEvents();
  }, [activeTab]);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const data = await rpc<any>('get_home_dashboard', { p_token: token });
      setDashboardData(data || {});
      if (data?.user) {
        const nextUser = normalizeProfile(data.user);
        setUser(nextUser);
        localStorage.setItem('sb_current_user', JSON.stringify(nextUser));
      }
    } catch {
      try {
        const p = await rpc<any>('get_my_profile', { p_token: token });
        if (p) {
          const nextUser = normalizeProfile(p.user || p);
          setUser(nextUser);
          localStorage.setItem('sb_current_user', JSON.stringify(nextUser));
        }
        setDashboardData(p?.user ? p : { ...(p || {}), user: p });
      } catch (e) { showError(e); }
    } finally { setLoading(false); }
  };

  const fetchNews = async () => {
    setLoading(true);
    try {
      const data = await rpc<any>('list_news', { p_token: token });
      const arr = Array.isArray(data) ? data : (data?.items || data?.news || []);
      setNewsList(arr); setLightboxList(arr);
    } catch (err) { showError(err); } finally { setLoading(false); }
  };

  const fetchMissions = async () => {
    setLoading(true);
    try {
      const data = await rpc<any>('list_missions', { p_token: token });
      setMissionsList(Array.isArray(data) ? data : (data?.items || data?.missions || []));
    } catch (err) { showError(err); } finally { setLoading(false); }
  };

  const fetchRewards = async () => {
    setLoading(true);
    try {
      const data = await rpc<any>('list_rewards', { p_token: token });
      setRewardsList(Array.isArray(data) ? data : (data?.items || data?.rewards || []));
    } catch (err) { showError(err); } finally { setLoading(false); }
  };

  const fetchRanking = async () => {
    setLoading(true);
    try {
      const data = await rpc<any>('list_ranking', { p_token: token });
      const nextRanking = Array.isArray(data) ? data : (data?.items || data?.ranking || []);
      setRankingList(nextRanking);
      localStorage.setItem('sb_ranking_cache', JSON.stringify(nextRanking));
    } catch (err) { showError(err); } finally { setLoading(false); }
  };

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const data = await rpc<any>('list_notifications', { p_token: token });
      setNotifications(Array.isArray(data) ? data : (data?.items || data?.rows || []));
    } catch (err) { showError(err); } finally { setLoading(false); }
  };

  const fetchLogs = async () => {
    try {
      const data = await rpc<any>('list_my_overall_logs', { p_token: token });
      setLogsList(Array.isArray(data) ? data : (data?.items || data?.logs || []));
    } catch { /* silent for home tab */ }
  };

  const fetchCalendarEvents = async () => {
    try {
      const data = await rpc<any>('list_calendar_events', { p_token: token });
      setCalendarEvents(Array.isArray(data) ? data : []);
    } catch { /* silent */ }
  };

  const fetchRules = async () => {
    setLoading(true);
    try {
      const data = await rpc<any>('list_rule_board', { p_token: token });
      setRulesList(Array.isArray(data) ? data : (data?.items || data?.rows || []));
    } catch (err) { showError(err); } finally { setLoading(false); }
  };

  const fetchWelcomeConfig = async () => {
    try {
      const data = await rpc<any>('get_app_welcome', { p_token: token });
      if (data) setWelcomeConfig({
        title: data.title || 'SB CONNECT',
        message: data.message || '',
        video_url: data.video_url || '',
        is_active: data.is_active !== false,
      });
    } catch {
      /* keep default welcome */
    }
  };

  // ── Action handlers ──────────────────────────────────────────────────
  const handleCheckin = async () => {
    setCheckinLoading(true);
    try {
      const res = await rpc<any>('daily_checkin', { p_token: token });
      showSuccess(res.message || 'เช็คอินเสร็จสมบูรณ์!');
      fetchDashboard(); fetchLogs();
    } catch (err) { showError(err); } finally { setCheckinLoading(false); }
  };

  const handleReadNews = async (newsId: string) => {
    try {
      const res = await rpc<any>('read_news', { p_token: token, p_news_id: newsId });
      showSuccess(res.message || 'บันทึกการอ่านสำเร็จ!');
      fetchNews();
    } catch (err) { showError(err); }
  };

  const handleSubmitMission = async (missionId: string) => {
    try {
      const res = await rpc<any>('submit_mission', { p_token: token, p_mission_id: missionId });
      showSuccess(res.message || 'ส่งภารกิจเสร็จสิ้น!');
      fetchMissions();
    } catch (err) { showError(err); }
  };

  const handleRedeemReward = async (rewardId: string, name: string, cost: number) => {
    const swal = (window as any).Swal;
    if (swal) {
      const r = await swal.fire({
        title: t('redeem'), text: `แลก "${name}" ใช้ ${cost.toLocaleString()} แต้ม?`,
        icon: 'question', showCancelButton: true,
        confirmButtonColor: thm.primary, cancelButtonColor: '#64748b',
        confirmButtonText: lang === 'th' ? 'ยืนยัน' : 'Confirm',
        cancelButtonText: lang === 'th' ? 'ยกเลิก' : 'Cancel',
        background: darkMode ? '#0f172a' : '#fff', color: darkMode ? '#fff' : '#0f172a',
      });
      if (!r.isConfirmed) return;
    } else {
      if (!confirm(`แลก "${name}" ใช้ ${cost} แต้ม?`)) return;
    }
    try {
      const res = await rpc<any>('redeem_reward', { p_token: token, p_reward_id: rewardId });
      showSuccess(res.message || 'แลกรางวัลสำเร็จ!');
      fetchRewards(); fetchDashboard();
    } catch (err) { showError(err); }
  };

  const handleMarkNotificationRead = async (notiId: string) => {
    try { await rpc('mark_notification_read', { p_token: token, p_notification_id: notiId }); fetchNotifications(); } catch (err) { showError(err); }
  };

  const handleMarkAllRead = async () => {
    for (const n of notifications.filter(n => !n.is_read)) {
      try { await rpc('mark_notification_read', { p_token: token, p_notification_id: n.id }); } catch { /* skip */ }
    }
    fetchNotifications();
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const b64 = ev.target?.result as string;
      setAvatarUrl(b64);
      localStorage.setItem('sb_avatar_' + (profile.emp_id || ''), b64);
      showSuccess(lang === 'th' ? 'เปลี่ยนรูปโปรไฟล์สำเร็จ!' : 'Profile photo updated!');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleDownloadCard = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 900;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Custom card background with rounded corners
    const cardGrad = ctx.createLinearGradient(0, 0, 600, 900);
    cardGrad.addColorStop(0, cardTheme.card1);
    cardGrad.addColorStop(1, cardTheme.card2);
    ctx.fillStyle = cardGrad;
    ctx.beginPath();
    ctx.roundRect(0, 0, 600, 900, 48);
    ctx.fill();

    // 2. Draw outer boundary border
    ctx.strokeStyle = cardTheme.accent2;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(3, 3, 594, 894, 48);
    ctx.stroke();

    // 3. Diagonal watermark in soft gold/white, matching the on-screen card
    ctx.save();
    ctx.translate(300, 450);
    ctx.rotate(-26 * Math.PI / 180);
    ctx.textAlign = 'center';
    ctx.font = '900 48px sans-serif';
    const watermarkGrad = ctx.createLinearGradient(-250, 0, 250, 0);
    watermarkGrad.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
    watermarkGrad.addColorStop(0.48, 'rgba(246, 211, 101, 0.18)');
    watermarkGrad.addColorStop(1, 'rgba(255, 244, 176, 0.2)');
    ctx.fillStyle = watermarkGrad;
    ctx.fillText('SB CONNECT ✦ SB CONNECT', 0, -40);
    ctx.fillText('SB CONNECT ✦ SB CONNECT', 0, 40);
    ctx.restore();

    // 4. Custom top banner matching front card design
    const atollGrad = ctx.createLinearGradient(0, 0, 600, 140);
    atollGrad.addColorStop(0, cardTheme.card1);
    atollGrad.addColorStop(1, cardTheme.card2);
    ctx.fillStyle = atollGrad;
    ctx.beginPath();
    ctx.roundRect(0, 0, 600, 140, [48, 48, 0, 0]);
    ctx.fill();

    // White Logo Mark
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(40, 50);
    ctx.lineTo(55, 80);
    ctx.lineTo(70, 50);
    ctx.lineTo(85, 85);
    ctx.lineTo(100, 50);
    ctx.lineTo(85, 100);
    ctx.lineTo(70, 70);
    ctx.lineTo(55, 100);
    ctx.closePath();
    ctx.fill();

    // Brand Name Text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('SB CONNECT', 120, 85);

    // Top Right Gold accent curve cut
    const goldGrad = ctx.createLinearGradient(430, 0, 600, 140);
    goldGrad.addColorStop(0, cardTheme.accent1);
    goldGrad.addColorStop(1, cardTheme.accent2);
    ctx.fillStyle = goldGrad;
    ctx.beginPath();
    ctx.moveTo(430, 0);
    ctx.lineTo(600, 0);
    ctx.lineTo(600, 140);
    ctx.lineTo(490, 140);
    ctx.closePath();
    ctx.fill();

    // 5. Name and Department
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(profile.full_name || 'ผู้ใช้ระบบ', 300, 545);

    ctx.fillStyle = goldGrad;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(profile.role === 'admin' ? 'ผู้จัดการ / Admin' : 'เจ้าหน้าที่ / Staff', 300, 600);

    // 6. QR Code Section (mock pixels)
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.strokeStyle = cardTheme.accent2;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(60, 680, 120, 120, 16);
    ctx.fill();
    ctx.stroke();

    // Mock QR finder squares
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(75, 695, 30, 30);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(83, 703, 14, 14);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(87, 707, 6, 6);

    ctx.fillRect(135, 695, 30, 30);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(143, 703, 14, 14);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(147, 707, 6, 6);

    ctx.fillRect(75, 755, 30, 30);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(83, 763, 14, 14);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(87, 767, 6, 6);

    // Random QR bits representation
    for (let rx = 0; rx < 8; rx++) {
      for (let ry = 0; ry < 8; ry++) {
        if (Math.random() > 0.45) {
          ctx.fillRect(115 + rx * 6, 730 + ry * 6, 6, 6);
        }
      }
    }

    // Expiry and Employee details
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('รหัสพนักงาน : ' + (profile.emp_id || ''), 210, 725);
    ctx.fillStyle = goldGrad;
    ctx.fillText('VALID THRU : 12/2028', 210, 770);

    // 7. Bottom Gold-Blue Wave Accents
    ctx.fillStyle = atollGrad;
    ctx.beginPath();
    ctx.roundRect(0, 840, 600, 60, [0, 0, 48, 48]);
    ctx.fill();

    ctx.fillStyle = goldGrad;
    ctx.beginPath();
    ctx.moveTo(0, 840);
    ctx.lineTo(130, 840);
    ctx.lineTo(80, 900);
    ctx.lineTo(0, 900);
    ctx.closePath();
    ctx.fill();

    // 8. Image Avatar loading & framing
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(180, 180, 240, 280, 24);
      ctx.clip();
      ctx.drawImage(img, 180, 180, 240, 280);
      ctx.restore();

      // Shadow overlay edge border on image
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(180, 180, 240, 280, 24);
      ctx.stroke();

      triggerDownload();
    };

    img.onerror = () => {
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.roundRect(180, 180, 240, 280, 24);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 80px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SB', 300, 345);
      triggerDownload();
    };

    img.src = displayAvatar;

    function triggerDownload() {
      const link = document.createElement('a');
      link.download = `SB_ID_Card_${profile.emp_id || 'employee'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    }
  };

  const handleWelcomeClose = () => {
    if (welcomeSkip) localStorage.setItem('sb_welcome_dismissed', localDateKey());
    setShowWelcome(false);
  };

  // ── Lightbox helpers ─────────────────────────────────────────────────
  const openLightbox = (item: any, list: any[]) => {
    const idx = list.findIndex(i => i.id === item.id);
    setLightboxItem(item); setLightboxList(list); setLightboxIdx(idx >= 0 ? idx : 0);
  };
  const lbPrev = () => {
    const idx = (lightboxIdx - 1 + lightboxList.length) % lightboxList.length;
    setLightboxIdx(idx); setLightboxItem(lightboxList[idx]);
  };
  const lbNext = () => {
    const idx = (lightboxIdx + 1) % lightboxList.length;
    setLightboxIdx(idx); setLightboxItem(lightboxList[idx]);
  };

  // ── Alert helpers ─────────────────────────────────────────────────────
  const showError = (error: any) => {
    const msg = error instanceof Error ? error.message : String(error || 'เกิดข้อผิดพลาด');
    const swal = (window as any).Swal;
    if (swal) swal.fire({ icon: 'error', title: 'ล้มเหลว', text: msg, background: darkMode ? '#0f172a' : '#fff', color: darkMode ? '#fff' : '#0f172a' });
    else alert(msg);
  };
  const showSuccess = (msg: string) => {
    const swal = (window as any).Swal;
    if (swal) swal.fire({ icon: 'success', title: lang === 'th' ? 'สำเร็จ' : 'Success', text: msg, timer: 2200, showConfirmButton: false, background: darkMode ? '#0f172a' : '#fff', color: darkMode ? '#fff' : '#0f172a' });
    else alert(msg);
  };
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return dateStr; }
  };

  // ── Calendar helpers ──────────────────────────────────────────────────
  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDayMon = (y: number, m: number) => { const d = new Date(y, m, 1).getDay(); return d === 0 ? 6 : d - 1; };

  const checkinDates = new Set<string>(
    logsList.filter(l => l.source_type === 'CHECKIN').map(l => l.checkin_date || l.created_at?.slice(0, 10)).filter(Boolean)
  );
  if (dashboardData?.checked_in_today) checkinDates.add(localDateKey());

  const eventMap: Record<string, any> = {};
  calendarEvents.forEach(ev => { if (ev.date) eventMap[ev.date] = ev; });

  // ── Filtered lists ────────────────────────────────────────────────────
  const filteredNews = newsList.filter(item =>
    item.topic?.toLowerCase().includes(searchQuery.toLowerCase()) || item.detail?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredMissions = missionsList
    .filter(item => { if (filterType === 'done') return item.is_done || item.done; if (filterType === 'active') return !(item.is_done || item.done); return true; })
    .filter(item => item.title?.toLowerCase().includes(searchQuery.toLowerCase()) || item.description?.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredRewards = rewardsList.filter(item =>
    item.name?.toLowerCase().includes(searchQuery.toLowerCase()) || item.detail?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredRankingList = rankingList
    .filter(item => {
      const haystack = `${item.emp_id || ''} ${item.full_name || item.name || ''} ${item.department || item.dept || item.dept_th || ''} ${item.role || ''}`.toLowerCase();
      return haystack.includes(searchQuery.toLowerCase());
    });
  const filteredRules = rulesList
    .filter(item => (item.category || 'policy') === rulesCategory)
    .filter(item => {
      const haystack = `${item.title || ''} ${item.summary || ''} ${item.body_html || item.body || ''}`.toLowerCase();
      return haystack.includes(searchQuery.toLowerCase());
    });
  const unreadNotiCount = notifications.filter(n => !n.is_read).length;
  const remainingPoints = Number(dashboardData?.points ?? user?.points ?? 0);

  // ── Computed styles ───────────────────────────────────────────────────
  const appBg = darkMode ? '#0f172a' : thm.bg;
  const textColor = darkMode ? '#f1f5f9' : '#1e293b';
  const sidebarStyle: React.CSSProperties = darkMode
    ? { background: 'rgba(15,23,42,0.97)', borderRight: '1px solid rgba(255,255,255,0.06)' }
    : { background: 'rgba(255,255,255,0.93)', borderRight: `1px solid ${thm.border}50` };
  const headerStyle: React.CSSProperties = {
    background: topBarGradient,
    borderBottom: '1px solid rgba(255,255,255,0.10)',
    boxShadow: '0 10px 24px rgba(15,23,42,0.10)',
  };
  const cardStyle: React.CSSProperties = darkMode
    ? { background: '#1e293b', border: `1px solid rgba(255,255,255,0.07)` }
    : { background: '#fff', border: `1px solid ${thm.cardBorder}60` };

  // ── Avatar ─────────────────────────────────────────────────────────────
  const displayAvatar = avatarUrl || user?.avatar_url || 'https://lh3.googleusercontent.com/d/1EQVEVtVojuH0XOfBIggn4eU5nr5GYruL';
  const fallbackAvatar = 'https://api.dicebear.com/7.x/adventurer/svg?seed=' + (profile.emp_id || 'avatar');
  const rankingAvatar = (item: any) => {
    if (item.emp_id === profile.emp_id) return displayAvatar;
    return item.avatar_url || item.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(item.emp_id || item.full_name || 'rank')}`;
  };

  // ── Nav items ─────────────────────────────────────────────────────────
  const navIcon = (src: string) => (
    <img src={src} alt="" aria-hidden="true" className="w-7 h-7 object-contain drop-shadow-sm" />
  );
  const navItems = [
    { id: 'home',          icon: navIcon(NAV_LOGO_HOME),     label: t('home'), color: '#0ea5e9' },
    { id: 'news',          icon: navIcon(NAV_LOGO_NEWS),     label: t('news'), color: '#f97316' },
    { id: 'mission',       icon: navIcon(NAV_LOGO_TASK),     label: t('tasks'), color: '#8b5cf6' },
    { id: 'rewards',       icon: navIcon(NAV_LOGO_REWARDS),  label: t('shop'), color: '#f59e0b' },
    { id: 'ranking',       icon: navIcon(NAV_LOGO_RANKING),  label: t('rank'), color: '#ef4444' },
  ];
  const pageTitle: Record<string, string> = {
    home: t('home'), news: t('news'), mission: t('tasks'), rewards: t('shop'),
    ranking: t('rank'), tools: t('tools'), rules: t('rules'), logs: t('history'), notifications: t('notifications'), settings: t('settings'),
  };

  // ═════════════════════════════════════════════════════════════════════════
  //  RENDER
  // ═════════════════════════════════════════════════════════════════════════
  return (
    <div
      className="min-h-screen flex flex-col font-sans relative overflow-x-hidden"
      style={{ backgroundColor: appBg, color: textColor, fontFamily: "'Prompt','Sarabun',sans-serif" }}
    >
      <div className="pointer-events-none fixed inset-0 z-0 sb-backdrop-pattern opacity-70 hidden sm:block" />

      {/* ══════════════════════════════════════════════════════════════════
          WELCOME MODAL
      ══════════════════════════════════════════════════════════════════ */}
      {showWelcome && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ backdropFilter: 'blur(14px)', background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-md rounded-3xl shadow-2xl relative overflow-hidden animate-fade-in"
            style={cardStyle}>
            {/* Rainbow top strip */}
            <div className="h-1.5 w-full" style={{ background: 'linear-gradient(90deg,#ef4444,#f97316,#eab308,#22c55e,#06b6d4,#8b5cf6,#ec4899)' }} />
            <div className="p-6">
              <div className="text-center mb-5">
                <div className="text-5xl mb-2">🎉</div>
                <h2 className="text-xl font-black tracking-tight" style={{ color: thm.text }}>{t('welcome_title')}</h2>
                <p className="text-sm font-medium mt-1 opacity-60">{t('welcome_sub')}</p>
              </div>
              {dashboardData?.latest_news?.slice(0, 2).map((item: any, i: number) => (
                <div key={i} className="flex items-center gap-3 mb-2 p-3 rounded-2xl border"
                  style={{ background: thm.light, borderColor: thm.border + '50' }}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: thm.primary }}>
                    <Newspaper size={13} className="text-white" />
                  </div>
                  <span className="text-xs font-bold flex-1 truncate" style={{ color: textColor }}>{item.topic}</span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full text-white shrink-0" style={{ background: thm.primary }}>+{item.points}</span>
                </div>
              ))}
              <label className="flex items-center gap-2.5 mt-4 cursor-pointer select-none" onClick={() => setWelcomeSkip(s => !s)}>
                <div className="w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all"
                  style={{ background: welcomeSkip ? thm.primary : 'transparent', borderColor: welcomeSkip ? thm.primary : '#cbd5e1' }}>
                  {welcomeSkip && <Check size={12} className="text-white" />}
                </div>
                <span className="text-xs font-bold opacity-60">{t('welcome_skip')}</span>
              </label>
              <button onClick={handleWelcomeClose}
                className="w-full mt-4 py-3 rounded-2xl font-black text-sm text-white transition active:scale-95"
                style={{ background: `linear-gradient(135deg, ${thm.primary}, ${thm.primary}cc)` }}>
                {t('welcome_start')} →
              </button>
            </div>
            <button onClick={() => setShowWelcome(false)}
              className="absolute top-4 right-4 opacity-40 hover:opacity-80 transition p-1 rounded-full">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── CARD PREVIEW & DOWNLOAD MODAL ── */}
      {cardPreviewOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 overflow-y-auto"
          style={{ backdropFilter: 'blur(16px)', background: 'rgba(0,0,0,0.65)' }}
          onClick={() => setCardPreviewOpen(false)}>
          <div className="w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden relative animate-fade-in flex flex-col my-8"
            style={cardStyle}
            onClick={e => e.stopPropagation()}>
            <div className="h-1.5 w-full shrink-0 animate-pulse" style={{ background: thm.primary }} />
            
            <div className="p-6 flex-1 flex flex-col items-center">
              <h3 className="text-center font-black text-lg mb-1" style={{ color: thm.text }}>
                ตัวอย่างบัตรพนักงาน / ID Card Preview
              </h3>
              <p className="text-center text-xs opacity-50 font-bold mb-6">คลิกดาวน์โหลดเพื่อรับรูปภาพบัตรพนักงานความละเอียดสูง (.png)</p>

              {/* Side-by-Side Front and Back Cards */}
              <div className="flex flex-col md:flex-row gap-6 justify-center items-center w-full">
                {/* Front Side */}
                  <div className="w-[250px] h-[388px] rounded-[20px] overflow-hidden flex flex-col justify-between relative border shadow-lg shrink-0"
                    style={{ background: cardGradient }}>
                  {/* Watermark */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-0">
                    <div className="font-black text-[18px] uppercase tracking-[0.2em] opacity-10 rotate-[-26deg] select-none text-white">
                      SB CONNECT
                    </div>
                  </div>
                  {/* Header */}
                  <div className="absolute top-0 inset-x-0 h-12 flex items-center px-3 justify-between z-10"
                    style={{ background: 'linear-gradient(135deg, rgba(3,47,58,.96), rgba(7,94,105,.92))' }}>
                    <div className="flex items-center gap-1 min-w-0">
                      <img src={COMPANY_LOGO_URL} alt="SB Connect" className="h-7 max-w-[110px] object-contain object-left" />
                    </div>
                    <div className="absolute top-0 right-0 w-20 h-12" style={{ background: accentGradient, clipPath: 'polygon(35% 0%, 100% 0%, 100% 100%, 0% 100%)' }} />
                  </div>
                  {/* Avatar */}
                  <div className="absolute top-[65px] left-1/2 -translate-x-1/2 w-24 h-28 border-[3px] border-white rounded-[14px] overflow-hidden shadow-md bg-slate-50 z-10">
                    <img src={displayAvatar} alt="Avatar" className="w-full h-full object-cover" onError={(e) => { (e.target as any).src = fallbackAvatar; }} />
                  </div>
                  {/* Name */}
                  <div className="absolute top-[195px] inset-x-3 text-center z-10">
                    <h3 className="text-sm font-black text-white truncate sb-nav-label">{profile.full_name}</h3>
                    <p className="text-[9px] font-black tracking-widest mt-0.5 uppercase" style={{ color: '#fde68a' }}>
                      {profile.role === 'admin' ? 'ผู้จัดการ / Admin' : 'เจ้าหน้าที่ / Staff'}
                    </p>
                  </div>
                  {/* QR details */}
                  <div className="absolute bottom-9 inset-x-4 flex items-center justify-between gap-2 border-t border-white/20 pt-2 z-10 text-[9px] font-bold text-white/80">
                    <div className="w-9 h-9 bg-slate-100 border p-0.5 flex flex-wrap rounded shrink-0">
                      <div className="w-full h-full bg-slate-800" style={{ clipPath: 'polygon(0 0, 70% 0, 70% 70%, 0 70%)' }} />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="truncate">รหัสพนักงาน: <span className="font-extrabold text-white">{profile.emp_id}</span></p>
                      <p className="text-[8px] mt-0.5" style={{ color: '#fde68a' }}>VALID THRU: 12/2028</p>
                    </div>
                  </div>
                  {/* Bottom footer wave */}
                  <div className="absolute bottom-0 inset-x-0 h-6 z-10" style={{ background: 'linear-gradient(135deg, #032f3a, #075e69)' }}>
                    <div className="absolute bottom-0 left-0 w-12 h-6" style={{ background: accentGradient, clipPath: 'polygon(0% 0%, 75% 0%, 100% 100%, 0% 100%)' }} />
                  </div>
                </div>

                {/* Back Side */}
                <div className="w-[250px] h-[388px] rounded-[20px] overflow-hidden flex flex-col justify-between p-4 border shadow-lg bg-white shrink-0">
                  <div className="z-10">
                    <h4 className="text-center font-black text-slate-800 text-[10px] mt-2 tracking-wider">เงื่อนไขการใช้บัตร / Terms of Use</h4>
                    <div className="h-0.5 my-2 bg-gradient-to-r from-transparent via-[#d4af37] to-transparent opacity-60" />
                    
                    <ol className="space-y-1 text-[8px] font-bold text-slate-500 list-decimal pl-4 pr-1 leading-relaxed">
                      <li>ติดบัตรตลอดเวลาในขณะปฏิบัติหน้าที่</li>
                      <li>บัตรนี้เป็นทรัพย์สินของ บริษัท เอสบี อินเตอร์แล็บ จำกัด</li>
                      <li>ใช้เฉพาะผู้ที่มีชื่อในบัตรเท่านั้นและต้องส่งคืนทันทีเมื่อพ้นสภาพจากการเป็นพนักงาน</li>
                      <li>กรณีบัตรสูญหายหรือชำรุด กรุณาแจ้งฝ่ายบุคคล (HR)</li>
                    </ol>
                  </div>
                  <div className="flex justify-between border-t border-slate-100 pt-2 mb-0.5 text-[7px] font-black text-slate-400">
                    <div className="text-left">
                      <span>วันออกบัตร (Issue)</span>
                      <strong className="text-slate-600 block">04/2022</strong>
                    </div>
                    <div className="text-right">
                      <span>วันหมดอายุ (Expiry)</span>
                      <strong className="text-slate-600 block">12/2028</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-8 flex gap-3 w-full max-w-sm">
                <button onClick={() => setCardPreviewOpen(false)}
                  className="flex-1 py-3 rounded-2xl text-xs font-black bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition">
                  ปิดหน้าต่าง / Close
                </button>
                <button onClick={handleDownloadCard}
                  className="flex-1 py-3 rounded-2xl text-xs font-black text-white transition active:scale-95"
                  style={{ background: thm.primary }}>
                  💾 ดาวน์โหลดบัตรพนักงาน
                </button>
              </div>
            </div>
            
            <button onClick={() => setCardPreviewOpen(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center bg-black/5 hover:bg-black/10 transition">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          LIGHTBOX MODAL
      ══════════════════════════════════════════════════════════════════ */}
      {lightboxItem && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4"
          style={{ backdropFilter: 'blur(18px)', background: 'rgba(0,0,0,0.78)' }}
          onClick={() => setLightboxItem(null)}>
          <div className="w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden relative animate-fade-in max-h-[90vh] flex flex-col"
            style={cardStyle}
            onClick={e => e.stopPropagation()}>
            <div className="h-1 shrink-0" style={{ background: `linear-gradient(90deg,${thm.primary},${thm.primary}88)` }} />
            {(lightboxItem.cover_url || lightboxItem.image_url) && (
              <div className="h-52 w-full overflow-hidden shrink-0">
                <img src={lightboxItem.cover_url || lightboxItem.image_url} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="p-6 flex-1 overflow-y-auto">
              <div className="flex justify-between items-start gap-3 mb-3">
                <h2 className="text-lg font-black leading-snug flex-1">{lightboxItem.topic || lightboxItem.title}</h2>
                <span className="shrink-0 px-3 py-1 rounded-full text-xs font-black text-white" style={{ background: thm.primary }}>+{lightboxItem.points} PTS</span>
              </div>
              <p className="text-sm leading-relaxed opacity-75 whitespace-pre-line">{lightboxItem.detail || lightboxItem.description}</p>
              <div className="mt-4 text-xs font-bold opacity-40">{formatDate(lightboxItem.created_at || lightboxItem.publish_date)}</div>
            </div>
            <div className="p-4 border-t flex justify-between items-center gap-3 shrink-0"
              style={{ borderColor: darkMode ? 'rgba(255,255,255,0.08)' : thm.border + '30' }}>
              <button onClick={lbPrev} className="p-2 rounded-xl border transition hover:opacity-70"
                style={{ borderColor: thm.border + '60' }}><ChevronLeft size={16} /></button>
              <span className="text-xs font-bold opacity-40">{lightboxIdx + 1} / {lightboxList.length}</span>
              {lightboxItem.is_read ? (
                <span className="px-4 py-2 rounded-xl text-xs font-black opacity-50 border"
                  style={{ borderColor: thm.border, color: thm.subtext }}>{t('read_done')}</span>
              ) : (
                <button onClick={() => { handleReadNews(lightboxItem.id); setLightboxItem(null); }}
                  className="px-4 py-2 rounded-xl text-xs font-black text-white transition active:scale-95"
                  style={{ background: thm.primary }}>{t('read_btn')}</button>
              )}
              <button onClick={lbNext} className="p-2 rounded-xl border transition hover:opacity-70"
                style={{ borderColor: thm.border + '60' }}><ChevronRight size={16} /></button>
            </div>
            <button onClick={() => setLightboxItem(null)}
              className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center bg-black/30 hover:bg-black/50 transition">
              <X size={14} className="text-white" />
            </button>
          </div>
        </div>
      )}

      <AppLoader
        visible={loading || checkinLoading}
        color={thm.primary}
        darkMode={darkMode}
        label={checkinLoading ? (lang === 'th' ? 'กำลังบันทึกเช็คอิน' : 'Saving check-in') : (lang === 'th' ? 'กำลังโหลดข้อมูล' : 'Loading data')}
      />

      {toolsModalOpen && (
        <div className="fixed inset-0 z-[115] flex items-center justify-center p-4"
          style={{ backdropFilter: 'blur(14px)', background: 'rgba(15,23,42,0.58)' }}
          onClick={() => setToolsModalOpen(false)}>
          <div className="w-full max-w-2xl rounded-3xl shadow-2xl border overflow-hidden animate-scale-in"
            style={cardStyle}
            onClick={e => e.stopPropagation()}>
            <div className="h-1.5 w-full" style={{ background: thm.primary }} />
            <div className="p-5">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-base font-black flex items-center gap-2" style={{ color: thm.text }}>
                    <Wrench size={18} /> {t('tools')}
                  </h3>
                  <p className="text-xs opacity-55 font-bold mt-1">
                    {lang === 'th' ? 'เลือกบริการที่ต้องการใช้งาน' : 'Choose a service to continue.'}
                  </p>
                </div>
                <button onClick={() => setToolsModalOpen(false)} className="p-2 rounded-xl border opacity-60 hover:opacity-100"
                  style={{ borderColor: thm.border + '50' }}>
                  <X size={16} />
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { title: t('tools'), icon: Wrench, note: lang === 'th' ? 'ศูนย์รวมบริการ' : 'Service hub', tab: 'tools' as TabType },
                  { title: t('rules'), icon: BookOpen, note: lang === 'th' ? 'กฎและคู่มือ' : 'Rules and guides', tab: 'rules' as TabType },
                  { title: t('history'), icon: History, note: lang === 'th' ? 'ประวัติกิจกรรม' : 'Activity history', tab: 'logs' as TabType },
                  { title: t('settings'), icon: Settings, note: lang === 'th' ? 'ตั้งค่าแอป' : 'App settings', tab: 'settings' as TabType },
                  { title: t('quotation'), icon: FileText, note: lang === 'th' ? 'เปิดใบเสนอราคา' : 'Create quotation' },
                  { title: t('it_request'), icon: ClipboardList, note: lang === 'th' ? 'แจ้งคำร้อง IT' : 'Open IT ticket' },
                ].map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <button key={idx}
                      onClick={() => {
                        if ('tab' in item && item.tab) {
                          setActiveTab(item.tab);
                          setToolsModalOpen(false);
                          return;
                        }
                        showSuccess(lang === 'th' ? `เปิดเมนู ${item.title}` : `Open ${item.title}`);
                      }}
                      className="rounded-2xl p-4 text-left border sb-hover-lift"
                      style={{ background: darkMode ? 'rgba(255,255,255,0.04)' : thm.light, borderColor: thm.border + '55' }}>
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-3" style={{ background: thm.primary, color: '#fff' }}>
                        <Icon size={18} />
                      </div>
                      <h4 className="text-sm font-black" style={{ color: textColor }}>{item.title}</h4>
                      <p className="text-[10px] opacity-50 font-bold mt-1">{item.note}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarUpload} />

      {/* ════════════════════════════════════════════════════════════════
          LAYOUT
      ════════════════════════════════════════════════════════════════ */}
      <div className="w-full flex flex-1 relative min-h-screen z-10">

        {/* ── LEFT SIDEBAR (≥ lg) ──────────────────────────────────────── */}
        <aside className="w-64 hidden lg:flex flex-col shrink-0 sticky top-0 h-screen overflow-y-auto" style={sidebarStyle}>

          {/* Logo */}
          <div className="px-5 py-4 flex items-center gap-3 border-b" style={{ borderColor: thm.border + '40' }}>
            <div className="min-w-0">
              <img
                src={COMPANY_LOGO_URL}
                alt="SB Connect"
                className="h-8 max-w-[150px] object-contain"
                style={{ background: 'transparent', filter: 'drop-shadow(0 1px 1px rgba(255,255,255,0.16))' }}
              />
              <span className="text-[9px] font-extrabold uppercase tracking-[0.22em] opacity-55" style={{ color: thm.subtext }}>{t('app_sub')}</span>
            </div>
          </div>

          {/* User profile card */}
          <div className="mx-3 my-3 p-3 rounded-2xl border flex items-center gap-3"
            style={{ background: thm.light, borderColor: thm.border + '60' }}>
            <div className="relative shrink-0 cursor-pointer group" onClick={() => setActiveTab('settings')}>
              <div className="w-10 h-10 rounded-full p-[2px]" style={{ background: `linear-gradient(135deg,${thm.primary},${thm.primary}70)` }}>
                <img src={displayAvatar} className="w-full h-full rounded-full object-cover" onError={(e) => { (e.target as any).src = fallbackAvatar; }} />
              </div>
              <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                <Settings size={12} className="text-white" />
              </div>
            </div>
            <div className="truncate flex-1 min-w-0">
              <h4 className="text-xs font-black truncate" style={{ color: textColor }}>{profile.full_name || '-'}</h4>
              <span className="text-[9px] font-extrabold uppercase opacity-60" style={{ color: thm.subtext }}>{profile.emp_id} • {profile.department || '-'}</span>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
            {navItems.map(item => (
              <button key={item.id} onClick={() => {
                setActiveTab(item.id as TabType);
                if (item.id === 'tools') setToolsModalOpen(true);
              }}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-xs font-black transition-all text-left relative"
                style={activeTab === item.id
                  ? { background: `${navGradient}, ${transparentize(item.color, 0.18)}`, color: '#f8fafc', boxShadow: `inset 3px 0 0 ${item.color}, inset 0 0 0 1px rgba(255,255,255,0.08)` }
                  : { background: 'linear-gradient(135deg, rgba(15,23,42,0.045), rgba(51,65,85,0.08))', color: darkMode ? '#cbd5e1' : '#475569' }}>
                <span className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: transparentize(item.color, activeTab === item.id ? 0.18 : 0.1), color: item.color }}>
                  {item.icon}
                </span>
                <span className="truncate sb-nav-label">{item.label}</span>
                {item.id === 'notifications' && unreadNotiCount > 0 && (
                  <span className="ml-auto text-[9px] font-black text-white px-1.5 py-0.5 rounded-full" style={{ background: item.color }}>{unreadNotiCount}</span>
                )}
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

        {/* ── CONTENT AREA ─────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 min-h-screen pb-16 lg:pb-0">

          {/* ── STICKY HEADER ─────────────────────────────────────────── */}
          <header className="sticky top-0 z-40 h-14 px-4 flex items-center justify-between gap-3" style={headerStyle}>

            {/* Zone A: Brand + Page */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative w-8 h-8 rounded-full p-[2px] shrink-0 cursor-pointer group lg:hidden"
                style={{ background: `linear-gradient(135deg,${thm.primary},${thm.primary}80)` }}
                onClick={() => setActiveTab('settings')}>
                <img src={displayAvatar} className="w-full h-full rounded-full object-cover" onError={(e) => { (e.target as any).src = fallbackAvatar; }} />
                <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                  <Settings size={10} className="text-white" />
                </div>
              </div>
              <button
                type="button"
                onClick={() => setToolsModalOpen(true)}
                className="flex items-center justify-center w-8 h-8 rounded-2xl border transition active:scale-95"
                style={{ background: darkMode ? 'rgba(255,255,255,0.08)' : thm.light, borderColor: thm.border + '70', color: thm.subtext }}
                aria-label="Services">
                <Wrench size={15} />
              </button>
              <div className="truncate min-w-0">
                <img
                  src={COMPANY_LOGO_URL}
                  alt="SB Connect"
                  className="h-5 max-w-[118px] object-contain object-left"
                  style={{
                    background: 'transparent',
                    filter: 'drop-shadow(0 1px 1px rgba(255,255,255,0.18))',
                  }}
                />
                <h2 className="text-sm font-black truncate leading-tight" style={{ color: '#f8fafc' }}>{pageTitle[activeTab] || profile.full_name || '-'}</h2>
              </div>
            </div>

            {/* Zone B: Tools */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Desktop search */}
              <div className="hidden lg:flex items-center relative">
                <Search size={13} className="absolute left-3 opacity-35" />
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  placeholder={t('search')}
                  className="pl-8 pr-3 py-1.5 rounded-full text-xs font-medium border w-40 outline-none"
                  style={{ background: darkMode ? 'rgba(255,255,255,0.06)' : thm.light, borderColor: thm.border + '60', color: textColor }} />
              </div>

              {/* TH/EN Toggle */}
              <button onClick={() => setLang(l => l === 'th' ? 'en' : 'th')}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-black border transition-all"
                style={{ background: darkMode ? 'rgba(255,255,255,0.06)' : thm.light, borderColor: thm.border + '60', color: thm.subtext }}>
                <Globe size={11} /> {lang.toUpperCase()}
              </button>

              {/* Bell + Notification Panel */}
              <div className="relative" ref={notifPanelRef}>
                <button onClick={() => { setNotifPanelOpen(p => !p); if (!notifPanelOpen) fetchNotifications(); }}
                  className="relative p-2 rounded-xl border transition active:scale-95"
                  style={{ background: darkMode ? 'rgba(255,255,255,0.06)' : thm.light, borderColor: thm.border + '60' }}>
                  <Bell size={16} style={{ color: textColor }} />
                  {unreadNotiCount > 0 && (
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full border-2 border-white flex items-center justify-center text-[7px] font-black text-white"
                      style={{ background: thm.primary, lineHeight: 1 }}>{unreadNotiCount > 9 ? '9+' : unreadNotiCount}</span>
                  )}
                </button>

                {/* ── NOTIFICATION PANEL DROPDOWN ── */}
                {notifPanelOpen && (
                  <div className="absolute right-0 top-[calc(100%+8px)] w-80 rounded-3xl shadow-2xl overflow-hidden z-50 border"
                    style={{ background: darkMode ? '#1e293b' : '#fff', borderColor: thm.border + '50', color: textColor }}>
                    {/* Panel Header */}
                    <div className="px-4 py-3 flex justify-between items-center border-b" style={{ borderColor: thm.border + '30' }}>
                      <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2" style={{ color: thm.text }}>
                        {t('notifications')}
                        {unreadNotiCount > 0 && <span className="px-1.5 py-0.5 rounded-full text-white text-[9px] font-black" style={{ background: thm.primary }}>{unreadNotiCount}</span>}
                      </h3>
                      {unreadNotiCount > 0 && (
                        <button onClick={handleMarkAllRead} className="text-[10px] font-bold hover:opacity-70 transition" style={{ color: thm.subtext }}>{t('mark_read')}</button>
                      )}
                    </div>
                    {/* Panel List */}
                    <div className="max-h-72 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="py-10 text-center text-xs opacity-40 font-bold">{t('no_notif')}</div>
                      ) : notifications.map((n, i) => (
                        <div key={i}
                          onClick={() => !n.is_read && handleMarkNotificationRead(n.id)}
                          className="flex items-start gap-3 px-4 py-3 border-b transition cursor-pointer hover:opacity-80"
                          style={{ borderColor: thm.border + '20', background: n.is_read ? 'transparent' : thm.light + '90' }}>
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                            style={{ background: n.is_read ? (darkMode ? '#334155' : '#f1f5f9') : thm.primary }}>
                            <Bell size={12} className={n.is_read ? 'opacity-30' : 'text-white'} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold truncate" style={{ color: n.is_read ? textColor : thm.text, opacity: n.is_read ? 0.55 : 1 }}>{n.title}</p>
                            {n.detail && <p className="text-[10px] opacity-45 mt-0.5 line-clamp-2">{n.detail}</p>}
                            <span className="text-[9px] opacity-35 mt-0.5 block">{formatDate(n.created_at)}</span>
                          </div>
                          {!n.is_read && <div className="w-2 h-2 rounded-full mt-2 shrink-0" style={{ background: thm.primary }} />}
                        </div>
                      ))}
                    </div>
                    <button onClick={() => { setNotifPanelOpen(false); setActiveTab('notifications'); }}
                      className="w-full py-3 text-[11px] font-black border-t transition hover:opacity-75"
                      style={{ borderColor: thm.border + '30', color: thm.subtext }}>
                      {t('notifications')} →
                    </button>
                  </div>
                )}
              </div>

              {/* Mobile logout */}
              <button onClick={logout}
                className="p-2 rounded-xl border transition active:scale-95 lg:hidden text-red-400"
                style={{ background: darkMode ? 'rgba(255,255,255,0.04)' : '#fff5f5', borderColor: '#fecaca' }}>
                <LogOut size={15} />
              </button>
            </div>
          </header>

          {/* ── SUBHEADER / BREADCRUMB ─────────────────────────────────── */}
          <div className="px-4 py-1.5 flex justify-between items-center border-b z-30 sticky top-14"
            style={{ borderColor: 'rgba(255,255,255,0.08)', background: navGradient }}>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-200/70">SB Connect</span>
              <ChevronRight size={10} className="opacity-30" />
              <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#f8fafc' }}>{pageTitle[activeTab]}</span>
            </div>
            <button onClick={() => {
              if (activeTab === 'home') { fetchDashboard(); fetchLogs(); }
              else if (activeTab === 'news') fetchNews();
              else if (activeTab === 'mission') fetchMissions();
              else if (activeTab === 'rewards') fetchRewards();
              else if (activeTab === 'ranking') fetchRanking();
              else if (activeTab === 'rules') fetchRules();
              else if (activeTab === 'notifications') fetchNotifications();
              else if (activeTab === 'logs') fetchLogs();
            }}
            disabled={loading}
            className="flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-full border transition active:scale-95 disabled:opacity-40"
            style={{ color: thm.subtext, borderColor: thm.border + '60', background: darkMode ? 'rgba(255,255,255,0.05)' : thm.light }}>
              <RefreshCw size={9} className={loading ? 'animate-spin' : ''} /> {t('refresh')}
            </button>
          </div>

          {/* ── MAIN CONTENT ─────────────────────────────────────────── */}
          <main className="flex-1 p-4 lg:p-6 z-10 w-full max-w-7xl mx-auto">

            {/* ─────────────────────────────────────────────────────── */}
            {/* TAB: HOME                                               */}
            {/* ─────────────────────────────────────────────────────── */}
            {activeTab === 'home' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

                  {/* LEFT 7-col */}
                  <div className="lg:col-span-7 space-y-5">

                    {/* 3D ID CARD (PORTRAIT DESIGN LIKE EXAMPLE) */}
                    <div className="flex flex-col items-center">
                      <section
                        className="relative w-[280px] h-[435px] cursor-pointer select-none"
                        style={{ perspective: '1200px' }}
                        onClick={() => setIsFlipped(f => !f)}
                      >
                        <div className="w-full h-full relative" style={{
                          transformStyle: 'preserve-3d',
                          transition: 'transform 750ms cubic-bezier(0.4, 0, 0.2, 1)',
                          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                        }}>
                          {/* ── CARD FRONT ── */}
                          <div className="absolute inset-0 w-full h-full rounded-[24px] overflow-hidden flex flex-col justify-between"
                            style={{
                              backfaceVisibility: 'hidden',
                              background: cardGradient,
                              border: '1px solid rgba(253,230,138,0.5)',
                              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.12), 0 5px 15px rgba(0, 0, 0, 0.06)',
                            }}>
                            {/* Gold/white watermark SB CONNECT */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-0">
                              <div
                                className="font-black text-[22px] uppercase whitespace-nowrap tracking-[0.25em] select-none"
                                style={{
                                  transform: 'rotate(-26deg)',
                                  opacity: 0.16,
                                  background: 'linear-gradient(90deg,rgba(255,255,255,.9),rgba(253,230,138,.9),rgba(255,255,255,.9))',
                                  WebkitBackgroundClip: 'text',
                                  WebkitTextFillColor: 'transparent',
                                  backgroundClip: 'text',
                                  backgroundSize: '200% 100%',
                                }}>
                                SB CONNECT ✦ SB CONNECT
                              </div>
                            </div>

                            {/* Top Banner Blue & Gold Corner */}
                            <div className="absolute top-0 inset-x-0 h-16 flex items-center px-4 justify-between z-10"
                              style={{ background: 'linear-gradient(135deg, rgba(3,47,58,.96), rgba(7,94,105,.92))' }}>
                              {/* Logo */}
                              <div className="flex items-center gap-1.5 min-w-0">
                                <img src={COMPANY_LOGO_URL} alt="SB Connect" className="h-9 max-w-[150px] object-contain object-left" />
                              </div>
                              {/* Gold Corner cut */}
                              <div className="absolute top-0 right-0 w-24 h-16"
                                style={{ background: accentGradient, clipPath: 'polygon(35% 0%, 100% 0%, 100% 100%, 0% 100%)' }} />
                            </div>

                            {/* Center Avatar Profile Frame */}
                            <div className="absolute top-[80px] left-1/2 -translate-x-1/2 w-32 h-36 border-[4px] border-white rounded-[18px] overflow-hidden shadow-md bg-slate-50 z-10">
                              <img src={displayAvatar} alt="Avatar" className="w-full h-full object-cover"
                                onError={(e) => { (e.target as any).src = fallbackAvatar; }} />
                              <div onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
                                className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center transition cursor-pointer">
                                <Camera size={18} className="text-white" />
                              </div>
                            </div>

                            {/* Name & Position */}
                            <div className="absolute top-[236px] inset-x-4 text-center z-10">
                              <h3 className="text-base font-black text-white tracking-wide sb-nav-label">{profile.full_name || 'ผู้ใช้ระบบ'}</h3>
                              <p className="text-[11px] font-black tracking-widest mt-1 uppercase" style={{ color: '#fde68a' }}>
                                {profile.role === 'admin' ? 'ผู้จัดการ / Admin' : 'เจ้าหน้าที่ / Staff'}
                              </p>
                            </div>

                            {/* Bottom Expiry & QR Section */}
                            <div className="absolute bottom-11 inset-x-5 flex items-center justify-between gap-3 border-t border-white/20 pt-2.5 z-10">
                              {/* QR Box */}
                              <div className="w-12 h-12 bg-white border border-slate-200 p-1 flex flex-wrap items-center justify-center shrink-0 rounded-lg">
                                {/* Vector QR shape */}
                                <div className="grid grid-cols-3 gap-0.5 w-full h-full">
                                  <div className="bg-slate-800" /><div className="bg-slate-800" /><div className="bg-transparent" />
                                  <div className="bg-slate-800" /><div className="bg-transparent" /><div className="bg-slate-800" />
                                  <div className="bg-transparent" /><div className="bg-slate-800" /><div className="bg-slate-800" />
                                </div>
                              </div>
                              {/* Details */}
                              <div className="flex-1 text-left min-w-0 font-bold text-white/85 text-[10px]">
                                <p className="truncate">รหัสพนักงาน: <span className="font-extrabold text-white">{profile.emp_id}</span></p>
                                <p className="mt-0.5" style={{ color: '#fde68a' }}>VALID THRU : 12/2028</p>
                              </div>
                            </div>

                            {/* Bottom Wave decoration */}
                            <div className="absolute bottom-0 inset-x-0 h-8 flex items-center px-4 justify-between z-10"
                              style={{ background: 'linear-gradient(135deg, #032f3a, #075e69)' }}>
                              <div className="absolute bottom-0 left-0 w-16 h-8"
                                style={{ background: accentGradient, clipPath: 'polygon(0% 0%, 75% 0%, 100% 100%, 0% 100%)' }} />
                            </div>
                          </div>

                          {/* ── CARD BACK ── */}
                          <div className="absolute inset-0 w-full h-full rounded-[24px] overflow-hidden flex flex-col justify-between p-5"
                            style={{
                              backfaceVisibility: 'hidden',
                              transform: 'rotateY(180deg)',
                              background: '#ffffff',
                              border: '1px solid #e2e8f0',
                              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.12), 0 5px 15px rgba(0, 0, 0, 0.06)',
                            }}>
                            <div className="z-10">
                              <h4 className="text-center font-black text-slate-800 text-xs mt-3 tracking-wider">เงื่อนไขการใช้บัตร / Terms of Use</h4>
                              <div className="h-0.5 my-2.5 bg-gradient-to-r from-transparent via-[#d4af37] to-transparent opacity-60" />
                              
                              <ol className="space-y-1.5 text-[9px] font-bold text-slate-600 list-decimal pl-4 pr-1 leading-normal">
                                <li>ติดบัตรตลอดเวลาในขณะปฏิบัติหน้าที่</li>
                                <li>บัตรนี้เป็นทรัพย์สินของ บริษัท เอสบี อินเตอร์แล็บ จำกัด</li>
                                <li>ใช้เฉพาะผู้ที่มีชื่อในบัตรเท่านั้นและต้องส่งคืนทันทีเมื่อพ้นสภาพจากการเป็นพนักงาน</li>
                                <li>กรณีบัตรสูญหายหรือชำรุด กรุณาแจ้งฝ่ายบุคคล (HR)</li>
                              </ol>
                            </div>

                            {/* Bottom dates block */}
                            <div className="flex justify-between border-t border-slate-100 pt-2.5 mb-1 text-[8px] font-black text-slate-500">
                              <div className="text-left">
                                <span className="block opacity-60">วันออกบัตร (Issue)</span>
                                <strong className="text-slate-800 mt-0.5 block">04/2022</strong>
                              </div>
                              <div className="text-right">
                                <span className="block opacity-60">วันหมดอายุ (Expiry)</span>
                                <strong className="text-slate-800 mt-0.5 block">12/2028</strong>
                              </div>
                            </div>
                          </div>
                        </div>
                      </section>

                      <div className="relative mt-3 w-[210px] sm:w-[230px] select-none pointer-events-none">
                        <img
                          src={POINT_RABBIT_URL}
                          alt=""
                          aria-hidden="true"
                          className="w-full h-auto object-contain drop-shadow-[0_18px_24px_rgba(15,23,42,0.12)]"
                        />
                        <div className="absolute left-[25%] right-[25%] bottom-[16%] h-[16%] flex flex-col items-center justify-center text-center">
                          <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wide leading-none" style={{ color: thm.text }}>
                            {t('remaining')}
                          </span>
                          <span className="text-sm sm:text-base font-black leading-tight" style={{ color: thm.subtext }}>
                            {remainingPoints.toLocaleString()} {t('pts')}
                          </span>
                        </div>
                      </div>

                      {/* Preview & Download Button */}
                      <button onClick={e => { e.stopPropagation(); setCardPreviewOpen(true); }}
                        className="mt-4 px-4 py-2 rounded-full font-black text-xs transition active:scale-95 border hover:opacity-85 shadow-sm"
                        style={{ color: thm.subtext, borderColor: thm.border + '60', background: thm.light }}>
                        👁️ Preview & Download
                      </button>
                    </div>

                    {/* CHECK-IN + CALENDAR */}
                    <section className="rounded-3xl p-5 shadow-sm relative overflow-hidden" style={cardStyle}>
                      <div className="absolute top-0 right-0 w-28 h-28 rounded-full blur-3xl pointer-events-none opacity-40" style={{ background: thm.primary + '25' }} />
                      <div className="flex items-center justify-between mb-4 gap-3">
                        <div>
                          <h3 className="sb-sticker-title text-sm font-black flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white shadow-sm" style={{ background: thm.primary }}>
                            <CalendarCheck size={16} /> {t('checkin')}
                          </h3>
                          <p className="text-xs opacity-55 font-medium mt-0.5">{t('checkin_desc')}</p>
                        </div>
                        <button onClick={handleCheckin}
                          disabled={checkinLoading || dashboardData?.checked_in_today}
                          className="px-4 py-2 rounded-2xl font-black text-xs transition-all flex items-center gap-1.5 shrink-0 disabled:cursor-not-allowed"
                          style={dashboardData?.checked_in_today
                            ? { background: darkMode ? '#334155' : '#f1f5f9', color: '#94a3b8', border: '1px solid #e2e8f0' }
                            : { background: `linear-gradient(135deg,${thm.primary},${thm.primary}cc)`, color: '#fff', boxShadow: `0 4px 14px ${thm.primary}40` }}>
                          {dashboardData?.checked_in_today
                            ? <><Check size={13} /> {t('checkin_done')}</>
                            : <><CalendarCheck size={13} /> {checkinLoading ? t('checkin_loading') : t('checkin_btn')}</>}
                        </button>
                      </div>

                      {/* ── MINI CALENDAR ── */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-black" style={{ color: thm.subtext }}>
                            {t('cal_title')} — {lang === 'th' ? MONTH_TH[calMonth.getMonth()] : MONTH_EN[calMonth.getMonth()]} {calMonth.getFullYear()}
                          </span>
                          <div className="flex gap-1">
                            <button onClick={() => setCalMonth(m => { const n = new Date(m); n.setMonth(n.getMonth() - 1); return n; })}
                              className="p-1 rounded-lg border text-xs transition hover:opacity-70"
                              style={{ borderColor: thm.border + '60', color: thm.subtext }}><ChevronLeft size={12} /></button>
                            <button onClick={() => setCalMonth(m => { const n = new Date(m); n.setMonth(n.getMonth() + 1); return n; })}
                              className="p-1 rounded-lg border text-xs transition hover:opacity-70"
                              style={{ borderColor: thm.border + '60', color: thm.subtext }}><ChevronRight size={12} /></button>
                          </div>
                        </div>

                        {/* Weekday headers */}
                        <div className="grid grid-cols-7 gap-0.5 mb-1">
                          {(lang === 'th' ? WD_TH : WD_EN).map((d, i) => (
                            <div key={i} className="text-center text-[9px] font-black uppercase opacity-40">{d}</div>
                          ))}
                        </div>

                        {/* Day cells */}
                        <div className="grid grid-cols-7 gap-0.5">
                          {Array.from({ length: getFirstDayMon(calMonth.getFullYear(), calMonth.getMonth()) }).map((_, i) => <div key={`e${i}`} />)}
                          {Array.from({ length: getDaysInMonth(calMonth.getFullYear(), calMonth.getMonth()) }).map((_, i) => {
                            const dayNum = i + 1;
                            const dateStr = `${calMonth.getFullYear()}-${String(calMonth.getMonth()+1).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`;
                            const today = new Date().toISOString().split('T')[0];
                            const isToday = dateStr === today;
                            const isCheckedIn = checkinDates.has(dateStr);
                            const evt = eventMap[dateStr];
                            const evtColor = calendarColorFor(evt);
                            const dow = new Date(calMonth.getFullYear(), calMonth.getMonth(), dayNum).getDay();
                            const isWeekend = dow === 0 || dow === 6;
                            const isPast = dateStr < today;

                            let bg = 'transparent', clr = darkMode ? '#64748b' : '#94a3b8', bdr = 'transparent';
                            if (evt) {
                              bg = transparentize(evtColor, darkMode ? 0.24 : 0.15);
                              clr = evtColor;
                              bdr = evtColor;
                            } else if (isCheckedIn) {
                              bg = '#dcfce7'; clr = '#166534'; bdr = '#86efac';
                            } else if (isPast && !isWeekend) {
                              bg = darkMode ? '#1e293b' : '#fff1f2'; clr = '#e11d48'; bdr = '#fecdd3';
                            }
                            if (isToday) bdr = thm.primary;

                            return (
                              <div key={dayNum} title={evt?.label || ''}
                                className="aspect-square flex items-center justify-center rounded-lg relative border cursor-default transition-all"
                                style={{ background: bg, color: clr, borderColor: bdr || 'transparent', opacity: isWeekend && !isCheckedIn && !evt ? 0.3 : 1, fontSize: '10px', fontWeight: 800 }}>
                                {dayNum}
                                {isCheckedIn && <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 border border-white" />}
                                {evt && <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full border border-white" style={{ background: evtColor }} />}
                              </div>
                            );
                          })}
                        </div>

                        {/* Legend */}
                        <div className="flex gap-4 mt-2.5 flex-wrap">
                          {[
                            { bg: '#dcfce7', bdr: '#86efac', label: t('cal_ok') },
                            { bg: '#fff1f2', bdr: '#fecdd3', label: t('cal_miss') },
                            { bg: '#f3e8ff', bdr: '#8b5cf6', label: t('cal_event') },
                          ].map((item, i) => (
                            <div key={i} className="flex items-center gap-1">
                              <div className="w-2.5 h-2.5 rounded-sm border" style={{ background: item.bg, borderColor: item.bdr }} />
                              <span className="text-[9px] font-bold opacity-45">{item.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </section>

                    {/* STATS & WEEKLY POINT EARNING CHART */}
                    <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Numeric Stats */}
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: t('remaining'), value: remainingPoints.toLocaleString(), unit: t('pts') },
                          { label: t('news_read_ct'), value: dashboardData?.news_read_count || 0, unit: lang === 'th' ? 'บทความ' : 'articles' },
                          { label: t('missions_ct'), value: dashboardData?.mission_done_count || 0, unit: lang === 'th' ? 'ภารกิจ' : 'missions' },
                          { label: t('rewards_ct'), value: dashboardData?.reward_count || 0, unit: lang === 'th' ? 'ครั้ง' : 'times' },
                        ].map((s, i) => (
                          <div key={i} className="rounded-2xl p-3 border flex flex-col justify-between sb-hover-lift relative overflow-hidden" style={{ background: darkMode ? '#1e293b' : '#fff', borderColor: thm.border + '55', boxShadow: darkMode ? 'none' : '0 10px 24px rgba(15,23,42,0.05)' }}>
                            <div className="absolute inset-x-0 top-0 h-1" style={{ background: thm.primary }} />
                            <span className="text-[10px] font-extrabold uppercase tracking-wider opacity-55">{s.label}</span>
                            <div className="mt-1 flex items-baseline gap-1">
                              <strong className="text-base font-black" style={{ color: thm.subtext }}>{s.value}</strong>
                              <span className="text-[9px] opacity-45 font-bold">{s.unit}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Animated Point Earning Chart Widget */}
                      <div className="rounded-2xl p-4 border flex flex-col justify-between" style={{ background: darkMode ? '#1e293b' : thm.light + '80', borderColor: thm.border + '40' }}>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider opacity-55">Point Earning Activity (7 Days)</span>
                        <div className="flex items-end justify-between h-20 gap-1.5 mt-2 px-1">
                          {[
                            { day: 'M', pts: 10 }, { day: 'T', pts: 25 }, { day: 'W', pts: 0 },
                            { day: 'T', pts: 50 }, { day: 'F', pts: 15 }, { day: 'S', pts: 30 },
                            { day: 'S', pts: 45 }
                          ].map((d, idx) => {
                            const pct = Math.max(10, Math.min(100, (d.pts / 50) * 100));
                            return (
                              <div key={idx} className="flex-1 flex flex-col items-center gap-1 group cursor-pointer">
                                <div className="w-full rounded-t-md transition-all duration-500 relative flex justify-center"
                                  style={{ height: `${pct * 0.7}px`, background: d.pts > 0 ? thm.primary : '#94a3b830' }}>
                                  <span className="absolute bottom-[calc(100%+4px)] opacity-0 group-hover:opacity-100 transition text-[8px] font-black bg-slate-900 text-white rounded-md px-1 py-0.5 pointer-events-none">+{d.pts}</span>
                                </div>
                                <span className="text-[9px] font-black opacity-45">{d.day}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </section>
                  </div>

                  {/* RIGHT 5-col */}
                  <div className="lg:col-span-5 space-y-5">

                    {/* INTERACTIVE MISSIONS IN HOME */}
                    <section className="rounded-3xl p-4 border shadow-sm flex flex-col" style={cardStyle}>
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-1.5 opacity-55">
                          <Award size={12} /> {lang === 'th' ? 'ภารกิจแนะนำ' : 'Featured Missions'}
                        </h3>
                        <button onClick={() => setActiveTab('mission')} className="text-[10px] font-black" style={{ color: thm.subtext }}>{t('see_all')}</button>
                      </div>
                      <div className="space-y-2">
                        {missionsList.filter(m => !(m.is_done || m.done)).slice(0, 2).map((item: any, idx: number) => (
                          <div key={item.id || idx} className="flex items-center justify-between gap-2.5 p-2.5 rounded-2xl border"
                            style={{ background: thm.light + '60', borderColor: thm.border + '30' }}>
                            <div className="min-w-0 flex-1">
                              <h5 className="text-xs font-black truncate" style={{ color: textColor }}>{item.title}</h5>
                              <p className="text-[10px] opacity-45 truncate">{item.description}</p>
                            </div>
                            <button onClick={() => handleSubmitMission(item.id)}
                              className="px-2.5 py-1 rounded-xl text-[10px] font-black text-white shrink-0 active:scale-95 transition"
                              style={{ background: thm.primary }}>
                              +{item.points}
                            </button>
                          </div>
                        ))}
                        {missionsList.filter(m => !(m.is_done || m.done)).length === 0 && (
                          <div className="text-center text-xs opacity-35 py-3 font-bold">{t('no_data')}</div>
                        )}
                      </div>
                    </section>

                    {/* NEWS CAROUSEL */}
                    {dashboardData?.latest_news?.length > 0 && (
                      <section className="rounded-3xl overflow-hidden border shadow-sm" style={cardStyle}>
                        <div className="flex justify-between items-center px-4 pt-4 pb-3 border-b" style={{ borderColor: thm.border + '30' }}>
                          <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-1.5 opacity-55">
                            <Newspaper size={12} /> {t('latest_news')}
                          </h3>
                          <button onClick={() => setActiveTab('news')} className="text-[10px] font-black" style={{ color: thm.subtext }}>{t('see_all')}</button>
                        </div>
                        <div className="px-4 pb-4 pt-3">
                          {dashboardData.latest_news.slice(0, 5).map((item: any, i: number) => (
                            <div key={item.id} style={{ display: i === carouselIdx ? 'block' : 'none' }}
                              className="cursor-pointer" onClick={() => openLightbox(item, dashboardData.latest_news)}>
                              {(item.cover_url || item.image_url) && (
                                <div className="h-36 rounded-2xl overflow-hidden mb-3">
                                  <img src={item.cover_url || item.image_url} alt="" className="w-full h-full object-cover" />
                                </div>
                              )}
                              <div className="flex justify-between items-start gap-2">
                                <p className="text-sm font-black leading-snug flex-1 line-clamp-2" style={{ color: textColor }}>{item.topic}</p>
                                <span className="shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full text-white" style={{ background: thm.primary }}>+{item.points}</span>
                              </div>
                              <p className="text-xs opacity-50 mt-1 line-clamp-2 leading-relaxed">{item.detail}</p>
                            </div>
                          ))}
                          {/* Dots */}
                          <div className="flex justify-center gap-1.5 mt-3">
                            {dashboardData.latest_news.slice(0, 5).map((_: any, i: number) => (
                              <button key={i} onClick={() => setCarouselIdx(i)}
                                className="rounded-full transition-all"
                                style={{ width: i === carouselIdx ? 18 : 6, height: 6, background: i === carouselIdx ? thm.primary : thm.border + '60' }} />
                            ))}
                          </div>
                        </div>
                      </section>
                    )}

                    {/* LEADERBOARD PREVIEW */}
                    <section className="rounded-3xl p-4 border shadow-sm" style={cardStyle}>
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-1.5 opacity-55">
                          <Trophy size={12} /> {t('top_employees')}
                        </h3>
                        <button onClick={() => { window.location.href = new URL('ranking_full.html', window.location.href).href; }}
                          className="text-[10px] font-black px-2.5 py-1 rounded-full border"
                          style={{ color: thm.subtext, borderColor: thm.border + '70', background: thm.light }}>
                          {t('ranking_full')}
                        </button>
                      </div>
                      <div className="space-y-2">
                        {dashboardData?.ranking?.length > 0 ? dashboardData.ranking.slice(0, 3).map((item: any, idx: number) => (
                          <div key={item.emp_id || idx} className="flex items-center gap-2.5 p-2.5 rounded-2xl border"
                            style={{ background: thm.light + '60', borderColor: thm.border + '30' }}>
                            <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0"
                              style={{ background: idx === 0 ? '#f59e0b' : idx === 1 ? '#94a3b8' : '#b45309' }}>{idx + 1}</span>
                            <span className="text-xs font-bold flex-1 truncate" style={{ color: textColor }}>{item.full_name || item.emp_id}</span>
                            <span className="text-xs font-black shrink-0" style={{ color: thm.subtext }}>{Number(item.points || 0).toLocaleString()} {t('pts')}</span>
                          </div>
                        )) : <div className="text-center text-xs opacity-35 py-3 font-bold">{t('no_data')}</div>}
                      </div>
                    </section>
                  </div>
                </div>
              </div>
            )}

            {/* ─────────────────────────────────────────────────────── */}
            {/* TAB: NEWS                                               */}
            {/* ─────────────────────────────────────────────────────── */}
            {activeTab === 'news' && (
              <div className="space-y-4">
                {/* Toolbar */}
                <div className="flex gap-2 flex-wrap items-center">
                  <div className="flex-1 min-w-[160px] flex items-center gap-2 rounded-2xl px-3 py-2.5 border"
                    style={{ background: darkMode ? '#1e293b' : thm.light, borderColor: thm.border + '50' }}>
                    <Search size={14} className="opacity-35 shrink-0" />
                    <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                      className="bg-transparent border-0 outline-none w-full text-xs font-bold" placeholder={t('search')} style={{ color: textColor }} />
                  </div>
                  <div className="flex p-1 rounded-2xl border gap-1"
                    style={{ background: darkMode ? '#1e293b' : thm.light, borderColor: thm.border + '50' }}>
                    {[{ v: 'grid', icon: <CheckCircle2 size={12} />, label: t('grid_view') }, { v: 'table', icon: <List size={12} />, label: t('table_view') }].map(({ v, icon, label }) => (
                      <button key={v} onClick={() => setNewsViewMode(v as any)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-[10px] font-black transition-all"
                        style={{ background: newsViewMode === v ? thm.primary : 'transparent', color: newsViewMode === v ? '#fff' : (darkMode ? '#64748b' : '#94a3b8') }}>
                        {icon} {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* TABLE VIEW */}
                {newsViewMode === 'table' && (
                  <div className="rounded-3xl overflow-hidden border shadow-sm" style={cardStyle}>
                    <table className="w-full">
                      <thead>
                        <tr style={{ background: thm.light + '80', borderBottom: `1px solid ${thm.border}30` }}>
                          {['หัวข้อ / Topic', 'แต้ม', 'วันที่', 'Action'].map((h, i) => (
                            <th key={i} className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest opacity-55"
                              style={{ width: i === 0 ? '50%' : 'auto', textAlign: i === 0 ? 'left' : 'center' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredNews.length > 0 ? filteredNews.map((item, idx) => (
                          <tr key={item.id} className="border-b cursor-pointer hover:opacity-80 transition"
                            style={{ borderColor: thm.border + '20', background: idx % 2 === 0 ? 'transparent' : (darkMode ? 'rgba(255,255,255,0.02)' : thm.light + '25') }}
                            onClick={() => openLightbox(item, filteredNews)}>
                            <td className="px-4 py-3 text-xs font-bold truncate max-w-0" style={{ color: textColor }}>
                              <span className="truncate block">{item.topic}</span>
                            </td>
                            <td className="px-2 py-3 text-center">
                              <span className="px-2 py-0.5 rounded-full text-white text-[10px] font-black" style={{ background: thm.primary }}>+{item.points}</span>
                            </td>
                            <td className="px-2 py-3 text-center text-[10px] opacity-45 font-bold">
                              {new Date(item.created_at || item.publish_date).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-GB', { day: 'numeric', month: 'short' })}
                            </td>
                            <td className="px-2 py-3 text-center">
                              {item.is_read
                                ? <span className="text-emerald-500 text-[10px] font-black">{t('read_done')}</span>
                                : <button onClick={e => { e.stopPropagation(); handleReadNews(item.id); }}
                                    className="px-2.5 py-1 rounded-lg text-[10px] font-black text-white" style={{ background: thm.primary }}>{t('read_btn')}</button>}
                            </td>
                          </tr>
                        )) : (
                          <tr><td colSpan={4} className="text-center py-12 opacity-35 font-bold text-sm">{t('no_data')}</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* GRID VIEW */}
                {newsViewMode === 'grid' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredNews.length > 0 ? filteredNews.map(item => (
                      <article key={item.id}
                        className="rounded-3xl overflow-hidden shadow-sm border hover:shadow-md transition duration-300 flex flex-col cursor-pointer"
                        style={cardStyle}
                        onClick={() => openLightbox(item, filteredNews)}>
                        {(item.cover_url || item.image_url) && (
                          <div className="h-36 w-full overflow-hidden relative">
                            <img src={item.cover_url || item.image_url} alt="" className="w-full h-full object-cover" />
                            <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-black text-white shadow" style={{ background: thm.primary }}>+{item.points} PTS</div>
                          </div>
                        )}
                        <div className="p-4 flex-1 flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between items-start gap-2 mb-2">
                              <h3 className="text-sm font-extrabold leading-snug flex-1 line-clamp-2" style={{ color: textColor }}>{item.topic}</h3>
                              {!(item.cover_url || item.image_url) && (
                                <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black text-white" style={{ background: thm.primary }}>+{item.points}</span>
                              )}
                            </div>
                            <p className="text-xs opacity-55 line-clamp-2 leading-relaxed">{item.detail}</p>
                          </div>
                          <div className="flex justify-between items-center mt-3 pt-3 border-t" style={{ borderColor: thm.border + '30' }}>
                            <span className="text-[10px] opacity-35 font-bold">{formatDate(item.created_at || item.publish_date)}</span>
                            {item.is_read
                              ? <span className="text-emerald-500 text-[10px] font-black">{t('read_done')}</span>
                              : <button onClick={e => { e.stopPropagation(); handleReadNews(item.id); }}
                                  className="px-3 py-1.5 rounded-xl text-xs font-black text-white transition active:scale-95"
                                  style={{ background: thm.primary }}>{t('read_btn')}</button>}
                          </div>
                        </div>
                      </article>
                    )) : (
                      <div className="col-span-full text-center py-12 opacity-35 font-bold text-sm">{t('no_data')}</div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ─────────────────────────────────────────────────────── */}
            {/* TAB: MISSIONS                                           */}
            {/* ─────────────────────────────────────────────────────── */}
            {activeTab === 'mission' && (
              <div className="space-y-4">
                <div className="flex gap-2 flex-wrap items-center">
                  <div className="flex-1 min-w-[160px] flex items-center gap-2 rounded-2xl px-3 py-2.5 border lg:hidden"
                    style={{ background: darkMode ? '#1e293b' : thm.light, borderColor: thm.border + '50' }}>
                    <Search size={14} className="opacity-35 shrink-0" />
                    <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                      className="bg-transparent border-0 outline-none w-full text-xs font-bold" placeholder={t('search')} style={{ color: textColor }} />
                  </div>
                  <div className="flex p-1 rounded-2xl border gap-1 ml-auto"
                    style={{ background: darkMode ? '#1e293b' : thm.light, borderColor: thm.border + '50' }}>
                    {['all', 'active', 'done'].map(f => (
                      <button key={f} onClick={() => setFilterType(f)}
                        className="px-3 py-1.5 rounded-xl text-[10px] font-black transition-all"
                        style={{ background: filterType === f ? thm.primary : 'transparent', color: filterType === f ? '#fff' : (darkMode ? '#64748b' : '#94a3b8') }}>
                        {f === 'all' ? t('filter_all') : f === 'active' ? t('filter_pending') : t('filter_done')}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredMissions.length > 0 ? filteredMissions.map(item => {
                    const isDone = item.is_done || item.done;
                    return (
                      <article key={item.id} className="rounded-3xl overflow-hidden border shadow-sm flex flex-col"
                        style={{ background: darkMode ? '#1e293b' : '#fff', border: `1px solid ${isDone ? thm.primary + '50' : thm.cardBorder + '50'}` }}>
                        {item.image_url && (
                          <div className="h-36 overflow-hidden relative">
                            <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                            <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-black text-white" style={{ background: thm.primary }}>+{item.points}</div>
                          </div>
                        )}
                        <div className="p-4 flex-1 flex flex-col justify-between">
                          <div>
                            <div className="flex gap-2 items-start mb-1">
                              {isDone && <CheckCircle2 size={14} className="mt-0.5 shrink-0" style={{ color: thm.primary }} />}
                              <h3 className="text-sm font-extrabold leading-snug flex-1" style={{ color: textColor }}>{item.title}</h3>
                              {!item.image_url && <span className="shrink-0 ml-auto px-2 py-0.5 rounded-full text-[10px] font-black text-white" style={{ background: thm.primary }}>+{item.points}</span>}
                            </div>
                            <p className="text-xs opacity-55 line-clamp-3 leading-relaxed">{item.description || item.detail}</p>
                          </div>
                          <div className="flex justify-between items-center mt-3 pt-3 border-t" style={{ borderColor: thm.border + '30' }}>
                            <span className="text-[10px] opacity-35 font-bold">{formatDate(item.created_at)}</span>
                            <button onClick={() => handleSubmitMission(item.id)} disabled={isDone}
                              className="px-3 py-1.5 rounded-xl text-xs font-black transition active:scale-95 disabled:cursor-not-allowed"
                              style={{ background: isDone ? (darkMode ? '#334155' : '#d1fae5') : thm.primary, color: isDone ? (darkMode ? '#6ee7b7' : '#065f46') : '#fff' }}>
                              {isDone ? t('done') : t('submit')}
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  }) : <div className="col-span-full text-center py-12 opacity-35 font-bold text-sm">{t('no_data')}</div>}
                </div>
              </div>
            )}

            {/* ─────────────────────────────────────────────────────── */}
            {/* TAB: REWARDS SHOP                                       */}
            {/* ─────────────────────────────────────────────────────── */}
            {activeTab === 'rewards' && (
              <div className="space-y-4">
                <div className="flex gap-2 lg:hidden">
                  <div className="flex-1 flex items-center gap-2 rounded-2xl px-3 py-2.5 border"
                    style={{ background: darkMode ? '#1e293b' : thm.light, borderColor: thm.border + '50' }}>
                    <Search size={14} className="opacity-35 shrink-0" />
                    <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                      className="bg-transparent border-0 outline-none w-full text-xs font-bold" placeholder={t('search')} style={{ color: textColor }} />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredRewards.length > 0 ? filteredRewards.map(item => {
                    const cost = item.points_required || item.points_cost || 0;
                    const myPts = dashboardData?.points || user?.points || 0;
                    const canRedeem = myPts >= cost && (item.stock === null || item.stock > 0);
                    return (
                      <article key={item.id} className="rounded-3xl overflow-hidden border shadow-sm flex flex-col" style={cardStyle}>
                        {item.image_url && (
                          <div className="h-36 overflow-hidden relative">
                            <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                            <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-black shadow"
                              style={{ background: '#f59e0b', color: '#1e293b' }}>{cost.toLocaleString()} PTS</div>
                          </div>
                        )}
                        <div className="p-4 flex-1 flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between items-start gap-2 mb-1">
                              <h3 className="text-sm font-extrabold flex-1 leading-snug" style={{ color: textColor }}>{item.name}</h3>
                              {!item.image_url && <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black shadow" style={{ background: '#f59e0b', color: '#1e293b' }}>{cost.toLocaleString()}</span>}
                            </div>
                            <p className="text-xs opacity-55 line-clamp-2 leading-relaxed">{item.detail || item.description}</p>
                          </div>
                          <div className="flex justify-between items-center mt-3 pt-3 border-t" style={{ borderColor: thm.border + '30' }}>
                            <span className="text-[10px] opacity-45 font-bold">{t('stock')} {item.stock !== null && item.stock !== undefined ? `${item.stock} ${t('pcs')}` : t('unlimited')}</span>
                            <button onClick={() => handleRedeemReward(item.id, item.name, cost)} disabled={!canRedeem}
                              className="px-3 py-1.5 rounded-xl text-xs font-black text-white transition active:scale-95 disabled:cursor-not-allowed"
                              style={{ background: !canRedeem ? (darkMode ? '#334155' : '#e2e8f0') : thm.primary, color: !canRedeem ? '#94a3b8' : '#fff' }}>
                              {myPts < cost ? t('not_enough') : t('redeem')}
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  }) : <div className="col-span-full text-center py-12 opacity-35 font-bold text-sm">{t('no_data')}</div>}
                </div>
              </div>
            )}

            {/* ─────────────────────────────────────────────────────── */}
            {/* TAB: RANKING                                            */}
            {/* ─────────────────────────────────────────────────────── */}
            {activeTab === 'ranking' && (
              <div className="space-y-4 max-w-2xl mx-auto w-full">
                <div className="rounded-3xl p-4 border overflow-hidden" style={cardStyle}>
                    <div className="text-center mb-4">
                      <div className="text-5xl leading-none select-none" style={{ filter: 'drop-shadow(0 8px 0 rgba(120,53,15,.22)) drop-shadow(0 18px 18px rgba(245,158,11,.28))' }}>
                        🏆
                      </div>
                      <h3 className="text-base font-black mt-2" style={{ color: thm.text }}>{t('leaderboard')}</h3>
                      <p className="text-xs opacity-55 font-bold mt-1">{t('leaderboard_sub')}</p>
                    </div>
                    <div className="flex items-center gap-2 rounded-2xl px-3 py-2 border mb-4"
                      style={{ background: darkMode ? 'rgba(255,255,255,0.03)' : thm.light, borderColor: thm.border + '50' }}>
                      <Search size={14} className="opacity-35 shrink-0" />
                      <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                        className="bg-transparent border-0 outline-none w-full text-xs font-bold" placeholder={t('search')} style={{ color: textColor }} />
                    </div>
                    <div className="grid grid-cols-3 gap-2 items-end min-h-[190px]">
                      {[1, 0, 2].map((rankIdx) => {
                        const item = filteredRankingList[rankIdx];
                        if (!item) return <div key={rankIdx} />;
                        const isMe = item.emp_id === profile.emp_id;
                        const tone = rankIdx === 0
                          ? { label: '1', name: 'ทอง', color: '#f59e0b', h: 'h-32', icon: <Crown size={18} /> }
                          : rankIdx === 1
                            ? { label: '2', name: 'เงิน', color: '#94a3b8', h: 'h-24', icon: <Trophy size={16} /> }
                            : { label: '3', name: 'บรอนซ์', color: '#b45309', h: 'h-20', icon: <Trophy size={16} /> };
                        return (
                          <div key={rankIdx} className="flex flex-col items-center justify-end min-w-0">
                            <div className="mb-2 w-full rounded-2xl border p-2 text-center shadow-sm"
                              style={{ background: isMe ? thm.light : (darkMode ? '#1e293b' : '#fff'), borderColor: isMe ? thm.primary + '70' : thm.border + '45' }}>
                              <div className="mx-auto w-11 h-11 rounded-full p-0.5 shadow relative"
                                style={{ background: tone.color }}>
                                {rankIdx === 0 && (
                                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[15px]" style={{ color: '#f59e0b' }}>
                                    <Crown size={16} fill="currentColor" />
                                  </span>
                                )}
                                <img
                                  src={rankingAvatar(item)}
                                  alt=""
                                  className="w-full h-full rounded-full object-cover bg-white"
                                  onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(item.emp_id || 'rank')}`; }}
                                />
                              </div>
                              <p className="mt-2 text-[11px] font-black truncate" style={{ color: textColor }}>{item.full_name || item.emp_id}</p>
                              <p className="text-[10px] font-black" style={{ color: tone.color }}>{Number(item.points || 0).toLocaleString()} {t('pts')}</p>
                              {isMe && <span className="mt-1 inline-flex text-[8px] font-black px-1.5 py-0.5 rounded-full text-white" style={{ background: thm.primary }}>YOU</span>}
                            </div>
                            <div className={`w-full ${tone.h} rounded-t-3xl flex flex-col items-center justify-center text-white shadow-inner relative overflow-hidden`}
                              style={{ background: `linear-gradient(180deg, ${tone.color}, ${transparentize(tone.color, 0.68)})` }}>
                              <span className="absolute inset-0 bg-white/10" />
                              <span className="relative text-3xl font-black">{tone.label}</span>
                              <span className="relative text-[10px] font-black opacity-80">{tone.name}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                </div>
                <div className="space-y-2">
                  {filteredRankingList.length > 0 ? filteredRankingList.slice(3, 10).map((item: any, offset: number) => {
                    const idx = offset + 3;
                    const isMe = item.emp_id === profile.emp_id;
                    const dept = item.department || item.dept || item.dept_th || '-';
                    const role = item.role || item.app_role || 'user';
                    return (
                      <div key={item.emp_id || idx} className="flex items-center gap-3 p-4 rounded-2xl border transition"
                        style={{
                          background: isMe ? thm.light : (darkMode ? '#1e293b' : '#fff'),
                          borderColor: isMe ? thm.primary + '70' : thm.border + '40',
                          boxShadow: isMe ? `0 0 0 2px ${thm.primary}25` : 'none',
                        }}>
                        <div className="relative shrink-0">
                          <img
                            src={rankingAvatar(item)}
                            alt=""
                            className="w-9 h-9 rounded-full object-cover border-2 bg-white"
                            style={{ borderColor: idx === 0 ? '#f59e0b' : idx === 1 ? '#94a3b8' : idx === 2 ? '#b45309' : thm.border }}
                            onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(item.emp_id || 'rank')}`; }}
                          />
                          <span className="absolute -bottom-1 -right-1 min-w-5 h-5 px-1 rounded-full flex items-center justify-center text-[9px] font-black border border-white"
                            style={{ background: darkMode ? '#334155' : '#f1f5f9', color: '#64748b' }}>
                            {idx + 1}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-bold block truncate" style={{ color: textColor }}>{item.full_name || item.emp_id}</span>
                          <span className="text-[10px] opacity-45 font-bold truncate block">{item.emp_id} • {dept} • {String(role).toUpperCase()}</span>
                        </div>
                        {isMe && <span className="text-[10px] font-black px-2 py-0.5 rounded-full text-white shrink-0" style={{ background: thm.primary }}>YOU</span>}
                        <span className="text-sm font-black shrink-0" style={{ color: thm.subtext }}>{Number(item.points || 0).toLocaleString()} {t('pts')}</span>
                      </div>
                    );
                  }) : <div className="text-center py-12 opacity-35 font-bold text-sm">{t('no_data')}</div>}
                </div>
              </div>
            )}

            {/* ─────────────────────────────────────────────────────── */}
            {/* TAB: TOOLS                                              */}
            {activeTab === 'tools' && (
              <div className="max-w-4xl mx-auto w-full space-y-4">
                <section className="rounded-3xl p-6 border shadow-sm overflow-hidden relative" style={cardStyle}>
                  <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: thm.primary }} />
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-black flex items-center gap-2" style={{ color: thm.text }}>
                        <Wrench size={20} /> {t('tools')}
                      </h3>
                      <p className="text-xs opacity-55 font-bold mt-1">
                        {lang === 'th' ? 'รวมทางลัดบริการภายใน ใบเสนอราคา และคำร้อง IT' : 'Internal services, quotation, and IT request shortcuts.'}
                      </p>
                    </div>
                    <button onClick={() => setToolsModalOpen(true)}
                      className="px-4 py-2 rounded-2xl text-xs font-black text-white transition active:scale-95"
                      style={{ background: thm.primary }}>
                      {lang === 'th' ? 'เปิด Pop-up' : 'Open Pop-up'}
                    </button>
                  </div>
                </section>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { title: t('services'), icon: Wrench, detail: lang === 'th' ? 'บริการและแบบฟอร์มที่ใช้บ่อย' : 'Common services and forms' },
                    { title: t('quotation'), icon: FileText, detail: lang === 'th' ? 'เปิดใบขอ quotation สำหรับงานขาย/จัดซื้อ' : 'Open a quotation request' },
                    { title: t('it_request'), icon: ClipboardList, detail: lang === 'th' ? 'แจ้งซ่อม ขออุปกรณ์ หรือขอความช่วยเหลือ IT' : 'Submit an IT support request' },
                  ].map((item, idx) => {
                    const Icon = item.icon;
                    return (
                      <button key={idx} onClick={() => setToolsModalOpen(true)}
                        className="text-left rounded-3xl p-5 border shadow-sm sb-hover-lift"
                        style={{ ...cardStyle, borderColor: thm.border + '55' }}>
                        <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-4" style={{ background: thm.light, color: thm.primary }}>
                          <Icon size={20} />
                        </div>
                        <h4 className="text-sm font-black" style={{ color: textColor }}>{item.title}</h4>
                        <p className="text-xs opacity-55 font-bold mt-1 leading-relaxed">{item.detail}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB: RULE BOARD                                         */}
            {activeTab === 'rules' && (
              <div className="max-w-5xl mx-auto w-full space-y-4">
                <section className="rounded-3xl p-5 border shadow-sm" style={cardStyle}>
                  <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
                    <div>
                      <h3 className="text-lg font-black flex items-center gap-2" style={{ color: thm.text }}>
                        <BookOpen size={20} /> {t('rules')}
                      </h3>
                      <p className="text-xs opacity-55 font-bold mt-1">
                        {lang === 'th' ? 'บอร์ดความรู้และประกาศจากหลังบ้าน' : 'Company knowledge board managed by admin.'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 rounded-2xl px-3 py-2 border min-w-[220px]"
                      style={{ background: darkMode ? 'rgba(255,255,255,0.03)' : thm.light, borderColor: thm.border + '50' }}>
                      <Search size={14} className="opacity-35 shrink-0" />
                      <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                        className="bg-transparent border-0 outline-none w-full text-xs font-bold" placeholder={t('search')} style={{ color: textColor }} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
                    {RULE_CATEGORIES.map(cat => {
                      const Icon = cat.icon;
                      const active = rulesCategory === cat.id;
                      return (
                        <button key={cat.id} onClick={() => setRulesCategory(cat.id)}
                          className="rounded-2xl border p-3 text-left transition-all sb-hover-lift"
                          style={{
                            background: active ? thm.light : (darkMode ? 'rgba(255,255,255,0.03)' : '#fff'),
                            borderColor: active ? thm.primary : thm.border + '45',
                            boxShadow: active ? `0 0 0 2px ${thm.primary}24` : 'none',
                          }}>
                          <Icon size={17} style={{ color: active ? thm.primary : '#94a3b8' }} />
                          <span className="block text-xs font-black mt-2" style={{ color: active ? thm.text : textColor }}>
                            {lang === 'th' ? cat.th : cat.en}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredRules.length > 0 ? filteredRules.map((item, idx) => (
                    <article key={item.id || idx} className="rounded-3xl border shadow-sm overflow-hidden sb-hover-lift" style={cardStyle}>
                      <div className="h-1.5" style={{ background: item.color || thm.primary }} />
                      <div className="p-5">
                        <span className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-black text-white" style={{ background: item.color || thm.primary }}>
                          {RULE_CATEGORIES.find(c => c.id === (item.category || 'policy'))?.[lang === 'th' ? 'th' : 'en'] || t('rules')}
                        </span>
                        <h4 className="text-base font-black mt-3 leading-snug" style={{ color: textColor }}>{item.title}</h4>
                        <div
                          className="text-xs opacity-65 font-medium leading-relaxed mt-2 space-y-2"
                          dangerouslySetInnerHTML={{ __html: item.body_html || item.body || item.summary || '' }}
                        />
                      </div>
                    </article>
                  )) : (
                    <div className="md:col-span-2 text-center py-16 opacity-35">
                      <BookOpen size={42} className="mx-auto mb-3 opacity-25" />
                      <p className="text-sm font-bold">{t('no_data')}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB: HISTORY                                            */}
            {/* ─────────────────────────────────────────────────────── */}
            {activeTab === 'logs' && (
              <div className="space-y-3 max-w-2xl mx-auto w-full">
                <div className="flex items-center gap-2 mb-1">
                  <History size={16} style={{ color: thm.subtext }} />
                  <h3 className="text-sm font-black" style={{ color: thm.text }}>{t('history')}</h3>
                </div>
                {logsList.length > 0 ? logsList.map((item, idx) => {
                  const isPos = Number(item.amount || item.points || 0) >= 0;
                  const amount = Number(item.amount || item.points || 0);
                  return (
                    <div key={idx} className="flex items-center justify-between gap-3 p-3.5 rounded-2xl border"
                      style={{ background: darkMode ? '#1e293b' : '#fff', borderColor: thm.border + '40' }}>
                      <div className="flex items-center gap-3 truncate">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: isPos ? '#dcfce7' : '#fee2e2' }}>
                          <Coins size={14} style={{ color: isPos ? '#16a34a' : '#dc2626' }} />
                        </div>
                        <div className="truncate">
                          <h4 className="text-xs font-black truncate" style={{ color: textColor }}>{item.title || item.source_type}</h4>
                          {item.description && <p className="text-[10px] opacity-45 truncate">{item.description}</p>}
                          <span className="text-[9px] opacity-35 font-bold">{formatDate(item.created_at || item.log_at)}</span>
                        </div>
                      </div>
                      <strong className="text-sm font-black shrink-0" style={{ color: isPos ? '#16a34a' : '#dc2626' }}>
                        {isPos ? '+' : ''}{amount.toLocaleString()}
                      </strong>
                    </div>
                  );
                }) : (
                  <div className="text-center py-16 opacity-35">
                    <History size={36} className="mx-auto mb-3 opacity-20" />
                    <p className="font-bold text-sm">{t('history_empty')}</p>
                  </div>
                )}
              </div>
            )}

            {/* ─────────────────────────────────────────────────────── */}
            {/* TAB: NOTIFICATIONS (full page)                          */}
            {/* ─────────────────────────────────────────────────────── */}
            {activeTab === 'notifications' && (
              <div className="space-y-3 max-w-2xl mx-auto w-full">
                <div className="flex justify-between items-center mb-1">
                  <h3 className="text-sm font-black flex items-center gap-2" style={{ color: thm.text }}>
                    <Bell size={16} /> {t('notifications')}
                    {unreadNotiCount > 0 && <span className="px-2 py-0.5 rounded-full text-white text-[10px] font-black" style={{ background: thm.primary }}>{unreadNotiCount}</span>}
                  </h3>
                  {unreadNotiCount > 0 && (
                    <button onClick={handleMarkAllRead} className="text-xs font-black px-3 py-1.5 rounded-full border"
                      style={{ color: thm.subtext, borderColor: thm.border + '60' }}>{t('mark_read')}</button>
                  )}
                </div>
                {notifications.length > 0 ? notifications.map((n, i) => (
                  <div key={i} onClick={() => !n.is_read && handleMarkNotificationRead(n.id)}
                    className="flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition hover:opacity-80"
                    style={{ background: n.is_read ? (darkMode ? '#1e293b' : '#fff') : thm.light, borderColor: n.is_read ? thm.border + '30' : thm.primary + '40' }}>
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                      style={{ background: n.is_read ? (darkMode ? '#334155' : '#f1f5f9') : thm.primary }}>
                      <Bell size={16} className={n.is_read ? 'opacity-30' : 'text-white'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black leading-snug" style={{ color: n.is_read ? textColor : thm.text, opacity: n.is_read ? 0.55 : 1 }}>{n.title}</p>
                      {n.detail && <p className="text-xs opacity-55 mt-0.5 line-clamp-2">{n.detail}</p>}
                      <span className="text-[10px] opacity-35 mt-1 block">{formatDate(n.created_at)}</span>
                    </div>
                    {!n.is_read && <div className="w-2.5 h-2.5 rounded-full mt-1 shrink-0 animate-pulse" style={{ background: thm.primary }} />}
                  </div>
                )) : (
                  <div className="text-center py-16 opacity-35">
                    <Bell size={40} className="mx-auto mb-3 opacity-20" />
                    <p className="font-bold text-sm">{t('notif_empty')}</p>
                  </div>
                )}
              </div>
            )}

            {/* ─────────────────────────────────────────────────────── */}
            {/* TAB: SETTINGS                                           */}
            {/* ─────────────────────────────────────────────────────── */}
            {activeTab === 'settings' && (
              <div className="space-y-5 max-w-2xl mx-auto w-full">

                {/* ── PROFILE PHOTO ── */}
                <section className="rounded-3xl p-5 border shadow-sm" style={cardStyle}>
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-45 mb-4">{t('account_section')}</p>
                  <div className="flex items-center gap-5">
                    <div className="relative cursor-pointer group shrink-0" onClick={() => fileInputRef.current?.click()}>
                      <div className="w-20 h-20 rounded-2xl p-0.5 shadow-lg" style={{ background: `linear-gradient(135deg,${thm.primary},${thm.primary}88)` }}>
                        <img src={displayAvatar} className="w-full h-full rounded-2xl object-cover" onError={(e) => { (e.target as any).src = fallbackAvatar; }} />
                      </div>
                      <div className="absolute inset-0 rounded-2xl bg-black/55 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-all gap-1">
                        <Camera size={22} className="text-white" />
                        <span className="text-[9px] text-white font-black">{lang === 'th' ? 'อัปโหลด' : 'Upload'}</span>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-base font-black" style={{ color: textColor }}>{profile.full_name || '-'}</h4>
                      <p className="text-xs opacity-55 font-bold">{profile.emp_id} • {profile.department || '-'}</p>
                      <p className="text-xs opacity-35 font-extrabold uppercase tracking-wider mt-0.5">{profile.role || 'user'}</p>
                      <button onClick={() => fileInputRef.current?.click()}
                        className="mt-2.5 flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded-xl border transition hover:opacity-80 active:scale-95"
                        style={{ color: thm.subtext, borderColor: thm.border + '60', background: thm.light }}>
                        <Camera size={12} /> {t('profile_photo')}
                      </button>
                    </div>
                  </div>
                </section>

                {/* ── APPEARANCE ── */}
                <section className="rounded-3xl p-5 border shadow-sm" style={cardStyle}>
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-45 mb-4">{t('appearance')}</p>
                  <div className="space-y-5">

                    {/* Dark Mode */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {darkMode ? <Moon size={18} style={{ color: thm.subtext }} /> : <Sun size={18} style={{ color: thm.subtext }} />}
                        <div>
                          <p className="text-sm font-black" style={{ color: textColor }}>{t('dark_mode')}</p>
                          <p className="text-[10px] opacity-45 font-bold">{darkMode ? (lang === 'th' ? 'โหมดมืด' : 'Dark mode on') : (lang === 'th' ? 'โหมดสว่าง' : 'Light mode on')}</p>
                        </div>
                      </div>
                      <div onClick={() => setDarkMode(d => !d)} className="relative w-12 h-6 rounded-full cursor-pointer transition-all duration-300 select-none"
                        style={{ background: darkMode ? thm.primary : '#e2e8f0' }}>
                        <div className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transition-all duration-300"
                          style={{ left: darkMode ? 'calc(100% - 20px)' : '4px' }} />
                      </div>
                    </div>

                    {/* Language */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Globe size={18} style={{ color: thm.subtext }} />
                        <div>
                          <p className="text-sm font-black" style={{ color: textColor }}>{t('lang_switch')}</p>
                          <p className="text-[10px] opacity-45 font-bold">{lang === 'th' ? 'ภาษาไทย' : 'English'}</p>
                        </div>
                      </div>
                      <div className="flex gap-1 p-1 rounded-xl border" style={{ borderColor: thm.border + '60', background: thm.light }}>
                        {(['th', 'en'] as Lang[]).map(l => (
                          <button key={l} onClick={() => setLang(l)}
                            className="px-3 py-1 rounded-lg text-xs font-black transition-all"
                            style={{ background: lang === l ? thm.primary : 'transparent', color: lang === l ? '#fff' : (darkMode ? '#64748b' : '#94a3b8') }}>
                            {l.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Notifications */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Bell size={18} style={{ color: thm.subtext }} />
                        <div>
                          <p className="text-sm font-black" style={{ color: textColor }}>{t('notif_toggle')}</p>
                          <p className="text-[10px] opacity-45 font-bold">{notifEnabled ? (lang === 'th' ? 'เปิดใช้งาน' : 'Enabled') : (lang === 'th' ? 'ปิดใช้งาน' : 'Disabled')}</p>
                        </div>
                      </div>
                      <div onClick={() => setNotifEnabled(n => !n)} className="relative w-12 h-6 rounded-full cursor-pointer transition-all duration-300 select-none"
                        style={{ background: notifEnabled ? thm.primary : '#e2e8f0' }}>
                        <div className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transition-all duration-300"
                          style={{ left: notifEnabled ? 'calc(100% - 20px)' : '4px' }} />
                      </div>
                    </div>

                    {/* Theme Colors */}
                    <div>
                      <div className="flex items-center gap-3 mb-3">
                        <Star size={18} style={{ color: thm.subtext }} />
                        <p className="text-sm font-black" style={{ color: textColor }}>{t('theme_color')}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        {(Object.entries(THEMES) as [ThemeColor, typeof THEMES['mint']][]).map(([key, val]) => {
                          const labels: Record<ThemeColor, string> = {
                            mint: t('theme_mint'), ocean: t('theme_ocean'),
                            sunset: t('theme_sunset'), lavender: t('theme_lavender'),
                          };
                          const emojis: Record<ThemeColor, string> = { mint: '🌿', ocean: '🌊', sunset: '🌅', lavender: '💜' };
                          return (
                            <button key={key} onClick={() => {
                              setTheme(key);
                              setCustomTheme(THEME_PRESET_COLORS[key]);
                            }}
                              className="flex items-center gap-2.5 p-3.5 rounded-2xl border transition-all text-left"
                              style={{
                                background: key === theme ? val.light : (darkMode ? 'rgba(255,255,255,0.04)' : '#f8fafc'),
                                borderColor: key === theme ? val.primary : thm.border + '40',
                                boxShadow: key === theme ? `0 0 0 2px ${val.primary}30` : 'none',
                              }}>
                              <div className="w-6 h-6 rounded-full shrink-0 shadow-sm" style={{ background: val.primary }} />
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-black truncate" style={{ color: key === theme ? val.text : textColor }}>{labels[key]}</p>
                                <p className="text-[10px] opacity-40 font-bold">{emojis[key]}</p>
                              </div>
                              {key === theme && <Check size={13} className="shrink-0" style={{ color: val.primary }} />}
                            </button>
                          );
                        })}
                      </div>
                      <div className="mt-4 rounded-2xl border p-3.5 space-y-3"
                        style={{ borderColor: thm.border + '45', background: darkMode ? 'rgba(255,255,255,0.04)' : '#f8fafc' }}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-black" style={{ color: textColor }}>
                              {lang === 'th' ? 'ปรับเฉดสีเอง' : 'Custom shades'}
                            </p>
                            <p className="text-[10px] opacity-45 font-bold">
                              {lang === 'th' ? 'สีนี้เก็บเฉพาะผู้ใช้นี้เท่านั้น' : 'Saved only for this user'}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setCustomTheme(THEME_PRESET_COLORS[theme])}
                            className="px-3 py-1.5 rounded-xl text-[10px] font-black border transition active:scale-95"
                            style={{ borderColor: thm.border + '60', color: thm.subtext, background: darkMode ? 'rgba(255,255,255,0.04)' : '#fff' }}>
                            Reset
                          </button>
                        </div>
                        {([
                          ['topBar', lang === 'th' ? 'Top Bar' : 'Top Bar', 'topBar1', 'topBar2'],
                          ['nav', lang === 'th' ? 'Nav Menu' : 'Nav Menu', 'nav1', 'nav2'],
                        ] as [string, string, keyof CustomTheme, keyof CustomTheme][]).map(([id, label, key1, key2]) => (
                          <div key={id} className="grid grid-cols-[96px_1fr_1fr] items-center gap-2">
                            <span className="text-[11px] font-black truncate" style={{ color: textColor }}>{label}</span>
                            {[key1, key2].map((colorKey, idx) => (
                              <label key={colorKey} className="h-9 rounded-xl border px-2 flex items-center gap-2 cursor-pointer"
                                style={{ borderColor: thm.border + '45', background: darkMode ? 'rgba(15,23,42,0.35)' : '#fff' }}>
                                <input
                                  type="color"
                                  value={customTheme[colorKey]}
                                  onChange={(e) => setCustomTheme(prev => ({ ...prev, [colorKey]: e.target.value }))}
                                  className="w-5 h-5 rounded border-0 bg-transparent p-0 cursor-pointer"
                                  aria-label={`${label} #${idx + 1}`}
                                />
                                <span className="text-[10px] font-black uppercase tabular-nums" style={{ color: thm.subtext }}>
                                  #{idx + 1}
                                </span>
                              </label>
                            ))}
                          </div>
                        ))}
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <div className="h-8 rounded-xl shadow-inner" style={{ background: topBarGradient }} />
                          <div className="h-8 rounded-xl shadow-inner" style={{ background: navGradient }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* ── SYSTEM INFO ── */}
                <section className="rounded-3xl p-5 border shadow-sm" style={cardStyle}>
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-45 mb-4">{t('system_section')}</p>
                  {[
                    { label: t('version_label'), value: 'SB Connect v2.1' },
                    { label: t('mode_label'), value: 'Offline / Mock DB' },
                    { label: t('emp_label'), value: profile.emp_id || '-' },
                    { label: t('role_label'), value: (profile.role || 'user').toUpperCase() },
                    { label: lang === 'th' ? 'แผนก' : 'Department', value: profile.department || '-' },
                  ].map((row, i) => (
                    <div key={i} className="flex justify-between items-center py-2.5 border-b last:border-0"
                      style={{ borderColor: thm.border + '25' }}>
                      <span className="text-xs font-bold opacity-45">{row.label}</span>
                      <span className="text-xs font-black" style={{ color: thm.subtext }}>{row.value}</span>
                    </div>
                  ))}

                  {profile.role === 'admin' && (
                    <div className="mt-4 p-3 rounded-2xl flex items-center gap-2 border"
                      style={{ background: thm.light, borderColor: thm.primary + '40' }}>
                      <ShieldAlert size={14} style={{ color: thm.primary }} />
                      <span className="text-[11px] font-black" style={{ color: thm.text }}>
                        {lang === 'th' ? 'คุณมีสิทธิ์ Admin' : 'You have Admin access'}
                      </span>
                    </div>
                  )}

                  <button onClick={logout}
                    className="w-full mt-4 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-black border transition active:scale-95 text-red-500 border-red-200 hover:bg-red-50">
                    <LogOut size={16} /> {t('logout_btn')}
                  </button>
                </section>

              </div>
            )}

          </main>

          {/* ── FIXED BOTTOM NAV (mobile < lg) ───────────────────────── */}
          <nav className="fixed bottom-0 inset-x-0 h-16 flex items-center justify-around gap-1 px-2 z-40 lg:hidden border-t"
            style={{ ...headerStyle }}>
            {navItems.map(item => (
              <button key={item.id} onClick={() => {
                setActiveTab(item.id as TabType);
                if (item.id === 'tools') setToolsModalOpen(true);
              }}
                className="min-w-[58px] flex flex-col items-center gap-0.5 transition-all relative px-1 py-1 rounded-2xl"
                style={{
                  background: activeTab === item.id ? `${navGradient}, ${transparentize(item.color, 0.18)}` : 'transparent',
                  color: activeTab === item.id ? '#f8fafc' : (darkMode ? '#cbd5e1' : '#94a3b8'),
                }}>
                <span className="w-8 h-8 rounded-2xl flex items-center justify-center"
                  style={{ background: transparentize(item.color, activeTab === item.id ? 0.18 : 0.08), color: item.color }}>
                  {item.icon}
                </span>
                <span className="text-[8px] font-black tracking-wider sb-nav-label">{item.label}</span>
                {item.id === 'notifications' && unreadNotiCount > 0 && (
                  <div className="absolute -top-0.5 right-0 w-2 h-2 rounded-full border border-white" style={{ background: item.color }} />
                )}
                {activeTab === item.id && (
                  <div className="absolute -bottom-1 w-4 h-0.5 rounded-full" style={{ background: item.color }} />
                )}
              </button>
            ))}
          </nav>

        </div>
      </div>
    </div>
  );
}

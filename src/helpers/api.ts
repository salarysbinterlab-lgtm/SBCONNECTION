// src/helpers/api.ts

const TOKEN_KEY = 'sb_session_token';
const USER_KEY = 'sb_current_user';
const TMP_PASS_KEY = 'sb_tmp_login_password';

export function getConfig() {
  if (typeof window !== 'undefined' && window.SB_CONNECT_CONFIG) {
    return window.SB_CONNECT_CONFIG;
  }
  return {
    supabaseUrl: 'https://tmcbblwfucwauksenqqr.supabase.co',
    supabaseAnonKey: 'sb_publishable__eAshDr5vo6TBNDJ4VNRUg_tRPp2Wov',
  };
}

export function isSupabaseConfigured(): boolean {
  const cfg = getConfig();
  return Boolean(
    cfg.supabaseUrl &&
    !cfg.supabaseUrl.includes('PASTE_') &&
    cfg.supabaseAnonKey &&
    !cfg.supabaseAnonKey.includes('PASTE_')
  );
}

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || '{}');
  } catch {
    return {};
  }
}

export function getTempPassword(): string {
  return sessionStorage.getItem(TMP_PASS_KEY) || '';
}

export function clearTempPassword() {
  sessionStorage.removeItem(TMP_PASS_KEY);
}

export function setSession(token: string, user: any, tempPassword = '') {
  const normalizedUser = {
    ...(user || {}),
    emp_id: user?.emp_id || user?.empId || '',
    empId: user?.empId || user?.emp_id || '',
    full_name: user?.full_name || user?.name || user?.display_name || '',
    name: user?.name || user?.full_name || user?.display_name || '',
    department: user?.department || user?.dept || user?.dept_th || '',
    dept: user?.dept || user?.department || user?.dept_th || '',
    position: user?.position || user?.pos_th || user?.position_name || '',
    avatar_url: user?.avatar_url || user?.avatar || '',
    avatar: user?.avatar || user?.avatar_url || '',
  };
  localStorage.setItem(TOKEN_KEY, token || '');
  localStorage.setItem(USER_KEY, JSON.stringify(normalizedUser));
  if (tempPassword) {
    sessionStorage.setItem(TMP_PASS_KEY, tempPassword);
  }
}

// Local storage keys for mock database
const MOCK_USERS_KEY = 'mock_db_users';
const MOCK_NEWS_KEY = 'mock_db_news';
const MOCK_MISSIONS_KEY = 'mock_db_missions';
const MOCK_REWARDS_KEY = 'mock_db_rewards';
const MOCK_LOGS_KEY = 'mock_db_logs';
const MOCK_DEPTS_KEY = 'mock_db_depts';
const MOCK_CALENDAR_KEY = 'mock_db_calendar';
const MOCK_RULES_KEY = 'mock_db_rules';
const MOCK_WELCOME_KEY = 'mock_db_welcome_config';

function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function initMockDB() {
  if (!localStorage.getItem(MOCK_USERS_KEY)) {
    localStorage.setItem(MOCK_USERS_KEY, JSON.stringify([
      { emp_id: '3672', full_name: 'คุณพนักงานทดสอบ (Test Employee)', role: 'user', department: 'Production', status: 'ACTIVE', points: 1250 },
      { emp_id: 'ADMIN', full_name: 'IT Administrator', role: 'admin', department: 'IT', status: 'ACTIVE', points: 9999 },
      { emp_id: 'EMP002', full_name: 'คุณนพดล ทองดี', role: 'user', department: 'Warehouse', status: 'ACTIVE', points: 800 },
      { emp_id: 'EMP003', full_name: 'คุณสมศักดิ์ รักดี', role: 'user', department: 'QC', status: 'INACTIVE', points: 450 }
    ]));
  }
  if (!localStorage.getItem(MOCK_NEWS_KEY)) {
    localStorage.setItem(MOCK_NEWS_KEY, JSON.stringify([
      { id: 1, topic: 'ประกาศวันหยุดเทศกาลสงกรานต์ปี 2026', detail: 'เนื่องในเทศกาลสงกรานต์ บริษัทประกาศวันหยุดตั้งแต่วันที่ 13 ถึง 17 เมษายน 2026 ขอให้พนักงานเดินทางโดยสวัสดิภาพ', points: 100, is_active: true, publish_date: '2026-07-14T10:00:00Z', created_at: '2026-07-14T10:00:00Z' },
      { id: 2, topic: 'สัมมนาทิศทางการเติบโตของ Carebeau ปี 2026', detail: 'เชิญร่วมงานสัมมนาประจำปี ณ ห้องประชุมใหญ่ หัวข้อวิสัยทัศน์และการพัฒนาผลิตภัณฑ์ใหม่เพื่อความยั่งยืน', points: 150, is_active: true, publish_date: '2026-07-13T09:00:00Z', created_at: '2026-07-13T09:00:00Z' },
      { id: 3, topic: 'กิจกรรมบริจาคโลหิตเคลื่อนที่ ครั้งที่ 3', detail: 'ขอเชิญชวนเพื่อนพนักงานร่วมบริจาคโลหิต ณ รถหน่วยเคลื่อนที่บริเวณลานจอดรถหน้าบริษัท', points: 200, is_active: false, publish_date: '2026-07-10T09:00:00Z', created_at: '2026-07-10T09:00:00Z' }
    ]));
  }
  if (!localStorage.getItem(MOCK_MISSIONS_KEY)) {
    localStorage.setItem(MOCK_MISSIONS_KEY, JSON.stringify([
      { id: 101, title: 'ตอบแบบสำรวจความสุขพนักงาน', description: 'ร่วมตอบแบบสำรวจสั้นๆ 5 นาทีเพื่อนำไปพัฒนาคุณภาพชีวิตการทำงานในสำนักงาน', points: 80, is_active: true, created_at: '2026-07-14T12:00:00Z' },
      { id: 102, title: 'ทำความสะอาดโต๊ะทำงาน (5S)', description: 'ถ่ายภาพโต๊ะทำงานที่จัดระเบียบเรียบร้อยส่งเข้ามาในระบบเพื่อรับคะแนน', points: 150, is_active: true, created_at: '2026-07-12T08:00:00Z' }
    ]));
  }
  if (!localStorage.getItem(MOCK_REWARDS_KEY)) {
    localStorage.setItem(MOCK_REWARDS_KEY, JSON.stringify([
      { id: 201, name: 'แก้วน้ำเกล็ดหิมะ Carebeau Limited', detail: 'แก้วเก็บความเย็นลิมิเต็ดสีสันสวยงามจากแบรนด์แคร์บิว ขนาด 30 ออนซ์', points_required: 500, stock: 10, is_active: true, image_url: 'https://images.unsplash.com/photo-1577937927133-66ef06acdf18?w=500' },
      { id: 202, name: 'บัตรกำนัล Starbucks 100 บาท', detail: 'ใช้แลกเครื่องดื่มและสินค้าแบรนด์สตาร์บัคส์ได้ทุกสาขา', points_required: 1000, stock: 5, is_active: true, image_url: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=500' }
    ]));
  }
  if (!localStorage.getItem(MOCK_LOGS_KEY)) {
    localStorage.setItem(MOCK_LOGS_KEY, JSON.stringify([
      { emp_id: '3672', title: 'เช็คอินประจำวัน', amount: 50, created_at: '2026-07-15T08:30:00Z', source_type: 'CHECKIN', description: 'เช็คอินประจำวันที่ 15/07/2026' },
      { emp_id: '3672', title: 'แลกรางวัล: แก้วน้ำเกล็ดหิมะ', amount: -500, created_at: '2026-07-14T14:20:00Z', source_type: 'REDEEM', description: 'แลกรางวัลแก้วน้ำเกล็ดหิมะ' }
    ]));
  }
  if (!localStorage.getItem(MOCK_DEPTS_KEY)) {
    localStorage.setItem(MOCK_DEPTS_KEY, JSON.stringify([
      { manager_emp_id: 'EMP005', department_id: 'DEPT01', department_name: 'Production', is_active: true },
      { manager_emp_id: 'EMP006', department_id: 'DEPT02', department_name: 'QC', is_active: true }
    ]));
  }
  if (!localStorage.getItem(MOCK_CALENDAR_KEY)) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    localStorage.setItem(MOCK_CALENDAR_KEY, JSON.stringify([
      { id: 1, date: `${y}-${m}-01`, type: 'holiday', label: 'วันหยุดประจำเดือน', color: '#ef4444', is_active: true, created_by: 'ADMIN' },
      { id: 2, date: `${y}-${m}-13`, type: 'event',   label: 'กิจกรรมสัมมนาพนักงาน', color: '#8b5cf6', is_active: true, created_by: 'ADMIN' },
      { id: 3, date: `${y}-${m}-25`, type: 'note',    label: 'กิจกรรมบริจาคโลหิต', color: '#22c55e', is_active: true, created_by: 'ADMIN' },
    ]));
  }
  if (!localStorage.getItem(MOCK_RULES_KEY)) {
    localStorage.setItem(MOCK_RULES_KEY, JSON.stringify([
      { id: 1, category: 'policy', title: 'ระเบียบการเข้างานและการแต่งกาย', body_html: '<p>พนักงานควรลงเวลาตามรอบงาน แต่งกายสุภาพ และติดบัตรพนักงานในพื้นที่บริษัท</p>', color: '#8b5cf6', sort_order: 10, is_active: true, updated_at: new Date().toISOString() },
      { id: 2, category: '5s', title: 'แนวทาง 5ส ประจำพื้นที่', body_html: '<ul><li>สะสางของที่ไม่จำเป็น</li><li>สะดวกต่อการหยิบใช้</li><li>สะอาดและตรวจเช็กทุกวัน</li></ul>', color: '#22c55e', sort_order: 20, is_active: true, updated_at: new Date().toISOString() },
      { id: 3, category: 'iso_gmp', title: 'ISO/GMP จุดสำคัญที่ต้องจำ', body_html: '<p>รักษาความสะอาด บันทึกข้อมูลตามจริง และปฏิบัติตาม WI/SOP ที่ประกาศใช้ล่าสุด</p>', color: '#0ea5e9', sort_order: 30, is_active: true, updated_at: new Date().toISOString() },
      { id: 4, category: 'company', title: 'เกี่ยวกับบริษัท', body_html: '<p>SB Connect เป็นพื้นที่สื่อสารข่าวสาร กิจกรรม คะแนน และบริการภายในสำหรับพนักงาน</p>', color: '#f59e0b', sort_order: 40, is_active: true, updated_at: new Date().toISOString() },
    ]));
  }
  if (!localStorage.getItem(MOCK_WELCOME_KEY)) {
    localStorage.setItem(MOCK_WELCOME_KEY, JSON.stringify({
      title: 'SB CONNECT',
      message: 'ยินดีต้อนรับเข้าสู่ระบบ SB Connect',
      video_url: '',
      is_active: true,
      updated_at: new Date().toISOString(),
    }));
  }
}

function handleMockRpc(fn: string, args: Record<string, any> = {}): any {
  initMockDB();

  const getList = (key: string) => JSON.parse(localStorage.getItem(key) || '[]');
  const saveList = (key: string, data: any) => localStorage.setItem(key, JSON.stringify(data));

  const token = args.p_token || getToken();
  let empId = '3672';
  if (token === 'mock_admin_token') empId = 'ADMIN';

  const users = getList(MOCK_USERS_KEY);
  const currentUserObj = users.find((u: any) => u.emp_id === empId) || users[0];

  switch (fn) {
    case 'get_home_dashboard': {
      const news = getList(MOCK_NEWS_KEY).filter((n: any) => n.is_active);
      const ranking = [...users].sort((a: any, b: any) => b.points - a.points);
      const logs = getList(MOCK_LOGS_KEY).filter((l: any) => l.emp_id === empId);
      const todayKey = localDateKey();
      const checkedInToday = logs.some((l: any) => l.source_type === 'CHECKIN' && ((l.checkin_date || l.created_at?.slice(0, 10)) === todayKey));

      return {
        points: currentUserObj.points,
        checkin_count: logs.filter((l: any) => l.source_type === 'CHECKIN').length,
        checked_in_today: checkedInToday,
        last_checkin: logs.find((l: any) => l.source_type === 'CHECKIN')?.created_at || 'ยังไม่เคยเช็คอิน',
        news_read_count: logs.filter((l: any) => l.source_type === 'READ_NEWS').length,
        mission_done_count: logs.filter((l: any) => l.source_type === 'MISSION').length,
        reward_count: logs.filter((l: any) => l.source_type === 'REDEEM').length,
        latest_news: news.slice(0, 5),
        ranking: ranking.slice(0, 10),
        user: currentUserObj
      };
    }

    case 'get_my_profile':
      return currentUserObj;

    case 'daily_checkin': {
      const logs = getList(MOCK_LOGS_KEY);
      const todayKey = localDateKey();
      const checkedInToday = logs.some((l: any) => l.emp_id === empId && l.source_type === 'CHECKIN' && ((l.checkin_date || l.created_at?.slice(0, 10)) === todayKey));

      if (checkedInToday) {
        throw new Error('คุณเช็คอินวันนี้ไปแล้ว');
      }

      currentUserObj.points += 50;
      saveList(MOCK_USERS_KEY, users);

      logs.unshift({
        emp_id: empId,
        title: 'เช็คอินประจำวัน',
        amount: 50,
        created_at: new Date().toISOString(),
        checkin_date: todayKey,
        stamp: 'PASS',
        source_type: 'CHECKIN',
        description: 'เช็คอินประจำวันสำเร็จ ได้รับ 50 คะแนน'
      });
      saveList(MOCK_LOGS_KEY, logs);

      return { status: 'success', message: 'เช็คอินประจำวันเสร็จสมบูรณ์! คุณได้รับ 50 คะแนน' };
    }

    case 'get_app_welcome':
    case 'admin_get_app_welcome':
      return getList(MOCK_WELCOME_KEY) || {};

    case 'admin_save_app_welcome': {
      const payload = args.p_payload || {};
      const next = {
        title: payload.title || 'SB CONNECT',
        message: payload.message || '',
        video_url: payload.video_url || '',
        is_active: payload.is_active !== false,
        updated_at: new Date().toISOString(),
        updated_by: empId,
      };
      localStorage.setItem(MOCK_WELCOME_KEY, JSON.stringify(next));
      return { status: 'success', config: next };
    }

    case 'list_news': {
      const news = getList(MOCK_NEWS_KEY);
      const logs = getList(MOCK_LOGS_KEY).filter((l: any) => l.emp_id === empId && l.source_type === 'READ_NEWS');
      return news.map((n: any) => ({
        ...n,
        is_read: logs.some((l: any) => String(l.description).includes(`อ่านข่าว ID: ${n.id}`))
      }));
    }

    case 'read_news': {
      const newsId = args.p_news_id;
      const newsList = getList(MOCK_NEWS_KEY);
      const newsItem = newsList.find((n: any) => n.id === Number(newsId));
      if (!newsItem) throw new Error('ไม่พบข่าวสาร');

      const logs = getList(MOCK_LOGS_KEY);
      const alreadyRead = logs.some((l: any) => l.emp_id === empId && l.source_type === 'READ_NEWS' && String(l.description).includes(`อ่านข่าว ID: ${newsId}`));

      if (!alreadyRead) {
        currentUserObj.points += newsItem.points;
        saveList(MOCK_USERS_KEY, users);

        logs.unshift({
          emp_id: empId,
          title: `อ่านข่าว: ${newsItem.topic}`,
          amount: newsItem.points,
          created_at: new Date().toISOString(),
          source_type: 'READ_NEWS',
          description: `อ่านข่าว ID: ${newsId} ได้รับ ${newsItem.points} คะแนน`
        });
        saveList(MOCK_LOGS_KEY, logs);
      }

      return { status: 'success', message: 'บันทึกการอ่านข่าวสำเร็จ!' };
    }

    case 'list_missions': {
      const missions = getList(MOCK_MISSIONS_KEY);
      const logs = getList(MOCK_LOGS_KEY).filter((l: any) => l.emp_id === empId && l.source_type === 'MISSION');
      return missions.map((m: any) => ({
        ...m,
        is_done: logs.some((l: any) => String(l.description).includes(`ส่งภารกิจ ID: ${m.id}`))
      }));
    }

    case 'submit_mission': {
      const missionId = args.p_mission_id;
      const missionsList = getList(MOCK_MISSIONS_KEY);
      const missionItem = missionsList.find((m: any) => m.id === Number(missionId));
      if (!missionItem) throw new Error('ไม่พบภารกิจ');

      const logs = getList(MOCK_LOGS_KEY);
      const alreadyDone = logs.some((l: any) => l.emp_id === empId && l.source_type === 'MISSION' && String(l.description).includes(`ส่งภารกิจ ID: ${missionId}`));

      if (alreadyDone) throw new Error('คุณทำภารกิจนี้ไปแล้ว');

      currentUserObj.points += missionItem.points;
      saveList(MOCK_USERS_KEY, users);

      logs.unshift({
        emp_id: empId,
        title: `ทำภารกิจ: ${missionItem.title}`,
        amount: missionItem.points,
        created_at: new Date().toISOString(),
        source_type: 'MISSION',
        description: `ส่งภารกิจ ID: ${missionId} ได้รับ ${missionItem.points} คะแนน`
      });
      saveList(MOCK_LOGS_KEY, logs);

      return { status: 'success', message: 'ส่งภารกิจเสร็จเรียบร้อย! ได้รับคะแนนสะสม' };
    }

    case 'list_rewards':
      return getList(MOCK_REWARDS_KEY);

    case 'redeem_reward': {
      const rewardId = args.p_reward_id;
      const rewardsList = getList(MOCK_REWARDS_KEY);
      const rewardItem = rewardsList.find((r: any) => r.id === Number(rewardId));
      if (!rewardItem) throw new Error('ไม่พบของรางวัล');
      if (rewardItem.stock !== null && rewardItem.stock <= 0) throw new Error('ของรางวัลหมดสต็อก');
      if (currentUserObj.points < rewardItem.points_required) throw new Error('แต้มสะสมของคุณไม่เพียงพอ');

      currentUserObj.points -= rewardItem.points_required;
      saveList(MOCK_USERS_KEY, users);

      if (rewardItem.stock !== null) {
        rewardItem.stock -= 1;
        saveList(MOCK_REWARDS_KEY, rewardsList);
      }

      const logs = getList(MOCK_LOGS_KEY);
      logs.unshift({
        emp_id: empId,
        title: `แลกรางวัล: ${rewardItem.name}`,
        amount: -rewardItem.points_required,
        created_at: new Date().toISOString(),
        source_type: 'REDEEM',
        description: `แลกของรางวัล ID: ${rewardId} หัก ${rewardItem.points_required} คะแนน`
      });
      saveList(MOCK_LOGS_KEY, logs);

      return { status: 'success', message: 'แลกของรางวัลสำเร็จ!' };
    }

    case 'list_ranking':
      return [...users].sort((a: any, b: any) => b.points - a.points);

    case 'list_notifications':
      return [
        { id: 301, title: 'ยินดีต้อนรับสู่ระบบ SB Connect ใหม่', detail: 'แอปพลิเคชันเวอร์ชันใหม่ล่าสุดของเราพร้อมใช้งานแล้ว ขอให้สนุกกับการสะสมแต้ม!', is_read: false, created_at: new Date(Date.now() - 3600000).toISOString() }
      ];

    case 'mark_notification_read':
      return { status: 'success' };

    case 'list_my_overall_logs':
      return getList(MOCK_LOGS_KEY).filter((l: any) => l.emp_id === empId);

    case 'get_admin_dashboard': {
      return {
        total_users: users.length,
        total_news: getList(MOCK_NEWS_KEY).length,
        total_missions: getList(MOCK_MISSIONS_KEY).length,
        total_rewards: getList(MOCK_REWARDS_KEY).length,
        users: users.slice(0, 5),
        logs: getList(MOCK_LOGS_KEY).slice(0, 10),
        ranking: [...users].sort((a: any, b: any) => b.points - a.points).slice(0, 10)
      };
    }

    case 'admin_list_users':
      return users;

    case 'admin_list_news':
      return getList(MOCK_NEWS_KEY);

    case 'admin_list_missions':
      return getList(MOCK_MISSIONS_KEY);

    case 'admin_list_rewards':
      return getList(MOCK_REWARDS_KEY);

    case 'admin_list_ledger':
      return getList(MOCK_LOGS_KEY);

    case 'admin_list_special_point_logs':
      return getList(MOCK_LOGS_KEY).filter((l: any) => l.source_type === 'SPECIAL_POINTS');

    case 'admin_list_overall_activity':
      return getList(MOCK_LOGS_KEY).map((l: any) => ({
        created_at: l.created_at,
        action_group: l.source_type === 'SPECIAL_POINTS' ? 'points' : 'activity',
        action: l.source_type || 'SYSTEM',
        actor_emp_id: l.admin_emp_id || l.emp_id || '',
        target_emp_id: l.target_emp_id || l.emp_id || '',
        description: l.description || l.title || '',
      }));

    case 'admin_list_manager_depts':
      return getList(MOCK_DEPTS_KEY);

    case 'list_calendar_events':
      return getList(MOCK_CALENDAR_KEY).filter((e: any) => e.is_active);

    case 'admin_list_calendar_events':
      return getList(MOCK_CALENDAR_KEY);

    case 'admin_upsert_calendar_event': {
      const payload = args.p_payload;
      const list = getList(MOCK_CALENDAR_KEY);
      const nextPayload = { ...payload, color: payload.color || (payload.type === 'holiday' ? '#ef4444' : payload.type === 'note' ? '#22c55e' : '#8b5cf6') };
      if (payload.id) {
        const idx = list.findIndex((x: any) => x.id === payload.id);
        if (idx >= 0) list[idx] = { ...list[idx], ...nextPayload };
      } else {
        const newId = list.length > 0 ? Math.max(...list.map((x: any) => x.id)) + 1 : 1;
        list.push({ ...nextPayload, id: newId, created_by: empId, is_active: payload.is_active !== false });
      }
      saveList(MOCK_CALENDAR_KEY, list);
      return { status: 'success' };
    }

    case 'admin_delete_calendar_event': {
      const id = Number(args.p_id);
      let list = getList(MOCK_CALENDAR_KEY);
      list = list.filter((x: any) => x.id !== id);
      saveList(MOCK_CALENDAR_KEY, list);
      return { status: 'success' };
    }

    case 'list_rule_board':
      return getList(MOCK_RULES_KEY)
        .filter((x: any) => x.is_active !== false)
        .sort((a: any, b: any) => Number(a.sort_order || 0) - Number(b.sort_order || 0));

    case 'admin_list_rule_board':
      return getList(MOCK_RULES_KEY)
        .sort((a: any, b: any) => Number(a.sort_order || 0) - Number(b.sort_order || 0));

    case 'admin_upsert_rule_board': {
      const payload = args.p_payload;
      const list = getList(MOCK_RULES_KEY);
      const nextPayload = { ...payload, updated_at: new Date().toISOString(), is_active: payload.is_active !== false };
      if (payload.id) {
        const idx = list.findIndex((x: any) => x.id === payload.id);
        if (idx >= 0) list[idx] = { ...list[idx], ...nextPayload };
      } else {
        const newId = list.length > 0 ? Math.max(...list.map((x: any) => x.id)) + 1 : 1;
        list.push({ ...nextPayload, id: newId, created_at: new Date().toISOString() });
      }
      saveList(MOCK_RULES_KEY, list);
      return { status: 'success' };
    }

    case 'admin_delete_rule_board': {
      const id = Number(args.p_id);
      const list = getList(MOCK_RULES_KEY).filter((x: any) => x.id !== id);
      saveList(MOCK_RULES_KEY, list);
      return { status: 'success' };
    }

    case 'admin_upsert_user': {
      const payload = args.p_payload;
      const targetEmp = payload.emp_id;
      const index = users.findIndex((u: any) => u.emp_id === targetEmp);
      if (index >= 0) {
        // Protect points if user is modifying points directly and is not authorized or if we want it read-only
        // As requested: "ยกเว้นแก้คะแนน" (Except editing points) - Admin can update full_name, dept, role, status but points should remain as they were, unless creating a new user where it defaults to 0 or initial value.
        const existingUser = users[index];
        users[index] = { ...existingUser, ...payload, points: existingUser.points }; // Keep points read-only
      } else {
        users.push({ ...payload, points: 0, status: payload.status || 'ACTIVE' });
      }
      saveList(MOCK_USERS_KEY, users);
      return { status: 'success' };
    }

    case 'admin_delete_user': {
      const targetEmp = args.p_emp_id;
      const filtered = users.filter((u: any) => u.emp_id !== targetEmp);
      saveList(MOCK_USERS_KEY, filtered);
      return { status: 'success' };
    }

    case 'admin_upsert_news': {
      const payload = args.p_payload;
      const list = getList(MOCK_NEWS_KEY);
      if (payload.id) {
        const idx = list.findIndex((x: any) => x.id === payload.id);
        if (idx >= 0) list[idx] = { ...list[idx], ...payload };
      } else {
        const newId = list.length > 0 ? Math.max(...list.map((x: any) => x.id)) + 1 : 1;
        list.push({ ...payload, id: newId, created_at: new Date().toISOString() });
      }
      saveList(MOCK_NEWS_KEY, list);
      return { status: 'success' };
    }

    case 'admin_upsert_mission': {
      const payload = args.p_payload;
      const list = getList(MOCK_MISSIONS_KEY);
      if (payload.id) {
        const idx = list.findIndex((x: any) => x.id === payload.id);
        if (idx >= 0) list[idx] = { ...list[idx], ...payload };
      } else {
        const newId = list.length > 0 ? Math.max(...list.map((x: any) => x.id)) + 1 : 101;
        list.push({ ...payload, id: newId, created_at: new Date().toISOString() });
      }
      saveList(MOCK_MISSIONS_KEY, list);
      return { status: 'success' };
    }

    case 'admin_upsert_reward': {
      const payload = args.p_payload;
      const list = getList(MOCK_REWARDS_KEY);
      if (payload.id) {
        const idx = list.findIndex((x: any) => x.id === payload.id);
        if (idx >= 0) list[idx] = { ...list[idx], ...payload };
      } else {
        const newId = list.length > 0 ? Math.max(...list.map((x: any) => x.id)) + 1 : 201;
        list.push({ ...payload, id: newId });
      }
      saveList(MOCK_REWARDS_KEY, list);
      return { status: 'success' };
    }

    case 'admin_delete_news': {
      const id = Number(args.p_id);
      let list = getList(MOCK_NEWS_KEY);
      list = list.filter((x: any) => x.id !== id);
      saveList(MOCK_NEWS_KEY, list);
      return { status: 'success' };
    }

    case 'admin_delete_mission': {
      const id = Number(args.p_id);
      let list = getList(MOCK_MISSIONS_KEY);
      list = list.filter((x: any) => x.id !== id);
      saveList(MOCK_MISSIONS_KEY, list);
      return { status: 'success' };
    }

    case 'admin_delete_reward': {
      const id = Number(args.p_id);
      let list = getList(MOCK_REWARDS_KEY);
      list = list.filter((x: any) => x.id !== id);
      saveList(MOCK_REWARDS_KEY, list);
      return { status: 'success' };
    }

    case 'admin_upsert_manager_dept': {
      const payload = args.p_payload;
      const list = getList(MOCK_DEPTS_KEY);
      const idx = list.findIndex((x: any) => x.manager_emp_id === payload.manager_emp_id && x.department_id === payload.department_id);
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...payload };
      } else {
        list.push(payload);
      }
      saveList(MOCK_DEPTS_KEY, list);
      return { status: 'success' };
    }

    case 'admin_save_manager_depts_batch': {
      const mappings = args.p_mappings as any[];
      saveList(MOCK_DEPTS_KEY, mappings);
      return { status: 'success' };
    }

    case 'admin_add_special_points': {
      const targetEmp = String(args.p_target_emp_id || '');
      const points = Number(args.p_points || 0);
      const targetIdx = users.findIndex((u: any) => u.emp_id === targetEmp);
      if (targetIdx < 0) throw new Error('TARGET_EMP_ID_NOT_FOUND');
      const before = Number(users[targetIdx].points || 0);
      users[targetIdx] = { ...users[targetIdx], points: before + points };
      saveList(MOCK_USERS_KEY, users);
      const logs = getList(MOCK_LOGS_KEY);
      const txId = `SP-${Date.now()}`;
      logs.unshift({
        id: txId,
        tx_id: txId,
        emp_id: targetEmp,
        target_emp_id: targetEmp,
        admin_emp_id: args.p_confirm_admin_emp_id,
        hr_emp_id: args.p_hr_emp_id,
        title: 'Special Points',
        amount: points,
        points,
        balance_after: before + points,
        created_at: new Date().toISOString(),
        source_type: 'SPECIAL_POINTS',
        description: args.p_reason || 'Special activity points'
      });
      saveList(MOCK_LOGS_KEY, logs);
      return { status: 'success', tx_id: txId, balance_after: before + points };
    }

    case 'admin_reset_password': {
      const targetEmp = args.p_emp_id;
      const tempPass = args.p_temp_password;
      const logs = getList(MOCK_LOGS_KEY);
      logs.unshift({
        emp_id: empId,
        title: 'รีเซ็ตรหัสผ่านพนักงาน',
        amount: 0,
        created_at: new Date().toISOString(),
        source_type: 'SYSTEM',
        description: `แอดมินรีเซ็ตรหัสผ่านให้กับพนักงาน ${targetEmp} เป็นรหัสชั่วคราว: ${tempPass}`
      });
      saveList(MOCK_LOGS_KEY, logs);
      return { status: 'success' };
    }

    default:
      return { status: 'success' };
  }
}

export async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const cfg = getConfig();

  // Mode check: use mock RPC if offline or placeholder
  const isPlaceholder = !isSupabaseConfigured();

  if (isPlaceholder) {
    try {
      return handleMockRpc(fn, args) as T;
    } catch (err: any) {
      throw err;
    }
  }

  try {
    const url = `${cfg.supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/${fn}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: cfg.supabaseAnonKey,
        Authorization: `Bearer ${cfg.supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args || {}),
    });

    const rawText = await res.text();
    let data: any = null;

    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch {
      data = rawText;
    }

    if (!res.ok) {
      const obj = data as { message?: string; error?: string; details?: string };
      throw new Error(obj?.message || obj?.error || obj?.details || rawText || `RPC error: ${fn}`);
    }

    if (data?.status === 'error') {
      throw new Error(data.message || 'RPC_ERROR');
    }

    return data as T;
  } catch (err) {
    if (isPlaceholder) {
      console.warn(`Mock RPC ${fn} failed`, err);
      return handleMockRpc(fn, args) as T;
    }
    throw err;
  }
}

export async function logout() {
  const token = getToken();
  try {
    if (token) {
      await rpc('logout_public_session', { p_token: token });
    }
  } catch (err) {
    console.warn(err);
  }
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  clearTempPassword();
  window.location.hash = '';
  window.location.reload();
}

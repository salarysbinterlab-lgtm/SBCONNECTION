import { FormEvent, useEffect, useState } from 'react';
import { LockKeyhole, LogIn, ShieldCheck, UserRound, X } from 'lucide-react';
import { rpc, setSession, getTempPassword, getToken, getCurrentUser, isSupabaseConfigured } from './helpers/api';
import UserDashboard from './components/UserDashboard';
import AdminDashboard from './components/AdminDashboard';

type ToonImage = {
  src: string;
  bg: string;
  panel: string;
};

type LoginResult = {
  status?: string;
  token?: string;
  user?: {
    emp_id?: string;
    full_name?: string;
    role?: string;
    [key: string]: any;
  };
  mustChangePassword?: boolean;
  message?: string;
};

const BASE = import.meta.env.BASE_URL || './';
const COMPANY_LOGO_URL = 'https://lh3.googleusercontent.com/d/1SqzBIsXwfMzd91mgBepq6O2-nbGaZR4s';

const IMAGES: ToonImage[] = [
  { src: `${BASE}image/index_1.png`, bg: '#F4845F', panel: '#F79B7F' },
  { src: `${BASE}image/index_2.png`, bg: '#6BBF7A', panel: '#85CC92' },
  { src: `${BASE}image/index_3.png`, bg: '#6EB5FF', panel: '#8DC4FF' },
  { src: `${BASE}image/index_4.png`, bg: '#E882B4', panel: '#ED9DC4' },
];

function isPasswordValid(value: string) {
  return /^[A-Za-z0-9]{8}$/.test(value);
}

function roleForIndex(index: number, activeIndex: number) {
  if (index === activeIndex) return 'center';
  if (index === (activeIndex + 3) % 4) return 'left';
  if (index === (activeIndex + 1) % 4) return 'right';
  return 'back';
}

function getItemStyle(role: string, isMobile: boolean): React.CSSProperties {
  const base: React.CSSProperties = {
    position: 'absolute',
    aspectRatio: '0.6 / 1',
    transition:
      'transform 750ms cubic-bezier(0.4,0,0.2,1), filter 750ms cubic-bezier(0.4,0,0.2,1), opacity 750ms cubic-bezier(0.4,0,0.2,1), left 750ms cubic-bezier(0.4,0,0.2,1), height 750ms cubic-bezier(0.4,0,0.2,1), bottom 750ms cubic-bezier(0.4,0,0.2,1)',
    willChange: 'transform, filter, opacity',
  };

  if (role === 'center') {
    return {
      ...base,
      transform: `translateX(-50%) scale(${isMobile ? 1.25 : 1.65})`,
      filter: 'drop-shadow(0 34px 42px rgba(0,0,0,.22))',
      opacity: 1,
      zIndex: 20,
      left: '50%',
      height: isMobile ? '58%' : '88%',
      bottom: isMobile ? '24%' : '1%',
    };
  }

  if (role === 'left') {
    return {
      ...base,
      transform: 'translateX(-50%) scale(1)',
      filter: 'blur(2px) drop-shadow(0 18px 24px rgba(0,0,0,.18))',
      opacity: 0.82,
      zIndex: 10,
      left: isMobile ? '19%' : '30%',
      height: isMobile ? '16%' : '27%',
      bottom: isMobile ? '31%' : '12%',
    };
  }

  if (role === 'right') {
    return {
      ...base,
      transform: 'translateX(-50%) scale(1)',
      filter: 'blur(2px) drop-shadow(0 18px 24px rgba(0,0,0,.18))',
      opacity: 0.82,
      zIndex: 10,
      left: isMobile ? '81%' : '70%',
      height: isMobile ? '16%' : '27%',
      bottom: isMobile ? '31%' : '12%',
    };
  }

  return {
    ...base,
    transform: 'translateX(-50%) scale(1)',
    filter: 'blur(4px) drop-shadow(0 18px 24px rgba(0,0,0,.18))',
    opacity: 0.72,
    zIndex: 5,
    left: '50%',
    height: isMobile ? '13%' : '21%',
    bottom: isMobile ? '31%' : '12%',
  };
}

export default function App() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  
  // Login Session & Views
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // UI Controls
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [empId, setEmpId] = useState('');
  const [password, setPassword] = useState('');
  const [isLoginBusy, setIsLoginBusy] = useState(false);
  
  // First-time Password Setup State
  const [showFirstLogin, setShowFirstLogin] = useState(false);
  const [firstLoginEmpId, setFirstLoginEmpId] = useState('');
  const [newPass1, setNewPass1] = useState('');
  const [newPass2, setNewPass2] = useState('');

  const activeImage = IMAGES[activeIndex];

  // Preload Images
  useEffect(() => {
    IMAGES.forEach((item) => {
      const img = new Image();
      img.src = item.src;
    });
  }, []);

  // Window Resize
  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 640);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Character slide timer
  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % 4);
    }, 3000);
    return () => window.clearInterval(timer);
  }, []);

  // Session Check on Load
  useEffect(() => {
    const token = getToken();
    const user = getCurrentUser();
    if (token && user?.emp_id) {
      setIsLoggedIn(true);
      setCurrentUser(user);
    }
  }, []);

  // Handle Login submission
  async function handleLogin(event: FormEvent) {
    event.preventDefault();

    if (!empId.trim() || !password) {
      showError(new Error('กรุณากรอกรหัสพนักงานและรหัสผ่าน'));
      return;
    }

    setIsLoginBusy(true);

    try {
      const userVal = empId.trim();
      const passVal = password;

      const allowMockLogin = !isSupabaseConfigured();

      // Offline mock account checks
      if (allowMockLogin && userVal.toLowerCase() === 'admin' && passVal === 'admin123') {
        const adminUser = {
          emp_id: 'ADMIN',
          full_name: 'IT Administrator',
          role: 'admin',
          status: 'ACTIVE',
          department: 'IT',
          points: 9999
        };
        setSession('mock_admin_token', adminUser, passVal);
        setCurrentUser(adminUser);
        setIsLoggedIn(true);
        setShowLoginModal(false);
        return;
      }

      if (allowMockLogin && userVal === '3672') {
        if (passVal === '1234') {
          // Force password change!
          const tempUser = {
            emp_id: '3672',
            full_name: 'คุณพนักงานทดสอบ (Test Employee)',
            role: 'user',
            status: 'ACTIVE',
            department: 'Production',
            points: 1250
          };
          setSession('mock_temp_token', tempUser, passVal);
          setFirstLoginEmpId('3672');
          setShowFirstLogin(true);
          setShowLoginModal(false);
          return;
        } else {
          // Log in with non-1234 password directly
          const testUser = {
            emp_id: '3672',
            full_name: 'คุณพนักงานทดสอบ (Test Employee)',
            role: 'user',
            status: 'ACTIVE',
            department: 'Production',
            points: 1250
          };
          setSession('mock_user_token', testUser, passVal);
          setCurrentUser(testUser);
          setIsLoggedIn(true);
          setShowLoginModal(false);
          return;
        }
      }

      const res = await rpc<LoginResult>('login_with_emp_password', {
        p_emp_id: userVal,
        p_password: passVal,
        p_user_agent: navigator.userAgent,
      });

      if (res.status === 'success' && res.token && res.user) {
        setSession(res.token, res.user, passVal);
        setCurrentUser(res.user);
        setIsLoggedIn(true);
        setShowLoginModal(false);
        return;
      }

      if (res.status === 'first_setup_required' || res.mustChangePassword) {
        if (res.token && res.user) {
          setSession(res.token, res.user, passVal);
          setCurrentUser(res.user);
        }
        setFirstLoginEmpId(userVal);
        setShowFirstLogin(true);
        setShowLoginModal(false);
        return;
      }

      throw new Error(res.message || 'เข้าสู่ระบบไม่สำเร็จ');
    } catch (error) {
      showError(error);
    } finally {
      setIsLoginBusy(false);
    }
  }

  // Handle First Time Password Change
  async function submitFirstPasswordChange() {
    if (!isPasswordValid(newPass1)) {
      showError(new Error('รหัสใหม่ต้องเป็น A-Z, a-z, 0-9 จำนวน 8 ตัวพอดี'));
      return;
    }

    if (newPass1 !== newPass2) {
      showError(new Error('รหัสผ่านใหม่ไม่ตรงกัน'));
      return;
    }

    if (newPass1 === '1234') {
      showError(new Error('ห้ามใช้ 1234 ซ้ำ'));
      return;
    }

    try {
      const targetEmp = firstLoginEmpId || empId.trim();

      // Offline mock account change password bypass
      if (!isSupabaseConfigured() && targetEmp === '3672') {
        const testUser = {
          emp_id: '3672',
          full_name: 'คุณพนักงานทดสอบ (Test Employee)',
          role: 'user',
          status: 'ACTIVE',
          department: 'Production',
          points: 1250
        };
        setSession('mock_user_token', testUser, newPass1);
        setCurrentUser(testUser);
        setIsLoggedIn(true);
        setShowFirstLogin(false);

        const swal = (window as any).Swal;
        if (swal) {
          swal.fire({
            icon: 'success',
            title: 'สำเร็จ',
            text: 'ตั้งรหัสผ่านใหม่เสร็จสมบูรณ์!',
            timer: 2000,
            showConfirmButton: false,
            background: '#0f172a',
            color: '#fff'
          });
        }
        return;
      }

      const token = getToken();
      const currentPassword = getTempPassword() || password;

      if (token) {
        await rpc('change_my_password', {
          p_token: token,
          p_current_password: currentPassword,
          p_new_password: newPass1,
          p_confirm_password: newPass2,
        });

        const user = getCurrentUser();
        setIsLoggedIn(true);
        setShowFirstLogin(false);
        return;
      }

      // If token not yet present, perform setup first
      await rpc('setup_first_password_no_credential', {
        p_emp_id: targetEmp,
        p_new_password: newPass1,
        p_confirm_password: newPass2,
      });

      const res = await rpc<LoginResult>('login_with_emp_password', {
        p_emp_id: targetEmp,
        p_password: newPass1,
        p_user_agent: navigator.userAgent,
      });

      if (!res.token || !res.user) throw new Error('ไม่พบ session token หลังตั้งรหัส');

      setSession(res.token, res.user, newPass1);
      setCurrentUser(res.user);
      setIsLoggedIn(true);
      setShowFirstLogin(false);
    } catch (error) {
      showError(error);
    }
  }

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
  };

  // Helper alerts
  function showError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error || 'เกิดข้อผิดพลาด');
    const swal = (window as any).Swal;
    if (swal) {
      swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: message,
        background: '#0f172a',
        color: '#fff'
      });
      return;
    }
    alert(message);
  }

  // Render Logged-in Dashboards based on User Roles
  if (isLoggedIn && currentUser) {
    const role = String(currentUser.role || '').toLowerCase();
    if (['admin', 'admin_it', 'dev'].includes(role)) {
      return <AdminDashboard user={currentUser} onLogout={handleLogout} />;
    } else {
      return <UserDashboard user={currentUser} onLogout={handleLogout} />;
    }
  }

  // Render Premium Landing page + Pop-up Login
  return (
    <main
      className="relative w-full h-screen overflow-hidden text-white flex flex-col justify-between"
      style={{
        backgroundColor: activeImage.bg,
        transition: 'background-color 750ms cubic-bezier(0.4,0,0.2,1)',
        fontFamily: "'Prompt', 'Inter', sans-serif",
      }}
    >
      {/* Cartoon Grain / Overlay effects */}
      <div className="toon-grain absolute inset-0 z-[49] pointer-events-none" />

      {/* Anton Bold Watermark Header */}
      <div
        className="absolute inset-x-0 flex items-center justify-center pointer-events-none select-none"
        style={{ zIndex: 2, top: '18%' }}
      >
        <div
          className="sb-hero-title font-display whitespace-nowrap text-white"
          style={{
            fontFamily: "'Anton', sans-serif",
            fontSize: 'clamp(54px, 17vw, 230px)',
            fontWeight: 900,
            opacity: 0.98,
            lineHeight: 1,
            letterSpacing: 0,
          }}
        >
          SB-Connect
        </div>
      </div>

      {/* Characters Carousel */}
      <div className="absolute inset-0 z-[3]">
        {IMAGES.map((item, index) => {
          const role = roleForIndex(index, activeIndex);
          return (
            <div key={item.src} style={getItemStyle(role, isMobile)}>
              <img
                src={item.src}
                alt={`CAREBEAU character ${index + 1}`}
                draggable={false}
                className="h-full w-full object-contain object-bottom select-none"
              />
            </div>
          );
        })}
      </div>

      {/* Top Brand Bar */}
      <header className="w-full p-6 flex justify-between items-center z-[48] relative">
        <div className="sb-landing-logo-shell">
          <img
            src={COMPANY_LOGO_URL}
            alt="SB Connect"
            className="sb-landing-logo"
            onError={(event) => {
              event.currentTarget.style.display = 'none';
            }}
          />
        </div>
      </header>

      {/* Center CTA to show Pop-up Login */}
      <div className="w-full max-w-sm mx-auto p-6 text-center z-[48] flex flex-col items-center justify-center flex-1">
        <div className="bg-slate-950/40 backdrop-blur-md border border-white/10 rounded-3xl p-6 shadow-2xl space-y-4 max-w-[320px] sm:max-w-none">
          <h2 className="text-lg font-black tracking-tight text-white leading-tight">
            เชื่อมต่อเพื่อสะสมแต้มพนักงาน
          </h2>
          <p className="text-xs text-white/75 font-medium leading-relaxed">
            เข้าร่วมกิจกรรม เช็คอินรับคะแนน และแลกของรางวัลพิเศษได้ทันทีที่นี่
          </p>
          <button
            onClick={() => setShowLoginModal(true)}
            className="w-full flex items-center justify-center gap-2 py-4 bg-white hover:bg-white/95 text-slate-950 rounded-2xl font-black text-sm active:scale-95 shadow-xl transition-all duration-300"
          >
            <LogIn size={18} />
            เข้าสู่ระบบ (Login to Connect)
          </button>
          <p className="text-[10px] text-white/50 font-bold leading-normal">
            รหัสผ่านเริ่มต้นคือ 1234 สำหรับการเปิดใช้งานครั้งแรก
          </p>
        </div>
      </div>

      {/* Bottom info footer */}
      <footer className="w-full p-6 text-center z-[48] text-[10px] text-white/40 font-extrabold tracking-widest uppercase">
        © 2026 SB INTERLAB CO., LTD. ALL RIGHTS RESERVED.
      </footer>

      {/* POPUP LOGIN MODAL FORM */}
      {showLoginModal && (
        <div className="fixed inset-0 z-[50] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md animate-fade-in">
          <form
            onSubmit={handleLogin}
            className="carebeau-login-3d w-full max-w-sm rounded-[32px] border border-white/20 px-6 py-7 sm:p-8 text-white relative animate-scale-in"
            style={{
              background: `linear-gradient(145deg, ${activeImage.panel}f0 0%, rgba(255,255,255,0.30) 42%, ${activeImage.bg}e8 100%)`,
              boxShadow: `0 34px 84px rgba(0,0,0,0.26), 0 16px 0 rgba(0,0,0,0.16), inset 0 2px 5px rgba(255,255,255,0.66), inset 0 -20px 45px rgba(0,0,0,0.12)`,
            }}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setShowLoginModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-black/10 hover:bg-black/20 text-white/90 transition"
            >
              <X size={16} />
            </button>

            <div className="mb-6 flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-black shadow-[0_12px_0_rgba(0,0,0,0.16),0_22px_45px_rgba(0,0,0,0.22)]">
                <ShieldCheck size={22} />
              </div>
              <div>
                <h3 className="text-lg font-black leading-none text-white">SBinterlab</h3>
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/80 mt-1">Secure Connection</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.18em] text-white/90">
                  รหัสพนักงาน (Employee ID)
                </label>
                <div className="flex h-12 items-center gap-3 rounded-2xl border border-white/60 bg-white/95 px-3 text-slate-900 shadow-inner">
                  <UserRound size={18} className="shrink-0 text-slate-500" />
                  <input
                    value={empId}
                    onChange={(event) => setEmpId(event.target.value)}
                    className="h-10 w-full bg-transparent text-xs font-bold outline-none placeholder:text-slate-400"
                    placeholder="ระบุรหัสพนักงาน"
                    autoComplete="username"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.18em] text-white/90">
                  รหัสผ่าน (Password)
                </label>
                <div className="flex h-12 items-center gap-3 rounded-2xl border border-white/60 bg-white/95 px-3 text-slate-900 shadow-inner">
                  <LockKeyhole size={18} className="shrink-0 text-slate-500" />
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-10 w-full bg-transparent text-xs font-bold outline-none placeholder:text-slate-400"
                    placeholder="ระบุรหัสผ่าน"
                    type="password"
                    autoComplete="current-password"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoginBusy}
                className="w-full flex h-13 items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 mt-2 text-xs font-black text-black shadow-[0_8px_0_rgba(0,0,0,0.18),0_18px_36px_rgba(0,0,0,0.22)] hover:-translate-y-0.5 hover:scale-[1.01] active:translate-y-0.5 active:shadow-md transition-all duration-300 disabled:opacity-75 disabled:cursor-wait"
              >
                <LogIn size={15} />
                {isLoginBusy ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 px-4 py-2.5 text-center text-[10px] font-bold leading-normal text-white/80 shadow-inner">
              * สมาชิกใหม่กรุณาใช้รหัสเริ่มต้น <span className="text-emerald-300 font-black">1234</span>
            </div>
          </form>
        </div>
      )}

      {/* FIRST LOGIN PASSWORD CHANGE POPUP */}
      {showFirstLogin && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-sm rounded-[32px] bg-slate-900 border border-slate-800 p-6 text-slate-200 shadow-2xl relative animate-scale-in">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <LockKeyhole size={22} />
            </div>
            <h3 className="text-base font-black text-center text-white">เปลี่ยนรหัสผ่านครั้งแรก</h3>
            <p className="text-xs text-center text-slate-400 font-bold mt-1 mb-5">
              บัญชีพนักงาน {firstLoginEmpId || empId} จำเป็นต้องตั้งรหัสผ่านใหม่ก่อนเข้าใช้งาน
            </p>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-emerald-400">รหัสผ่านใหม่ (NEW PASSWORD)</label>
                <input
                  value={newPass1}
                  onChange={(event) =>
                    setNewPass1(event.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 8))
                  }
                  type="password"
                  maxLength={8}
                  className="h-12 w-full rounded-2xl border border-slate-850 bg-slate-950 px-4 text-xs font-black outline-none focus:border-emerald-500/50"
                  placeholder="ความยาว 8 ตัว: ตัวอักษร/ตัวเลข"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-emerald-400">ยืนยันรหัสผ่านใหม่ (CONFIRM PASSWORD)</label>
                <input
                  value={newPass2}
                  onChange={(event) =>
                    setNewPass2(event.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 8))
                  }
                  type="password"
                  maxLength={8}
                  className="h-12 w-full rounded-2xl border border-slate-850 bg-slate-950 px-4 text-xs font-black outline-none focus:border-emerald-500/50"
                  placeholder="กรอกรหัสใหม่อีกครั้งเพื่อความถูกต้อง"
                />
              </div>

              <div className="rounded-2xl bg-emerald-500/5 border border-emerald-500/10 p-3.5 text-[10px] font-bold leading-normal text-emerald-400/90 shadow-inner">
                * เงื่อนไข: รหัสต้องมีความยาว 8 ตัวพอดี ประกอบด้วย A-Z, a-z หรือ 0-9 เท่านั้น (ห้ามใช้อักขระพิเศษและห้ามใช้ 1234 ซ้ำ)
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFirstLogin(false)}
                  className="flex-1 h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 font-black text-xs text-slate-300 transition active:scale-95"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={submitFirstPasswordChange}
                  className="flex-1 h-12 rounded-2xl bg-emerald-500 hover:bg-emerald-400 font-black text-xs text-slate-950 transition active:scale-95 shadow-lg shadow-emerald-500/10"
                >
                  บันทึกรหัสใหม่
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

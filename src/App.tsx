import { FormEvent, Suspense, lazy, useEffect, useState } from 'react';
import { LockKeyhole, LogIn, UserRound, X } from 'lucide-react';
import { rpc, setSession, clearSession, getToken, getCurrentUser, isSupabaseConfigured, isMockMode, requestPasswordReset } from './helpers/api';
import AppLoader from './components/AppLoader';

// โหลดหน้าจอหลักแบบ lazy: ผู้ใช้ทั่วไปไม่ต้องดาวน์โหลดโค้ดฝั่งแอดมิน และกลับกัน
const UserDashboard = lazy(() => import('./components/UserDashboard'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));

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
const INTRO_VIDEO_URL = `${BASE}icons/SB_CARE_Logo_Animation_FHD.mp4`;
const INTRO_GIF_URL = `${BASE}icons/SB_CARE_Logo_Animation_Preview.gif`;

const IMAGES: ToonImage[] = [
  { src: `${BASE}image/index_1.png`, bg: '#F4845F', panel: '#F79B7F' },
  { src: `${BASE}image/index_2.png`, bg: '#6BBF7A', panel: '#85CC92' },
  { src: `${BASE}image/index_3.png`, bg: '#6EB5FF', panel: '#8DC4FF' },
  { src: `${BASE}image/index_4.png`, bg: '#E882B4', panel: '#ED9DC4' },
];

// ต้องตรงกับ public.sb_is_valid_password() ใน sql/17_SECURITY_HARDENING_AND_FIXES.sql
const PASSWORD_RULE_TEXT =
  'รหัสผ่านต้องยาว 8-72 ตัว มีทั้งตัวอักษรและตัวเลข ใช้อักขระพิเศษได้ ห้ามเว้นวรรคและห้ามภาษาไทย';

// ขั้นตอนหน้าลืมรหัสผ่าน
//   request = กรอกรหัสพนักงานเพื่อขอรหัสยืนยัน
//   sent    = ส่งคำขอให้ IT แล้ว รอ IT ติดต่อกลับมาบอกรหัส
//   otp     = กรอกรหัสยืนยัน 6 หลัก มีเวลา 3 นาที
// ผ่าน otp แล้วจะไปหน้าตั้งรหัสใหม่ ซึ่ง "ไม่จับเวลา" ตามที่ต้องการ
type ForgotStep = 'request' | 'sent' | 'otp';

// เวลาให้กรอกรหัสยืนยันที่หน้าเว็บ 3 นาที
const OTP_WINDOW_SECONDS = 180;

// รหัสยืนยันที่ sb_generate_reset_code() ออกให้ ใช้ชุด ABCDEFGHJKMNPQRSTUVWXYZ23456789
// ตัด I O L 0 1 ออก เพราะอ่านผิดง่ายเวลา IT บอกทางโทรศัพท์
const RESET_CODE_LENGTH = 6;

function formatCountdown(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  const mm = Math.floor(safe / 60);
  const ss = safe % 60;
  return `${mm}:${String(ss).padStart(2, '0')}`;
}

function isPasswordValid(value: string) {
  return (
    typeof value === 'string' &&
    value.length >= 8 &&
    value.length <= 72 &&
    value === value.trim() &&
    /^[\x21-\x7E]+$/.test(value) &&
    /[A-Za-z]/.test(value) &&
    /[0-9]/.test(value)
  );
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
  const [showIntro, setShowIntro] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches
  );
  const [useIntroGif, setUseIntroGif] = useState(false);
  
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
  // ลืมรหัสผ่าน: request -> sent -> otp -> (ไปหน้าตั้งรหัสใหม่ ซึ่งไม่จับเวลา)
  const [showForgot, setShowForgot] = useState(false);
  const [forgotStep, setForgotStep] = useState<ForgotStep>('request');
  const [forgotEmpId, setForgotEmpId] = useState('');
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotDone, setForgotDone] = useState('');
  const [forgotCode, setForgotCode] = useState('');
  const [otpSecondsLeft, setOtpSecondsLeft] = useState(OTP_WINDOW_SECONDS);
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

  useEffect(() => {
    if (!showIntro) return;
    const timer = window.setTimeout(() => setShowIntro(false), 7000);
    return () => window.clearTimeout(timer);
  }, [showIntro]);

  // นับถอยหลัง 3 นาทีของหน้ากรอกรหัสยืนยัน
  // นับจากเวลาจริง ไม่ใช่บวกทีละวินาที เพราะถ้าผู้ใช้สลับแท็บหรือล็อกหน้าจอ
  // เบราว์เซอร์จะหน่วง setInterval ทำให้เวลาที่เหลือค้างและยาวกว่าที่ควรจะเป็น
  useEffect(() => {
    if (!showForgot || forgotStep !== 'otp') return;
    const deadline = Date.now() + OTP_WINDOW_SECONDS * 1000;
    setOtpSecondsLeft(OTP_WINDOW_SECONDS);
    const tick = () => {
      const left = Math.ceil((deadline - Date.now()) / 1000);
      setOtpSecondsLeft(left > 0 ? left : 0);
    };
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [showForgot, forgotStep]);

  // Character slide timer
  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % 4);
    }, 3000);
    return () => window.clearInterval(timer);
  }, []);

  // Session Check on Load
  useEffect(() => {
    let cancelled = false;
    const token = getToken();
    const cachedUser = getCurrentUser();

    if (!token || !cachedUser?.emp_id) return;
    if (isMockMode()) {
      setIsLoggedIn(true);
      setCurrentUser(cachedUser);
      return;
    }
    if (!isSupabaseConfigured()) {
      clearSession();
      return;
    }

    rpc<any>('validate_public_session', { p_token: token })
      .then((result) => {
        if (cancelled) return;
        if (result?.status !== 'success' || !result?.user) throw new Error(result?.message || 'SESSION_EXPIRED');
        setSession(token, result.user);
        setCurrentUser(result.user);
        setIsLoggedIn(true);
      })
      .catch(() => {
        if (cancelled) return;
        clearSession();
        setCurrentUser(null);
        setIsLoggedIn(false);
      });

    return () => {
      cancelled = true;
    };
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

      // เดิมเปิดเมื่อ config หาย ซึ่งแปลว่า production ที่ตั้งค่าพลาดจะรับ admin/admin123 ได้
      // ตอนนี้เปิดเฉพาะ dev บนเครื่องตัวเองที่ใส่ ?mock=1 เท่านั้น
      const allowMockLogin = isMockMode();

      // Offline mock account checks
      if (allowMockLogin && userVal.toLowerCase() === 'admin' && (passVal === 'admin' || passVal === 'admin123')) {
        const adminUser = {
          emp_id: 'ADMIN',
          full_name: 'IT Administrator',
          role: 'admin',
          status: 'ACTIVE',
          department: 'IT',
          points: 9999
        };
        setSession('mock_admin_token', adminUser);
        if (passVal === 'admin') {
          setFirstLoginEmpId('ADMIN');
          setShowFirstLogin(true);
          setShowLoginModal(false);
          return;
        }
        setCurrentUser(adminUser);
        setIsLoggedIn(true);
        setShowLoginModal(false);
        return;
      }

      if (allowMockLogin && userVal === '3672') {
        if (passVal === userVal) {
          // Force password change!
          const tempUser = {
            emp_id: '3672',
            full_name: 'คุณพนักงานทดสอบ (Test Employee)',
            role: 'user',
            status: 'ACTIVE',
            department: 'Production',
            points: 1250
          };
          setSession('mock_temp_token', tempUser);
          setFirstLoginEmpId('3672');
          setShowFirstLogin(true);
          setShowLoginModal(false);
          return;
        } else {
          // Log in with a changed password directly
          const testUser = {
            emp_id: '3672',
            full_name: 'คุณพนักงานทดสอบ (Test Employee)',
            role: 'user',
            status: 'ACTIVE',
            department: 'Production',
            points: 1250
          };
          setSession('mock_user_token', testUser);
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

      if (res.status === 'first_setup_required') {
        throw new Error('บัญชียังไม่มีรหัสผ่านชั่วคราว กรุณาติดต่อผู้ดูแลระบบ');
      }

      if (res.status === 'success' && res.mustChangePassword) {
        if (res.token && res.user) {
          setSession(res.token, res.user);
          setCurrentUser(res.user);
        }
        setFirstLoginEmpId(userVal);
        setShowFirstLogin(true);
        setShowLoginModal(false);
        return;
      }

      if (res.status === 'success' && res.token && res.user) {
        setSession(res.token, res.user);
        setCurrentUser(res.user);
        setIsLoggedIn(true);
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
      showError(new Error(PASSWORD_RULE_TEXT));
      return;
    }

    if (newPass1 !== newPass2) {
      showError(new Error('รหัสผ่านใหม่ไม่ตรงกัน'));
      return;
    }

    if (newPass1 === (firstLoginEmpId || empId.trim())) {
      showError(new Error('ห้ามใช้รหัสพนักงานซ้ำ'));
      return;
    }

    try {
      const targetEmp = firstLoginEmpId || empId.trim();

      // Offline mock account change password bypass
      if (isMockMode() && targetEmp === '3672') {
        const testUser = {
          emp_id: '3672',
          full_name: 'คุณพนักงานทดสอบ (Test Employee)',
          role: 'user',
          status: 'ACTIVE',
          department: 'Production',
          points: 1250
        };
        setSession('mock_user_token', testUser);
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

      if (token) {
        // ฐานข้อมูลอนุญาตให้เว้นรหัสเดิมได้เมื่อบัญชีอยู่ในโหมดบังคับเปลี่ยนรหัส
        // (session token คือหลักฐานตัวตนอยู่แล้ว) เราจึงไม่ต้องเก็บ plaintext ไว้ในเบราว์เซอร์
        await rpc('change_my_password', {
          p_token: token,
          p_current_password: null,
          p_new_password: newPass1,
          p_confirm_password: newPass2,
        });

        setIsLoggedIn(true);
        setShowFirstLogin(false);
        return;
      }

      throw new Error('SESSION_EXPIRED กรุณาเข้าสู่ระบบใหม่');
    } catch (error) {
      showError(error);
    }
  }

  // ส่งคำขอลืมรหัสผ่าน ระบบจะอีเมลรหัสชั่วคราวไปหาผู้ดูแล ไม่ส่งกลับมาที่หน้าเว็บ
  async function submitForgotPassword(event: FormEvent) {
    event.preventDefault();
    const target = forgotEmpId.trim();
    if (!target) {
      showError(new Error('กรุณากรอกรหัสพนักงาน'));
      return;
    }
    setForgotBusy(true);
    try {
      const message = await requestPasswordReset(target);
      setForgotDone(message);
      setForgotStep('sent');
    } catch (error) {
      showError(error);
    } finally {
      setForgotBusy(false);
    }
  }

  // กรอกรหัสยืนยัน 6 หลักที่ IT แจ้งมา
  // ฐานข้อมูลรับรหัสนี้แทนรหัสผ่านเดิมได้ครั้งเดียว และจะบังคับตั้งรหัสใหม่ทันที
  async function submitForgotCode(event: FormEvent) {
    event.preventDefault();
    const target = forgotEmpId.trim();
    const code = forgotCode.trim().toUpperCase();

    if (otpSecondsLeft <= 0) {
      showError(new Error('หมดเวลากรอกรหัสยืนยันแล้ว กรุณากดขอรหัสใหม่'));
      return;
    }
    if (!target) {
      showError(new Error('กรุณากรอกรหัสพนักงาน'));
      return;
    }
    if (code.length !== RESET_CODE_LENGTH) {
      showError(new Error(`รหัสยืนยันต้องมี ${RESET_CODE_LENGTH} ตัว`));
      return;
    }

    setForgotBusy(true);
    try {
      const res = await rpc<LoginResult>('login_with_emp_password', {
        p_emp_id: target,
        p_password: code,
        p_user_agent: navigator.userAgent,
      });

      if (res.status !== 'success' || !res.token || !res.user) {
        throw new Error(res.message || 'รหัสยืนยันไม่ถูกต้องหรือหมดอายุแล้ว');
      }

      setSession(res.token, res.user);
      setCurrentUser(res.user);

      // ผ่านด่านรหัสยืนยันแล้ว จากนี้ไปคือหน้าตั้งรหัสใหม่ ซึ่งไม่มีการจับเวลา
      closeForgot();
      setFirstLoginEmpId(target);
      setNewPass1('');
      setNewPass2('');
      setShowLoginModal(false);
      setShowFirstLogin(true);
    } catch (error) {
      showError(error);
    } finally {
      setForgotBusy(false);
    }
  }

  // ขอรหัสใหม่หลังหมดเวลา กลับไปเริ่มที่ขั้นตอนแรก
  function restartForgot() {
    setForgotStep('request');
    setForgotCode('');
    setForgotDone('');
    setOtpSecondsLeft(OTP_WINDOW_SECONDS);
  }

  function closeForgot() {
    setShowForgot(false);
    setForgotStep('request');
    setForgotEmpId('');
    setForgotDone('');
    setForgotCode('');
    setOtpSecondsLeft(OTP_WINDOW_SECONDS);
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
  if (showIntro) {
    return (
      <main className="sb-mobile-intro" aria-label="SB Connect loading">
        <div className="sb-mobile-intro-media">
          {useIntroGif ? (
            <img src={INTRO_GIF_URL} alt="SB Connect" className="sb-mobile-intro-asset" />
          ) : (
            <video
              className="sb-mobile-intro-asset"
              src={INTRO_VIDEO_URL}
              autoPlay
              muted
              playsInline
              preload="auto"
              onEnded={() => setShowIntro(false)}
              onError={() => setUseIntroGif(true)}
            />
          )}
        </div>
      </main>
    );
  }

  // Render Logged-in Dashboards based on User Roles
  if (isLoggedIn && currentUser) {
    const role = String(currentUser.role || '').toLowerCase();
    if (['admin', 'admin_it', 'dev'].includes(role)) {
      return (
        <Suspense fallback={<AppLoader visible label="กำลังโหลดหน้าจอ" />}>
          <AdminDashboard user={currentUser} onLogout={handleLogout} />
        </Suspense>
      );
    } else {
    return (
      <Suspense fallback={<AppLoader visible label="กำลังโหลดหน้าจอ" />}>
        <UserDashboard user={currentUser} onLogout={handleLogout} />
      </Suspense>
    );
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
            fontSize: 'clamp(78px, 24vw, 320px)',
            fontWeight: 900,
            opacity: 0.98,
            lineHeight: 1,
            letterSpacing: 0,
          }}
        >
          CAREBEAU
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

      {/* Top spacing */}
      <header className="w-full p-6 z-[48] relative" aria-hidden="true" />

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
            เข้าใช้งานครั้งแรก ใช้รหัสเริ่มต้นที่บริษัทแจ้ง แล้วตั้งรหัสใหม่ของตัวเอง
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

            <div className="mb-6 flex items-center">
              <div className="sb-login-logo-card">
                <img
                  src={COMPANY_LOGO_URL}
                  alt="SB Interlab"
                  className="sb-login-logo"
                  onError={(event) => {
                    event.currentTarget.style.display = 'none';
                  }}
                />
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

            <button
              type="button"
              onClick={() => {
                setForgotEmpId(empId.trim());
                setForgotDone('');
                setForgotCode('');
                setForgotStep('request');
                setOtpSecondsLeft(OTP_WINDOW_SECONDS);
                setShowForgot(true);
              }}
              className="mt-3 w-full text-center text-[11px] font-black text-white/85 underline underline-offset-4 hover:text-white transition"
            >
              ลืมรหัสผ่าน?
            </button>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 px-4 py-2.5 text-center text-[10px] font-bold leading-normal text-white/80 shadow-inner">
              * เข้าใช้งานครั้งแรก ใช้รหัสเริ่มต้นที่บริษัทแจ้ง แล้วระบบจะให้ตั้งรหัสใหม่ทันที
            </div>
          </form>
        </div>
      )}

      {/* FORGOT PASSWORD POPUP */}
      {showForgot && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-sm rounded-[32px] bg-slate-900 border border-slate-800 p-6 text-slate-200 shadow-2xl relative animate-scale-in">
            <button
              type="button"
              onClick={closeForgot}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 transition"
            >
              <X size={16} />
            </button>

            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <LockKeyhole size={22} />
            </div>
            <h3 className="text-base font-black text-center text-white">
              {forgotStep === 'otp' ? 'กรอกรหัสยืนยัน' : 'ลืมรหัสผ่าน'}
            </h3>

            {/* แถบบอกขั้นตอน 1 ขอรหัส -> 2 ยืนยัน -> 3 ตั้งรหัสใหม่ */}
            <div className="mt-3 mb-1 flex items-center justify-center gap-1.5">
              {['ขอรหัส', 'ยืนยัน', 'ตั้งรหัสใหม่'].map((label, index) => {
                const current = forgotStep === 'request' ? 0 : forgotStep === 'sent' ? 0 : 1;
                const active = index <= current;
                return (
                  <span
                    key={label}
                    className={`rounded-full px-2.5 py-1 text-[9px] font-black tracking-wide ${
                      active ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {index + 1}. {label}
                  </span>
                );
              })}
            </div>

            {forgotStep === 'otp' ? (
              <form onSubmit={submitForgotCode}>
                <p className="text-xs text-center text-slate-400 font-bold mt-3 mb-1 leading-relaxed">
                  กรอกรหัสยืนยัน {RESET_CODE_LENGTH} ตัวที่ IT แจ้งให้
                </p>

                <div
                  className={`mx-auto mt-2 mb-4 w-fit rounded-full px-4 py-1.5 text-sm font-black tabular-nums ${
                    otpSecondsLeft <= 0
                      ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                      : otpSecondsLeft <= 30
                        ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                        : 'bg-slate-800 text-slate-200 border border-slate-700'
                  }`}
                >
                  {otpSecondsLeft > 0 ? `เหลือเวลา ${formatCountdown(otpSecondsLeft)} นาที` : 'หมดเวลาแล้ว'}
                </div>

                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                  รหัสพนักงาน (Employee ID)
                </label>
                <div className="mb-4 flex h-12 items-center gap-3 rounded-2xl border border-slate-700 bg-slate-950/70 px-3">
                  <UserRound size={18} className="shrink-0 text-slate-500" />
                  <input
                    value={forgotEmpId}
                    onChange={(event) => setForgotEmpId(event.target.value)}
                    className="h-10 w-full bg-transparent text-xs font-bold text-slate-100 outline-none placeholder:text-slate-600"
                    placeholder="ระบุรหัสพนักงาน"
                    autoComplete="username"
                    maxLength={40}
                  />
                </div>

                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                  รหัสยืนยัน {RESET_CODE_LENGTH} ตัว
                </label>
                <input
                  value={forgotCode}
                  onChange={(event) =>
                    setForgotCode(
                      event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, RESET_CODE_LENGTH),
                    )
                  }
                  disabled={otpSecondsLeft <= 0}
                  className="h-14 w-full rounded-2xl border border-slate-700 bg-slate-950/70 text-center text-2xl font-black tracking-[0.4em] text-slate-100 outline-none focus:border-amber-500/60 disabled:opacity-40"
                  placeholder="XXXXXX"
                  inputMode="text"
                  autoComplete="one-time-code"
                  autoFocus
                />

                {otpSecondsLeft > 0 ? (
                  <button
                    type="submit"
                    disabled={forgotBusy || forgotCode.length !== RESET_CODE_LENGTH}
                    className="mt-5 w-full rounded-2xl bg-amber-500 py-3 text-xs font-black text-slate-950 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {forgotBusy ? 'กำลังตรวจสอบ...' : 'ยืนยันรหัส'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={restartForgot}
                    className="mt-5 w-full rounded-2xl bg-white py-3 text-xs font-black text-slate-950 active:scale-95 transition"
                  >
                    ขอรหัสใหม่อีกครั้ง
                  </button>
                )}

                <p className="mt-3 text-center text-[10px] font-bold text-slate-500 leading-relaxed">
                  รหัสนี้ใช้ได้ครั้งเดียว รหัสผ่านเดิมของคุณยังใช้ได้อยู่จนกว่าจะยืนยันสำเร็จ
                </p>
              </form>
            ) : forgotStep === 'sent' ? (
              <>
                <p className="text-xs text-center text-emerald-400 font-bold mt-3 leading-relaxed">
                  {forgotDone}
                </p>
                <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-[11px] font-bold leading-relaxed text-slate-400">
                  ระบบส่งรหัสยืนยัน {RESET_CODE_LENGTH} ตัว พร้อมข้อมูลของคุณ
                  (รหัสพนักงาน ชื่อ แผนก ตำแหน่ง) ไปที่อีเมลของ IT แล้ว
                  <br />
                  IT จะติดต่อกลับเพื่อแจ้งรหัสให้ เมื่อได้รหัสแล้วกดปุ่มข้างล่าง
                  <br />
                  <span className="text-slate-500">
                    ตอนกดปุ่มจะเริ่มจับเวลา 3 นาที ให้กรอกรหัส กดเมื่อมีรหัสอยู่ในมือแล้ว
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setForgotCode('');
                    setForgotStep('otp');
                  }}
                  className="mt-5 w-full rounded-2xl bg-amber-500 py-3 text-xs font-black text-slate-950 active:scale-95 transition"
                >
                  ได้รับรหัสแล้ว กรอกรหัสยืนยัน
                </button>
                <button
                  type="button"
                  onClick={closeForgot}
                  className="mt-2 w-full rounded-2xl bg-slate-800 py-3 text-xs font-black text-slate-300 active:scale-95 transition"
                >
                  ปิดหน้านี้ ไว้ค่อยมากรอก
                </button>
              </>
            ) : (
              <form onSubmit={submitForgotPassword}>
                <p className="text-xs text-center text-slate-400 font-bold mt-1 mb-5 leading-relaxed">
                  กรอกรหัสพนักงานของคุณ ระบบจะส่งรหัสยืนยันไปที่อีเมลของ IT
                  <br />
                  แล้ว IT จะติดต่อกลับมาแจ้งรหัสให้คุณ
                </p>

                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                  รหัสพนักงาน (Employee ID)
                </label>
                <div className="flex h-12 items-center gap-3 rounded-2xl border border-slate-700 bg-slate-950/70 px-3">
                  <UserRound size={18} className="shrink-0 text-slate-500" />
                  <input
                    value={forgotEmpId}
                    onChange={(event) => setForgotEmpId(event.target.value)}
                    className="h-10 w-full bg-transparent text-xs font-bold text-slate-100 outline-none placeholder:text-slate-600"
                    placeholder="ระบุรหัสพนักงาน"
                    autoComplete="username"
                    maxLength={40}
                  />
                </div>

                <button
                  type="submit"
                  disabled={forgotBusy}
                  className="mt-5 w-full rounded-2xl bg-amber-500 py-3 text-xs font-black text-slate-950 active:scale-95 transition disabled:opacity-70 disabled:cursor-wait"
                >
                  {forgotBusy ? 'กำลังส่งคำขอ...' : 'ส่งคำขอไปยังผู้ดูแลระบบ'}
                </button>

                <p className="mt-3 text-center text-[10px] font-bold text-slate-500 leading-relaxed">
                  ขอได้สูงสุด 3 ครั้งต่อวัน
                </p>
              </form>
            )}
          </div>
        </div>
      )}

      {/* FIRST LOGIN PASSWORD CHANGE POPUP */}
      {showFirstLogin && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-sm rounded-[32px] bg-slate-900 border border-slate-800 p-6 text-slate-200 shadow-2xl relative animate-scale-in">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <LockKeyhole size={22} />
            </div>
            <h3 className="text-base font-black text-center text-white">ตั้งรหัสผ่านใหม่</h3>
            <p className="text-xs text-center text-slate-400 font-bold mt-1 mb-2">
              บัญชีพนักงาน {firstLoginEmpId || empId} จำเป็นต้องตั้งรหัสผ่านใหม่ก่อนเข้าใช้งาน
            </p>
            <p className="mb-5 text-center text-[10px] font-black text-emerald-400/80">
              หน้านี้ไม่จำกัดเวลา ค่อย ๆ คิดรหัสได้
            </p>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-emerald-400">รหัสผ่านใหม่ (NEW PASSWORD)</label>
                <input
                  value={newPass1}
                  onChange={(event) =>
                    setNewPass1(event.target.value.replace(/[^\x21-\x7E]/g, '').slice(0, 72))
                  }
                  type="password"
                  maxLength={72}
                  className="h-12 w-full rounded-2xl border border-slate-850 bg-slate-950 px-4 text-xs font-black outline-none focus:border-emerald-500/50"
                  placeholder="อย่างน้อย 8 ตัว มีตัวอักษรและตัวเลข"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-emerald-400">ยืนยันรหัสผ่านใหม่ (CONFIRM PASSWORD)</label>
                <input
                  value={newPass2}
                  onChange={(event) =>
                    setNewPass2(event.target.value.replace(/[^\x21-\x7E]/g, '').slice(0, 72))
                  }
                  type="password"
                  maxLength={72}
                  className="h-12 w-full rounded-2xl border border-slate-850 bg-slate-950 px-4 text-xs font-black outline-none focus:border-emerald-500/50"
                  placeholder="กรอกรหัสใหม่อีกครั้งเพื่อความถูกต้อง"
                />
              </div>

              <div className="rounded-2xl bg-emerald-500/5 border border-emerald-500/10 p-3.5 text-[10px] font-bold leading-normal text-emerald-400/90 shadow-inner">
                * {PASSWORD_RULE_TEXT} และห้ามใช้รหัสพนักงานของตัวเองเป็นรหัสผ่าน
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    // ยังไม่ได้ตั้งรหัสใหม่ = ยังเข้าใช้งานไม่ได้
                    // ต้องล้าง session ที่ค้างอยู่ ไม่งั้นเปิดแท็บใหม่แล้วหลุดเข้าไปได้ทั้งที่ยังไม่เปลี่ยนรหัส
                    clearSession();
                    setCurrentUser(null);
                    setIsLoggedIn(false);
                    setNewPass1('');
                    setNewPass2('');
                    setShowFirstLogin(false);
                  }}
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

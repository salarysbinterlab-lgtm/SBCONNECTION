import { useEffect, useMemo, useRef, useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
//  SB Connect — กงล้อรางวัล (6 ช่องตายตัว)
//
//  หน้าบ้านเป็นผู้เล่นอย่างเดียว: ไม่รู้อัตราออก ไม่รู้สต็อก
//  ลำดับจริง: กดหมุน → เรียก RPC spin_wheel → ได้ slot_index → หมุนไปหยุดช่องนั้น
//  คอมโพเนนต์นี้รับ slots + ฟังก์ชัน onSpin เข้ามา จึงต่อ API จริงได้ทันที
// ─────────────────────────────────────────────────────────────────────────────

export const WHEEL_SLOT_COUNT = 6;

export type WheelPrizeType = 'coin' | 'reward' | 'ticket' | 'none';

export type WheelSlot = {
  slot_index: number;          // 0–5
  label: string;               // ข้อความในช่อง
  image_url?: string | null;   // รูป mini (coin / ของรางวัล / กระต่ายเสียใจ)
  color?: string | null;       // สีพื้นช่อง
  prize_type: WheelPrizeType;
};

export type SpinResult = {
  slot_index: number;
  prize_type: WheelPrizeType;
  prize_label: string;
  coin_awarded?: number;
  reward_name?: string | null;
  reward_qty?: number | null;
  ticket_amount?: number | null;
};

type Props = {
  slots: WheelSlot[];
  /** เรียก RPC จริง แล้วคืนผลที่เซิร์ฟเวอร์ตัดสินมาแล้ว */
  onSpin: () => Promise<SpinResult>;
  /** ปิดปุ่มเมื่อไม่มีสิทธิ์หมุน */
  disabled?: boolean;
  disabledReason?: string;
  spinLabel?: string;
  size?: number;               // ขนาดวงล้อ (px) — ค่าเริ่มต้นคำนวณตามจอ
  darkMode?: boolean;
  accent?: string;
  onResult?: (r: SpinResult) => void;
};

const DEFAULT_COLORS = ['#10b981', '#f8fafc', '#34d399', '#f1f5f9', '#6ee7b7', '#ffffff'];
const SPIN_MS = 4600;
const TURNS = 5;

const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);

export default function WheelGame({
  slots,
  onSpin,
  disabled,
  disabledReason,
  spinLabel = 'หมุนเลย',
  size,
  darkMode = false,
  accent = '#10b981',
  onResult,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgCache = useRef<Record<string, HTMLImageElement>>({});
  const rafRef = useRef<number | null>(null);
  const angleRef = useRef(0);           // มุมปัจจุบันของวง (เรเดียน)

  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [box, setBox] = useState(size || 320);

  // เรียงช่องตาม slot_index และเติมให้ครบ 6 เสมอ
  const ordered = useMemo(() => {
    const out: WheelSlot[] = [];
    for (let i = 0; i < WHEEL_SLOT_COUNT; i++) {
      const found = slots.find(s => s.slot_index === i);
      out.push(
        found || { slot_index: i, label: 'ไม่ได้รางวัล', prize_type: 'none', color: null, image_url: null },
      );
    }
    return out;
  }, [slots]);

  // ── ขนาดวงล้อตามจอ ────────────────────────────────────────────────────
  useEffect(() => {
    if (size) { setBox(size); return; }
    const fit = () => {
      const w = Math.min(window.innerWidth - 40, 380);
      const h = Math.min(window.innerHeight - 320, 380);
      setBox(Math.max(240, Math.min(w, h)));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [size]);

  // ── โหลดรูปของแต่ละช่องล่วงหน้า ───────────────────────────────────────
  useEffect(() => {
    ordered.forEach(s => {
      const url = s.image_url;
      if (!url || imgCache.current[url]) return;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => { imgCache.current[url] = img; draw(angleRef.current); };
      img.src = url;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordered]);

  // ── วาดวงล้อ ──────────────────────────────────────────────────────────
  const draw = (angle: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== box * dpr) {
      canvas.width = box * dpr;
      canvas.height = box * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, box, box);

    const cx = box / 2;
    const cy = box / 2;
    const r = box / 2 - 10;
    const step = (Math.PI * 2) / WHEEL_SLOT_COUNT;

    // เงาใต้วง
    ctx.save();
    ctx.shadowColor = 'rgba(15,23,42,0.28)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = darkMode ? '#0f172a' : '#ffffff';
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    ordered.forEach((slot, i) => {
      const start = i * step - Math.PI / 2 - step / 2;
      const end = start + step;
      const color = slot.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length];

      // พื้นช่อง
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, start, end);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // เนื้อหาในช่อง (หมุนให้ตั้งฉากกับรัศมี)
      const mid = start + step / 2;
      ctx.save();
      ctx.rotate(mid + Math.PI / 2);

      const url = slot.image_url || '';
      const img = url ? imgCache.current[url] : undefined;
      const light = isLight(color);
      const textColor = light ? '#0f172a' : '#ffffff';

      if (img) {
        const s = r * 0.30;
        ctx.drawImage(img, -s / 2, -r * 0.72, s, s);
      }

      ctx.fillStyle = textColor;
      const fs = Math.max(10, r * 0.082);
      ctx.font = `800 ${fs}px 'Prompt','Sarabun',sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // ข้อความอยู่ใต้รูป (ถ้าไม่มีรูปก็เลื่อนออกไปใกล้ขอบแทน) และไม่แตะดุมกลาง
      const baseY = img ? -r * 0.40 : -r * 0.58;
      const lines = wrap(slot.label, 11).slice(0, 2);
      lines.forEach((line, li) => {
        ctx.fillText(line, 0, baseY + li * fs * 1.15);
      });
      ctx.restore();
    });

    ctx.restore();

    // ขอบวง
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.lineWidth = 8;
    ctx.strokeStyle = accent;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.stroke();

    // ดุมกลาง
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.17, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = accent;
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.font = `900 ${Math.max(9, r * 0.085)}px 'Prompt','Sarabun',sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SB', cx, cy);
  };

  useEffect(() => { draw(angleRef.current); });

  // ── หมุน ──────────────────────────────────────────────────────────────
  const handleSpin = async () => {
    if (spinning || disabled) return;
    setSpinning(true);
    setResult(null);

    let res: SpinResult;
    try {
      res = await onSpin();            // เซิร์ฟเวอร์ตัดสินผลมาแล้ว
    } catch (e) {
      setSpinning(false);
      throw e;
    }

    const step = (Math.PI * 2) / WHEEL_SLOT_COUNT;
    const jitter = (Math.random() - 0.5) * step * 0.5;   // ไม่ให้หยุดกลางเป๊ะทุกครั้ง
    const target = Math.PI * 2 * TURNS - res.slot_index * step + jitter;
    const from = angleRef.current % (Math.PI * 2);
    const delta = target - from;
    const t0 = performance.now();

    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / SPIN_MS);
      angleRef.current = from + delta * easeOutQuart(p);
      draw(angleRef.current);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setSpinning(false);
        setResult(res);
        onResult?.(res);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const textColor = darkMode ? '#e2e8f0' : '#1e293b';

  return (
    <div className="flex flex-col items-center gap-4 select-none">
      <div className="relative" style={{ width: box, height: box }}>
        {/* ตัวชี้ */}
        <div
          className="absolute left-1/2 -translate-x-1/2 z-10"
          style={{ top: -6, filter: 'drop-shadow(0 3px 6px rgba(15,23,42,.35))' }}
        >
          <svg width="30" height="34" viewBox="0 0 30 34" aria-hidden="true">
            <path d="M15 33 L2 8 A14 14 0 0 1 28 8 Z" fill={accent} stroke="#fff" strokeWidth="2.5" />
          </svg>
        </div>
        <canvas
          ref={canvasRef}
          style={{ width: box, height: box, display: 'block' }}
          aria-label="กงล้อรางวัล"
        />
      </div>

      <button
        type="button"
        onClick={handleSpin}
        disabled={spinning || disabled}
        className="px-8 py-3 rounded-full text-sm font-black text-white transition active:scale-95 disabled:opacity-45 disabled:active:scale-100"
        style={{
          background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
          boxShadow: `0 10px 24px ${accent}55`,
        }}
      >
        {spinning ? 'กำลังหมุน…' : spinLabel}
      </button>

      {disabled && disabledReason && (
        <p className="text-[11px] font-bold opacity-60" style={{ color: textColor }}>{disabledReason}</p>
      )}

      {result && !spinning && (
        <div
          className="w-full max-w-xs rounded-3xl border p-4 text-center animate-scale-in"
          style={{
            background: darkMode ? 'rgba(255,255,255,0.05)' : '#fff',
            borderColor: result.prize_type === 'none' ? '#cbd5e1' : accent,
            color: textColor,
          }}
        >
          <p className="text-xs font-black" style={{ color: result.prize_type === 'none' ? '#64748b' : accent }}>
            {result.prize_type === 'none' ? 'เสียใจด้วย' : 'ยินดีด้วย!'}
          </p>
          <p className="text-base font-black mt-1">{result.prize_label}</p>
          {result.prize_type === 'reward' && (
            <p className="text-[11px] font-bold opacity-60 mt-1">ส่งเข้าคิวรับของแล้ว รอ HR อนุมัติ</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── helpers ────────────────────────────────────────────────────────────────
function isLight(hex: string) {
  const raw = hex.replace('#', '');
  if (raw.length !== 6) return true;
  const n = parseInt(raw, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) > 165;
}

function wrap(text: string, max: number) {
  const words = String(text || '').split(' ');
  const lines: string[] = [];
  let line = '';
  words.forEach(w => {
    if ((line + ' ' + w).trim().length > max) { if (line) lines.push(line.trim()); line = w; }
    else line = (line + ' ' + w).trim();
  });
  if (line) lines.push(line);
  return lines.length ? lines : [text];
}

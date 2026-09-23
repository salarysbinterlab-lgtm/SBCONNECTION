// ─────────────────────────────────────────────────────────────────────────────
//  hoverTint — ชี้ปุ่มแล้วสุ่มสีพาสเทลมา 1 สี ค้างไว้ตลอดที่ยังชี้อยู่
//  (ไม่ไล่วนสีเรื่อยๆ — สุ่มใหม่ทุกครั้งที่ชี้เข้ามาใหม่)
//
//  วิธีใช้:
//    <button {...tintHandlers} className={`... ${TINT_CLASS}`}>
// ─────────────────────────────────────────────────────────────────────────────

type Tint = { bg: string; ring: string };

const TINTS: Tint[] = [
  { bg: 'rgba(125,211,252,0.22)', ring: 'rgba(56,189,248,0.45)' },  // ฟ้า
  { bg: 'rgba(110,231,183,0.22)', ring: 'rgba(16,185,129,0.42)' },  // มิ้นต์
  { bg: 'rgba(196,181,253,0.24)', ring: 'rgba(139,92,246,0.42)' },  // ม่วงลาเวนเดอร์
  { bg: 'rgba(253,186,116,0.22)', ring: 'rgba(249,115,22,0.40)' },  // พีช
  { bg: 'rgba(249,168,212,0.24)', ring: 'rgba(236,72,153,0.40)' },  // ชมพู
  { bg: 'rgba(253,230,138,0.24)', ring: 'rgba(245,158,11,0.40)' },  // เหลืองนวล
  { bg: 'rgba(165,243,252,0.24)', ring: 'rgba(6,182,212,0.40)' },   // ฟ้าน้ำทะเล
  { bg: 'rgba(167,243,208,0.24)', ring: 'rgba(5,150,105,0.40)' },   // เขียวอ่อน
];

function applyTint(el: HTMLElement | null) {
  if (!el || !el.style) return;
  const prev = Number(el.dataset.sbTint ?? '-1');
  let i = Math.floor(Math.random() * TINTS.length);
  if (i === prev) i = (i + 1) % TINTS.length;   // กันสุ่มซ้ำสีเดิมติดกัน
  el.dataset.sbTint = String(i);
  el.style.setProperty('--sb-tint', TINTS[i].bg);
  el.style.setProperty('--sb-tint-ring', TINTS[i].ring);
}

const handle = (e: { currentTarget: HTMLElement }) => applyTint(e.currentTarget);

export const TINT_CLASS = 'sb-tint-hover';

export const tintHandlers = {
  onMouseEnter: handle,
  onFocus: handle,
  onTouchStart: handle,
};

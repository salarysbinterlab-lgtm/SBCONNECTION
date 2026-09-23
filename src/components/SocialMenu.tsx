import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown, ExternalLink, X, Sparkles } from 'lucide-react';
import { SOCIAL_GROUPS, BRANDS, COMMUNITY_GRADIENT } from '../constants/socialLinks';
import { tintHandlers, TINT_CLASS } from '../helpers/hoverTint';

// ─────────────────────────────────────────────────────────────────────────────
//  SocialMenu — เมนูช่องทางออนไลน์
//  • Desktop (≥1024px): panel ลอย ยึดตำแหน่งจากปุ่มใน sidebar
//  • Tablet / Mobile  : bottom sheet เหนือแถบเมนูล่าง (รองรับ safe-area iPhone)
// ─────────────────────────────────────────────────────────────────────────────

type Props = {
  open: boolean;
  onClose: () => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
  lang: 'th' | 'en';
  darkMode: boolean;
  accent: string;
  border: string;
  text: string;
};

const PANEL_WIDTH = 340;
const EDGE = 12;

export default function SocialMenu({ open, onClose, anchorRef, lang, darkMode, accent, border, text }: Props) {
  const [isDesktop, setIsDesktop] = useState<boolean>(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches,
  );
  const [openGroup, setOpenGroup] = useState<string>(SOCIAL_GROUPS[0]?.id || '');
  const [pos, setPos] = useState({ top: EDGE, left: EDGE, maxHeight: 520 });
  const panelRef = useRef<HTMLDivElement>(null);

  // ── ตรวจขนาดจอแบบสด (หมุนจอ / ย่อหน้าต่าง) ─────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const handle = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    setIsDesktop(mq.matches);
    mq.addEventListener('change', handle);
    return () => mq.removeEventListener('change', handle);
  }, []);

  // ── เปิดใหม่ทุกครั้ง = กางกลุ่มแรกไว้ก่อน ───────────────────────────────
  useEffect(() => {
    if (open) setOpenGroup(SOCIAL_GROUPS[0]?.id || '');
  }, [open]);

  // ── ปิดด้วย Esc ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // ── วางตำแหน่ง panel บน desktop ─────────────────────────────────────────
  useLayoutEffect(() => {
    if (!open || !isDesktop || typeof window === 'undefined') return;
    const place = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const maxHeight = Math.min(560, vh - EDGE * 2);
      const el = anchorRef?.current;
      if (!el) {
        setPos({ top: EDGE, left: Math.max(EDGE, vw - PANEL_WIDTH - EDGE), maxHeight });
        return;
      }
      const r = el.getBoundingClientRect();
      let left = r.right + EDGE;
      if (left + PANEL_WIDTH > vw - EDGE) left = Math.max(EDGE, r.left - PANEL_WIDTH - EDGE);
      let top = r.top - 6;
      if (top + maxHeight > vh - EDGE) top = vh - maxHeight - EDGE;
      if (top < EDGE) top = EDGE;
      setPos({ top, left, maxHeight });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, isDesktop, anchorRef]);

  if (!open) return null;

  const surface = darkMode ? '#0f172a' : '#ffffff';
  const subtle = darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.03)';
  const line = (border || '#cbd5e1') + (darkMode ? '35' : '60');

  const title = 'Community & Marketplace';
  const hint = lang === 'th' ? 'ช่องทางออนไลน์ทางการของเรา' : 'Our official online channels';
  const soon = lang === 'th' ? 'เร็วๆ นี้' : 'Coming soon';
  const unit = lang === 'th' ? 'ช่องทาง' : 'channels';

  const panelStyle: React.CSSProperties = isDesktop
    ? {
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        width: PANEL_WIDTH,
        maxHeight: pos.maxHeight,
        background: surface,
        borderColor: line,
        color: text,
      }
    : {
        position: 'fixed',
        left: EDGE,
        right: EDGE,
        marginLeft: 'auto',
        marginRight: 'auto',
        maxWidth: 520,
        bottom: 'calc(4.25rem + env(safe-area-inset-bottom, 0px))',
        maxHeight: 'min(68vh, 560px)',
        background: surface,
        borderColor: line,
        color: text,
      };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[118]"
        style={{
          background: isDesktop ? 'transparent' : 'rgba(15,23,42,0.55)',
          backdropFilter: isDesktop ? undefined : 'blur(8px)',
          WebkitBackdropFilter: isDesktop ? undefined : 'blur(8px)',
        }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`z-[119] rounded-3xl border shadow-2xl overflow-hidden flex flex-col ${isDesktop ? 'animate-scale-in' : 'sb-sheet-up'}`}
        style={panelStyle}
        onClick={e => e.stopPropagation()}
      >
        <div className="h-1.5 w-full shrink-0" style={{ background: COMMUNITY_GRADIENT }} />

        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-3.5 pb-3 shrink-0">
          <span
            className="w-9 h-9 rounded-2xl grid place-items-center shrink-0 text-white shadow-sm"
            style={{ background: COMMUNITY_GRADIENT }}
          >
            <Sparkles size={17} />
          </span>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-black truncate" style={{ color: text }}>{title}</h3>
            <p className="text-[10px] font-bold opacity-55 truncate">{hint}</p>
          </div>
          <button
            type="button"
            {...tintHandlers}
            onClick={onClose}
            aria-label="Close"
            className={`p-2 rounded-xl border opacity-60 hover:opacity-100 transition shrink-0 ${TINT_CLASS}`}
            style={{ borderColor: line }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Groups */}
        <div className="px-3 pb-3 space-y-2 overflow-y-auto overscroll-contain flex-1">
          {SOCIAL_GROUPS.map(group => {
            const brand = BRANDS[group.brand];
            const GroupIcon = brand.icon;
            const expanded = openGroup === group.id;
            const count = group.items.length;

            return (
              <div
                key={group.id}
                className="rounded-2xl border overflow-hidden"
                style={{ borderColor: line, background: expanded ? subtle : 'transparent' }}
              >
                <button
                  type="button"
                  {...tintHandlers}
                  onClick={() => setOpenGroup(expanded ? '' : group.id)}
                  aria-expanded={expanded}
                  className={`w-full flex items-center gap-3 p-2.5 text-left rounded-2xl ${TINT_CLASS}`}
                >
                  <span
                    className="w-9 h-9 rounded-2xl grid place-items-center shrink-0 text-white shadow-sm"
                    style={{ background: brand.gradient }}
                  >
                    <GroupIcon size={17} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-black truncate" style={{ color: text }}>
                      {lang === 'th' ? group.titleTh : group.titleEn}
                    </span>
                    <span className="block text-[10px] font-bold opacity-50 truncate">
                      {count} {unit}
                      {group.placeholders?.length ? ` · +${soon}` : ''}
                    </span>
                  </span>
                  <ChevronDown
                    size={16}
                    className="shrink-0 opacity-50 transition-transform duration-200"
                    style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  />
                </button>

                {expanded && (
                  <div className="px-2 pb-2 space-y-1 animate-fade-in">
                    {group.items.map(item => {
                      const ib = BRANDS[item.brand];
                      const ItemIcon = ib.icon;
                      return (
                        <a
                          key={item.url}
                          {...tintHandlers}
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={onClose}
                          className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 border ${TINT_CLASS}`}
                          style={{ borderColor: line, background: darkMode ? 'rgba(255,255,255,0.03)' : '#fff' }}
                        >
                          <span
                            className="w-7 h-7 rounded-xl grid place-items-center shrink-0"
                            style={{ background: ib.soft, color: ib.solid }}
                          >
                            <ItemIcon size={14} />
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-[12px] font-extrabold truncate" style={{ color: text }}>
                              {item.label}
                            </span>
                            {item.handle && (
                              <span className="block text-[10px] font-semibold opacity-45 truncate">{item.handle}</span>
                            )}
                          </span>
                          <ExternalLink size={13} className="opacity-35 shrink-0" />
                        </a>
                      );
                    })}

                    {group.placeholders?.map(ph => {
                      const pb = BRANDS[ph.brand];
                      const PhIcon = pb.icon;
                      return (
                        <div
                          key={ph.labelEn}
                          className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 border border-dashed opacity-60"
                          style={{ borderColor: line }}
                        >
                          <span
                            className="w-7 h-7 rounded-xl grid place-items-center shrink-0"
                            style={{ background: pb.soft, color: pb.solid }}
                          >
                            <PhIcon size={14} />
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-[12px] font-extrabold truncate" style={{ color: text }}>
                              {lang === 'th' ? ph.labelTh : ph.labelEn}
                            </span>
                            <span className="block text-[10px] font-semibold opacity-60 truncate">{soon}</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div
          className="px-4 py-2 text-[9px] font-black uppercase tracking-widest shrink-0 border-t"
          style={{ borderColor: line, color: accent, background: subtle }}
        >
          SB CONNECT · {lang === 'th' ? 'ช่องทางทางการ' : 'Official channels'}
        </div>
      </div>
    </>
  );
}

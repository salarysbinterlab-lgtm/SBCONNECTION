import {
  Youtube, Facebook, Music2, ShoppingBag, Store, Link2, MessageCircle, Sparkles,
  type LucideIcon,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
//  SB CONNECT — Community & Marketplace
//  แก้ลิงก์ทั้งหมดได้ที่ไฟล์นี้ไฟล์เดียว ไม่ต้องแตะ UI
// ─────────────────────────────────────────────────────────────────────────────

// ไล่สีจากสีโลโก้จริงของแต่ละช่องทาง: YouTube แดง → Shopee ส้ม → LINE เขียว → Facebook น้ำเงิน
export const COMMUNITY_GRADIENT = 'linear-gradient(135deg,#FF0033 0%,#EE4D2D 30%,#06C755 64%,#1877F2 100%)';

export type BrandKey =
  | 'youtube' | 'tiktok' | 'shopee' | 'lazada'
  | 'facebook' | 'line' | 'linktree' | 'community';

export type BrandStyle = {
  icon: LucideIcon;
  /** สีหลักของแบรนด์ (ใช้กับไอคอน chip เล็ก) */
  solid: string;
  /** gradient สำหรับ tile ไอคอนหัวข้อ */
  gradient: string;
  /** สีพื้นอ่อนของ chip เล็ก */
  soft: string;
};

export const BRANDS: Record<BrandKey, BrandStyle> = {
  youtube: {
    icon: Youtube,
    solid: '#FF0033',
    gradient: 'linear-gradient(135deg,#FF6B6B 0%,#FF0033 55%,#C4001D 100%)',
    soft: 'rgba(255,0,51,0.12)',
  },
  tiktok: {
    icon: Music2,
    solid: '#FE2C55',
    gradient: 'linear-gradient(135deg,#25F4EE 0%,#1F2937 52%,#FE2C55 100%)',
    soft: 'rgba(254,44,85,0.12)',
  },
  shopee: {
    icon: ShoppingBag,
    solid: '#EE4D2D',
    gradient: 'linear-gradient(135deg,#FF9A6B 0%,#EE4D2D 100%)',
    soft: 'rgba(238,77,45,0.12)',
  },
  lazada: {
    icon: Store,
    solid: '#3C51FF',
    gradient: 'linear-gradient(135deg,#5B6BFF 0%,#0F146D 62%,#F8511C 100%)',
    soft: 'rgba(60,81,255,0.12)',
  },
  facebook: {
    icon: Facebook,
    solid: '#1877F2',
    gradient: 'linear-gradient(135deg,#4293FF 0%,#0B5FCC 100%)',
    soft: 'rgba(24,119,242,0.12)',
  },
  line: {
    icon: MessageCircle,
    solid: '#06C755',
    gradient: 'linear-gradient(135deg,#5BE584 0%,#06C755 100%)',
    soft: 'rgba(6,199,85,0.12)',
  },
  linktree: {
    icon: Link2,
    solid: '#22C55E',
    gradient: 'linear-gradient(135deg,#6EE7B7 0%,#22C55E 100%)',
    soft: 'rgba(34,197,94,0.12)',
  },
  community: {
    icon: Sparkles,
    solid: '#7C5CFF',
    gradient: COMMUNITY_GRADIENT,
    soft: 'rgba(124,92,255,0.12)',
  },
};

export type SocialLink = {
  label: string;
  /** ชื่อ handle / โดเมน แสดงเป็นบรรทัดรอง */
  handle?: string;
  url: string;
  brand: BrandKey;
};

export type SocialPlaceholder = {
  labelTh: string;
  labelEn: string;
  brand: BrandKey;
};

export type SocialGroup = {
  id: string;
  titleTh: string;
  titleEn: string;
  brand: BrandKey;
  items: SocialLink[];
  /** แถวจางๆ สำหรับช่องทางที่ยังไม่ได้ใส่ลิงก์ */
  placeholders?: SocialPlaceholder[];
};

export const SOCIAL_GROUPS: SocialGroup[] = [
  {
    id: 'youtube',
    titleTh: 'YouTube',
    titleEn: 'YouTube',
    brand: 'youtube',
    items: [
      {
        label: 'Carebeau Club',
        handle: '@Carebeauclub',
        url: 'https://www.youtube.com/@Carebeauclub',
        brand: 'youtube',
      },
      {
        label: 'Lifelong Beauty With Carebeau',
        handle: '@LifelongBeautyWithCarebeau',
        url: 'https://www.youtube.com/@LifelongBeautyWithCarebeau',
        brand: 'youtube',
      },
      {
        label: 'Carebeau Hair Color Shampoo',
        handle: '@CarebeauHairColorShampoo',
        url: 'https://www.youtube.com/@CarebeauHairColorShampoo',
        brand: 'youtube',
      },
      {
        label: 'Carebeau Express Online',
        handle: '@carebeauexpressonline6328',
        url: 'https://www.youtube.com/@carebeauexpressonline6328',
        brand: 'youtube',
      },
      {
        label: 'SB Interlab',
        handle: '@SBINTERLAB',
        url: 'https://www.youtube.com/@SBINTERLAB',
        brand: 'youtube',
      },
    ],
  },
  {
    id: 'marketplace',
    titleTh: 'Marketplace',
    titleEn: 'Marketplace',
    brand: 'shopee',
    items: [
      {
        label: 'TikTok — Carebeau Club',
        handle: '@carebeauclub',
        url: 'https://www.tiktok.com/@carebeauclub',
        brand: 'tiktok',
      },
      {
        label: 'Shopee — Carebeau',
        handle: 'shopee.co.th/carebeau',
        url: 'https://shopee.co.th/carebeau',
        brand: 'shopee',
      },
      {
        label: 'Lazada — Carebeau',
        handle: 'lazada.co.th/shop/carebeau',
        url: 'https://www.lazada.co.th/shop/carebeau/?path=index.htm',
        brand: 'lazada',
      },
    ],
  },
  {
    id: 'community',
    titleTh: 'Community',
    titleEn: 'Community',
    brand: 'community',
    items: [
      {
        label: 'TikTok — HR SB Interlab',
        handle: '@hr_sbinterlab',
        url: 'https://www.tiktok.com/@hr_sbinterlab',
        brand: 'tiktok',
      },
      {
        label: 'Linktree — OEM SB Interlab',
        handle: 'linktr.ee/oemsbinterlab',
        url: 'https://linktr.ee/oemsbinterlab',
        brand: 'linktree',
      },
      {
        label: 'LINE Official',
        handle: 'lin.ee/pgSa8uH',
        url: 'https://lin.ee/pgSa8uH',
        brand: 'line',
      },
      {
        label: 'Facebook — SB Interlab',
        handle: 'โรงงานรับผลิตสกินแคร์ เครื่องสำอาง',
        url: 'https://www.facebook.com/profile.php?id=61587256443198',
        brand: 'facebook',
      },

      // ─── อยากเพิ่มเพจอื่นในอนาคต ใส่ต่อจากนี้ได้เลย ───
      // { label: 'Facebook — Carebeau Club', handle: 'facebook.com/carebeauofficial', url: 'https://www.facebook.com/carebeauofficial', brand: 'facebook' },
    ],
  },
];

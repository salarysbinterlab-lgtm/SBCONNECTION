export const DEV_PAGE_CONFIG = {
  ghostText: "CAREBEAU",
  loginTitle: "SBinterlab Connect",
  loginSubtitle: "Secure Login",
  firstLoginNote: "First login ใช้รหัสพนักงานเป็นรหัสผ่าน แล้วระบบจะให้เปลี่ยนรหัส 8 ตัว",

  carousel: {
    intervalMs: 3000,
    transitionMs: 650,
    autoRotate: true
  },

  images: [
    { src: "./image/index_1.png", bg: "#F4845F", panel: "#F79B7F", label: "Orange" },
    { src: "./image/index_2.png", bg: "#6BBF7A", panel: "#85CC92", label: "Green" },
    { src: "./image/index_3.png", bg: "#6EB5FF", panel: "#8DC4FF", label: "Blue" },
    { src: "./image/index_4.png", bg: "#E882B4", panel: "#ED9DC4", label: "Pink" }
  ],

  previewModes: {
    desktop: { label: "Desktop", width: 1440, height: 900 },
    ipad: { label: "iPad", width: 1024, height: 1366 },
    tablet: { label: "Tablet", width: 768, height: 1024 },
    mobile: { label: "Mobile", width: 390, height: 844 }
  },

  layout: {
    ghostTopPercent: {
      desktop: 18,
      ipad: 15,
      tablet: 14,
      mobile: 10
    },

    ghostFontClamp: {
      desktop: "clamp(78px, 24vw, 320px)",
      ipad: "clamp(64px, 22vw, 230px)",
      tablet: "clamp(54px, 21vw, 180px)",
      mobile: "clamp(42px, 18vw, 96px)"
    },

    login: {
      desktop: { top: 96, right: 80, width: 448 },
      ipad: { top: 110, right: 36, width: 420 },
      tablet: { top: 88, right: 24, width: 390 },
      mobile: { top: 54, right: 16, width: 358 }
    },

    carousel: {
      centerScale: {
        desktop: 1.62,
        ipad: 1.42,
        tablet: 1.30,
        mobile: 1.16
      },
      centerHeight: {
        desktop: 88,
        ipad: 76,
        tablet: 68,
        mobile: 54
      },
      centerBottom: {
        desktop: 1,
        ipad: 3,
        tablet: 8,
        mobile: 22
      },
      sideHeight: {
        desktop: 27,
        ipad: 22,
        tablet: 18,
        mobile: 14
      },
      sideBottom: {
        desktop: 12,
        ipad: 16,
        tablet: 22,
        mobile: 32
      },
      leftX: {
        desktop: 30,
        ipad: 26,
        tablet: 22,
        mobile: 16
      },
      rightX: {
        desktop: 70,
        ipad: 74,
        tablet: 78,
        mobile: 84
      },
      backHeight: {
        desktop: 21,
        ipad: 18,
        tablet: 15,
        mobile: 12
      },
      backOpacity: {
        desktop: 0.72,
        ipad: 0.68,
        tablet: 0.62,
        mobile: 0.48
      }
    }
  }
} as const;

export type DevPageConfig = typeof DEV_PAGE_CONFIG;
export type DevPreviewMode = keyof typeof DEV_PAGE_CONFIG.previewModes;

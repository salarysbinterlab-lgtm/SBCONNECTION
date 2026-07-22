// assets/js/sbConfig.js
// แก้แค่ไฟล์นี้เวลาเปลี่ยน Supabase / Apps Script endpoint
export const SB_CONFIG = {
  supabaseUrl: "https://tmcbblwfucwauksenqqr.supabase.co",
  supabaseAnonKey: "sb_publishable__eAshDr5vo6TBNDJ4VNRUg_tRPp2Wov",

  // Google Drive upload ผ่าน Apps Script Web App
  driveUploadEndpoint: "https://script.google.com/macros/s/AKfycbyulDl7wAwfVkCyW6X1gNGrYhL6yzYdgtWVwdkPwMieKHntlr4_qapXqaRQ6ewLl02J-w/exec",
  driveUploadToken: "CHANGE_THIS_TOKEN_TO_MATCH_APPS_SCRIPT"
};

if (typeof window !== "undefined") {
  window.SB_CONNECT_CONFIG = SB_CONFIG;
}

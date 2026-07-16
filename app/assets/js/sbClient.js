// assets/js/sbClient.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { SB_CONFIG } from "./sbConfig.js";

if (!SB_CONFIG.supabaseUrl.includes("supabase.co")) {
  console.warn("ยังไม่ได้ตั้งค่า Supabase URL ใน assets/js/sbConfig.js");
}

export const supabase = createClient(SB_CONFIG.supabaseUrl, SB_CONFIG.supabaseAnonKey, {
  auth: { persistSession: false }
});

export async function rpc(name, params = {}) {
  const { data, error } = await supabase.rpc(name, params);
  if (error) throw error;
  if (data && data.status === "error") throw new Error(data.message || "RPC_ERROR");
  return data;
}

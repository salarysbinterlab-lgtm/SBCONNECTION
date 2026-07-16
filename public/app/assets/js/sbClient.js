import { SB_CONFIG } from "./sbConfig.js";

export function getConfig() {
  const cfg = window.SB_CONNECT_CONFIG || SB_CONFIG;
  return cfg;
}

export async function rpc(fn, args = {}) {
  const cfg = getConfig();

  if (!cfg.supabaseUrl || cfg.supabaseUrl.includes("PASTE_")) {
    throw new Error("ยังไม่ได้ใส่ Supabase URL ใน public/app/assets/js/sbConfig.js");
  }

  if (!cfg.supabaseAnonKey || cfg.supabaseAnonKey.includes("PASTE_")) {
    throw new Error("ยังไม่ได้ใส่ Supabase anon key ใน public/app/assets/js/sbConfig.js");
  }

  const url = cfg.supabaseUrl.replace(/\/$/, "") + "/rest/v1/rpc/" + fn;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: cfg.supabaseAnonKey,
      Authorization: "Bearer " + cfg.supabaseAnonKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(args || {})
  });

  const text = await res.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg = data && (data.message || data.error || data.details)
      ? (data.message || data.error || data.details)
      : text;
    throw new Error(msg || `RPC error: ${fn}`);
  }

  if (data && data.status === "error") {
    throw new Error(data.message || "RPC_ERROR");
  }

  return data;
}

export async function select(table, query = "*", options = {}) {
  throw new Error("Direct table SELECT is disabled. Use secured RPC functions only.");
}

export async function insert(table, payload) {
  throw new Error("Direct table INSERT is disabled. Use secured RPC functions only.");
}

export async function update(table, payload, match) {
  throw new Error("Direct table UPDATE is disabled. Use secured RPC functions only.");
}

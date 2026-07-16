// assets/js/uiHelpers.js
export function qs(id) { return document.getElementById(id); }
export function esc(v) {
  return String(v ?? "").replace(/[&<>'"]/g, s => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[s]));
}
export function toast(title, icon = "success") {
  if (window.Swal) Swal.fire({ toast:true, position:"top-end", timer:1900, showConfirmButton:false, icon, title });
  else alert(title);
}
export function alertError(err) {
  const msg = err?.message || String(err || "เกิดข้อผิดพลาด");
  if (window.Swal) Swal.fire("ผิดพลาด", msg, "error"); else alert(msg);
}
export function setLoading(show) {
  const el = qs("loadingOverlay") || qs("loader");
  if (el) el.style.display = show ? "flex" : "none";
}
export function fmtDate(v) {
  if (!v) return "-";
  try { return new Date(v).toLocaleString("th-TH", { dateStyle:"short", timeStyle:"short" }); } catch { return v; }
}
export function toCSV(rows) {
  if (!rows?.length) return "";
  const cols = Object.keys(rows[0]);
  const line = r => cols.map(c => '"' + String(r[c] ?? "").replace(/"/g,'""') + '"').join(",");
  return [cols.join(","), ...rows.map(line)].join("\n");
}
export function downloadText(name, text) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type:"text/plain;charset=utf-8" }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 500);
}

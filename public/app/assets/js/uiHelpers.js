export function alertError(err) {
  const msg = err && err.message ? err.message : String(err || "เกิดข้อผิดพลาด");
  if (window.Swal) {
    Swal.fire({ icon: "error", title: "ไม่สำเร็จ", text: msg });
  } else {
    alert(msg);
  }
}

export function alertSuccess(msg = "สำเร็จ") {
  if (window.Swal) {
    Swal.fire({ icon: "success", title: "สำเร็จ", text: msg, timer: 1400, showConfirmButton: false });
  } else {
    alert(msg);
  }
}

export function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? "";
}

export function setHTML(id, value) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = value ?? "";
}

export function money(n) {
  return Number(n || 0).toLocaleString("th-TH");
}

export function fmtDate(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return String(value);
  }
}

export function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function csvDownload(filename, rows) {
  const text = rows.map(row => row.map(cell => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

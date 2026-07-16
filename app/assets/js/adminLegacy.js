// assets/js/adminLegacy.js
import { getToken, getUser, requireAdmin, logout } from "./sessionService.js";
import { rpc } from "./sbClient.js";
import { qs, esc, alertError, toast } from "./uiHelpers.js";

if (requireAdmin()) initAdmin();

function initAdmin() {
  const u = getUser() || {};
  qs("adminName") && (qs("adminName").textContent = u.name || u.empId || "Admin");
  qs("adminMeta") && (qs("adminMeta").textContent = `${u.empId || "-"} • ${u.role || "admin"}`);
  qs("logoutBtn")?.addEventListener("click", logout);
  qs("resetBtn")?.addEventListener("click", resetPass);
  loadDashboard();
}
async function loadDashboard() {
  try {
    const data = await rpc("admin_dashboard_payload", { p_token:getToken() });
    const k = data.kpi || {};
    qs("kpiGrid") && (qs("kpiGrid").innerHTML = Object.entries(k).map(([a,b]) => `<div class="stat-card"><span class="stat-val">${b}</span><span class="stat-label">${esc(a)}</span></div>`).join(""));
    qs("topUsers") && (qs("topUsers").innerHTML = (data.topUsers || []).map(x => `<div class="news-row"><b>#${x.rank_no}</b> ${esc(x.display_name || x.emp_id)} <b>${x.points}</b></div>`).join(""));
    qs("recentLogs") && (qs("recentLogs").innerHTML = (data.recentLogs || []).map(x => `<div class="news-row">${esc(x.emp_id)} ${esc(x.tx_type)} <b>${x.amount}</b></div>`).join(""));
    qs("recentUsers") && (qs("recentUsers").innerHTML = (data.recentUsers || []).map(u => `<tr><td>${esc(u.emp_id)}</td><td>${esc(u.display_name)}</td><td>${esc(u.role)}</td><td>${esc(u.dept_th)}</td><td>${esc(u.status)}</td><td>${u.points ?? 0}</td></tr>`).join(""));
  } catch (err) { alertError(err); }
}
async function resetPass() {
  const emp = qs("resetEmpId")?.value.trim();
  const pass = qs("resetTempPass")?.value.trim() || "1234";
  if (!emp) return alertError(new Error("กรุณากรอก emp_id"));
  try {
    await rpc("admin_reset_user_password", { p_token:getToken(), p_target_emp_id:emp, p_temp_password:pass });
    toast("Reset password สำเร็จ");
  } catch (err) { alertError(err); }
}

import { rpc } from "./sbClient.js";
import { getToken, getCurrentUser, validateSession, logout } from "./sessionService.js";
import { alertError, alertSuccess, escapeHTML, setText, fmtDate } from "./uiHelpers.js";

async function loadAdmin() {
  if (!(await validateSession({ admin: true }))) return;

  const user = getCurrentUser();
  setText("adminName", user.full_name || user.name || user.empId || user.emp_id || "Admin");
  setText("adminMeta", `${user.empId || user.emp_id || "-"} • ${user.role || "-"}`);

  try {
    const data = await rpc("admin_dashboard_payload", { p_token: getToken() });
    renderAdmin(data || {});
  } catch (err) {
    alertError(err);
  }
}

function renderAdmin(data) {
  const kpiData = data.kpi || {};
  const kpi = document.getElementById("kpiGrid");

  if (kpi) {
    kpi.innerHTML = `
      <div class="stat-card admin-dashboard-card"><span class="stat-val">${kpiData.users || 0}</span><span class="stat-label">Users</span></div>
      <div class="stat-card admin-dashboard-card"><span class="stat-val">${kpiData.activeUsers || 0}</span><span class="stat-label">Active</span></div>
      <div class="stat-card admin-dashboard-card"><span class="stat-val">${kpiData.points || 0}</span><span class="stat-label">Points</span></div>
      <div class="stat-card admin-dashboard-card"><span class="stat-val">${kpiData.pendingIT || 0}</span><span class="stat-label">Pending IT</span></div>
    `;
  }

  const top = document.getElementById("topUsers");
  const ranking = data.topUsers || data.ranking || [];
  if (top) {
    top.innerHTML = ranking.slice(0, 8).map((r, i) => `
      <div class="news-row"><b>#${i + 1}</b> ${escapeHTML(r.display_name || r.full_name || r.emp_id || "-")} <strong>${Number(r.points || 0).toLocaleString("th-TH")}</strong></div>
    `).join("");
  }

  const logs = document.getElementById("recentLogs");
  const rows = data.recentLogs || data.logs || [];
  if (logs) {
    logs.innerHTML = rows.slice(0, 8).map(l => `
      <div class="news-row"><span>${escapeHTML(l.description || l.action || l.title || "-")}</span><small>${fmtDate(l.created_at)}</small></div>
    `).join("");
  }

  const users = document.getElementById("recentUsers");
  const recent = data.recentUsers || data.users || [];
  if (users) {
    users.innerHTML = recent.slice(0, 10).map(u => `
      <tr>
        <td>${escapeHTML(u.emp_id)}</td>
        <td>${escapeHTML(u.display_name || u.full_name || u.name || "")}</td>
        <td>${escapeHTML(u.role)}</td>
        <td>${escapeHTML(u.dept_th || u.department || "")}</td>
        <td>${escapeHTML(u.status)}</td>
        <td>${Number(u.points || 0).toLocaleString("th-TH")}</td>
      </tr>
    `).join("");
  }
}

async function resetPassword() {
  const empId = document.getElementById("resetEmpId")?.value.trim();
  const pass = document.getElementById("resetTempPass")?.value.trim() || "1234";
  if (!empId) return alertError(new Error("Please enter emp_id"));

  try {
    await rpc("admin_reset_user_password", {
      p_token: getToken(),
      p_target_emp_id: empId,
      p_temp_password: pass
    });
    alertSuccess("Reset password complete");
  } catch (err) {
    alertError(err);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("logoutBtn")?.addEventListener("click", logout);
  document.getElementById("resetBtn")?.addEventListener("click", resetPassword);
  loadAdmin();
});

import { rpc } from "./sbClient.js";
import { getToken, validateSession } from "./sessionService.js";
import { alertError, escapeHTML, fmtDate } from "./uiHelpers.js";

async function loadNotifications() {
  if (!(await validateSession())) return;
  try {
    const data = await rpc("public_list_notifications", { p_token: getToken() });
    const rows = Array.isArray(data) ? data : (data.items || data.rows || []);
    const box = document.getElementById("notiContainer");
    box.innerHTML = rows.length ? rows.map(n => `
      <div class="noti-item ${n.is_read ? "" : "unread"}" onclick="markRead('${n.id}')">
        <div class="icon-box bg-${escapeHTML(n.type || "mission")}"><i class="fas fa-bell"></i></div>
        <div class="content">
          <div class="title">${escapeHTML(n.title || "-")}</div>
          <div class="detail">${escapeHTML(n.detail || n.message || "")}</div>
          <div class="time">${fmtDate(n.created_at)}</div>
        </div>
        ${n.is_read ? "" : "<span class='unread-dot'></span>"}
      </div>
    `).join("") : `<p style="text-align:center;color:#888">ยังไม่มีแจ้งเตือน</p>`;
  } catch (err) { alertError(err); }
}

window.markRead = async function(id) {
  try {
    await rpc("public_mark_notification_read", { p_token: getToken(), p_notification_id: id });
    loadNotifications();
  } catch (err) { alertError(err); }
};

document.addEventListener("DOMContentLoaded", loadNotifications);

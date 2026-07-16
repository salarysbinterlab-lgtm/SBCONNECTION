// assets/js/notificationsLegacy.js
import { getToken, requireLogin } from "./sessionService.js";
import { rpc } from "./sbClient.js";
import { qs, esc, alertError, fmtDate } from "./uiHelpers.js";

if (requireLogin()) loadNoti();

async function loadNoti() {
  try {
    const data = await rpc("public_list_notifications", { p_token: getToken() });
    const box = qs("notiContainer");
    const items = data.items || [];
    box.innerHTML = items.length ? items.map(n => `
      <div class="noti-item ${n.is_read ? "" : "unread"}" data-id="${esc(n.notification_id)}">
        <div class="icon-box bg-${esc(n.type || "system")}"><i class="fas fa-bell"></i></div>
        <div class="content"><div class="title">${esc(n.title)}</div><div class="detail">${esc(n.message || "")}</div><div class="time">${fmtDate(n.created_at)}</div></div>
        ${n.is_read ? "" : '<span class="unread-dot"></span>'}
      </div>`).join("") : `<p style="text-align:center;color:#888">ไม่มีแจ้งเตือน</p>`;
    box.querySelectorAll(".noti-item").forEach(el => el.addEventListener("click", async () => {
      await rpc("public_mark_notification_read", { p_token: getToken(), p_notification_id: el.dataset.id });
      loadNoti();
    }));
  } catch (err) { alertError(err); }
}

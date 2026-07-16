import { rpc } from "./sbClient.js";
import { getToken, getCurrentUser, validateSession, logout } from "./sessionService.js";
import { alertError, alertSuccess, escapeHTML, setText } from "./uiHelpers.js";

async function loadHome() {
  if (!(await validateSession())) return;

  const token = getToken();
  const user = getCurrentUser();
  const empId = user.empId || user.emp_id || "-";
  const dept = user.department || user.dept || "-";

  setText("displayName", user.full_name || user.name || empId);
  setText("displayMeta", `${empId} • ${dept} • ${user.role || "-"}`);
  setText("backMeta", `${user.position || "-"} / ${dept}`);

  const avatar = user.avatar_url || user.avatar;
  if (avatar && document.getElementById("avatar")) document.getElementById("avatar").src = avatar;
  if (avatar && document.getElementById("navAvatar")) document.getElementById("navAvatar").src = avatar;

  try {
    const data = await rpc("get_home_payload", { p_token: token });
    renderHome(data || {});
  } catch (err) {
    alertError(err);
  }
}

function renderHome(data) {
  const user = data.user || data.profile || data;
  const points = Number(data.points || user.points || user.total_points || 0);

  setText("points", points);
  setText("checkCount", user.checkInCount || data.checkin_count || data.total_checkins || 0);
  setText("lastCheck", user.lastCheckIn || data.last_checkin || "-");

  const dash = document.getElementById("personal-dashboard-container");
  if (dash) {
    dash.innerHTML = `
      <div class="sbui-mini-stat"><b>${points.toLocaleString("th-TH")}</b><span>POINTS</span></div>
      <div class="sbui-mini-stat"><b>${data.news_read_count || user.readNewsCount || 0}</b><span>NEWS READ</span></div>
      <div class="sbui-mini-stat"><b>${data.mission_done_count || user.completedMissions || 0}</b><span>MISSIONS</span></div>
      <div class="sbui-mini-stat"><b>${data.reward_count || user.redemptionCount || 0}</b><span>REDEEMS</span></div>
    `;
  }

  const news = data.latest_news || data.news || [];
  const newsBox = document.getElementById("newsPreview");
  if (newsBox) {
    newsBox.innerHTML = news.length ? news.slice(0, 5).map(n => `
      <div class="news-row" onclick="location.href='news.html'">
        <div class="news-title-cell">${escapeHTML(n.topic || n.title || "-")}</div>
        <b>+${Number(n.points || 0)}</b>
      </div>
    `).join("") : `<p style="color:#64748b;font-weight:700">No news yet</p>`;
  }

  const ranking = data.ranking || data.top_ranking || [];
  const rankBox = document.getElementById("rankingPreview");
  if (rankBox) {
    rankBox.innerHTML = ranking.length ? ranking.slice(0, 5).map((r, i) => `
      <div class="news-row" onclick="location.href='ranking.html'">
        <div class="news-title-cell">#${i + 1} ${escapeHTML(r.display_name || r.full_name || r.emp_id || "-")}</div>
        <b>${Number(r.points || r.total_points || 0).toLocaleString("th-TH")}</b>
      </div>
    `).join("") : `<p style="color:#64748b;font-weight:700">No ranking yet</p>`;
  }
}

async function doCheckin() {
  try {
    const data = await rpc("public_checkin", { p_token: getToken() });
    alertSuccess(data.message || "Check-in complete");
    loadHome();
  } catch (err) {
    alertError(err);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("menuBtn")?.addEventListener("click", () => {
    document.getElementById("topMenu")?.classList.toggle("active");
  });
  document.getElementById("logoutLink")?.addEventListener("click", (e) => {
    e.preventDefault();
    logout();
  });
  document.getElementById("checkinBtn")?.addEventListener("click", doCheckin);
  document.getElementById("idCard")?.addEventListener("click", () => {
    document.getElementById("idCard")?.classList.toggle("is-flipped");
  });
  loadHome();
});

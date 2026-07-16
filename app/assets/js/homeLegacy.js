// assets/js/homeLegacy.js
import { getToken, requireLogin, logout } from "./sessionService.js";
import { rpc } from "./sbClient.js";
import { qs, esc, alertError, toast } from "./uiHelpers.js";

if (requireLogin()) initHome();

async function initHome() {
  bindHomeUI();
  await loadHome();
}

function bindHomeUI() {
  qs("logoutLink")?.addEventListener("click", e => { e.preventDefault(); logout(); });
  qs("menuBtn")?.addEventListener("click", () => qs("topMenu")?.classList.toggle("active"));
  qs("idCard")?.addEventListener("click", () => qs("idCard")?.classList.toggle("is-flipped"));
  qs("checkinBtn")?.addEventListener("click", doCheckin);
}

async function loadHome() {
  try {
    const data = await rpc("get_home_payload", { p_token: getToken() });
    renderUser(data.user);
    renderNews(data.news || []);
    renderRanking(data.ranking || []);
    renderDashboard(data);
  } catch (err) { alertError(err); }
}

function renderUser(u = {}) {
  qs("displayName") && (qs("displayName").textContent = u.name || u.empId || "-");
  qs("displayMeta") && (qs("displayMeta").textContent = `${u.empId || "-"} • ${u.dept || "-"} • ${u.position || "-"}`);
  qs("backMeta") && (qs("backMeta").textContent = `${u.role || "user"} / ${u.dept || "-"}`);
  qs("points") && (qs("points").textContent = u.points ?? 0);
  qs("checkCount") && (qs("checkCount").textContent = `${u.checkInCount ?? 0} ครั้ง`);
  qs("lastCheck") && (qs("lastCheck").textContent = u.lastCheckIn || "-" );
  const img = u.avatar || "../assets/img/avatar.svg";
  qs("avatar") && (qs("avatar").src = img);
  qs("navAvatar") && (qs("navAvatar").src = img);
}

function renderNews(items) {
  const box = qs("newsPreview"); if (!box) return;
  box.innerHTML = items.length ? items.map(n => `
    <div class="news-row" onclick="location.href='news.html'">
      <div class="news-title-cell">${esc(n.topic || n.title)}</div>
      <b style="color:#059669">+${Number(n.points || 0)}</b>
    </div>`).join("") : `<p style="color:#64748b">ยังไม่มีข่าว</p>`;
}
function renderRanking(items) {
  const box = qs("rankingPreview"); if (!box) return;
  box.innerHTML = items.length ? items.map(r => `
    <div class="news-row" onclick="location.href='ranking.html'">
      <div class="news-title-cell">#${r.rank_no} ${esc(r.display_name || r.emp_id)}</div>
      <b style="color:#059669">${Number(r.points || 0)}</b>
    </div>`).join("") : `<p style="color:#64748b">ยังไม่มีอันดับ</p>`;
}
function renderDashboard(data) {
  const box = qs("personal-dashboard-container"); if (!box) return;
  const u = data.user || {};
  box.innerHTML = `
    <div class="sbui-mini-stat"><b>${u.points ?? 0}</b><span>แต้มปัจจุบัน</span></div>
    <div class="sbui-mini-stat"><b>${u.checkInCount ?? 0}</b><span>เช็คอินสะสม</span></div>
    <div class="sbui-mini-stat"><b>${(data.news || []).length}</b><span>ข่าวล่าสุด</span></div>
    <div class="sbui-mini-stat"><b>${(data.rewards || []).length}</b><span>รางวัลเปิดแลก</span></div>`;
}
async function doCheckin() {
  try {
    const res = await rpc("public_checkin", { p_token: getToken() });
    toast(res.message || "เช็คอินสำเร็จ", res.status === "already_checked" ? "info" : "success");
    await loadHome();
  } catch (err) { alertError(err); }
}

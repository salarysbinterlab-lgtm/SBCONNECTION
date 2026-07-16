import { rpc } from "./sbClient.js";
import { getToken, validateSession } from "./sessionService.js";
import { alertError, alertSuccess, escapeHTML, fmtDate, setText } from "./uiHelpers.js";

const page = document.body.dataset.page || location.pathname.split("/").pop().replace(".html", "");
let items = [];

function pageKey() {
  if (page === "rewards") return "rewards";
  if (page === "ranking") return "ranking";
  if (page === "overall_log") return "overall_log";
  if (page === "mission") return "mission";
  return "news";
}

async function load() {
  if (!(await validateSession())) return;

  try {
    const data = await rpc("public_page_payload", {
      p_token: getToken(),
      p_page: pageKey()
    });

    items = Array.isArray(data)
      ? data
      : (data.items || data.rows || data.news || data.missions || data.rewards || data.ranking || data.logs || []);

    setText("myPoints", data.myPoints || data.my_points || data.points || 0);
    render(items);
  } catch (err) {
    alertError(err);
  } finally {
    const o = document.getElementById("loadingOverlay");
    if (o) o.style.display = "none";
  }
}

function render(rows) {
  setText("itemCount", `${rows.length} รายการ`);
  const box = document.getElementById("contentList");
  const summary = document.getElementById("summaryStrip");

  if (summary) {
    summary.innerHTML = `
      <div class="sbui-mini-stat"><b>${rows.length}</b><span>ทั้งหมด</span></div>
      <div class="sbui-mini-stat"><b>${rows.filter(x => x.is_done || x.done || x.is_read).length}</b><span>สำเร็จ/อ่านแล้ว</span></div>
    `;
  }

  if (!box) return;

  if (page === "news") {
    box.innerHTML = rows.map(n => card(
      n.cover_url || n.image_url,
      n.topic || n.title,
      n.detail || n.summary || n.description,
      `+${n.points || 0} แต้ม`,
      n.done ? "" : `readNews('${n.id}')`
    )).join("");
  } else if (page === "mission") {
    box.innerHTML = rows.map(m => card(
      m.cover_url || m.image_url,
      m.title,
      m.description || m.detail,
      `+${m.points || 0} แต้ม`,
      m.done ? "" : `submitMission('${m.id}')`
    )).join("");
  } else if (page === "rewards") {
    box.innerHTML = rows.map(r => card(
      r.image_url,
      r.name || r.title,
      r.detail || r.description,
      `${r.points_required || r.points || r.points_cost || 0} แต้ม`,
      r.can_redeem === false ? "" : `redeemReward('${r.id}')`
    )).join("");
  } else if (page === "ranking") {
    box.innerHTML = rows.map((r, i) => `
      <div class="rank-card">
        <b>#${r.id || i + 1}</b>
        <span>${escapeHTML(r.display_name || r.full_name || r.title || r.emp_id || "-")}</span>
        <strong>${Number(r.points || r.total_points || 0).toLocaleString("th-TH")}</strong>
      </div>
    `).join("");
  } else {
    box.innerHTML = rows.map(r => `
      <div class="glass-card">
        <b>${escapeHTML(r.title || r.source_type || r.action || "-")}</b>
        <p>${escapeHTML(r.description || r.detail || r.note || "")}</p>
        <small>${fmtDate(r.created_at || r.log_at)}</small>
      </div>
    `).join("");
  }
}

function card(img, title, detail, badge, action) {
  return `
    <article class="glass-card card-mission">
      ${img ? `<img class="mission-img img-cover" src="${escapeHTML(img)}" alt="">` : ""}
      <div class="mission-body">
        <h3>${escapeHTML(title || "-")}</h3>
        <p>${escapeHTML(detail || "")}</p>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
          <span class="badge-point point-pill">${escapeHTML(badge)}</span>
          ${action ? `<button class="sbui-action-btn sbui-btn-primary" onclick="${action}">Action</button>` : `<span class="badge-point point-pill">Done</span>`}
        </div>
      </div>
    </article>
  `;
}

window.readNews = async function(id) {
  try {
    const res = await rpc("public_read_news", { p_token: getToken(), p_news_id: id });
    alertSuccess(res.message || "Read complete");
    load();
  } catch (err) {
    alertError(err);
  }
};

window.submitMission = async function(id) {
  try {
    const res = await rpc("public_complete_mission", {
      p_token: getToken(),
      p_mission_id: id,
      p_evidence_url: null
    });
    alertSuccess(res.message || "Mission complete");
    load();
  } catch (err) {
    alertError(err);
  }
};

window.redeemReward = async function(id) {
  try {
    const ok = await Swal.fire({
      icon: "question",
      title: "ยืนยันการแลก?",
      showCancelButton: true,
      confirmButtonText: "แลก"
    });
    if (!ok.isConfirmed) return;

    const res = await rpc("public_redeem_reward", { p_token: getToken(), p_reward_id: id });
    alertSuccess(res.message || "Redeem complete");
    load();
  } catch (err) {
    alertError(err);
  }
};

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("refreshBtn")?.addEventListener("click", load);
  document.getElementById("searchInput")?.addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase();
    render(items.filter(x => JSON.stringify(x).toLowerCase().includes(q)));
  });
  load();
});

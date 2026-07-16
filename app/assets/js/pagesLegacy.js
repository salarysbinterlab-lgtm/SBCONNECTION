// assets/js/pagesLegacy.js
import { getToken, requireLogin } from "./sessionService.js";
import { rpc } from "./sbClient.js";
import { qs, esc, alertError, toast, setLoading } from "./uiHelpers.js";

const page = document.body.dataset.page;
let allItems = [];

if (requireLogin()) init();

function init() {
  qs("refreshBtn")?.addEventListener("click", load);
  qs("searchInput")?.addEventListener("input", render);
  qs("filterSelect")?.addEventListener("change", render);
  qs("actionBtn")?.addEventListener("click", load);
  load();
}

async function load() {
  try {
    setLoading(true);
    const data = await rpc("public_page_payload", { p_token: getToken(), p_page: page });
    allItems = data.items || [];
    qs("myPoints") && (qs("myPoints").textContent = data.myPoints ?? 0);
    renderSummary(data.myPoints || 0);
    render();
  } catch (err) { alertError(err); }
  finally { setLoading(false); }
}

function renderSummary(points) {
  const strip = qs("summaryStrip"); if (!strip) return;
  const active = allItems.filter(x => x.status === "active" || x.can_redeem).length;
  const done = allItems.filter(x => x.done).length;
  strip.innerHTML = `
    <div class="sbui-mini-stat"><b>${allItems.length}</b><span>ทั้งหมด</span></div>
    <div class="sbui-mini-stat"><b>${active}</b><span>Active</span></div>
    <div class="sbui-mini-stat"><b>${done}</b><span>Done</span></div>
    <div class="sbui-mini-stat"><b>${points}</b><span>POINTS</span></div>`;
}

function filteredItems() {
  const q = (qs("searchInput")?.value || "").toLowerCase();
  const f = qs("filterSelect")?.value || "all";
  return allItems.filter(x => {
    const text = JSON.stringify(x).toLowerCase();
    const byText = !q || text.includes(q);
    const byFilter = f === "all" || (f === "done" ? !!x.done : (x.status === f || (f === "active" && x.status === "active")));
    return byText && byFilter;
  });
}

function render() {
  const list = qs("contentList"); if (!list) return;
  const items = filteredItems();
  qs("itemCount") && (qs("itemCount").textContent = `${items.length} รายการ`);
  list.innerHTML = items.length ? items.map(cardHTML).join("") : `<div class="glass-card">ไม่พบข้อมูล</div>`;
  list.querySelectorAll("[data-action]").forEach(btn => btn.addEventListener("click", handleAction));
}

function cardHTML(x) {
  if (page === "ranking") {
    return `<div class="glass-card rank-card"><b>#${esc(x.id)}</b> ${esc(x.title)}<br><small>${esc(x.description || "")}</small><div class="point-pill"><span class="value">${x.points || 0}</span><span class="label">POINTS</span></div></div>`;
  }
  if (page === "overall_log") {
    return `<div class="glass-card"><b>${esc(x.title)}</b><p>${esc(x.description || "")}</p><div class="point-pill"><span class="value">${x.points || 0}</span><span class="label">BAL ${x.balance_after ?? ""}</span></div></div>`;
  }
  const img = x.image_url ? `<img class="item-img" src="${esc(x.image_url)}" onerror="this.style.display='none'">` : "";
  let action = "";
  if (page === "news") action = x.done ? `<button class="sbui-action-btn sbui-btn-soft" disabled>อ่านแล้ว</button>` : `<button class="sbui-action-btn sbui-btn-primary" data-action="read-news" data-id="${esc(x.id)}">อ่านรับแต้ม</button>`;
  if (page === "mission") action = x.done ? `<button class="sbui-action-btn sbui-btn-soft" disabled>สำเร็จแล้ว</button>` : `<button class="sbui-action-btn sbui-btn-primary" data-action="complete-mission" data-id="${esc(x.id)}">ส่งภารกิจ</button>`;
  if (page === "rewards") action = x.can_redeem ? `<button class="sbui-action-btn sbui-btn-primary" data-action="redeem" data-id="${esc(x.id)}">แลก ${x.points || 0} แต้ม</button>` : `<button class="sbui-action-btn sbui-btn-soft" disabled>แต้มไม่พอ/หมด</button>`;
  return `<article class="glass-card content-card">${img}<h3>${esc(x.title)}</h3><p>${esc(x.description || "")}</p><div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><b style="color:#059669">${x.points || 0} pts</b>${action}</div></article>`;
}

async function handleAction(e) {
  const btn = e.currentTarget;
  const id = btn.dataset.id;
  try {
    if (btn.dataset.action === "read-news") {
      const res = await rpc("public_read_news", { p_token: getToken(), p_news_id: id });
      toast(res.message || "อ่านข่าวสำเร็จ");
    } else if (btn.dataset.action === "complete-mission") {
      let evidence = "";
      if (window.Swal) {
        const r = await Swal.fire({ title:"ลิงก์หลักฐาน Google Drive", input:"url", inputPlaceholder:"วางลิงก์รูป/หลักฐาน ถ้ามี", showCancelButton:true, confirmButtonText:"ส่งภารกิจ" });
        if (!r.isConfirmed) return;
        evidence = r.value || "";
      }
      const res = await rpc("public_complete_mission", { p_token: getToken(), p_mission_id: id, p_evidence_url: evidence });
      toast(res.message || "ส่งภารกิจสำเร็จ");
    } else if (btn.dataset.action === "redeem") {
      const ok = !window.Swal || (await Swal.fire({ title:"ยืนยันแลกรางวัล?", icon:"question", showCancelButton:true })).isConfirmed;
      if (!ok) return;
      const res = await rpc("public_redeem_reward", { p_token: getToken(), p_reward_id: id });
      toast(res.message || "แลกรางวัลสำเร็จ");
    }
    await load();
  } catch (err) { alertError(err); }
}

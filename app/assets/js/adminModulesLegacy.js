// assets/js/adminModulesLegacy.js
import { getToken, requireAdmin } from "./sessionService.js";
import { rpc } from "./sbClient.js";
import { qs, esc, alertError, toast, toCSV, downloadText } from "./uiHelpers.js";

const moduleName = document.body.dataset.adminModule;
let rows = [];
let columns = [];

if (requireAdmin()) init();
function init() {
  qs("refreshBtn")?.addEventListener("click", load);
  qs("searchInput")?.addEventListener("input", debounce(load, 300));
  qs("addBtn")?.addEventListener("click", openAddForm);
  qs("exportBtn")?.addEventListener("click", () => downloadText(`${moduleName}.csv`, toCSV(rows)));
  load();
}
function debounce(fn, ms){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; }
async function load() {
  try {
    const data = await rpc("admin_module_payload", { p_token:getToken(), p_module:moduleName, p_search:qs("searchInput")?.value || "", p_limit:200, p_offset:0 });
    rows = data.items || []; columns = data.columns || Object.keys(rows[0] || {});
    render();
  } catch (err) { alertError(err); }
}
function render() {
  qs("moduleHead") && (qs("moduleHead").innerHTML = `<tr>${columns.map(c=>`<th>${esc(c)}</th>`).join("")}<th>ACTION</th></tr>`);
  qs("moduleBody") && (qs("moduleBody").innerHTML = rows.map((r,i) => `<tr>${columns.map(c=>`<td>${esc(r[c])}</td>`).join("")}<td><button class="admin-mini-btn" data-row="${i}">แก้</button></td></tr>`).join(""));
  qs("pagerInfo") && (qs("pagerInfo").textContent = `${rows.length} รายการ`);
  qs("moduleKpi") && (qs("moduleKpi").innerHTML = `<div class="stat-card"><span class="stat-val">${rows.length}</span><span class="stat-label">TOTAL</span></div>`);
  document.querySelectorAll("[data-row]").forEach(b => b.addEventListener("click", () => openAddForm(rows[Number(b.dataset.row)])));
}
async function openAddForm(row = null) {
  try {
    if (moduleName === "news") return saveNews(row);
    if (moduleName === "missions") return saveMission(row);
    if (moduleName === "rewards") return saveReward(row);
    if (moduleName === "users") return saveUser(row);
    if (moduleName === "manager_depts") return saveManagerDept(row);
    if (moduleName === "ledger") return Swal.fire("Ledger", "Ledger เป็น log อัตโนมัติ แก้ตรงนี้ไม่ได้", "info");
  } catch (err) { alertError(err); }
}
async function htmlForm(title, html) {
  const r = await Swal.fire({ title, html, width: 680, showCancelButton:true, confirmButtonText:"บันทึก", focusConfirm:false, preConfirm:()=>{
    const obj={}; document.querySelectorAll("[data-f]").forEach(i=>obj[i.dataset.f]=i.value); return obj;
  }});
  return r.isConfirmed ? r.value : null;
}
async function saveNews(r={}) {
  const v = await htmlForm("News Manager", form([
    ["news_id","ID",r.news_id||""],["topic","หัวข้อ",r.topic||""],["detail","รายละเอียด",r.detail||""],["points","แต้ม",r.points||0],["image_url","Google Drive/LH3 URL",r.image_url||""],["status","status active/inactive",r.status||"active"]]));
  if (!v) return;
  await rpc("admin_save_news", { p_token:getToken(), p_news_id:v.news_id, p_topic:v.topic, p_detail:v.detail, p_points:Number(v.points||0), p_image_url:v.image_url||null, p_status:v.status||"active" }); toast("บันทึกข่าวสำเร็จ"); load();
}
async function saveMission(r={}) {
  const v = await htmlForm("Mission / Quest", form([
    ["mission_id","ID",r.mission_id||""],["title","ชื่อภารกิจ",r.title||""],["description","รายละเอียด",r.description||""],["points","แต้ม",r.points||0],["image_url","Google Drive/LH3 URL",r.image_url||""],["status","status active/inactive",r.status||"active"]]));
  if (!v) return;
  await rpc("admin_save_mission", { p_token:getToken(), p_mission_id:v.mission_id, p_title:v.title, p_description:v.description, p_points:Number(v.points||0), p_image_url:v.image_url||null, p_status:v.status||"active" }); toast("บันทึกภารกิจสำเร็จ"); load();
}
async function saveReward(r={}) {
  const v = await htmlForm("Reward Management", form([
    ["reward_id","ID",r.reward_id||""],["name","ชื่อรางวัล",r.name||""],["detail","รายละเอียด",r.detail||""],["points_required","แต้มที่ใช้",r.points_required||0],["stock","สต็อก",r.stock||0],["image_url","Google Drive/LH3 URL",r.image_url||""],["status","status active/inactive",r.status||"active"]]));
  if (!v) return;
  await rpc("admin_save_reward", { p_token:getToken(), p_reward_id:v.reward_id, p_name:v.name, p_detail:v.detail, p_points_required:Number(v.points_required||0), p_stock:Number(v.stock||0), p_image_url:v.image_url||null, p_status:v.status||"active" }); toast("บันทึกรางวัลสำเร็จ"); load();
}
async function saveUser(r={}) {
  const v = await htmlForm("User Management", form([
    ["emp_id","emp_id",r.emp_id||""],["name_th","ชื่อ",r.name||""],["surname_th","นามสกุล",r.surname_th||""],["dept_th","แผนก",r.dept||""],["pos_th","ตำแหน่ง",r.position||""],["role","role",r.role||"user"],["status","status",r.status||"active"]]));
  if (!v) return;
  await rpc("admin_save_user_simple", { p_token:getToken(), p_emp_id:v.emp_id, p_name_th:v.name_th, p_surname_th:v.surname_th, p_dept_th:v.dept_th, p_pos_th:v.pos_th, p_role:v.role||"user", p_status:v.status||"active" }); toast("บันทึกผู้ใช้สำเร็จ"); load();
}
async function saveManagerDept(r={}) {
  const v = await htmlForm("Manager Depts", form([["manager_emp_id","manager emp_id",r.manager_emp_id||""],["dept_th","แผนกที่ดูแล",r.dept_th||""]]));
  if (!v) return;
  await rpc("admin_save_manager_dept", { p_token:getToken(), p_manager_emp_id:v.manager_emp_id, p_dept_th:v.dept_th }); toast("บันทึกสิทธิ์แผนกสำเร็จ"); load();
}
function form(fields) { return `<div style="display:grid;gap:10px;text-align:left">${fields.map(([n,l,v])=>`<label><b>${l}</b><input data-f="${n}" class="swal2-input" value="${esc(v)}"></label>`).join("")}</div>`; }

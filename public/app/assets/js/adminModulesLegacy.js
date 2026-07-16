import { rpc } from "./sbClient.js";
import { getToken, validateSession } from "./sessionService.js";
import { alertError, alertSuccess, csvDownload, escapeHTML, fmtDate, setText } from "./uiHelpers.js";

const moduleName = document.body.dataset.adminModule || "users";
let rows = [];

const CONFIG = {
  users: {
    title: "Users",
    columns: ["emp_id", "name", "role", "dept", "position", "status", "points"]
  },
  news: {
    title: "News",
    columns: ["news_id", "topic", "points", "status", "publish_date", "pinned"]
  },
  missions: {
    title: "Missions",
    columns: ["mission_id", "title", "points", "status", "created_at"]
  },
  rewards: {
    title: "Rewards",
    columns: ["reward_id", "name", "points_required", "stock", "status"]
  },
  ledger: {
    title: "Point Ledger",
    columns: ["tx_id", "emp_id", "tx_type", "amount", "balance_after", "source_type", "created_at"]
  },
  manager_depts: {
    title: "Manager Depts",
    columns: ["id", "manager_emp_id", "dept_th", "updated_at"]
  }
};

function cfg() {
  return CONFIG[moduleName] || CONFIG.users;
}

async function load() {
  if (!(await validateSession({ admin: true }))) return;

  try {
    const data = await rpc("admin_module_payload", {
      p_token: getToken(),
      p_module: moduleName,
      p_search: "",
      p_limit: 200,
      p_offset: 0
    });

    rows = Array.isArray(data) ? data : (data.items || data.rows || []);
    render(rows);
  } catch (err) {
    alertError(err);
  }
}

function render(data) {
  setText("pagerInfo", `${data.length} รายการ`);

  const kpi = document.getElementById("moduleKpi");
  if (kpi) {
    kpi.innerHTML = `
      <div class="sbui-mini-stat"><b>${data.length}</b><span>ทั้งหมด</span></div>
      <div class="sbui-mini-stat"><b>${data.filter(x => String(x.status || "active").toLowerCase() === "active").length}</b><span>ACTIVE</span></div>
    `;
  }

  const head = document.getElementById("moduleHead");
  const body = document.getElementById("moduleBody");
  const cols = cfg().columns;

  if (head) head.innerHTML = `<tr>${cols.map(c => `<th>${escapeHTML(c)}</th>`).join("")}<th>ACTION</th></tr>`;
  if (body) {
    body.innerHTML = data.map(row => `
      <tr>
        ${cols.map(c => `<td>${renderCell(row[c])}</td>`).join("")}
        <td><button class="admin-mini-btn" onclick='editRow(${JSON.stringify(row).replaceAll("'", "&#039;")})'>แก้ไข</button></td>
      </tr>
    `).join("");
  }
}

function renderCell(value) {
  if (String(value || "").includes("T") && String(value || "").includes(":")) return escapeHTML(fmtDate(value));
  return escapeHTML(value ?? "-");
}

window.editRow = async function(row) {
  await openForm(row);
};

function fieldId(row) {
  return row.news_id || row.mission_id || row.reward_id || row.emp_id || "";
}

async function openForm(row = {}) {
  if (moduleName === "ledger") {
    return alertError(new Error("This module is read-only."));
  }

  const isContent = ["news", "missions", "rewards"].includes(moduleName);
  const html = isContent ? `
    <input id="f_title" class="swal2-input" placeholder="Title / Name" value="${escapeHTML(row.topic || row.title || row.name || "")}">
    <textarea id="f_detail" class="swal2-textarea" placeholder="Detail">${escapeHTML(row.detail || row.description || "")}</textarea>
    <input id="f_points" class="swal2-input" type="number" placeholder="Points" value="${escapeHTML(row.points || row.points_required || 0)}">
    ${moduleName === "rewards" ? `<input id="f_stock" class="swal2-input" type="number" placeholder="Stock" value="${escapeHTML(row.stock || 0)}">` : ""}
    <input id="f_image" class="swal2-input" placeholder="image_url / Google Drive lh3 link" value="${escapeHTML(row.image_url || row.cover_url || "")}">
    <input id="f_status" class="swal2-input" placeholder="status" value="${escapeHTML(row.status || "active")}">
  ` : `
    <input id="f_emp" class="swal2-input" placeholder="emp_id" value="${escapeHTML(row.emp_id || row.manager_emp_id || "")}">
    <input id="f_name" class="swal2-input" placeholder="name / department" value="${escapeHTML(row.name || row.full_name || row.dept_th || "")}">
    <input id="f_dept" class="swal2-input" placeholder="department" value="${escapeHTML(row.dept || row.dept_th || "")}">
    <input id="f_pos" class="swal2-input" placeholder="position" value="${escapeHTML(row.position || "")}">
    <input id="f_role" class="swal2-input" placeholder="role" value="${escapeHTML(row.role || "user")}">
    <input id="f_status" class="swal2-input" placeholder="status" value="${escapeHTML(row.status || "active")}">
  `;

  const res = await Swal.fire({
    title: cfg().title,
    html,
    showCancelButton: true,
    confirmButtonText: "บันทึก",
    cancelButtonText: "ยกเลิก",
    width: 620
  });

  if (!res.isConfirmed) return;

  try {
    await saveCurrentRow(row);
    alertSuccess("บันทึกแล้ว");
    load();
  } catch (err) {
    alertError(err);
  }
}

async function saveCurrentRow(row = {}) {
  if (moduleName === "news") {
    return rpc("admin_save_news", {
      p_token: getToken(),
      p_news_id: row.news_id || null,
      p_topic: document.getElementById("f_title").value,
      p_detail: document.getElementById("f_detail").value,
      p_points: Number(document.getElementById("f_points").value || 0),
      p_image_url: document.getElementById("f_image").value || null,
      p_status: document.getElementById("f_status").value || "active"
    });
  }

  if (moduleName === "missions") {
    return rpc("admin_save_mission", {
      p_token: getToken(),
      p_mission_id: row.mission_id || null,
      p_title: document.getElementById("f_title").value,
      p_description: document.getElementById("f_detail").value,
      p_points: Number(document.getElementById("f_points").value || 0),
      p_image_url: document.getElementById("f_image").value || null,
      p_status: document.getElementById("f_status").value || "active"
    });
  }

  if (moduleName === "rewards") {
    return rpc("admin_save_reward", {
      p_token: getToken(),
      p_reward_id: row.reward_id || null,
      p_name: document.getElementById("f_title").value,
      p_detail: document.getElementById("f_detail").value,
      p_points_required: Number(document.getElementById("f_points").value || 0),
      p_stock: Number(document.getElementById("f_stock")?.value || 0),
      p_image_url: document.getElementById("f_image").value || null,
      p_status: document.getElementById("f_status").value || "active"
    });
  }

  if (moduleName === "manager_depts") {
    return rpc("admin_save_manager_dept", {
      p_token: getToken(),
      p_manager_emp_id: document.getElementById("f_emp").value,
      p_dept_th: document.getElementById("f_dept").value || document.getElementById("f_name").value
    });
  }

  return rpc("admin_save_user_simple", {
    p_token: getToken(),
    p_emp_id: document.getElementById("f_emp").value || fieldId(row),
    p_name_th: document.getElementById("f_name").value,
    p_surname_th: null,
    p_dept_th: document.getElementById("f_dept").value,
    p_pos_th: document.getElementById("f_pos").value,
    p_role: document.getElementById("f_role").value || "user",
    p_status: document.getElementById("f_status").value || "active"
  });
}

function exportCSV() {
  const cols = cfg().columns;
  const data = [cols, ...rows.map(r => cols.map(c => r[c]))];
  csvDownload(`${moduleName}.csv`, data);
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("refreshBtn")?.addEventListener("click", load);
  document.getElementById("addBtn")?.addEventListener("click", () => openForm({}));
  document.getElementById("exportBtn")?.addEventListener("click", exportCSV);
  document.getElementById("searchInput")?.addEventListener("input", e => {
    const q = e.target.value.toLowerCase();
    render(rows.filter(x => JSON.stringify(x).toLowerCase().includes(q)));
  });
  document.getElementById("filterSelect")?.addEventListener("change", e => {
    if (e.target.value === "all") render(rows);
    else render(rows.filter(x => String(x.status || "active").toLowerCase() === "active"));
  });
  load();
});

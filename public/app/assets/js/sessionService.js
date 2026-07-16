import { rpc } from "./sbClient.js";

const TOKEN_KEY = "sb_session_token";
const USER_KEY = "sb_current_user";
const TMP_PASS_KEY = "sb_tmp_login_password";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "{}");
  } catch {
    return {};
  }
}

export function getTempPassword() {
  return sessionStorage.getItem(TMP_PASS_KEY) || "";
}

export function clearTempPassword() {
  sessionStorage.removeItem(TMP_PASS_KEY);
}

function normalizeUser(user = {}) {
  return {
    ...user,
    empId: user.empId || user.emp_id || user.empid || "",
    emp_id: user.emp_id || user.empId || user.empid || "",
    name: user.name || user.full_name || user.display_name || "",
    full_name: user.full_name || user.name || user.display_name || "",
    dept: user.dept || user.department || user.dept_th || "",
    department: user.department || user.dept || user.dept_th || "",
    position: user.position || user.pos_th || user.position_name || "",
    avatar: user.avatar || user.avatar_url || "",
    avatar_url: user.avatar_url || user.avatar || ""
  };
}

export function setSession(token, user, tempPassword = "") {
  localStorage.setItem(TOKEN_KEY, token || "");
  localStorage.setItem(USER_KEY, JSON.stringify(normalizeUser(user || {})));
  if (tempPassword) sessionStorage.setItem(TMP_PASS_KEY, tempPassword);
}

function clearSessionLocal() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  clearTempPassword();
}

function rootIndexUrl() {
  if (location.pathname.includes("/app/pages/")) return "../../index.html";
  if (location.pathname.includes("/app/")) return "../index.html";
  return "index.html";
}

export async function login(empId, password) {
  const res = await rpc("login_with_emp_password", {
    p_emp_id: empId,
    p_password: password,
    p_user_agent: navigator.userAgent
  });

  if (res.status === "success") {
    setSession(res.token, res.user, password);
    return res;
  }

  if (res.status === "first_setup_required" || res.mustChangePassword) {
    if (res.token && res.user) setSession(res.token, res.user, password);
    return { ...res, mustChangePassword: true };
  }

  throw new Error(res.message || "เข้าสู่ระบบไม่สำเร็จ");
}

export function getRolePage(user = getCurrentUser()) {
  const role = String(user.role || "").toLowerCase();
  return ["admin", "admin_it", "dev"].includes(role) ? "homeAdmin.html" : "home.html";
}

export function requireLogin() {
  if (!getToken()) {
    location.href = rootIndexUrl();
    return false;
  }
  return true;
}

export function requireAdmin() {
  if (!requireLogin()) return false;
  const role = String(getCurrentUser().role || "").toLowerCase();
  if (!["admin", "admin_it", "dev"].includes(role)) {
    location.href = "home.html";
    return false;
  }
  return true;
}

export async function validateSession({ admin = false } = {}) {
  const token = getToken();
  if (!token) {
    location.href = rootIndexUrl();
    return false;
  }

  try {
    const res = await rpc("validate_public_session", { p_token: token });
    if (!res || res.status !== "success") throw new Error(res?.message || "SESSION_EXPIRED");

    const user = normalizeUser(res.user || {});
    localStorage.setItem(USER_KEY, JSON.stringify(user));

    const role = String(user.role || "").toLowerCase();
    if (admin && !["admin", "admin_it", "dev"].includes(role)) {
      location.href = "home.html";
      return false;
    }

    return true;
  } catch (err) {
    clearSessionLocal();
    location.href = rootIndexUrl();
    return false;
  }
}

export async function logout() {
  const token = getToken();
  try {
    if (token) await rpc("logout_public_session", { p_token: token });
  } catch (err) {
    console.warn(err);
  }
  clearSessionLocal();
  location.href = rootIndexUrl();
}

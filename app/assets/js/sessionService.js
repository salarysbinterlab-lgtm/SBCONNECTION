// assets/js/sessionService.js
import { rpc } from "./sbClient.js";

const TOKEN_KEY = "sb_session_token";
const USER_KEY = "sb_current_user";
const TMP_PASS_KEY = "sb_tmp_login_password";

export function getToken() { return localStorage.getItem(TOKEN_KEY); }
export function getUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || "null"); } catch { return null; }
}
export function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user || {}));
}
export function saveTempPassword(password) { sessionStorage.setItem(TMP_PASS_KEY, password || ""); }
export function getTempPassword() { return sessionStorage.getItem(TMP_PASS_KEY) || ""; }
export function clearTempPassword() { sessionStorage.removeItem(TMP_PASS_KEY); }

export async function login(empId, password) {
  const res = await rpc("login_with_emp_password", {
    p_emp_id: empId,
    p_password: password,
    p_user_agent: navigator.userAgent
  });
  if (res.status === "success") {
    setSession(res.token, res.user);
    saveTempPassword(password);
  }
  return res;
}

export async function logout() {
  const token = getToken();
  try { if (token) await rpc("logout_public_session", { p_token: token }); } catch (e) { console.warn(e); }
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  clearTempPassword();
  location.href = location.pathname.includes("/pages/") ? "../index.html" : "index.html";
}

export function requireLogin() {
  if (!getToken()) {
    location.href = location.pathname.includes("/pages/") ? "../index.html" : "index.html";
    return false;
  }
  return true;
}

export function requireAdmin() {
  const user = getUser();
  if (!requireLogin()) return false;
  if (!user || !["admin", "admin_it", "dev"].includes(String(user.role))) {
    location.href = "home.html";
    return false;
  }
  return true;
}

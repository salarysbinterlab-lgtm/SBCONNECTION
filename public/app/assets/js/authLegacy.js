import { login, getRolePage, getToken, getTempPassword, clearTempPassword } from "./sessionService.js";
import { rpc } from "./sbClient.js";
import { alertError } from "./uiHelpers.js";

let firstLoginEmpId = "";

function qs(id) { return document.getElementById(id); }
function pageUrl(file) { return location.pathname.includes("/pages/") ? file : `pages/${file}`; }

function showLoader(show) {
  if (qs("loader")) qs("loader").style.display = show ? "block" : "none";
  if (qs("btnLogin")) qs("btnLogin").disabled = !!show;
}

function openFirstLogin(empId) {
  firstLoginEmpId = empId;
  if (qs("firstPasswordUserText")) qs("firstPasswordUserText").textContent = `บัญชี ${empId} ต้องตั้งรหัสผ่านใหม่ก่อนเข้าใช้งาน`;
  if (qs("firstPasswordOverlay")) {
    qs("firstPasswordOverlay").classList.add("active");
    qs("firstPasswordOverlay").style.display = "flex";
  }
}

function closeFirstLogin() {
  if (qs("firstPasswordOverlay")) {
    qs("firstPasswordOverlay").classList.remove("active");
    qs("firstPasswordOverlay").style.display = "none";
  }
}

function goAfterLogin(user) {
  const target = getRolePage(user);
  if (qs("loginForm")) qs("loginForm").style.display = "none";
  if (qs("successForm")) qs("successForm").style.display = "block";
  setTimeout(() => location.href = pageUrl(target), 650);
}

async function handleLogin() {
  const empId = (qs("uid")?.value || "").trim();
  const pass = qs("upass")?.value || "";
  if (!empId || !pass) return alertError(new Error("กรุณากรอกรหัสพนักงานและรหัสผ่าน"));
  showLoader(true);
  try {
    const res = await login(empId, pass);
    if (res.mustChangePassword) return openFirstLogin(empId);
    goAfterLogin(res.user);
  } catch (err) {
    alertError(err);
  } finally {
    showLoader(false);
  }
}

async function submitFirstPasswordChange() {
  const p1 = qs("newPass1")?.value || "";
  const p2 = qs("newPass2")?.value || "";
  if (!/^[A-Za-z0-9]{8}$/.test(p1)) return alertError(new Error("รหัสใหม่ต้องเป็น A-Z, a-z, 0-9 จำนวน 8 ตัวพอดี"));
  if (p1 !== p2) return alertError(new Error("รหัสผ่านใหม่ไม่ตรงกัน"));
  if (p1 === "1234") return alertError(new Error("ห้ามใช้ 1234 ซ้ำ"));

  try {
    const token = getToken();
    if (token) {
      await rpc("change_my_password", {
        p_token: token,
        p_current_password: getTempPassword(),
        p_new_password: p1,
        p_confirm_password: p2
      });
      clearTempPassword();
      goAfterLogin(JSON.parse(localStorage.getItem("sb_current_user") || "{}"));
      return;
    }

    await rpc("setup_first_password_no_credential", {
      p_emp_id: firstLoginEmpId,
      p_new_password: p1,
      p_confirm_password: p2
    });

    const res = await login(firstLoginEmpId, p1);
    goAfterLogin(res.user);
  } catch (err) {
    alertError(err);
  }
}

function sanitizePasswordInput(input) {
  input.value = String(input.value || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 8);
}

window.handleLogin = handleLogin;
window.cancelFirstPasswordChange = closeFirstLogin;
window.submitFirstPasswordChange = submitFirstPasswordChange;
window.sanitizePasswordInput = sanitizePasswordInput;

document.addEventListener("DOMContentLoaded", () => {
  qs("btnLogin")?.addEventListener("click", handleLogin);
  qs("upass")?.addEventListener("keydown", e => { if (e.key === "Enter") handleLogin(); });
});

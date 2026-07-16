// assets/js/authLegacy.js
import { login, getToken, getTempPassword, clearTempPassword } from "./sessionService.js";
import { rpc } from "./sbClient.js";
import { qs, alertError } from "./uiHelpers.js";

let firstLoginEmpId = null;

function showLoader(show) {
  const loader = qs("loader");
  const btn = qs("btnLogin");
  if (loader) loader.style.display = show ? "block" : "none";
  if (btn) btn.disabled = !!show;
}

window.sanitizePasswordInput = function(input) {
  input.value = String(input.value || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 8);
};

window.handleLogin = async function() {
  const empId = qs("uid")?.value.trim();
  const pass = qs("upass")?.value || "";
  if (!empId || !pass) return alertError(new Error("กรุณากรอกรหัสพนักงานและรหัสผ่าน"));
  showLoader(true);
  try {
    const res = await login(empId, pass);
    if (res.status === "first_setup_required") {
      firstLoginEmpId = empId;
      openFirstPasswordOverlay(empId);
      return;
    }
    if (res.mustChangePassword) {
      firstLoginEmpId = empId;
      openFirstPasswordOverlay(empId);
      return;
    }
    goAfterLogin(res.redirectPage);
  } catch (err) {
    alertError(err);
  } finally {
    showLoader(false);
  }
};

function openFirstPasswordOverlay(empId) {
  const t = qs("firstPasswordUserText");
  if (t) t.textContent = `บัญชี ${empId} ต้องตั้งรหัสผ่านใหม่ก่อนเข้าใช้งาน`;
  const overlay = qs("firstPasswordOverlay");
  if (overlay) {
    overlay.classList.add("active");
    overlay.style.display = "flex";
    overlay.setAttribute("aria-hidden", "false");
  }
}

window.cancelFirstPasswordChange = function() {
  const overlay = qs("firstPasswordOverlay");
  if (overlay) {
    overlay.classList.remove("active");
    overlay.style.display = "none";
    overlay.setAttribute("aria-hidden", "true");
  }
};

window.submitFirstPasswordChange = async function() {
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
      const user = JSON.parse(localStorage.getItem("sb_current_user") || "{}");
      goAfterLogin(["admin","admin_it","dev"].includes(String(user.role)) ? "admin" : "home");
      return;
    }
    await rpc("setup_first_password_no_credential", {
      p_emp_id: firstLoginEmpId || qs("uid")?.value.trim(),
      p_new_password: p1,
      p_confirm_password: p2
    });
    await login(firstLoginEmpId || qs("uid")?.value.trim(), p1);
    goAfterLogin("home");
  } catch (err) { alertError(err); }
};

function goAfterLogin(page) {
  const finalLink = qs("finalLink");
  const target = page === "admin" ? "pages/homeAdmin.html" : "pages/home.html";
  if (qs("loginForm")) qs("loginForm").style.display = "none";
  if (qs("successForm")) qs("successForm").style.display = "block";
  if (finalLink) finalLink.href = target;
  setTimeout(() => { location.href = target; }, 650);
}

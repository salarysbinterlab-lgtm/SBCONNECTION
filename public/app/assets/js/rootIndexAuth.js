// assets/js/rootIndexAuth.js
// Root index.html login handler. Uses the same Supabase public-session RPC flow as legacy app.
import { login, getToken, getTempPassword, clearTempPassword } from "./sessionService.js";
import { rpc } from "./sbClient.js";
import { alertError } from "./uiHelpers.js";

let firstLoginEmpId = null;

function qs(id) {
  return document.getElementById(id);
}

function appPage(pageName) {
  return new URL(`../../pages/${pageName}`, import.meta.url).href;
}

function showLoader(show) {
  const loader = qs("loader");
  const btn = qs("btnLogin");
  if (loader) loader.style.display = show ? "block" : "none";
  if (btn) btn.disabled = !!show;
}

function sanitizePasswordInput(input) {
  input.value = String(input.value || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 8);
}

function openFirstPasswordOverlay(empId) {
  const text = qs("firstPasswordUserText");
  if (text) text.textContent = `บัญชี ${empId} ต้องตั้งรหัสผ่านใหม่ก่อนเข้าใช้งาน`;

  const overlay = qs("firstPasswordOverlay");
  if (overlay) {
    overlay.classList.add("active");
    overlay.style.display = "flex";
    overlay.setAttribute("aria-hidden", "false");
  }
}

function closeFirstPasswordOverlay() {
  const overlay = qs("firstPasswordOverlay");
  if (overlay) {
    overlay.classList.remove("active");
    overlay.style.display = "none";
    overlay.setAttribute("aria-hidden", "true");
  }
}

function goAfterLogin(page) {
  const finalLink = qs("finalLink");
  const loginForm = qs("loginForm");
  const successForm = qs("successForm");
  const target = page === "admin" ? appPage("homeAdmin.html") : appPage("home.html");

  if (loginForm) loginForm.style.display = "none";
  if (successForm) successForm.style.display = "block";
  if (finalLink) finalLink.href = target;

  setTimeout(() => {
    location.href = target;
  }, 650);
}

async function handleLogin() {
  const empId = qs("uid")?.value.trim();
  const pass = qs("upass")?.value || "";

  if (!empId || !pass) {
    return alertError(new Error("กรุณากรอกรหัสพนักงานและรหัสผ่าน"));
  }

  showLoader(true);

  try {
    const res = await login(empId, pass);

    if (res.status === "first_setup_required" || res.mustChangePassword) {
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
}

async function submitFirstPasswordChange() {
  const p1 = qs("newPass1")?.value || "";
  const p2 = qs("newPass2")?.value || "";

  if (!/^[A-Za-z0-9]{8}$/.test(p1)) {
    return alertError(new Error("รหัสใหม่ต้องเป็น A-Z, a-z, 0-9 จำนวน 8 ตัวพอดี"));
  }

  if (p1 !== p2) {
    return alertError(new Error("รหัสผ่านใหม่ไม่ตรงกัน"));
  }

  if (p1 === "1234") {
    return alertError(new Error("ห้ามใช้ 1234 ซ้ำ"));
  }

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
      goAfterLogin(["admin", "admin_it", "dev"].includes(String(user.role)) ? "admin" : "home");
      return;
    }

    await rpc("setup_first_password_no_credential", {
      p_emp_id: firstLoginEmpId || qs("uid")?.value.trim(),
      p_new_password: p1,
      p_confirm_password: p2
    });

    await login(firstLoginEmpId || qs("uid")?.value.trim(), p1);
    goAfterLogin("home");
  } catch (err) {
    alertError(err);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  qs("btnLogin")?.addEventListener("click", handleLogin);
  qs("upass")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") handleLogin();
  });
  qs("uid")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") qs("upass")?.focus();
  });

  qs("newPass1")?.addEventListener("input", (event) => sanitizePasswordInput(event.target));
  qs("newPass2")?.addEventListener("input", (event) => sanitizePasswordInput(event.target));
  qs("btnCancelFirstPass")?.addEventListener("click", closeFirstPasswordOverlay);
  qs("btnSaveFirstPass")?.addEventListener("click", submitFirstPasswordChange);
});

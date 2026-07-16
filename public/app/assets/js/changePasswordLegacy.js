import { rpc } from "./sbClient.js";
import { getToken, validateSession, getTempPassword, clearTempPassword } from "./sessionService.js";
import { alertError, alertSuccess } from "./uiHelpers.js";

function clean(v) { return String(v || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 8); }

async function save() {
  if (!(await validateSession())) return;
  const cur = document.getElementById("currentPass").value;
  const p1 = clean(document.getElementById("newPass").value);
  const p2 = clean(document.getElementById("confirmPass").value);

  if (!/^[A-Za-z0-9]{8}$/.test(p1)) return alertError(new Error("รหัสใหม่ต้องเป็น 8 ตัว A-Z, a-z, 0-9"));
  if (p1 !== p2) return alertError(new Error("ยืนยันรหัสไม่ตรงกัน"));

  try {
    await rpc("change_my_password", {
      p_token: getToken(),
      p_current_password: cur || getTempPassword(),
      p_new_password: p1,
      p_confirm_password: p2
    });
    clearTempPassword();
    alertSuccess("เปลี่ยนรหัสผ่านแล้ว");
    setTimeout(() => location.href = "home.html", 900);
  } catch (err) { alertError(err); }
}

document.addEventListener("DOMContentLoaded", () => {
  ["newPass","confirmPass"].forEach(id => document.getElementById(id)?.addEventListener("input", e => e.target.value = clean(e.target.value)));
  document.getElementById("saveBtn")?.addEventListener("click", save);
});

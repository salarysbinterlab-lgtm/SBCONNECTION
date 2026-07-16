// assets/js/changePasswordLegacy.js
import { getToken, requireLogin, logout } from "./sessionService.js";
import { rpc } from "./sbClient.js";
import { qs, alertError, toast } from "./uiHelpers.js";

if (requireLogin()) {
  qs("saveBtn")?.addEventListener("click", save);
}
async function save() {
  const current = qs("currentPass")?.value || "";
  const p1 = qs("newPass")?.value || "";
  const p2 = qs("confirmPass")?.value || "";
  if (!/^[A-Za-z0-9]{8}$/.test(p1)) return alertError(new Error("รหัสใหม่ต้องเป็น A-Z, a-z, 0-9 จำนวน 8 ตัวพอดี"));
  try {
    await rpc("change_my_password", { p_token:getToken(), p_current_password:current, p_new_password:p1, p_confirm_password:p2 });
    toast("เปลี่ยนรหัสผ่านสำเร็จ");
    setTimeout(logout, 900);
  } catch (err) { alertError(err); }
}

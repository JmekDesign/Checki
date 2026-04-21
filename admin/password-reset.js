/* Password reset — forgot and reset screens */
(function () {
  const $ = (id) => document.getElementById(id);
  const toast = (m) => window.CHK?.toast?.(m);
  const apiRaw = async (path, opts) => {
    const base = window.CHK?.API_BASE || "https://api.checki.ge";
    const res = await fetch(base + path, { headers: { "Content-Type": "application/json" }, ...opts });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || res.statusText);
    return data;
  };

  $("btnForgotPassword").onclick = () => {
    $("forgotEmail").value = "";
    $("forgotDone").classList.add("hide");
    CHK.nav.go("screenForgot");
    $("forgotEmail").focus();
  };

  $("btnBackFromForgot").onclick = () => CHK.nav.back();

  $("btnSendReset").onclick = async () => {
    const email = $("forgotEmail").value.trim();
    if (!email) { $("forgotEmail").focus(); return; }
    $("btnSendReset").disabled = true;
    try {
      await apiRaw("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
      $("forgotDone").classList.remove("hide");
      $("btnSendReset").style.display = "none";
    } catch (e) { toast("Error: " + e.message); }
    finally { $("btnSendReset").disabled = false; }
  };

  $("forgotEmail").addEventListener("keydown", (e) => { if (e.key === "Enter") $("btnSendReset").click(); });

  $("btnDoReset").onclick = async () => {
    const token = new URLSearchParams(window.location.search).get("reset") || "";
    const password = $("resetPassword").value.trim();
    if (!password) { $("resetPassword").focus(); return; }
    $("btnDoReset").disabled = true;
    try {
      await apiRaw("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password }) });
      toast("Password changed! Please log in.");
      history.replaceState(null, "", window.location.pathname);
      CHK.nav.reset("screenLogin");
    } catch (e) { toast("Error: " + e.message); }
    finally { $("btnDoReset").disabled = false; }
  };

  $("resetPassword").addEventListener("keydown", (e) => { if (e.key === "Enter") $("btnDoReset").click(); });

  const resetToken = new URLSearchParams(window.location.search).get("reset");
  if (resetToken) {
    $("resetPassword").value = "";
    CHK.nav.reset("screenReset");
    $("resetPassword").focus();
  }
})();

(() => {
  const SESSION_TOKEN_KEY = "essy_admin_session";
  const SESSION_USER_KEY = "essy_admin_user";
  document.documentElement.setAttribute("data-admin-locked", "true");

  const settingsPath = window.location.pathname.includes("/admin/") ? "../content/settings.json" : "./content/settings.json";

  const loadSettings = async () => {
    const res = await fetch(settingsPath, { cache: "no-store" });
    if (!res.ok) throw new Error("Could not load settings");
    return res.json();
  };

  const buildFunctionUrl = (baseUrl, path) => {
    const cleanPath = String(path || "").replace(/^\/+/, "");
    const base = String(baseUrl || "").trim().replace(/\/+$/, "");
    return base ? `${base}/${cleanPath}` : `/${cleanPath}`;
  };

  const buildHeaders = (anonKey, token) => {
    const headers = {};
    if (anonKey) {
      headers.apikey = anonKey;
      headers.Authorization = `Bearer ${anonKey}`;
    }
    if (token) headers["x-admin-session"] = token;
    return headers;
  };

  const validateSession = async (baseUrl, anonKey, token) => {
    if (!token) return false;
    const url = buildFunctionUrl(baseUrl, "/admin-auth-check");
    const res = await fetch(url, { headers: buildHeaders(anonKey, token) });
    return res.ok;
  };

  const login = async (baseUrl, anonKey, username, password) => {
    if (!username || !password) return null;
    const url = buildFunctionUrl(baseUrl, "/admin-login");
    const headers = {};
    if (anonKey) {
      headers.apikey = anonKey;
      headers.Authorization = `Bearer ${anonKey}`;
    }
    headers["Content-Type"] = "application/json";
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        token: null,
        error: String(data?.error || "Login failed").trim() || "Login failed",
      };
    }
    const token = String(data?.token || "").trim();
    return {
      token: token || null,
      error: token ? "" : "Login failed",
    };
  };

  const unlockDocument = () => {
    document.documentElement.setAttribute("data-admin-locked", "false");
    window.__ESSY_ADMIN_UNLOCKED = true;
    try {
      window.dispatchEvent(new CustomEvent("admin-unlocked"));
    } catch {}
  };

  const publishReadySession = (token) => {
    try {
      window.dispatchEvent(new CustomEvent("admin-session-ready", { detail: { token } }));
    } catch {}
  };

  const renderLock = async (api) => {
    const wrap = document.createElement("div");
    wrap.className = "fixed inset-0 z-[200] grid place-items-center bg-[#0f080e]";
    wrap.innerHTML = `
      <div class="w-[92%] max-w-md rounded-2xl border border-amber-200/25 bg-black/40 p-5 text-amber-50">
        <h1 class="font-display text-2xl text-white">Admin Access</h1>
        <p class="mt-2 text-sm text-amber-100/80">Enter username and password.</p>
        <input id="admin-gate-user" class="mt-3 w-full rounded-md border border-amber-200/30 bg-black/35 px-3 py-2 text-sm text-amber-50" placeholder="Username" autocomplete="username" />
        <input id="admin-gate-pass" type="password" class="mt-2 w-full rounded-md border border-amber-200/30 bg-black/35 px-3 py-2 text-sm text-amber-50" placeholder="Password" autocomplete="current-password" />
        <button id="admin-gate-submit" class="btn-primary mt-3 rounded-full px-4 py-2 text-sm">Unlock</button>
        <p id="admin-gate-msg" class="mt-2 text-xs text-rose-200"></p>
      </div>
    `;
    document.body.appendChild(wrap);

    const userInput = wrap.querySelector("#admin-gate-user");
    const passInput = wrap.querySelector("#admin-gate-pass");
    const submit = wrap.querySelector("#admin-gate-submit");
    const msg = wrap.querySelector("#admin-gate-msg");

    const tryUnlock = async () => {
      const username = String(userInput?.value || "").trim();
      const password = String(passInput?.value || "");
      if (!username || !password) {
        msg.textContent = "Enter username and password.";
        return;
      }
      const result = await login(api.baseUrl, api.anonKey, username, password);
      if (!result?.token) {
        msg.textContent = result?.error || "Invalid username or password.";
        return;
      }
      sessionStorage.setItem(SESSION_TOKEN_KEY, result.token);
      sessionStorage.setItem(SESSION_USER_KEY, username);
      publishReadySession(result.token);
      unlockDocument();
      wrap.remove();
    };

    submit?.addEventListener("click", tryUnlock);
    passInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") tryUnlock();
    });
  };

  const init = async () => {
    try {
      const settings = await loadSettings();
      const api = {
        baseUrl: String(settings?.api?.functionsBaseUrl || "").trim(),
        anonKey: String(settings?.api?.supabaseAnonKey || "").trim(),
      };
      const storedToken = sessionStorage.getItem(SESSION_TOKEN_KEY) || "";
      if (storedToken) {
        const ok = await validateSession(api.baseUrl, api.anonKey, storedToken);
        if (ok) {
          publishReadySession(storedToken);
          unlockDocument();
          return;
        }
        sessionStorage.removeItem(SESSION_TOKEN_KEY);
        sessionStorage.removeItem(SESSION_USER_KEY);
      }
      await renderLock(api);
    } catch {
      // Fail-closed: keep admin locked if setup fails.
      await renderLock({ baseUrl: "", anonKey: "" });
    }
  };

  init();
})();

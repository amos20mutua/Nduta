(() => {
  const eventInput = document.getElementById('event-id');
  const adminKeyInput = document.getElementById('admin-key');
  const manualInput = document.getElementById('manual-token');
  const manualBtn = document.getElementById('manual-validate');
  const resultEl = document.getElementById('scan-result');
  let apiConfig = {};

  const waitForAdminAccess = async () => {
    if (window.__ESSY_ADMIN_UNLOCKED === true) return;
    await new Promise((resolve) => {
      const onUnlock = () => {
        window.removeEventListener('admin-unlocked', onUnlock);
        resolve();
      };
      window.addEventListener('admin-unlocked', onUnlock);
    });
  };

  const setResult = (message, ok) => {
    if (!resultEl) return;
    resultEl.textContent = message;
    resultEl.className = `mt-4 text-sm ${ok ? 'text-emerald-300' : 'text-rose-300'}`;
  };

  const buildFunctionUrl = (path) => {
    const cleanPath = String(path || '').replace(/^\/+/, '');
    const base = String(apiConfig?.functionsBaseUrl || '').trim().replace(/\/+$/, '');
    return base ? `${base}/${cleanPath}` : `/${cleanPath}`;
  };

  const buildFunctionHeaders = (extra = {}) => {
    const headers = { ...extra };
    const anonKey = String(apiConfig?.supabaseAnonKey || '').trim();
    if (anonKey) {
      headers.apikey = anonKey;
      if (!headers.Authorization) headers.Authorization = `Bearer ${anonKey}`;
    }
    const sessionToken = String(sessionStorage.getItem('essy_admin_session') || '').trim();
    const adminKey = String(adminKeyInput?.value || '').trim();
    if (sessionToken) headers['x-admin-session'] = sessionToken;
    else if (adminKey) headers['x-admin-key'] = adminKey;
    return headers;
  };

  const loadApiConfig = async () => {
    try {
      const response = await fetch('./content/settings.json', { cache: 'no-store' });
      if (!response.ok) return;
      const settings = await response.json();
      apiConfig = settings?.api || {};
      if (adminKeyInput) adminKeyInput.value = '';
    } catch {}
  };

  const validateToken = async (token) => {
    if (!token) return;

    try {
      const res = await fetch(buildFunctionUrl('/validate-ticket'), {
        method: 'POST',
        headers: buildFunctionHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ qrToken: token, eventId: eventInput?.value || '' })
      });
      const data = await res.json();
      if (!res.ok) {
        setResult(data.error || 'This ticket could not be validated.', false);
        return;
      }
      setResult(`Checked in: ${data.ticket.holder_name || data.ticket.id}`, true);
    } catch (error) {
      setResult(error.message || 'The scanner is not available right now.', false);
    }
  };

  if (manualBtn) {
    manualBtn.addEventListener('click', () => validateToken((manualInput?.value || '').trim()));
  }

  window.addEventListener('admin-session-ready', () => {
    if (adminKeyInput) adminKeyInput.value = '';
  });

  window.addEventListener('load', async () => {
    await waitForAdminAccess();
    await loadApiConfig();
    if (!window.Html5Qrcode) return;
    const scanner = new Html5Qrcode('reader');
    try {
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => validateToken(decodedText),
        () => {}
      );
    } catch {
      setResult('Camera access is not available here. Paste the ticket token manually instead.', false);
    }
  });
})();

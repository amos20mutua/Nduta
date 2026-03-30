(() => {
  const eventFilter = document.getElementById('event-filter');
  const adminKeyInput = document.getElementById('admin-key');
  const loadBtn = document.getElementById('load-tickets');
  const exportBtn = document.getElementById('export-csv');
  const ticketsBody = document.getElementById('tickets-body');
  const logsList = document.getElementById('logs-list');
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
    if (sessionToken) headers['x-admin-session'] = sessionToken;
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

  const query = () => {
    const id = encodeURIComponent((eventFilter?.value || '').trim());
    return id ? `?event_id=${id}` : '';
  };

  const load = async () => {
    const adminKey = String(adminKeyInput?.value || '').trim();
    const headers = buildFunctionHeaders(adminKey ? { 'x-admin-key': adminKey } : {});
    const res = await fetch(buildFunctionUrl(`/admin-tickets${query()}`), { headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'The tickets dashboard could not be loaded.');

    ticketsBody.innerHTML = (data.tickets || [])
      .map((t) => `<tr><td class="px-2 py-2">${t.holder_name || ''}<div class="text-xs text-amber-200/80">${t.holder_email || ''}</div></td><td class="px-2 py-2">${t.event_id}</td><td class="px-2 py-2">${t.status}</td><td class="px-2 py-2">${t.checked_in ? 'Yes' : 'No'}</td></tr>`)
      .join('');

    logsList.innerHTML = (data.scanLogs || [])
      .slice(0, 30)
      .map((l) => `<li class="rounded-md border border-amber-200/20 p-2">${l.scanned_at} - ${l.outcome} - ${l.ticket_id}</li>`)
      .join('');
  };

  loadBtn?.addEventListener('click', () => load().catch((e) => alert(e.message || 'The tickets dashboard could not be loaded.')));
  exportBtn?.addEventListener('click', () => {
    const adminKey = String(adminKeyInput?.value || '').trim();
    const headers = buildFunctionHeaders(adminKey ? { 'x-admin-key': adminKey } : {});
    const url = `${buildFunctionUrl(`/admin-tickets${query()}`)}${query() ? '&' : '?'}format=csv`;
    fetch(url, { headers })
      .then(async (res) => {
        if (!res.ok) throw new Error('Export is not available until you sign in again.');
        const blob = await res.blob();
        const href = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = href;
        link.download = 'tickets.csv';
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(href);
      })
      .catch((e) => alert(e.message || 'Ticket export could not be completed.'));
  });

  window.addEventListener('admin-session-ready', () => {
    if (adminKeyInput) adminKeyInput.value = '';
  });

  window.addEventListener('load', async () => {
    await waitForAdminAccess();
    await loadApiConfig();
    load().catch(() => {});
  });
})();

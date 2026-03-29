(() => {
  const statusFilter = document.getElementById('inquiry-status-filter');
  const adminKeyInput = document.getElementById('admin-key');
  const loadBtn = document.getElementById('load-inquiries');
  const feedbackEl = document.getElementById('inquiries-feedback');
  const listEl = document.getElementById('inquiries-list');
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

  const escapeHtml = (value) =>
    String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');

  const setFeedback = (message, ok = true) => {
    if (!feedbackEl) return;
    feedbackEl.textContent = message;
    feedbackEl.className = `mt-4 text-sm ${ok ? 'text-amber-100/80' : 'text-rose-200'}`;
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

  const formatDateTime = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(date);
  };

  const renderList = (items) => {
    if (!listEl) return;
    if (!items.length) {
      listEl.innerHTML = `
        <article class="section-shell p-6">
          <h2 class="font-display text-3xl text-white">No inquiries found</h2>
          <p class="mt-2 text-sm text-amber-50/80">When visitors submit the booking form, requests will appear here.</p>
        </article>
      `;
      return;
    }

    listEl.innerHTML = items
      .map((item) => `
        <article class="section-shell overflow-hidden p-5" data-inquiry-id="${escapeHtml(item.id)}">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p class="text-xs uppercase tracking-[0.16em] text-amber-200">${escapeHtml(item.status || 'new')}</p>
              <h2 class="mt-2 font-display text-3xl text-white">${escapeHtml(item.name || 'Unknown')}</h2>
              <p class="mt-2 text-sm text-amber-50/80">${escapeHtml(formatDateTime(item.created_at))}</p>
            </div>
            <div class="flex flex-wrap gap-2">
              ${item.status !== 'contacted' ? '<button type="button" data-set-status="contacted" class="btn-secondary rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide">Mark Contacted</button>' : ''}
              ${item.status !== 'closed' ? '<button type="button" data-set-status="closed" class="btn-secondary rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide">Close</button>' : ''}
              ${item.status !== 'new' ? '<button type="button" data-set-status="new" class="btn-secondary rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide">Mark New</button>' : ''}
            </div>
          </div>
          <div class="mt-5 grid gap-4 lg:grid-cols-2">
            <div class="space-y-3 rounded-2xl border border-amber-200/15 bg-black/20 p-4 text-sm text-amber-50/85">
              <p><span class="text-amber-200">Email:</span> ${item.email ? `<a class="text-amber-50 underline-offset-4 hover:underline" href="mailto:${escapeHtml(item.email)}">${escapeHtml(item.email)}</a>` : 'Not provided'}</p>
              <p><span class="text-amber-200">Phone:</span> ${item.phone ? `<a class="text-amber-50 underline-offset-4 hover:underline" href="tel:${escapeHtml(item.phone)}">${escapeHtml(item.phone)}</a>` : 'Not provided'}</p>
              <p><span class="text-amber-200">Organization:</span> ${escapeHtml(item.organization || 'Not provided')}</p>
              <p><span class="text-amber-200">Event Date:</span> ${escapeHtml(item.event_date || 'Not provided')}</p>
              <p><span class="text-amber-200">Location:</span> ${escapeHtml(item.location || 'Not provided')}</p>
            </div>
            <div class="rounded-2xl border border-amber-200/15 bg-black/20 p-4">
              <p class="text-xs uppercase tracking-[0.14em] text-amber-200">Message</p>
              <p class="mt-3 whitespace-pre-line text-sm leading-7 text-amber-50/85">${escapeHtml(item.message || '')}</p>
            </div>
          </div>
        </article>
      `)
      .join('');

    listEl.querySelectorAll('[data-set-status]').forEach((button) => {
      button.addEventListener('click', async () => {
        const card = button.closest('[data-inquiry-id]');
        const inquiryId = card?.getAttribute('data-inquiry-id') || '';
        const nextStatus = button.getAttribute('data-set-status') || '';
        if (!inquiryId || !nextStatus) return;
        setFeedback('Updating inquiry...');
        try {
          const response = await fetch(buildFunctionUrl('/admin-inquiries'), {
            method: 'POST',
            headers: buildFunctionHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ id: inquiryId, status: nextStatus })
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data?.error || 'Could not update inquiry');
          await load();
          setFeedback('Inquiry updated.');
        } catch (error) {
          setFeedback(error.message || 'Could not update inquiry', false);
        }
      });
    });
  };

  const load = async () => {
    const status = String(statusFilter?.value || '').trim();
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    params.set('limit', '100');

    const response = await fetch(buildFunctionUrl(`/admin-inquiries?${params.toString()}`), {
      headers: buildFunctionHeaders()
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || 'Could not load inquiries');
    renderList(Array.isArray(data?.items) ? data.items : []);
  };

  loadBtn?.addEventListener('click', () => {
    load()
      .then(() => setFeedback('Booking requests loaded.'))
      .catch((error) => setFeedback(error.message || 'Could not load inquiries', false));
  });

  statusFilter?.addEventListener('change', () => {
    load()
      .then(() => setFeedback('Booking requests loaded.'))
      .catch((error) => setFeedback(error.message || 'Could not load inquiries', false));
  });

  window.addEventListener('admin-session-ready', () => {
    if (adminKeyInput) adminKeyInput.value = '';
  });

  window.addEventListener('load', async () => {
    await waitForAdminAccess();
    await loadApiConfig();
    load()
      .then(() => setFeedback('Booking requests loaded.'))
      .catch((error) => setFeedback(error.message || 'Could not load inquiries', false));
  });
})();

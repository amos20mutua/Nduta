(() => {
  const listEl = document.getElementById('events-list');
  const eyebrowEl = document.getElementById('events-eyebrow');
  const titleEl = document.getElementById('events-title');
  const subtitleEl = document.getElementById('events-subtitle');
  const tagsEl = document.getElementById('events-tags');

  const renderSkeletons = () => {
    if (!listEl) return;
    listEl.innerHTML = Array.from({ length: 2 }).map(() => `
      <article class="skeleton-card">
        <div class="loading-skeleton skeleton-image"></div>
        <div class="loading-skeleton skeleton-line wide"></div>
        <div class="loading-skeleton skeleton-line mid"></div>
      </article>
    `).join('');
  };

  const startOfToday = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  };

  const isUpcoming = (isoDate) => {
    const ts = new Date(`${isoDate}T00:00:00`).getTime();
    if (Number.isNaN(ts)) return false;
    return ts >= startOfToday();
  };

  const eventBadge = (date) => {
    const today = startOfToday();
    const eventDay = new Date(`${date}T00:00:00`).getTime();
    const diff = Math.round((eventDay - today) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    return `${diff} days to go`;
  };

  const buildIcs = (event) => {
    const uid = `${event.title}-${event.date}`.replace(/[^a-z0-9]/gi, '').toLowerCase();
    const start = new Date(`${event.date}T18:00:00`);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    const fmt = (date) => `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(date.getUTCDate()).padStart(2, '0')}T${String(date.getUTCHours()).padStart(2, '0')}${String(date.getUTCMinutes()).padStart(2, '0')}${String(date.getUTCSeconds()).padStart(2, '0')}Z`;
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Essy Singer//Events//EN', 'BEGIN:VEVENT', `UID:${uid}@essysinger.com`, `DTSTAMP:${fmt(new Date())}`, `DTSTART:${fmt(start)}`, `DTEND:${fmt(end)}`, `SUMMARY:${event.title}`, `LOCATION:${event.venue || ''}`, `DESCRIPTION:${event.description || ''}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  };

  const downloadIcs = (event) => {
    const blob = new Blob([buildIcs(event)], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = event.title.toLowerCase().replace(/[^a-z0-9]+/gi, '-');
    a.href = url;
    a.download = `${safeName || 'event'}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const shareEvent = async (event) => {
    const slug = event.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const url = `${window.location.origin}${window.location.pathname}#${slug}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: event.title, text: event.description || '', url });
        return true;
      } catch {
        return false;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      return false;
    }
  };

  const normalizeEvent = (event) => {
    const ticketTiers = Array.isArray(event.ticketTiers) ? event.ticketTiers : [];
    const normalizedTiers = ticketTiers
      .map((tier) => ({
        name: String(tier?.name || '').trim(),
        priceKsh: Number(tier?.priceKsh || 0)
      }))
      .filter((tier) => tier.name && Number.isFinite(tier.priceKsh) && tier.priceKsh > 0);

    return {
      ...event,
      enabled: event?.enabled !== false,
      ticketTiers: normalizedTiers,
      ticketing: {
        capacity: Number(event?.ticketing?.capacity || 0) || 0,
        maxPerPurchase: Number(event?.ticketing?.maxPerPurchase || 1) || 1
      },
      buttons: {
        buyTicketEnabled: event?.buttons?.buyTicketEnabled !== false,
        addToCalendarEnabled: event?.buttons?.addToCalendarEnabled !== false,
        shareEnabled: event?.buttons?.shareEnabled !== false
      }
    };
  };

  const buildFunctionUrl = (path, apiConfig) => {
    const cleanPath = String(path || '').replace(/^\/+/, '');
    const base = String(apiConfig?.functionsBaseUrl || '').trim().replace(/\/+$/, '');
    return base ? `${base}/${cleanPath}` : `/${cleanPath}`;
  };

  const buildFunctionHeaders = (apiConfig, extra = {}) => {
    const headers = { ...extra };
    const anonKey = String(apiConfig?.supabaseAnonKey || '').trim();
    if (anonKey) {
      headers.apikey = anonKey;
      if (!headers.Authorization) headers.Authorization = `Bearer ${anonKey}`;
    }
    return headers;
  };

  const fetchAvailability = async (apiConfig) => {
    try {
      const res = await fetch(buildFunctionUrl('/ticket-availability', apiConfig), {
        headers: buildFunctionHeaders(apiConfig)
      });
      if (!res.ok) return new Map();
      const data = await res.json().catch(() => ({}));
      const map = new Map();
      const items = Array.isArray(data?.items) ? data.items : [];
      items.forEach((item) => {
        const eventId = String(item?.eventId || '').trim();
        if (!eventId) return;
        map.set(eventId, {
          capacity: Number(item?.capacity || 0),
          sold: Number(item?.sold || 0),
          remaining: item?.remaining === null ? null : Number(item?.remaining || 0)
        });
      });
      return map;
    } catch {
      return new Map();
    }
  };

  const renderEvent = (event, settings, availability) => {
    const remaining = availability?.remaining;
    const capacityReached = Number.isFinite(remaining) && remaining <= 0;
    const soldOut = String(event.status || '').toLowerCase() !== 'available' || capacityReached;
    const tiers = event.ticketTiers;
    const hasPurchasableTiers = tiers.length > 0;
    const maxPerPurchase = Math.max(1, event.ticketing.maxPerPurchase || 1);
    const eventSlug = event.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const eventId = event.id || eventSlug;
    const buyEnabled = settings.mpesa?.enabled && event.buttons.buyTicketEnabled && !soldOut && hasPurchasableTiers;
    const capacityText = event.ticketing.capacity > 0
      ? `<p class="text-xs text-amber-100/80">Available tickets: ${SiteApp.escapeHtml(String(Number.isFinite(remaining) ? remaining : event.ticketing.capacity))}</p>`
      : '';

    const tiersHtml = tiers
      .map((tier) => `<li class="text-sm text-amber-50/80">${SiteApp.escapeHtml(tier.name)}: <span class="font-medium text-amber-100">KSh ${SiteApp.escapeHtml(String(tier.priceKsh))}</span></li>`)
      .join('');

    const tierOptions = tiers
      .map((tier) => `<option value="${SiteApp.escapeHtml(tier.name)}" data-price="${SiteApp.escapeHtml(String(tier.priceKsh))}">${SiteApp.escapeHtml(tier.name)} - KSh ${SiteApp.escapeHtml(String(tier.priceKsh))}</option>`)
      .join('');

    return `
      <article id="${SiteApp.escapeHtml(eventSlug)}" data-event-id="${SiteApp.escapeHtml(eventId)}" class="section-shell overflow-hidden">
        <div class="events-poster-wrap">
          <img src="${SiteApp.escapeHtml(SiteApp.resolvePath(event.bannerImage || event.poster || '/assets/event-1.jpg'))}" alt="Poster for ${SiteApp.escapeHtml(event.title)}" loading="lazy" />
        </div>
        <div class="space-y-4 p-5">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h2 class="font-display text-3xl leading-tight text-white">${SiteApp.escapeHtml(event.title)}</h2>
            <div class="flex items-center gap-2">
              ${event.featured ? '<span class="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide bg-amber-200/20 text-amber-100">Featured</span>' : ''}
              <span class="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide bg-amber-200/20 text-amber-100">${SiteApp.escapeHtml(eventBadge(event.date))}</span>
              <span class="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${soldOut ? 'bg-rose-200/20 text-rose-100' : 'bg-emerald-200/20 text-emerald-100'}">${soldOut ? 'Sold Out' : 'Available'}</span>
            </div>
          </div>
          <p class="text-sm text-amber-50/80">${SiteApp.formatDate(event.date)} - ${SiteApp.escapeHtml(event.time || '')} - ${SiteApp.escapeHtml(event.venue || '')}</p>
          ${event.yearTheme ? `<p class="text-sm text-amber-100">Theme: ${SiteApp.escapeHtml(event.yearTheme)}</p>` : ''}
          <p class="text-sm text-amber-50/80">${SiteApp.escapeHtml(event.description || '')}</p>
          ${tiersHtml ? `<ul class="space-y-1">${tiersHtml}</ul>` : '<p class="text-xs text-amber-100/80">No ticket tier is configured yet.</p>'}
          ${capacityText}
          ${buyEnabled ? `
            <form class="rounded-xl border border-amber-200/20 bg-black/20 p-3" data-buy-form="true">
              <p class="text-xs uppercase tracking-[0.12em] text-amber-200">Buy Ticket (M-Pesa)</p>
              <div class="mt-3 grid gap-3 sm:grid-cols-2">
                <input class="w-full rounded-md border border-amber-200/30 bg-black/35 px-3 py-2 text-sm text-amber-50 outline-none" type="text" name="holderName" placeholder="Full name" required />
                <input class="w-full rounded-md border border-amber-200/30 bg-black/35 px-3 py-2 text-sm text-amber-50 outline-none" type="email" name="holderEmail" placeholder="Email" required />
                <input class="w-full rounded-md border border-amber-200/30 bg-black/35 px-3 py-2 text-sm text-amber-50 outline-none sm:col-span-2" type="tel" name="phone" placeholder="M-Pesa Phone (e.g. 07...)" required />
                <select name="tierName" class="w-full rounded-md border border-amber-200/30 bg-black/35 px-3 py-2 text-sm text-amber-50 outline-none">${tierOptions}</select>
                <input class="w-full rounded-md border border-amber-200/30 bg-black/35 px-3 py-2 text-sm text-amber-50 outline-none" type="number" name="quantity" min="1" max="${SiteApp.escapeHtml(String(maxPerPurchase))}" value="1" required />
              </div>
              <div class="mt-4 flex flex-wrap items-center gap-3">
                <button type="submit" class="btn-primary inline-flex rounded-full px-4 py-2 text-sm font-medium">Buy Ticket</button>
                <p class="text-xs text-amber-100/80">Max per purchase: ${SiteApp.escapeHtml(String(maxPerPurchase))}</p>
              </div>
              <p class="mt-2 hidden text-xs" data-buy-feedback="true"></p>
            </form>
          ` : ''}
          <div class="flex flex-wrap gap-3">
            ${event.buttons.addToCalendarEnabled ? '<button class="btn-secondary inline-flex rounded-full px-4 py-2 text-sm font-medium" data-add-calendar="true">Save Date</button>' : ''}
            ${event.buttons.shareEnabled ? '<button class="btn-secondary inline-flex rounded-full px-4 py-2 text-sm font-medium" data-share-event="true">Share</button>' : ''}
          </div>
          <p class="hidden text-xs text-emerald-200" data-share-feedback="true">Event link shared.</p>
        </div>
      </article>
    `;
  };

  const attachHandlers = (card, event, apiConfig, updateAvailability) => {
    const buyForm = card.querySelector('[data-buy-form="true"]');
    const calendarBtn = card.querySelector('[data-add-calendar="true"]');
    const shareBtn = card.querySelector('[data-share-event="true"]');
    const feedback = card.querySelector('[data-share-feedback="true"]');

    if (buyForm instanceof HTMLFormElement) {
      buyForm.addEventListener('submit', async (evt) => {
        evt.preventDefault();
        const message = buyForm.querySelector('[data-buy-feedback="true"]');
        const button = buyForm.querySelector('button[type="submit"]');
        const formData = new FormData(buyForm);
        const holderName = String(formData.get('holderName') || '').trim();
        const holderEmail = String(formData.get('holderEmail') || '').trim();
        const phone = String(formData.get('phone') || '').trim();
        const tierName = String(formData.get('tierName') || '').trim();
        const quantity = Number(formData.get('quantity') || 1);

        if (!holderName || !holderEmail || !phone || !tierName || !Number.isFinite(quantity) || quantity < 1) {
          if (message) {
            message.textContent = 'Fill all fields correctly.';
            message.className = 'mt-2 text-xs text-rose-200';
            message.classList.remove('hidden');
          }
          return;
        }

        if (button instanceof HTMLButtonElement) button.disabled = true;
        if (message) {
          message.textContent = 'Requesting M-Pesa prompt...';
          message.className = 'mt-2 text-xs text-amber-100';
          message.classList.remove('hidden');
        }

        try {
          const res = await fetch(buildFunctionUrl('/mpesa-stk-push', apiConfig), {
            method: 'POST',
            headers: buildFunctionHeaders(apiConfig, { 'Content-Type': 'application/json' }),
            body: JSON.stringify({
              eventId: event.id,
              holderName,
              holderEmail,
              phone,
              tierName,
              quantity
            })
          });

          const data = await res.json();
          if (!res.ok) {
            throw new Error(data?.error || 'Could not initiate payment');
          }

          if (message) {
            message.textContent = data.customerMessage || 'STK Push sent. Complete payment on your phone.';
            message.className = 'mt-2 text-xs text-emerald-200';
            message.classList.remove('hidden');
          }
          if (typeof updateAvailability === 'function') {
            updateAvailability(event.id, quantity);
            setTimeout(() => updateAvailability(), 6000);
          }
        } catch (error) {
          if (message) {
            message.textContent = error.message || 'Payment request failed.';
            message.className = 'mt-2 text-xs text-rose-200';
            message.classList.remove('hidden');
          }
        } finally {
          if (button instanceof HTMLButtonElement) button.disabled = false;
        }
      });
    }

    if (calendarBtn) calendarBtn.addEventListener('click', () => downloadIcs(event));
    if (shareBtn) {
      shareBtn.addEventListener('click', async () => {
        const shared = await shareEvent(event);
        if (feedback) {
          feedback.textContent = shared ? 'Event link shared.' : 'Could not share on this browser.';
          feedback.classList.remove('hidden');
          setTimeout(() => feedback.classList.add('hidden'), 2500);
        }
      });
    }
  };

  renderSkeletons();

  SiteApp.ready
    .then(async (settings) => {
      const [siteSettings, payload] = await Promise.all([
        SiteApp.loadJson('/content/settings.json').catch(() => settings || {}),
        SiteApp.loadJson('/content/events.json')
      ]);
      const apiConfig = siteSettings.api || {};
      let availabilityMap = await fetchAvailability(apiConfig);

      const page = siteSettings.eventsPage || {};
      if (eyebrowEl) eyebrowEl.textContent = page.eyebrow || 'Events';
      if (titleEl) titleEl.textContent = page.title || 'Upcoming Worship Gatherings';
      if (subtitleEl) subtitleEl.textContent = page.subtitle || 'Reserve your seat and come ready for worship.';
      if (tagsEl) {
        const tags = Array.isArray(page.tags) ? page.tags : [];
        tagsEl.innerHTML = tags.map((tag) => `<span class="pill-note">${SiteApp.escapeHtml(String(tag || ''))}</span>`).join('');
      }

      const eventsPageEnabled = page.enabled !== false;
      const events = SiteApp.listFromPayload(payload)
        .map(normalizeEvent)
        .filter((event) => event.enabled && event.id && isUpcoming(event.date))
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      if (!listEl) return;
      if (!eventsPageEnabled || !events.length) {
        listEl.innerHTML = `
          <article class="section-shell p-6 sm:p-8">
            <h2 class="font-display text-3xl text-white">No Upcoming Events</h2>
            <p class="mt-2 text-sm text-amber-50/80">No event is open for booking right now. Please check back soon.</p>
          </article>
        `;
        return;
      }

      const rerender = () => {
        if (!listEl) return;
        listEl.innerHTML = events.map((event) => renderEvent(event, siteSettings, availabilityMap.get(event.id))).join('');
        listEl.querySelectorAll('article[data-event-id]').forEach((card) => {
          const eventId = card.getAttribute('data-event-id');
          const event = events.find((item) => item.id === eventId);
          if (event) {
            attachHandlers(card, event, apiConfig, async (targetEventId, qty) => {
              if (targetEventId && Number.isFinite(qty)) {
                const current = availabilityMap.get(targetEventId);
                if (current && Number.isFinite(current.remaining)) {
                  current.remaining = Math.max(0, current.remaining - qty);
                  availabilityMap.set(targetEventId, current);
                  rerender();
                  return;
                }
              }
              availabilityMap = await fetchAvailability(apiConfig);
              rerender();
            });
          }
        });
      };

      rerender();
      setInterval(async () => {
        availabilityMap = await fetchAvailability(apiConfig);
        rerender();
      }, 15000);
    })
    .catch(() => {
      if (listEl) listEl.innerHTML = '<p class="text-sm text-rose-300">Could not load events.</p>';
    });
})();

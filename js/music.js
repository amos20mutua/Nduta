(() => {
  const listEl = document.getElementById('music-list');
  const eyebrowEl = document.getElementById('music-eyebrow');
  const titleEl = document.getElementById('music-title');
  const subtitleEl = document.getElementById('music-subtitle');
  const tagsEl = document.getElementById('music-tags');

  const renderSkeletons = () => {
    if (!listEl) return;
    listEl.innerHTML = Array.from({ length: 4 })
      .map(
        () => `
          <article class="skeleton-card">
            <div class="loading-skeleton skeleton-image"></div>
            <div class="loading-skeleton skeleton-line wide"></div>
            <div class="loading-skeleton skeleton-line mid"></div>
            <div class="loading-skeleton skeleton-line short"></div>
          </article>
        `
      )
      .join('');
  };

  const renderItem = (item, index) => {
    const linksData = item.links || item.listenLinks || {};
    const links = [
      ['Spotify', linksData.spotify],
      ['Apple Music', linksData.appleMusic],
      ['YouTube', linksData.youtube],
      ['Audiomack', linksData.audiomack]
    ]
      .filter(([, href]) => SiteApp.safeExternalHref(href))
      .map(([name, href]) => `<a class="btn-secondary inline-flex rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide" href="${SiteApp.escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${name}</a>`)
      .join('');

    const release = item.releaseDate ? SiteApp.formatDate(item.releaseDate) : '';
    const lyrics = String(item.lyrics || '').trim();
    const lyricsId = `music-lyrics-${index}`;

    return `
      <article class="section-shell overflow-hidden">
        <img src="${SiteApp.escapeHtml(SiteApp.resolvePath(item.coverImage || item.cover || '/assets/music-1.jpg'))}" alt="${SiteApp.escapeHtml(item.title || 'Music release')} cover" class="h-56 w-full object-cover" loading="lazy" />
        <div class="space-y-4 p-5">
          <div>
            <p class="text-xs uppercase tracking-[0.2em] text-amber-200">${release || 'Release'}${item.featured ? ' - Featured' : ''}</p>
            <h2 class="mt-2 font-display text-2xl leading-tight text-white">${SiteApp.escapeHtml(item.title || 'Untitled release')}</h2>
          </div>
          <div class="flex flex-wrap gap-2">${links || '<p class="text-sm text-amber-50/70">Streaming links will appear here once this release is published.</p>'}</div>
          ${lyrics ? `
            <div class="rounded-2xl border border-amber-200/15 bg-black/20 p-4">
              <button type="button" class="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-amber-200" data-toggle-lyrics="${lyricsId}" aria-expanded="false" aria-controls="${lyricsId}">
                Lyrics Preview
              </button>
              <div id="${lyricsId}" class="mt-3 hidden whitespace-pre-line text-sm leading-7 text-amber-50/85">${SiteApp.escapeHtml(lyrics)}</div>
            </div>
          ` : ''}
        </div>
      </article>
    `;
  };

  const bindLyricsToggles = () => {
    if (!listEl) return;
    listEl.querySelectorAll('[data-toggle-lyrics]').forEach((button) => {
      button.addEventListener('click', () => {
        const panelId = button.getAttribute('data-toggle-lyrics');
        if (!panelId) return;
        const panel = document.getElementById(panelId);
        if (!panel) return;
        const expanded = button.getAttribute('aria-expanded') === 'true';
        button.setAttribute('aria-expanded', expanded ? 'false' : 'true');
        panel.classList.toggle('hidden', expanded);
      });
    });
  };

  renderSkeletons();

  SiteApp.ready
    .then(async () => {
      const [settings, payload] = await Promise.all([
        SiteApp.loadJson('/content/settings.json').catch(() => ({})),
        SiteApp.loadJson('/content/music.json')
      ]);

      const page = settings.musicPage || {};
      if (eyebrowEl) eyebrowEl.textContent = page.eyebrow || 'Music';
      if (titleEl) titleEl.textContent = page.title || 'Songs For Worship Moments';
      if (subtitleEl) subtitleEl.textContent = page.subtitle || 'A focused catalog of songs, moments, and melodies that carry hope.';
      if (tagsEl) {
        const tags = Array.isArray(page.tags) ? page.tags : [];
        tagsEl.innerHTML = tags.map((tag) => `<span class="pill-note">${SiteApp.escapeHtml(String(tag || ''))}</span>`).join('');
      }

      const items = SiteApp.listFromPayload(payload);
      if (!listEl) return;
      if (!items.length) {
        listEl.innerHTML = `
          <article class="section-shell p-7 sm:col-span-2">
            <p class="text-xs uppercase tracking-[0.16em] text-amber-200">Coming Soon</p>
            <h2 class="mt-3 font-display text-3xl text-white">New releases are being prepared.</h2>
            <p class="mt-3 max-w-2xl text-sm text-amber-50/80">This page is ready for songs, live sessions, and streaming links. Once releases are published in the admin editor, they will appear here automatically.</p>
            <div class="mt-5 flex flex-wrap gap-3">
              <a href="${SiteApp.resolvePath('/contact.html')}" class="btn-primary inline-flex rounded-full px-5 py-2.5 text-sm font-semibold uppercase tracking-wide">Contact for Ministry</a>
              <a href="${SiteApp.resolvePath('/events.html')}" class="btn-secondary inline-flex rounded-full px-5 py-2.5 text-sm font-semibold uppercase tracking-wide">View Events</a>
            </div>
          </article>
        `;
        return;
      }

      items.sort((a, b) => new Date(b.releaseDate || 0) - new Date(a.releaseDate || 0));
      listEl.innerHTML = items.map(renderItem).join('');
      bindLyricsToggles();
    })
    .catch(() => {
      if (listEl) listEl.innerHTML = '<p class="text-sm text-rose-300">Could not load music.</p>';
    });
})();

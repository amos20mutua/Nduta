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

  const renderItem = (item) => {
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

    return `
      <article class="section-shell overflow-hidden">
        <img src="${SiteApp.escapeHtml(SiteApp.resolvePath(item.coverImage || item.cover))}" alt="${SiteApp.escapeHtml(item.title)} cover" class="h-56 w-full object-cover" loading="lazy" />
        <div class="space-y-3 p-5">
          <p class="text-xs uppercase tracking-[0.2em] text-amber-200">${release || 'Release'}${item.featured ? ' - Featured' : ''}</p>
          <h2 class="font-display text-2xl leading-tight text-white">${SiteApp.escapeHtml(item.title)}</h2>
          <div class="flex flex-wrap gap-2">${links || '<p class="text-sm text-amber-50/70">Streaming links will appear here.</p>'}</div>
        </div>
      </article>
    `;
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
      if (titleEl) titleEl.textContent = page.title || 'Songs for Worship Moments';
      if (subtitleEl) subtitleEl.textContent = page.subtitle || '';
      if (tagsEl) {
        const tags = Array.isArray(page.tags) ? page.tags : [];
        tagsEl.innerHTML = tags.map((tag) => `<span class="pill-note">${SiteApp.escapeHtml(String(tag || ''))}</span>`).join('');
      }

      const items = SiteApp.listFromPayload(payload);
      if (!listEl) return;
      if (!items.length) {
        listEl.innerHTML = '<p class="text-sm text-amber-50/70">No songs published yet.</p>';
        return;
      }

      items.sort((a, b) => new Date(b.releaseDate || 0) - new Date(a.releaseDate || 0));
      listEl.innerHTML = items.map(renderItem).join('');
    })
    .catch(() => {
      if (listEl) listEl.innerHTML = '<p class="text-sm text-rose-300">Could not load music.</p>';
    });
})();

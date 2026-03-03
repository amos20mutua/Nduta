(() => {
  const heroImageEl = document.getElementById('hero-image');
  const heroVideoEl = document.getElementById('hero-video');
  const heroOverlayEl = document.getElementById('hero-overlay');
  const heroTitleEl = document.getElementById('hero-title');
  const heroSubtitleEl = document.getElementById('hero-subtitle');
  const heroScriptureEl = document.getElementById('hero-scripture');
  const heroBookCta = document.getElementById('hero-book-cta');
  const heroWatchCta = document.getElementById('hero-watch-cta');
  const heroHumanNoteTextEl = document.getElementById('hero-human-note-text');

  const storyEyebrowEl = document.getElementById('story-eyebrow');
  const storyTitleEl = document.getElementById('story-title');
  const storyIntroEl = document.getElementById('story-intro');
  const storyBlocksEl = document.getElementById('story-blocks');

  const reduceMotion = Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  const applySectionConfig = (sections) => {
    const defaults = [{ id: 'story', enabled: true, order: 0 }];
    const config = Array.isArray(sections) && sections.length ? sections : defaults;
    const map = new Map(config.map((item) => [String(item.id || ''), item]));

    const allSections = Array.from(document.querySelectorAll('[data-home-section]'));
    allSections.forEach((section) => {
      const id = section.getAttribute('data-home-section') || '';
      const item = map.get(id);
      const enabled = item ? Boolean(item.enabled) : true;
      section.style.display = enabled ? '' : 'none';
    });

    const main = document.getElementById('main-content');
    if (!main) return;
    const ordered = [...allSections].sort((a, b) => {
      const aId = a.getAttribute('data-home-section') || '';
      const bId = b.getAttribute('data-home-section') || '';
      const aOrder = Number(map.get(aId)?.order ?? 99);
      const bOrder = Number(map.get(bId)?.order ?? 99);
      return aOrder - bOrder;
    });
    ordered.forEach((section) => main.appendChild(section));
  };

  const textToParagraphs = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    return raw
      .split(/\n\s*\n/g)
      .map((chunk) => `<p>${SiteApp.escapeHtml(chunk.trim()).replace(/\n/g, '<br />')}</p>`)
      .join('');
  };

  const sanitizeHref = (href) => {
    const safeExternal = SiteApp.safeExternalHref(href);
    if (safeExternal) return safeExternal;
    return SiteApp.resolvePath(href || '/contact.html');
  };

  const renderStoryBlocks = (items) => {
    if (!storyBlocksEl) return;
    const list = Array.isArray(items) ? items : [];
    if (!list.length) {
      storyBlocksEl.innerHTML = '';
      return;
    }

    storyBlocksEl.innerHTML = list
      .map((block, index) => {
        const type = String(block?.type || 'text').toLowerCase();
        const title = SiteApp.escapeHtml(String(block?.title || ''));
        const eyebrow = SiteApp.escapeHtml(String(block?.eyebrow || ''));
        const body = textToParagraphs(block?.body);
        const image = SiteApp.resolvePath(block?.image || '/assets/hero.jpg');
        const imageAlt = SiteApp.escapeHtml(String(block?.imageAlt || block?.title || 'Essy Singer photo'));
        const caption = SiteApp.escapeHtml(String(block?.imageCaption || ''));
        const ctaText = SiteApp.escapeHtml(String(block?.ctaText || ''));
        const ctaHref = sanitizeHref(block?.ctaHref);
        const isExternal = /^https?:/i.test(ctaHref);
        const ctaAttrs = isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
        const imagePosition = String(block?.imagePosition || (index % 2 ? 'left' : 'right')).toLowerCase();
        const splitOrderClass = imagePosition === 'left' ? 'story-block--image-left' : 'story-block--image-right';

        if (type === 'image') {
          return `
            <figure class="reveal story-block story-block--image">
              <img src="${SiteApp.escapeHtml(image)}" alt="${imageAlt}" loading="lazy" />
              ${caption ? `<figcaption>${caption}</figcaption>` : ''}
            </figure>
          `;
        }

        if (type === 'split') {
          return `
            <article class="reveal story-block story-block--split ${splitOrderClass}">
              <div class="story-copy">
                ${eyebrow ? `<p class="story-block-eyebrow">${eyebrow}</p>` : ''}
                ${title ? `<h3 class="story-block-title">${title}</h3>` : ''}
                ${body ? `<div class="story-block-body">${body}</div>` : ''}
                ${ctaText ? `<a class="btn-primary inline-flex rounded-full px-6 py-3 text-xs font-semibold uppercase tracking-wide" href="${SiteApp.escapeHtml(ctaHref)}"${ctaAttrs}>${ctaText}</a>` : ''}
              </div>
              <figure class="story-media">
                <img src="${SiteApp.escapeHtml(image)}" alt="${imageAlt}" loading="lazy" />
                ${caption ? `<figcaption>${caption}</figcaption>` : ''}
              </figure>
            </article>
          `;
        }

        return `
          <article class="reveal story-block story-block--text">
            ${eyebrow ? `<p class="story-block-eyebrow">${eyebrow}</p>` : ''}
            ${title ? `<h3 class="story-block-title">${title}</h3>` : ''}
            ${body ? `<div class="story-block-body">${body}</div>` : ''}
            ${ctaText ? `<a class="btn-secondary inline-flex rounded-full px-5 py-2.5 text-xs font-semibold uppercase tracking-wide" href="${SiteApp.escapeHtml(ctaHref)}"${ctaAttrs}>${ctaText}</a>` : ''}
          </article>
        `;
      })
      .join('');

    storyBlocksEl.querySelectorAll('.reveal').forEach((node) => node.classList.add('in'));
  };

  const initHumanTilt = () => {
    if (reduceMotion) return;
    document.querySelectorAll('.section-humane').forEach((card) => {
      card.addEventListener('pointermove', (event) => {
        if (window.innerWidth < 900) return;
        const rect = card.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        card.style.transform = `perspective(900px) rotateX(${(-y * 2).toFixed(2)}deg) rotateY(${(x * 2).toFixed(2)}deg) translateY(-2px)`;
      }, { passive: true });
      card.addEventListener('pointerleave', () => {
        card.style.transform = '';
      });
    });
  };

  const initParallax = () => {
    if (!heroImageEl || reduceMotion) return;
    const layers = Array.from(document.querySelectorAll('.parallax-layer'));
    let rafId = 0;
    let mouseX = 0;
    let mouseY = 0;

    const apply = () => {
      const y = Math.min(window.scrollY * 0.14, 30);
      heroImageEl.style.transform = `translate3d(${mouseX}px, ${y + mouseY}px, 0) scale(1.03)`;
      layers.forEach((layer) => {
        const depth = Number(layer.getAttribute('data-depth') || '0.06');
        const moveY = Math.min(window.scrollY * depth, 24) + (mouseY * (depth * 9));
        const moveX = mouseX * (depth * 8);
        layer.style.transform = `translate3d(${moveX}px, ${moveY}px, 0)`;
      });
      rafId = 0;
    };

    const onScroll = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(apply);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pointermove', (event) => {
      if (window.innerWidth < 900) return;
      const rx = (event.clientX / window.innerWidth - 0.5) * 2;
      const ry = (event.clientY / window.innerHeight - 0.5) * 2;
      mouseX = rx * 5;
      mouseY = ry * 3;
      onScroll();
    }, { passive: true });

    apply();
  };

  SiteApp.ready
    .then(async (settings) => {
      const [theme, homepage] = await Promise.all([
        SiteApp.loadTheme(),
        SiteApp.loadJson('/content/homepage.json').catch(() => ({}))
      ]);

      const hero = homepage.hero || {};
      const primaryEnabled = hero?.primaryCta?.enabled !== false;
      const secondaryEnabled = hero?.secondaryCta?.enabled !== false;
      const heroType = String(hero.backgroundType || 'image').toLowerCase();
      if (heroImageEl) {
        heroImageEl.src = SiteApp.resolvePath(hero.backgroundImage || '/assets/hero.jpg');
        heroImageEl.classList.remove('hidden');
      }
      if (heroVideoEl) {
        const videoUrl = SiteApp.safeExternalHref(hero.backgroundVideo) || SiteApp.resolvePath(hero.backgroundVideo || '');
        if (heroType === 'video' && videoUrl) {
          heroVideoEl.src = videoUrl;
          heroVideoEl.classList.add('hidden');
          const showVideo = () => {
            heroVideoEl.classList.remove('hidden');
          };
          heroVideoEl.addEventListener('canplay', showVideo, { once: true });
          heroVideoEl.addEventListener('loadeddata', showVideo, { once: true });
        } else {
          heroVideoEl.classList.add('hidden');
          heroVideoEl.removeAttribute('src');
        }
      }

      if (heroOverlayEl && theme?.heroOverlay) heroOverlayEl.className = `absolute inset-0 bg-gradient-to-br ${theme.heroOverlay}`;
      if (heroTitleEl) heroTitleEl.textContent = hero.headline || settings.siteName || 'ESSY SINGER';
      if (heroSubtitleEl) heroSubtitleEl.textContent = hero.subheadline || settings.tagline || '';
      if (heroScriptureEl) heroScriptureEl.textContent = hero.description || '';
      if (heroHumanNoteTextEl) heroHumanNoteTextEl.textContent = (hero.humanNote || '').trim() || 'Worship with depth, prayer, and authenticity.';

      if (heroBookCta) {
        if (secondaryEnabled) {
          heroBookCta.href = SiteApp.resolvePath(hero.secondaryCta?.href || '/contact.html');
          heroBookCta.textContent = hero.secondaryCta?.text || 'Book Essy';
          heroBookCta.classList.remove('hidden');
        } else {
          heroBookCta.classList.add('hidden');
        }
      }

      if (heroWatchCta) {
        if (primaryEnabled) {
          const href = hero.primaryCta?.href || settings.streamingLinks?.youtube || '/music.html';
          const safeHref = SiteApp.safeExternalHref(href) || SiteApp.resolvePath(href);
          heroWatchCta.href = safeHref;
          heroWatchCta.textContent = hero.primaryCta?.text || 'Watch Live';
          heroWatchCta.classList.remove('hidden');
          if (/^https?:/i.test(safeHref)) {
            heroWatchCta.target = '_blank';
            heroWatchCta.rel = 'noopener noreferrer';
          }
        } else {
          heroWatchCta.classList.add('hidden');
        }
      }

      const story = homepage.story || {};
      if (storyEyebrowEl) storyEyebrowEl.textContent = story.eyebrow || 'About';
      if (storyTitleEl) storyTitleEl.textContent = story.title || '';
      if (storyIntroEl) storyIntroEl.textContent = story.intro || '';
      renderStoryBlocks(story.blocks);

      applySectionConfig(homepage.sections);
      initParallax();
      initHumanTilt();
    })
    .catch(() => {
      if (storyBlocksEl) storyBlocksEl.innerHTML = '<p class="text-sm text-rose-700">Could not load homepage content.</p>';
    });
})();

(() => {
  const state = {
    settings: null,
    theme: null,
    loadErrorShown: false,
    menuOpen: false,
    focusables: [],
    lastFocused: null,
    reduceMotion: false,
    contentStore: new Map(),
    inflightContent: new Map(),
    initialBundlePromise: null
  };
  const CONTENT_CACHE_TTL_MS = 5 * 60 * 1000;
  const CONTENT_API_TIMEOUT_MS = 7000;
  const CONTENT_CACHE_PREFIX = 'essy_content_cache_v1:';

  const defaultNavLinks = [
    { href: '/index.html', label: 'Home' },
    { href: '/music.html', label: 'Music' },
    { href: '/events.html', label: 'Events' },
    { href: '/contact.html', label: 'Contact' }
  ];

  const escapeHtml = (value) =>
    String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');

  const safeExternalHref = (url) => {
    if (!url || typeof url !== 'string') return '';
    const trimmed = url.trim();
    if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return trimmed;
    return '';
  };

  const resolvePath = (path) => {
    if (!path || typeof path !== 'string') return '';
    if (/^(https?:|mailto:|tel:|data:)/i.test(path)) return path;
    if (!path.startsWith('/')) return path;
    return `.${path}`;
  };

  const showServerHint = () => {
    if (state.loadErrorShown) return;
    state.loadErrorShown = true;
    const wrap = document.createElement('div');
    wrap.className = 'site-preview-hint';
    wrap.setAttribute('role', 'alert');
    wrap.innerHTML = 'Content could not be loaded in this preview. Open the site through its local server, for example <code>npx serve</code>, or use the deployed site.';
    document.body.appendChild(wrap);
  };

  const currentPath = () => {
    const path = window.location.pathname.replace(/\\/g, '/');
    const name = path.split('/').pop() || 'index.html';
    return `/${name}`;
  };

  const fetchWithRetry = async (path, parser, attempts = 2) => {
    let lastError;
    for (let i = 0; i < attempts; i += 1) {
      try {
        const response = await fetch(resolvePath(path), { cache: 'no-store' });
        if (!response.ok) throw new Error(`Failed to load ${path}`);
        return await parser(response);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  };

  const isContentPath = (path) => typeof path === 'string' && path.startsWith('/content/') && path.endsWith('.json');

  const getApiConfig = () => state.settings?.api || {};

  const cacheKeyForPath = (path) => `${CONTENT_CACHE_PREFIX}${path}`;

  const rememberContent = (path, payload) => {
    if (!path) return;
    state.contentStore.set(path, {
      payload,
      ts: Date.now()
    });
  };

  const readRememberedContent = (path) => {
    if (!path) return null;
    const entry = state.contentStore.get(path);
    return entry ? entry.payload : null;
  };

  const clearContentCache = (path = '') => {
    try {
      if (path) {
        localStorage.removeItem(cacheKeyForPath(path));
        state.contentStore.delete(path);
        state.inflightContent.delete(path);
        return;
      }
      const keys = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key?.startsWith(CONTENT_CACHE_PREFIX)) keys.push(key);
      }
      keys.forEach((key) => localStorage.removeItem(key));
      state.contentStore.clear();
      state.inflightContent.clear();
    } catch {}
  };

  const readContentCache = (path, { allowExpired = false } = {}) => {
    try {
      const raw = localStorage.getItem(cacheKeyForPath(path));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const ts = Number(parsed?.ts || 0);
      if (!ts) return null;
      const fresh = Date.now() - ts <= CONTENT_CACHE_TTL_MS;
      if (!fresh && !allowExpired) return null;
      return {
        payload: parsed?.payload ?? null,
        fresh,
        stale: !fresh,
        ts
      };
    } catch {
      return null;
    }
  };

  const writeContentCache = (path, payload) => {
    try {
      rememberContent(path, payload);
      localStorage.setItem(cacheKeyForPath(path), JSON.stringify({ ts: Date.now(), payload }));
    } catch {}
  };

  const fetchWithTimeout = async (url, options = {}, timeoutMs = CONTENT_API_TIMEOUT_MS) => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      window.clearTimeout(timer);
    }
  };

  const getFunctionsBaseUrl = (api) => {
    const explicit = String(api?.functionsBaseUrl || '').trim().replace(/\/+$/, '');
    if (explicit) return explicit;
    if (window.location.protocol === 'http:' || window.location.protocol === 'https:') return '';
    return null;
  };

  const hasConfiguredContentApi = (api) => getFunctionsBaseUrl(api) !== null;

  const fetchContentViaApi = async (path, apiOverride = getApiConfig()) => {
    const api = apiOverride || {};
    const base = getFunctionsBaseUrl(api);
    if (base === null || !isContentPath(path)) return null;
    const headers = {};
    const anonKey = String(api?.supabaseAnonKey || '').trim();
    if (anonKey) {
      headers.apikey = anonKey;
      headers.Authorization = `Bearer ${anonKey}`;
    }
    const url = `${base}/content-get?path=${encodeURIComponent(path)}`;
    const response = await fetchWithTimeout(url, { cache: 'no-store', headers }, CONTENT_API_TIMEOUT_MS);
    if (!response.ok) return null;
    const data = await response.json();
    return data?.payload ?? null;
  };

  const fetchContentBundleViaApi = async (paths, apiOverride = getApiConfig()) => {
    const requested = Array.from(new Set((Array.isArray(paths) ? paths : []).filter(isContentPath)));
    if (!requested.length) return [];

    const api = apiOverride || {};
    const base = getFunctionsBaseUrl(api);
    if (base === null) return [];

    const headers = {};
    const anonKey = String(api?.supabaseAnonKey || '').trim();
    if (anonKey) {
      headers.apikey = anonKey;
      headers.Authorization = `Bearer ${anonKey}`;
    }

    const url = `${base}/content-bundle?paths=${encodeURIComponent(requested.join(','))}`;
    const response = await fetchWithTimeout(url, { cache: 'no-store', headers }, CONTENT_API_TIMEOUT_MS);
    if (!response.ok) return [];
    const data = await response.json().catch(() => ({}));
    return Array.isArray(data?.items) ? data.items : [];
  };

  const getInitialContentPaths = () => {
    const path = currentPath();
    const paths = ['/content/settings.json', '/content/theme.json'];
    if (path === '/index.html') paths.push('/content/homepage.json');
    if (path === '/events.html') paths.push('/content/events.json');
    if (path === '/music.html') paths.push('/content/music.json');
    return paths;
  };

  const primeInitialBundle = async () => {
    if (state.initialBundlePromise) return state.initialBundlePromise;

    const api = getApiConfig();
    if (!hasConfiguredContentApi(api)) return null;

    const paths = getInitialContentPaths();
    state.initialBundlePromise = (async () => {
      try {
        const items = await fetchContentBundleViaApi(paths, api);
        items.forEach((item) => {
          if (!item?.path) return;
          if (item.payload === undefined || item.payload === null) return;
          writeContentCache(item.path, item.payload);
        });
        return items;
      } catch {
        return null;
      }
    })();

    return state.initialBundlePromise;
  };

  const loadJson = async (path) => {
    const remembered = readRememberedContent(path);
    if (remembered !== null) return remembered;

    const inflight = state.inflightContent.get(path);
    if (inflight) return inflight;

    const task = (async () => {
      try {
        const isContent = isContentPath(path);
        const api = getApiConfig();
        const hasApi = isContent && hasConfiguredContentApi(api);

        if (hasApi) {
          try {
            const apiPayload = await fetchContentViaApi(path, api);
            if (apiPayload !== null && apiPayload !== undefined) {
              writeContentCache(path, apiPayload);
              return apiPayload;
            }
          } catch {}
          const cached = readContentCache(path, { allowExpired: true });
          if (cached?.payload !== null) {
            writeContentCache(path, cached.payload);
            return cached.payload;
          }
        }
        const localPayload = await fetchWithRetry(path, (res) => res.json());
        if (isContent) writeContentCache(path, localPayload);
        return localPayload;
      } catch (error) {
        showServerHint();
        throw error;
      } finally {
        state.inflightContent.delete(path);
      }
    })();

    state.inflightContent.set(path, task);
    return task;
  };

  const formatDate = (isoDate) => {
    if (!isoDate) return '';
    const date = new Date(`${isoDate}T00:00:00`);
    if (Number.isNaN(date.getTime())) return isoDate;
    return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(date);
  };

  const listFromPayload = (payload) => (Array.isArray(payload) ? payload : Array.isArray(payload?.items) ? payload.items : []);

  const getContact = (settings) => ({
    email: settings?.contact?.email || settings?.email || '',
    phone: settings?.contact?.phone || settings?.phone || ''
  });

  const getNavLinks = (settings) => {
    const items = settings?.nav?.items;
    if (!Array.isArray(items) || !items.length) return defaultNavLinks;
    return items
      .map((item) => ({ label: String(item?.label || '').trim(), href: String(item?.href || '').trim() }))
      .filter((item) => item.label && item.href);
  };

  const socialHtml = (settings) => {
    const socials = settings?.socialLinks || settings?.socials || {};
    const pairs = [
      ['youtube', 'YouTube'],
      ['instagram', 'Instagram'],
      ['tiktok', 'TikTok'],
      ['facebook', 'Facebook'],
      ['spotify', 'Spotify'],
      ['appleMusic', 'Apple Music']
    ];

    return pairs
      .map(([key, label]) => {
        const href = safeExternalHref(socials?.[key]);
        if (!href) return '';
        return `<a class="footer-social" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
      })
      .filter(Boolean)
      .join('');
  };

  const wordmarkHtml = (logoText) => {
    const name = String(logoText || 'Essy Singer').trim().split(/\s+/);
    const first = name[0] || 'Essy';
    const second = name.slice(1).join(' ') || 'Singer';

    return `
      <span class="wordmark" aria-hidden="true">
        <span class="wordmark-main">${escapeHtml(first)}</span>
        <span class="wordmark-sub">${escapeHtml(second.toUpperCase())}</span>
        <span class="wordmark-dot"></span>
      </span>
    `;
  };

  const getFocusable = (root) => {
    if (!root) return [];
    const selector = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
    return Array.from(root.querySelectorAll(selector)).filter((el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true');
  };

  const renderHeader = (settings) => {
    const mount = document.getElementById('site-header');
    if (!mount) return;

    const navLinks = getNavLinks(settings);
    const path = currentPath();
    const links = navLinks
      .map((link) => {
        const active = path === link.href ? 'nav-link is-active' : 'nav-link';
        const ariaCurrent = path === link.href ? ' aria-current="page"' : '';
        return `<a class="${active}" href="${resolvePath(link.href)}"${ariaCurrent}>${escapeHtml(link.label)}</a>`;
      })
      .join('');

    mount.innerHTML = `
      <a class="skip-link" href="#main-content">Skip to content</a>
      <header class="site-nav sticky top-0 z-50 border-b border-amber-200/10 bg-black/40 backdrop-blur-xl">
        <div class="mx-auto flex h-20 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <a href="${resolvePath('/index.html')}" class="wordmark-link" aria-label="${escapeHtml(settings.siteName || settings.artistName || 'Site')} home">
            ${wordmarkHtml(settings.logoText || settings.siteName || settings.artistName)}
          </a>
          <nav class="hidden items-center gap-1 md:flex" aria-label="Primary">${links}</nav>
          <button id="mobile-menu-button" class="hamburger md:hidden" type="button" aria-expanded="false" aria-controls="mobile-menu" aria-label="Open menu">
            <span></span><span></span><span></span>
          </button>
        </div>
      </header>
      <div id="mobile-menu-overlay" class="fixed inset-0 z-40 hidden bg-black/65" aria-hidden="true"></div>
      <aside id="mobile-menu" class="mobile-drawer fixed right-0 top-0 z-50 h-screen w-[84%] max-w-sm bg-[#10070c] p-6 shadow-2xl transition-transform duration-300" aria-hidden="true" tabindex="-1">
        <div class="flex items-center justify-end border-b border-amber-200/20 pb-4">
          <button id="mobile-menu-close" type="button" class="rounded-md border border-amber-200/30 p-2 text-amber-100" aria-label="Close menu">
            <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M4.22 4.22a.75.75 0 011.06 0L10 8.94l4.72-4.72a.75.75 0 111.06 1.06L11.06 10l4.72 4.72a.75.75 0 11-1.06 1.06L10 11.06l-4.72 4.72a.75.75 0 01-1.06-1.06L8.94 10 4.22 5.28a.75.75 0 010-1.06z" clip-rule="evenodd"/></svg>
          </button>
        </div>
        <nav class="mt-6 grid gap-2" aria-label="Mobile Primary">${links.replaceAll('nav-link', 'nav-link nav-link-mobile')}</nav>
      </aside>
    `;

    const button = document.getElementById('mobile-menu-button');
    const closeButton = document.getElementById('mobile-menu-close');
    const overlay = document.getElementById('mobile-menu-overlay');
    const drawer = document.getElementById('mobile-menu');
    if (!button || !overlay || !drawer) return;

    // Ensure consistent initial closed state even before any interaction.
    drawer.classList.remove('is-open');

    const closeMenu = () => {
      if (!state.menuOpen) return;
      state.menuOpen = false;
      button.setAttribute('aria-expanded', 'false');
      button.classList.remove('is-open');
      drawer.classList.remove('is-open');
      drawer.setAttribute('aria-hidden', 'true');
      overlay.classList.add('hidden');
      overlay.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('menu-open');
      document.removeEventListener('keydown', keyHandler);
      if (state.lastFocused instanceof HTMLElement) state.lastFocused.focus();
      const panel = document.getElementById('mobile-cta-bar');
      if (panel) panel.style.pointerEvents = '';
    };

    const openMenu = () => {
      state.menuOpen = true;
      state.lastFocused = document.activeElement;
      button.setAttribute('aria-expanded', 'true');
      button.classList.add('is-open');
      overlay.classList.remove('hidden');
      overlay.setAttribute('aria-hidden', 'false');
      drawer.classList.add('is-open');
      drawer.setAttribute('aria-hidden', 'false');
      document.body.classList.add('menu-open');
      const panel = document.getElementById('mobile-cta-bar');
      if (panel) panel.style.pointerEvents = 'none';
      state.focusables = getFocusable(drawer);
      if (state.focusables[0]) state.focusables[0].focus();
      document.addEventListener('keydown', keyHandler);
    };

    const keyHandler = (event) => {
      if (!state.menuOpen) return;
      if (event.key === 'Escape') {
        closeMenu();
        return;
      }
      if (event.key === 'Tab') {
        state.focusables = getFocusable(drawer);
        if (!state.focusables.length) return;
        const first = state.focusables[0];
        const last = state.focusables[state.focusables.length - 1];
        const active = document.activeElement;
        if (event.shiftKey && active === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    button.addEventListener('click', () => (state.menuOpen ? closeMenu() : openMenu()));
    if (closeButton) closeButton.addEventListener('click', closeMenu);
    overlay.addEventListener('click', closeMenu);
    drawer.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
    window.addEventListener('resize', () => {
      if (window.innerWidth >= 768) closeMenu();
    });
  };

  const renderFooter = (settings) => {
    const mount = document.getElementById('site-footer');
    if (!mount) return;

    const social = socialHtml(settings);

    mount.innerHTML = `
      <footer class="border-t border-amber-200/20 bg-black/30">
        <div class="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <div class="site-footer-grid border-b border-amber-200/15 pb-6">
            <section>
              <a href="${resolvePath('/index.html')}" class="wordmark-link" aria-label="${escapeHtml(settings.siteName || settings.artistName || 'Site')} home">${wordmarkHtml(settings.logoText || settings.siteName || settings.artistName)}</a>
              <p class="site-footer-copy mt-2 text-sm">${escapeHtml(settings.tagline || 'Worship ministry rooted in prayer and Scripture.')}</p>
              <p class="site-footer-location mt-1 text-xs">${escapeHtml(settings.location || '')}</p>
            </section>
            <section>
              <p class="footer-section-label text-xs uppercase tracking-[0.16em]">Follow</p>
              <div class="mt-3 flex flex-wrap gap-3">${social || '<p class="site-footer-location text-xs">Add social links in settings.</p>'}</div>
            </section>
          </div>
          <div class="site-footer-legal pt-4 text-center text-xs">
            <p>&copy; <span id="footer-year"></span> ${escapeHtml(settings.siteName || settings.artistName || 'Site')}. ${escapeHtml(settings?.footer?.legalText || 'All rights reserved.')}</p>
          </div>
        </div>
      </footer>
    `;

    const year = document.getElementById('footer-year');
    if (year) year.textContent = String(new Date().getFullYear());
  };

  const renderMobileCtaBar = () => {};

  const applyTheme = (theme) => {
    const root = document.documentElement;
    root.style.setProperty('--brand', theme?.accent || '#D4AF37');
    root.style.setProperty('--brand-dark', '#B69022');
  };

  const getByPath = (object, path) => path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : ''), object);

  const applySettingBindings = (settings) => {
    document.querySelectorAll('[data-setting]').forEach((el) => {
      const path = el.getAttribute('data-setting') || '';
      const value = getByPath(settings, path);
      if (value !== '') el.textContent = String(value);
    });
  };

  const initReveal = () => {
    const targets = document.querySelectorAll('.reveal');
    if (!targets.length) return;

    targets.forEach((target, index) => {
      target.classList.add('reveal-stagger');
      target.style.setProperty('--reveal-delay', `${Math.min(index * 50, 240)}ms`);
    });

    if (state.reduceMotion || !('IntersectionObserver' in window)) {
      targets.forEach((item) => item.classList.add('in'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('in');
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12 }
    );

    targets.forEach((target) => observer.observe(target));
  };

  const placeholderImageDataUrl = () => {
    const svg = `
      <svg xmlns='http://www.w3.org/2000/svg' width='1200' height='800' viewBox='0 0 1200 800'>
        <rect width='1200' height='800' fill='#221b1d'/>
        <rect x='48' y='48' width='1104' height='704' rx='28' fill='none' stroke='#6e5b3b' stroke-width='2'/>
        <g fill='none' stroke='#d4af37' stroke-width='18' stroke-linecap='round' stroke-linejoin='round' opacity='0.9'>
          <path d='M420 310h360v180H420z'/>
          <path d='M420 490l120-115 105 96 60-55 75 74'/>
          <path d='M705 360h.1'/>
        </g>
        <text x='600' y='610' fill='#f7edcf' font-family='Georgia, serif' font-size='42' text-anchor='middle'>Image unavailable</text>
      </svg>
    `.trim();
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  };

  const installImageFallbacks = () => {
    document.addEventListener(
      'error',
      (event) => {
        const target = event.target;
        if (!(target instanceof HTMLImageElement)) return;
        if (target.dataset.fallbackApplied === 'true') return;
        target.dataset.fallbackApplied = 'true';
        target.alt = target.alt ? `${target.alt} (image unavailable)` : 'Image unavailable';
        target.src = placeholderImageDataUrl();
      },
      true
    );
  };

  const optimizeImages = () => {
    const images = Array.from(document.querySelectorAll('img'));
    images.forEach((img) => {
      if (!img.hasAttribute('decoding')) img.setAttribute('decoding', 'async');
      if (!img.hasAttribute('fetchpriority')) img.setAttribute('fetchpriority', 'low');
      if (!img.hasAttribute('loading') && img.id !== 'hero-image') img.setAttribute('loading', 'lazy');
    });
  };

  const initPageEnter = () => {
    window.requestAnimationFrame(() => document.body.classList.add('page-ready'));
  };

  const initProgressBar = () => {
    const bar = document.createElement('div');
    bar.id = 'scroll-progress';
    bar.setAttribute('aria-hidden', 'true');
    bar.className = 'fixed left-0 right-0 top-0 z-[60] h-[2px] origin-left scale-x-0 bg-[var(--brand)]';
    document.body.appendChild(bar);

    let rafId = 0;
    const onScroll = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const ratio = max > 0 ? Math.min(window.scrollY / max, 1) : 0;
        bar.style.transform = `scaleX(${ratio})`;
        rafId = 0;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  };

  const initLinkTransitions = () => {
    if (state.reduceMotion) return;
    document.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const href = anchor.getAttribute('href') || '';
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      if (anchor.target === '_blank') return;
      const next = new URL(anchor.href, window.location.origin);
      if (next.origin !== window.location.origin) return;
      event.preventDefault();
      document.body.classList.remove('page-ready');
      window.setTimeout(() => {
        window.location.href = next.href;
      }, 160);
    });
  };

  const initPrefetch = () => {
    const prefetched = new Set();
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection?.saveData || /2g/.test(connection?.effectiveType || '')) return;

    const prefetch = (href) => {
      if (!href || prefetched.has(href)) return;
      prefetched.add(href);
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = href;
      document.head.appendChild(link);
    };

    document.querySelectorAll('a[href]').forEach((a) => {
      const raw = a.getAttribute('href') || '';
      if (!raw || raw.startsWith('#') || raw.startsWith('mailto:') || raw.startsWith('tel:')) return;
      const abs = new URL(a.href, window.location.origin);
      if (abs.origin !== window.location.origin) return;
      const intent = () => prefetch(abs.pathname);
      a.addEventListener('mouseenter', intent, { passive: true });
      a.addEventListener('touchstart', intent, { passive: true, once: true });
    });
  };

  const loadSettings = async () => {
    if (state.settings) return state.settings;
    await primeInitialBundle();

    const bundled = readRememberedContent('/content/settings.json');
    if (bundled && typeof bundled === 'object') {
      state.settings = bundled;
      return state.settings;
    }

    const cacheEntry = readContentCache('/content/settings.json', { allowExpired: true });
    if (cacheEntry?.payload && typeof cacheEntry.payload === 'object') {
      state.settings = cacheEntry.payload;
      rememberContent('/content/settings.json', cacheEntry.payload);
      return state.settings;
    }

    const localSettings = await fetchWithRetry('/content/settings.json', (res) => res.json());
    state.settings = localSettings;
    writeContentCache('/content/settings.json', localSettings);
    return state.settings;
  };

  const loadTheme = async () => {
    if (state.theme) return state.theme;
    await primeInitialBundle();

    const bundled = readRememberedContent('/content/theme.json');
    if (bundled && typeof bundled === 'object') {
      state.theme = bundled;
      return state.theme;
    }

    state.theme = await loadJson('/content/theme.json').catch(() => ({ accent: '#D4AF37' }));
    return state.theme;
  };

  const init = async () => {
    state.reduceMotion = Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    await primeInitialBundle();
    const [settings, theme] = await Promise.all([loadSettings(), loadTheme()]);
    applyTheme(theme);
    renderHeader(settings);
    renderFooter(settings);
    applySettingBindings(settings);
    initPageEnter();
    initProgressBar();
    initLinkTransitions();
    initPrefetch();
    initReveal();
    installImageFallbacks();
    optimizeImages();
    return settings;
  };

  window.SiteApp = {
    ready: init(),
    loadSettings,
    loadTheme,
    loadJson,
    listFromPayload,
    escapeHtml,
    safeExternalHref,
    resolvePath,
    formatDate,
    placeholderImageDataUrl,
    clearContentCache,
    get settings() {
      return state.settings;
    },
    get theme() {
      return state.theme;
    }
  };
})();


(() => {
  const contentItems = [
    { label: "Site Settings", path: "/content/settings.json", hint: "Branding, contact, navigation, footer, social links." },
    { label: "Homepage", path: "/content/homepage.json", hint: "Hero and story content seen on home page." },
    { label: "Events", path: "/content/events.json", hint: "Event cards, dates, ticket settings and prices." },
    { label: "Music", path: "/content/music.json", hint: "Songs, release dates, cover images and links." },
    { label: "Media", path: "/content/media.json", hint: "Gallery/media cards and embed links." },
    { label: "Theme", path: "/content/theme.json", hint: "Accent colors and style classes." },
  ];

  const baseUrlInput = document.getElementById("functions-base-url");
  const anonKeyInput = document.getElementById("anon-key");
  const adminKeyInput = document.getElementById("admin-key");
  const sectionsEl = document.getElementById("editor-sections");
  const feedbackEl = document.getElementById("editor-feedback");
  const loadAllBtn = document.getElementById("load-all");
  const saveAllBtn = document.getElementById("save-all");

  const settingsStorageKey = "essy_admin_editor_config_v2";
  const refsByPath = new Map();
  const payloadByPath = new Map();

  const esc = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");

  const setFeedback = (message, ok = true) => {
    if (!feedbackEl) return;
    feedbackEl.textContent = message;
    feedbackEl.className = `mt-3 text-sm ${ok ? "text-emerald-200" : "text-rose-200"}`;
  };

  const getConfig = () => ({
    baseUrl: String(baseUrlInput?.value || "").trim().replace(/\/+$/, ""),
    anonKey: String(anonKeyInput?.value || "").trim(),
    adminSession: String(sessionStorage.getItem("essy_admin_session") || "").trim(),
    adminKey: String(adminKeyInput?.value || "").trim(),
  });

  const saveConfig = () => {
    const cfg = getConfig();
    localStorage.setItem(settingsStorageKey, JSON.stringify({ baseUrl: cfg.baseUrl, anonKey: cfg.anonKey }));
  };
  const loadConfig = () => {
    try {
      const raw = localStorage.getItem(settingsStorageKey);
      if (!raw) return;
      const cfg = JSON.parse(raw);
      if (baseUrlInput) baseUrlInput.value = cfg.baseUrl || "";
      if (anonKeyInput) anonKeyInput.value = cfg.anonKey || "";
      if (adminKeyInput) adminKeyInput.value = "";
    } catch {}
    if (adminKeyInput) adminKeyInput.value = "";
  };

  const waitForAdminAccess = async () => {
    if (window.__ESSY_ADMIN_UNLOCKED === true) return;
    await new Promise((resolve) => {
      const onUnlock = () => {
        window.removeEventListener("admin-unlocked", onUnlock);
        resolve();
      };
      window.addEventListener("admin-unlocked", onUnlock);
    });
  };

  const functionUrl = (path) => {
    const { baseUrl } = getConfig();
    if (!baseUrl) return "";
    return `${baseUrl}/${String(path || "").replace(/^\/+/, "")}`;
  };

  const apiHeaders = (needsAdmin = false) => {
    const { anonKey, adminSession, adminKey } = getConfig();
    const headers = { "Content-Type": "application/json" };
    if (anonKey) {
      headers.apikey = anonKey;
      headers.Authorization = `Bearer ${anonKey}`;
    }
    if (needsAdmin && adminSession) headers["x-admin-session"] = adminSession;
    else if (needsAdmin && adminKey) headers["x-admin-key"] = adminKey;
    return headers;
  };

  const loadLocalContent = async (path) => {
    const response = await fetch(`..${path}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Could not load ${path}`);
    return response.json();
  };

  const loadContent = async (path) => {
    const url = functionUrl(`/content-get?path=${encodeURIComponent(path)}`);
    if (url) {
      const response = await fetch(url, { cache: "no-store", headers: apiHeaders(false) });
      if (response.ok) {
        const data = await response.json();
        return data.payload;
      }
    }
    return loadLocalContent(path);
  };

  const saveContent = async (path, payload) => {
    const url = functionUrl("/content-upsert");
    if (!url) throw new Error("Functions Base URL is required");
    const { adminSession, adminKey } = getConfig();
    if (!adminSession && !adminKey) throw new Error("Login required. Unlock admin access first.");
    const response = await fetch(url, {
      method: "POST",
      headers: apiHeaders(true),
      body: JSON.stringify({ path, payload }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) throw new Error("Unauthorized. Unlock admin access again or verify ADMIN_API_KEY.");
    if (!response.ok) throw new Error(data?.error || "Save failed");
  };

  const row = (label, inputHtml) => `
    <label class="block">
      <span class="mb-1 block text-xs uppercase tracking-wide text-amber-200">${esc(label)}</span>
      ${inputHtml}
    </label>
  `;

  const textInput = (path, key, value, placeholder = "") =>
    `<input data-field="${esc(path)}:${esc(key)}" class="w-full rounded-md border border-amber-200/25 bg-black/35 px-3 py-2 text-sm text-amber-50" value="${esc(value)}" placeholder="${esc(placeholder)}" />`;

  const imageInput = (path, key, value, placeholder = "/assets/example.jpg") => `
    <div class="grid gap-2">
      <input data-field="${esc(path)}:${esc(key)}" class="w-full rounded-md border border-amber-200/25 bg-black/35 px-3 py-2 text-sm text-amber-50" value="${esc(value)}" placeholder="${esc(placeholder)}" />
      <div class="flex flex-wrap gap-2">
        <button type="button" data-upload-path="${esc(path)}" data-upload-key="${esc(key)}" class="btn-secondary rounded-full px-3 py-1 text-xs">Upload Image</button>
        <input type="file" accept="image/*" data-upload-input-path="${esc(path)}" data-upload-input-key="${esc(key)}" class="hidden" />
      </div>
      <p class="text-[11px] text-amber-100/70">Uploads are saved in database content as image data.</p>
    </div>
  `;

  const textArea = (path, key, value, rows = 4) =>
    `<textarea data-field="${esc(path)}:${esc(key)}" rows="${rows}" class="w-full rounded-md border border-amber-200/25 bg-black/35 p-3 text-sm text-amber-50">${esc(value)}</textarea>`;

  const checkbox = (path, key, checked) =>
    `<label class="inline-flex items-center gap-2 text-sm text-amber-50"><input data-field="${esc(path)}:${esc(key)}" type="checkbox" ${checked ? "checked" : ""} /> <span>Enabled</span></label>`;

  const ensureObject = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
  const ensureArray = (v) => (Array.isArray(v) ? v : []);
  const linesToArray = (text) =>
    String(text || "")
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean);

  const renderCardShell = () =>
    contentItems
      .map(
        (item) => `
      <article class="section-shell p-4" data-content-path="${item.path}">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="font-display text-2xl text-white">${esc(item.label)}</h2>
            <p class="mt-1 text-xs text-amber-100/75">${esc(item.hint)}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button type="button" data-reload="true" class="btn-secondary rounded-full px-4 py-2 text-xs">Reload</button>
            <button type="button" data-save="true" class="btn-primary rounded-full px-4 py-2 text-xs">Save</button>
          </div>
        </div>
        <div class="mt-4 grid gap-3" data-easy="true"></div>
        <details class="mt-4">
          <summary class="cursor-pointer text-xs uppercase tracking-wide text-amber-200">Advanced JSON (for developer)</summary>
          <textarea data-raw="true" rows="10" class="mt-2 w-full rounded-md border border-amber-200/25 bg-black/35 p-3 text-xs text-amber-50"></textarea>
        </details>
        <p data-status="true" class="mt-3 text-xs text-amber-100/75"></p>
      </article>
    `,
      )
      .join("");

  const syncRaw = (path) => {
    const refs = refsByPath.get(path);
    const payload = payloadByPath.get(path);
    if (!refs?.raw) return;
    refs.raw.value = JSON.stringify(payload, null, 2);
  };

  const setStatus = (path, message, ok = true) => {
    const refs = refsByPath.get(path);
    if (!refs?.status) return;
    refs.status.textContent = message;
    refs.status.className = `mt-3 text-xs ${ok ? "text-emerald-200" : "text-rose-200"}`;
  };

  const renderSettingsForm = (path, payload) => {
    const p = ensureObject(payload);
    p.contact = ensureObject(p.contact);
    p.nav = ensureObject(p.nav);
    p.nav.items = ensureArray(p.nav.items);
    p.footer = ensureObject(p.footer);
    p.footer.links = ensureArray(p.footer.links);
    p.socialLinks = ensureObject(p.socialLinks);
    p.streamingLinks = ensureObject(p.streamingLinks);
    p.mpesa = ensureObject(p.mpesa);
    p.api = ensureObject(p.api);
    p.eventsPage = ensureObject(p.eventsPage);
    p.musicPage = ensureObject(p.musicPage);
    p.contactPage = ensureObject(p.contactPage);

    const navHtml = p.nav.items
      .map(
        (item, idx) => `
      <div class="rounded-md border border-amber-200/20 p-3">
        <div class="grid gap-2 sm:grid-cols-2">
          ${row("Menu Label", textInput(path, `nav.items.${idx}.label`, item?.label || ""))}
          ${row("Menu Link", textInput(path, `nav.items.${idx}.href`, item?.href || ""))}
        </div>
        <button type="button" data-action="remove-nav" data-index="${idx}" class="mt-2 text-xs text-rose-200">Remove menu item</button>
      </div>`,
      )
      .join("");

    const footerLinksHtml = p.footer.links
      .map(
        (item, idx) => `
      <div class="rounded-md border border-amber-200/20 p-3">
        <div class="grid gap-2 sm:grid-cols-2">
          ${row("Footer Label", textInput(path, `footer.links.${idx}.label`, item?.label || ""))}
          ${row("Footer Link", textInput(path, `footer.links.${idx}.href`, item?.href || ""))}
        </div>
        <button type="button" data-action="remove-footer-link" data-index="${idx}" class="mt-2 text-xs text-rose-200">Remove footer link</button>
      </div>`,
      )
      .join("");

    return `
      <h3 class="text-sm font-semibold uppercase tracking-wide text-amber-100">Basic Info</h3>
      <div class="grid gap-3 sm:grid-cols-2">
        ${row("Site Name", textInput(path, "siteName", p.siteName || ""))}
        ${row("Logo Text", textInput(path, "logoText", p.logoText || ""))}
        ${row("Tagline", textInput(path, "tagline", p.tagline || ""))}
        ${row("Location", textInput(path, "location", p.location || ""))}
        ${row("Contact Email", textInput(path, "contact.email", p.contact.email || ""))}
        ${row("Contact Phone", textInput(path, "contact.phone", p.contact.phone || ""))}
      </div>

      <h3 class="mt-2 text-sm font-semibold uppercase tracking-wide text-amber-100">Navigation Menu</h3>
      <div class="grid gap-2">${navHtml || '<p class="text-xs text-amber-100/70">No menu items yet.</p>'}</div>
      <button type="button" data-action="add-nav" class="btn-secondary mt-2 rounded-full px-3 py-1 text-xs">Add menu item</button>

      <h3 class="mt-2 text-sm font-semibold uppercase tracking-wide text-amber-100">Footer</h3>
      <div class="grid gap-3 sm:grid-cols-2">
        ${row("Footer Legal Text", textInput(path, "footer.legalText", p.footer.legalText || ""))}
      </div>
      <div class="mt-2 grid gap-2">${footerLinksHtml || '<p class="text-xs text-amber-100/70">No footer links yet.</p>'}</div>
      <button type="button" data-action="add-footer-link" class="btn-secondary mt-2 rounded-full px-3 py-1 text-xs">Add footer link</button>

      <h3 class="mt-2 text-sm font-semibold uppercase tracking-wide text-amber-100">Social Links</h3>
      <div class="grid gap-3 sm:grid-cols-2">
        ${row("YouTube", textInput(path, "socialLinks.youtube", p.socialLinks.youtube || ""))}
        ${row("Instagram", textInput(path, "socialLinks.instagram", p.socialLinks.instagram || ""))}
        ${row("TikTok", textInput(path, "socialLinks.tiktok", p.socialLinks.tiktok || ""))}
        ${row("Facebook", textInput(path, "socialLinks.facebook", p.socialLinks.facebook || ""))}
        ${row("Spotify", textInput(path, "socialLinks.spotify", p.socialLinks.spotify || ""))}
        ${row("Apple Music", textInput(path, "socialLinks.appleMusic", p.socialLinks.appleMusic || ""))}
      </div>

      <h3 class="mt-2 text-sm font-semibold uppercase tracking-wide text-amber-100">Streaming Links</h3>
      <div class="grid gap-3 sm:grid-cols-2">
        ${row("Spotify", textInput(path, "streamingLinks.spotify", p.streamingLinks.spotify || ""))}
        ${row("Apple Music", textInput(path, "streamingLinks.appleMusic", p.streamingLinks.appleMusic || ""))}
        ${row("YouTube", textInput(path, "streamingLinks.youtube", p.streamingLinks.youtube || ""))}
      </div>

      <h3 class="mt-2 text-sm font-semibold uppercase tracking-wide text-amber-100">M-Pesa</h3>
      <div class="grid gap-3 sm:grid-cols-2">
        ${row("M-Pesa Enabled", checkbox(path, "mpesa.enabled", p.mpesa.enabled !== false))}
        ${row("Paybill/Till", textInput(path, "mpesa.paybillOrTill", p.mpesa.paybillOrTill || ""))}
        ${row("Account Reference", textInput(path, "mpesa.accountReference", p.mpesa.accountReference || ""))}
      </div>
      ${row("M-Pesa Instructions", textArea(path, "mpesa.instructions", p.mpesa.instructions || "", 3))}

      <h3 class="mt-2 text-sm font-semibold uppercase tracking-wide text-amber-100">Website API (auto-filled)</h3>
      <div class="grid gap-3 sm:grid-cols-2">
        ${row("Functions Base URL", textInput(path, "api.functionsBaseUrl", p.api.functionsBaseUrl || ""))}
        ${row("Supabase Anon Key", textInput(path, "api.supabaseAnonKey", p.api.supabaseAnonKey || ""))}
      </div>

      <h3 class="mt-2 text-sm font-semibold uppercase tracking-wide text-amber-100">Events Page Control</h3>
      <div class="grid gap-3 sm:grid-cols-2">
        ${row("Show Events Page Listings", checkbox(path, "eventsPage.enabled", p.eventsPage.enabled !== false))}
        ${row("Events Eyebrow", textInput(path, "eventsPage.eyebrow", p.eventsPage.eyebrow || ""))}
        ${row("Events Title", textInput(path, "eventsPage.title", p.eventsPage.title || ""))}
      </div>
      ${row("Events Subtitle", textArea(path, "eventsPage.subtitle", p.eventsPage.subtitle || "", 2))}
      ${row("Events Tags (one per line)", textArea(path, "eventsPage.tags", ensureArray(p.eventsPage.tags).join("\n"), 3))}

      <h3 class="mt-2 text-sm font-semibold uppercase tracking-wide text-amber-100">Music Page Text</h3>
      <div class="grid gap-3 sm:grid-cols-2">
        ${row("Music Eyebrow", textInput(path, "musicPage.eyebrow", p.musicPage.eyebrow || ""))}
        ${row("Music Title", textInput(path, "musicPage.title", p.musicPage.title || ""))}
      </div>
      ${row("Music Subtitle", textArea(path, "musicPage.subtitle", p.musicPage.subtitle || "", 2))}
      ${row("Music Tags (one per line)", textArea(path, "musicPage.tags", ensureArray(p.musicPage.tags).join("\n"), 3))}

      <h3 class="mt-2 text-sm font-semibold uppercase tracking-wide text-amber-100">Contact Page Text</h3>
      <div class="grid gap-3 sm:grid-cols-2">
        ${row("Contact Eyebrow", textInput(path, "contactPage.eyebrow", p.contactPage.eyebrow || ""))}
        ${row("Contact Title", textInput(path, "contactPage.title", p.contactPage.title || ""))}
        ${row("Details Title", textInput(path, "contactPage.detailsTitle", p.contactPage.detailsTitle || ""))}
        ${row("Quick Title", textInput(path, "contactPage.quickTitle", p.contactPage.quickTitle || ""))}
      </div>
      ${row("Contact Subtitle", textArea(path, "contactPage.subtitle", p.contactPage.subtitle || "", 2))}
    `;
  };

  const renderHomepageForm = (path, payload) => {
    const p = ensureObject(payload);
    p.hero = ensureObject(p.hero);
    p.hero.primaryCta = ensureObject(p.hero.primaryCta);
    p.hero.secondaryCta = ensureObject(p.hero.secondaryCta);
    if (p.hero.primaryCta.enabled === undefined) p.hero.primaryCta.enabled = true;
    if (p.hero.secondaryCta.enabled === undefined) p.hero.secondaryCta.enabled = true;
    p.story = ensureObject(p.story);
    p.story.blocks = ensureArray(p.story.blocks);
    p.sections = ensureArray(p.sections);
    const storySection = ensureObject(p.sections.find((s) => s?.id === "story") || { id: "story", enabled: true, order: 0 });

    const blocksHtml = p.story.blocks
      .map(
        (block, idx) => `
      <div class="rounded-md border border-amber-200/20 p-3">
        <div class="grid gap-2 sm:grid-cols-2">
          ${row("Block Type (text/image/split)", textInput(path, `story.blocks.${idx}.type`, block?.type || ""))}
          ${row("Eyebrow", textInput(path, `story.blocks.${idx}.eyebrow`, block?.eyebrow || ""))}
          ${row("Title", textInput(path, `story.blocks.${idx}.title`, block?.title || ""))}
          ${row("Image URL", imageInput(path, `story.blocks.${idx}.image`, block?.image || ""))}
          ${row("Image Alt", textInput(path, `story.blocks.${idx}.imageAlt`, block?.imageAlt || ""))}
          ${row("Image Caption", textInput(path, `story.blocks.${idx}.imageCaption`, block?.imageCaption || ""))}
          ${row("Image Position (left/right)", textInput(path, `story.blocks.${idx}.imagePosition`, block?.imagePosition || ""))}
          ${row("Button Text", textInput(path, `story.blocks.${idx}.ctaText`, block?.ctaText || ""))}
          ${row("Button Link", textInput(path, `story.blocks.${idx}.ctaHref`, block?.ctaHref || ""))}
        </div>
        ${row("Body", textArea(path, `story.blocks.${idx}.body`, block?.body || "", 4))}
        <button type="button" data-action="remove-story-block" data-index="${idx}" class="mt-2 text-xs text-rose-200">Remove block</button>
      </div>`,
      )
      .join("");

    return `
      <h3 class="text-sm font-semibold uppercase tracking-wide text-amber-100">Hero</h3>
      <div class="grid gap-3 sm:grid-cols-2">
        ${row("Headline", textInput(path, "hero.headline", p.hero.headline || ""))}
        ${row("Subheadline", textInput(path, "hero.subheadline", p.hero.subheadline || ""))}
        ${row("Human Note", textInput(path, "hero.humanNote", p.hero.humanNote || ""))}
        ${row("Background Type (image/video)", textInput(path, "hero.backgroundType", p.hero.backgroundType || ""))}
        ${row("Background Image URL", imageInput(path, "hero.backgroundImage", p.hero.backgroundImage || ""))}
        ${row("Background Video URL", textInput(path, "hero.backgroundVideo", p.hero.backgroundVideo || ""))}
        ${row("Primary Button Text", textInput(path, "hero.primaryCta.text", p.hero.primaryCta.text || ""))}
        ${row("Primary Button Link", textInput(path, "hero.primaryCta.href", p.hero.primaryCta.href || ""))}
        ${row("Show Primary Button", checkbox(path, "hero.primaryCta.enabled", p.hero.primaryCta.enabled !== false))}
        ${row("Secondary Button Text", textInput(path, "hero.secondaryCta.text", p.hero.secondaryCta.text || ""))}
        ${row("Secondary Button Link", textInput(path, "hero.secondaryCta.href", p.hero.secondaryCta.href || ""))}
        ${row("Show Secondary Button", checkbox(path, "hero.secondaryCta.enabled", p.hero.secondaryCta.enabled !== false))}
      </div>
      ${row("Hero Description", textArea(path, "hero.description", p.hero.description || "", 3))}

      <h3 class="mt-2 text-sm font-semibold uppercase tracking-wide text-amber-100">Story Section</h3>
      <div class="grid gap-3 sm:grid-cols-2">
        ${row("Story Enabled", checkbox(path, "sections.story.enabled", storySection.enabled !== false))}
        ${row("Story Order", textInput(path, "sections.story.order", storySection.order ?? 0))}
        ${row("Story Eyebrow", textInput(path, "story.eyebrow", p.story.eyebrow || ""))}
        ${row("Story Title", textInput(path, "story.title", p.story.title || ""))}
      </div>
      ${row("Story Intro", textArea(path, "story.intro", p.story.intro || "", 3))}

      <h3 class="mt-2 text-sm font-semibold uppercase tracking-wide text-amber-100">Story Blocks</h3>
      <div class="grid gap-2">${blocksHtml || '<p class="text-xs text-amber-100/70">No blocks yet.</p>'}</div>
      <button type="button" data-action="add-story-block" class="btn-secondary mt-2 rounded-full px-3 py-1 text-xs">Add story block</button>
    `;
  };

  const renderEventsForm = (path, payload) => {
    const p = ensureObject(payload);
    p.items = ensureArray(p.items);

    const html = p.items
      .map((event, idx) => {
        event.ticketing = ensureObject(event.ticketing);
        event.buttons = ensureObject(event.buttons);
        event.ticketTiers = ensureArray(event.ticketTiers);
        const tiersHtml = event.ticketTiers
          .map(
            (tier, tierIdx) => `
            <div class="grid gap-2 sm:grid-cols-2 rounded-md border border-amber-200/20 p-2">
              ${row("Tier Name", textInput(path, `items.${idx}.ticketTiers.${tierIdx}.name`, tier?.name || ""))}
              ${row("Price Ksh", textInput(path, `items.${idx}.ticketTiers.${tierIdx}.priceKsh`, tier?.priceKsh ?? 0))}
              <button type="button" data-action="remove-tier" data-eidx="${idx}" data-tidx="${tierIdx}" class="text-xs text-rose-200">Remove tier</button>
            </div>`,
          )
          .join("");

        return `
          <div class="rounded-md border border-amber-200/20 p-3">
            <h4 class="text-sm font-semibold text-amber-100">Event ${idx + 1}</h4>
            <div class="mt-2 grid gap-2 sm:grid-cols-2">
              ${row("Event ID", textInput(path, `items.${idx}.id`, event?.id || ""))}
              ${row("Visible", checkbox(path, `items.${idx}.enabled`, event?.enabled !== false))}
              ${row("Title", textInput(path, `items.${idx}.title`, event?.title || ""))}
              ${row("Year Theme", textInput(path, `items.${idx}.yearTheme`, event?.yearTheme || ""))}
              ${row("Date (YYYY-MM-DD)", textInput(path, `items.${idx}.date`, event?.date || ""))}
              ${row("Time", textInput(path, `items.${idx}.time`, event?.time || ""))}
              ${row("Venue", textInput(path, `items.${idx}.venue`, event?.venue || ""))}
              ${row("Banner Image URL", imageInput(path, `items.${idx}.bannerImage`, event?.bannerImage || ""))}
              ${row("Status (available/sold_out)", textInput(path, `items.${idx}.status`, event?.status || ""))}
              ${row("Featured", checkbox(path, `items.${idx}.featured`, event?.featured === true))}
              ${row("Capacity", textInput(path, `items.${idx}.ticketing.capacity`, event.ticketing.capacity ?? 0))}
              ${row("Max Per Purchase", textInput(path, `items.${idx}.ticketing.maxPerPurchase`, event.ticketing.maxPerPurchase ?? 1))}
              ${row("Buy Ticket Enabled", checkbox(path, `items.${idx}.buttons.buyTicketEnabled`, event.buttons.buyTicketEnabled !== false))}
              ${row("Add To Calendar", checkbox(path, `items.${idx}.buttons.addToCalendarEnabled`, event.buttons.addToCalendarEnabled !== false))}
              ${row("Share Enabled", checkbox(path, `items.${idx}.buttons.shareEnabled`, event.buttons.shareEnabled !== false))}
            </div>
            ${row("Description", textArea(path, `items.${idx}.description`, event?.description || "", 3))}
            ${row("Gallery Images (one URL per line)", textArea(path, `items.${idx}.galleryImages`, ensureArray(event?.galleryImages).join("\n"), 3))}
            ${row("Gallery Videos (one URL per line)", textArea(path, `items.${idx}.galleryVideos`, ensureArray(event?.galleryVideos).join("\n"), 3))}

            <div class="mt-2">
              <p class="text-xs uppercase tracking-wide text-amber-200">Ticket Tiers</p>
              <div class="mt-1 grid gap-2">${tiersHtml || '<p class="text-xs text-amber-100/70">No tiers yet.</p>'}</div>
              <button type="button" data-action="add-tier" data-eidx="${idx}" class="btn-secondary mt-2 rounded-full px-3 py-1 text-xs">Add tier</button>
            </div>

            <button type="button" data-action="remove-event" data-index="${idx}" class="mt-3 text-xs text-rose-200">Remove event</button>
          </div>
        `;
      })
      .join("");

    return `
      <div class="grid gap-2">${html || '<p class="text-xs text-amber-100/70">No events yet.</p>'}</div>
      <button type="button" data-action="add-event" class="btn-secondary mt-2 rounded-full px-3 py-1 text-xs">Add event</button>
    `;
  };

  const renderMusicForm = (path, payload) => {
    const p = ensureObject(payload);
    p.items = ensureArray(p.items);
    const html = p.items
      .map(
        (item, idx) => `
      <div class="rounded-md border border-amber-200/20 p-3">
        <h4 class="text-sm font-semibold text-amber-100">Song ${idx + 1}</h4>
        <div class="mt-2 grid gap-2 sm:grid-cols-2">
          ${row("Title", textInput(path, `items.${idx}.title`, item?.title || ""))}
          ${row("Cover Image URL", imageInput(path, `items.${idx}.coverImage`, item?.coverImage || ""))}
          ${row("Release Date", textInput(path, `items.${idx}.releaseDate`, item?.releaseDate || ""))}
          ${row("Featured", checkbox(path, `items.${idx}.featured`, item?.featured === true))}
          ${row("Spotify", textInput(path, `items.${idx}.links.spotify`, item?.links?.spotify || ""))}
          ${row("Apple Music", textInput(path, `items.${idx}.links.appleMusic`, item?.links?.appleMusic || ""))}
          ${row("YouTube", textInput(path, `items.${idx}.links.youtube`, item?.links?.youtube || ""))}
          ${row("Audiomack", textInput(path, `items.${idx}.links.audiomack`, item?.links?.audiomack || ""))}
        </div>
        ${row("Lyrics", textArea(path, `items.${idx}.lyrics`, item?.lyrics || "", 4))}
        <button type="button" data-action="remove-music" data-index="${idx}" class="mt-2 text-xs text-rose-200">Remove song</button>
      </div>`,
      )
      .join("");
    return `
      <div class="grid gap-2">${html || '<p class="text-xs text-amber-100/70">No songs yet.</p>'}</div>
      <button type="button" data-action="add-music" class="btn-secondary mt-2 rounded-full px-3 py-1 text-xs">Add song</button>
    `;
  };

  const renderMediaForm = (path, payload) => {
    const p = ensureObject(payload);
    p.items = ensureArray(p.items);
    const html = p.items
      .map(
        (item, idx) => `
      <div class="rounded-md border border-amber-200/20 p-3">
        <div class="grid gap-2 sm:grid-cols-2">
          ${row("Type (image/video)", textInput(path, `items.${idx}.type`, item?.type || ""))}
          ${row("Title", textInput(path, `items.${idx}.title`, item?.title || ""))}
          ${row("Thumbnail URL", imageInput(path, `items.${idx}.thumbnail`, item?.thumbnail || ""))}
          ${row("Link", textInput(path, `items.${idx}.link`, item?.link || ""))}
          ${row("Embed URL", textInput(path, `items.${idx}.embed`, item?.embed || ""))}
        </div>
        <button type="button" data-action="remove-media" data-index="${idx}" class="mt-2 text-xs text-rose-200">Remove media item</button>
      </div>`,
      )
      .join("");
    return `
      ${row("Section Title", textInput(path, "sectionTitle", p.sectionTitle || ""))}
      <div class="grid gap-2">${html || '<p class="text-xs text-amber-100/70">No media items yet.</p>'}</div>
      <button type="button" data-action="add-media" class="btn-secondary mt-2 rounded-full px-3 py-1 text-xs">Add media item</button>
    `;
  };

  const renderThemeForm = (path, payload) => {
    const p = ensureObject(payload);
    p.button = ensureObject(p.button);
    return `
      <div class="grid gap-3 sm:grid-cols-2">
        ${row("Accent Color", textInput(path, "accent", p.accent || ""))}
        ${row("Background Classes", textInput(path, "bg", p.bg || ""))}
        ${row("Hero Overlay Classes", textInput(path, "heroOverlay", p.heroOverlay || ""))}
        ${row("Card Classes", textInput(path, "card", p.card || ""))}
        ${row("Button Primary Classes", textInput(path, "button.primary", p.button.primary || ""))}
        ${row("Button Secondary Classes", textInput(path, "button.secondary", p.button.secondary || ""))}
      </div>
    `;
  };

  const setValueByPath = (obj, dotted, value) => {
    const keys = dotted.split(".");
    let cur = obj;
    for (let i = 0; i < keys.length - 1; i += 1) {
      const k = keys[i];
      const nextIsArrayIndex = /^\d+$/.test(keys[i + 1]);
      if (cur[k] === undefined) cur[k] = nextIsArrayIndex ? [] : {};
      cur = cur[k];
    }
    cur[keys[keys.length - 1]] = value;
  };

  const parseValue = (raw, type) => {
    if (type === "checkbox") return Boolean(raw);
    const text = String(raw ?? "");
    if (/^-?\d+$/.test(text)) return Number(text);
    return text;
  };

  const applySpecialTransforms = (path, field, value, payload) => {
    if (path === "/content/events.json" && (field.endsWith(".galleryImages") || field.endsWith(".galleryVideos"))) {
      return linesToArray(value);
    }
    if (path === "/content/settings.json" && (field === "eventsPage.tags" || field === "musicPage.tags")) {
      return linesToArray(value);
    }
    if (path === "/content/homepage.json" && field === "sections.story.enabled") {
      const sections = ensureArray(payload.sections);
      const idx = sections.findIndex((s) => s?.id === "story");
      const item = idx >= 0 ? sections[idx] : { id: "story", enabled: true, order: 0 };
      item.enabled = Boolean(value);
      if (idx >= 0) sections[idx] = item;
      else sections.push(item);
      payload.sections = sections;
      return "__handled__";
    }
    if (path === "/content/homepage.json" && field === "sections.story.order") {
      const sections = ensureArray(payload.sections);
      const idx = sections.findIndex((s) => s?.id === "story");
      const item = idx >= 0 ? sections[idx] : { id: "story", enabled: true, order: 0 };
      item.order = Number(value || 0);
      if (idx >= 0) sections[idx] = item;
      else sections.push(item);
      payload.sections = sections;
      return "__handled__";
    }
    return value;
  };

  const renderEasyForPath = (path) => {
    const refs = refsByPath.get(path);
    const payload = payloadByPath.get(path);
    if (!refs?.easy) return;

    let html = "";
    if (path === "/content/settings.json") html = renderSettingsForm(path, payload);
    if (path === "/content/homepage.json") html = renderHomepageForm(path, payload);
    if (path === "/content/events.json") html = renderEventsForm(path, payload);
    if (path === "/content/music.json") html = renderMusicForm(path, payload);
    if (path === "/content/media.json") html = renderMediaForm(path, payload);
    if (path === "/content/theme.json") html = renderThemeForm(path, payload);

    refs.easy.innerHTML = html;
    syncRaw(path);

    refs.easy.querySelectorAll("[data-field]").forEach((el) => {
      el.addEventListener("input", () => {
        const [fieldPath, dotted] = (el.getAttribute("data-field") || "").split(":");
        const currentPayload = payloadByPath.get(fieldPath);
        if (!currentPayload) return;
        const inputType = el.getAttribute("type");
        const rawVal = inputType === "checkbox" ? el.checked : el.value;
        let val = parseValue(rawVal, inputType);
        val = applySpecialTransforms(fieldPath, dotted, val, currentPayload);
        if (val !== "__handled__") setValueByPath(currentPayload, dotted, val);
        payloadByPath.set(fieldPath, currentPayload);
        syncRaw(fieldPath);
      });
    });

    refs.easy.querySelectorAll("[data-upload-path][data-upload-key]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const uploadPath = btn.getAttribute("data-upload-path") || "";
        const uploadKey = btn.getAttribute("data-upload-key") || "";
        const fileInput = refs.easy.querySelector(`[data-upload-input-path="${uploadPath}"][data-upload-input-key="${uploadKey}"]`);
        if (fileInput) fileInput.click();
      });
    });

    refs.easy.querySelectorAll("[data-upload-input-path][data-upload-input-key]").forEach((input) => {
      input.addEventListener("change", () => {
        const file = input.files?.[0];
        if (!file) return;
        const uploadPath = input.getAttribute("data-upload-input-path") || "";
        const uploadKey = input.getAttribute("data-upload-input-key") || "";
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = String(reader.result || "");
          const targetInput = refs.easy.querySelector(`[data-field="${uploadPath}:${uploadKey}"]`);
          if (targetInput) {
            targetInput.value = dataUrl;
            targetInput.dispatchEvent(new Event("input", { bubbles: true }));
            setStatus(path, "Image attached. Save section to persist.");
          }
        };
        reader.readAsDataURL(file);
      });
    });

    refs.easy.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.getAttribute("data-action");
        const payloadData = payloadByPath.get(path);
        if (!payloadData) return;

        if (action === "add-nav") ensureArray(ensureObject(payloadData.nav).items).push({ label: "New", href: "/" });
        if (action === "remove-nav") ensureArray(ensureObject(payloadData.nav).items).splice(Number(btn.getAttribute("data-index")), 1);

        if (action === "add-footer-link") ensureArray(ensureObject(payloadData.footer).links).push({ label: "Link", href: "/" });
        if (action === "remove-footer-link") ensureArray(ensureObject(payloadData.footer).links).splice(Number(btn.getAttribute("data-index")), 1);

        if (action === "add-story-block") ensureArray(ensureObject(ensureObject(payloadData.story).blocks)).push({ type: "text", title: "New block", body: "" });
        if (action === "remove-story-block") ensureArray(ensureObject(payloadData.story).blocks).splice(Number(btn.getAttribute("data-index")), 1);

        if (action === "add-event") ensureArray(payloadData.items).push({
          enabled: true,
          id: `event-${Date.now()}`,
          title: "New Event",
          yearTheme: "",
          description: "",
          date: "",
          time: "",
          venue: "",
          ticketing: { capacity: 0, maxPerPurchase: 1 },
          bannerImage: "",
          galleryImages: [],
          galleryVideos: [],
          featured: false,
          status: "available",
          buttons: { buyTicketEnabled: true, addToCalendarEnabled: true, shareEnabled: true },
          ticketTiers: [{ name: "General", priceKsh: 0 }],
        });
        if (action === "remove-event") ensureArray(payloadData.items).splice(Number(btn.getAttribute("data-index")), 1);

        if (action === "add-tier") {
          const eidx = Number(btn.getAttribute("data-eidx"));
          ensureArray(ensureObject(ensureArray(payloadData.items)[eidx]).ticketTiers).push({ name: "Tier", priceKsh: 0 });
        }
        if (action === "remove-tier") {
          const eidx = Number(btn.getAttribute("data-eidx"));
          const tidx = Number(btn.getAttribute("data-tidx"));
          ensureArray(ensureObject(ensureArray(payloadData.items)[eidx]).ticketTiers).splice(tidx, 1);
        }

        if (action === "add-music") ensureArray(payloadData.items).push({ title: "New Song", coverImage: "", releaseDate: "", links: { spotify: "", appleMusic: "", youtube: "", audiomack: "" }, featured: false, lyrics: "" });
        if (action === "remove-music") ensureArray(payloadData.items).splice(Number(btn.getAttribute("data-index")), 1);

        if (action === "add-media") ensureArray(payloadData.items).push({ type: "image", thumbnail: "", title: "New Media", link: "", embed: "" });
        if (action === "remove-media") ensureArray(payloadData.items).splice(Number(btn.getAttribute("data-index")), 1);

        payloadByPath.set(path, payloadData);
        renderEasyForPath(path);
      });
    });
  };

  const loadSection = async (path) => {
    setStatus(path, "Loading...");
    try {
      const payload = await loadContent(path);
      payloadByPath.set(path, payload);
      renderEasyForPath(path);
      setStatus(path, "Loaded");
      return true;
    } catch (error) {
      setStatus(path, error?.message || "Load failed", false);
      return false;
    }
  };

  const saveSection = async (path) => {
    setStatus(path, "Saving...");
    try {
      const refs = refsByPath.get(path);
      if (refs?.raw?.value) {
        try {
          const parsed = JSON.parse(refs.raw.value);
          payloadByPath.set(path, parsed);
        } catch {
          throw new Error("Advanced JSON is invalid");
        }
      }
      const payload = payloadByPath.get(path);
      await saveContent(path, payload);
      setStatus(path, "Saved");
      return true;
    } catch (error) {
      setStatus(path, error?.message || "Save failed", false);
      return false;
    }
  };

  const bindCardActions = () => {
    contentItems.forEach((item) => {
      const refs = refsByPath.get(item.path);
      if (!refs) return;
      refs.reloadBtn?.addEventListener("click", () => loadSection(item.path));
      refs.saveBtn?.addEventListener("click", () => saveSection(item.path));
      refs.raw?.addEventListener("change", () => {
        try {
          const parsed = JSON.parse(refs.raw.value);
          payloadByPath.set(item.path, parsed);
          renderEasyForPath(item.path);
          setStatus(item.path, "Advanced JSON applied");
        } catch {
          setStatus(item.path, "Advanced JSON is invalid", false);
        }
      });
    });
  };

  const loadAll = async () => {
    setFeedback("Loading all sections...");
    let failed = 0;
    for (const item of contentItems) {
      const ok = await loadSection(item.path);
      if (!ok) failed += 1;
    }
    if (failed) return setFeedback(`Loaded with ${failed} issue(s).`, false);
    setFeedback("All sections loaded.");
  };

  const saveAll = async () => {
    setFeedback("Saving all sections...");
    let failed = 0;
    for (const item of contentItems) {
      const ok = await saveSection(item.path);
      if (!ok) failed += 1;
    }
    if (failed) return setFeedback(`Saved with ${failed} issue(s).`, false);
    setFeedback("All sections saved.");
  };

  const renderCards = () => {
    if (!sectionsEl) return;
    sectionsEl.innerHTML = renderCardShell();
    contentItems.forEach((item) => {
      const card = sectionsEl.querySelector(`[data-content-path="${item.path}"]`);
      if (!card) return;
      refsByPath.set(item.path, {
        easy: card.querySelector("[data-easy='true']"),
        raw: card.querySelector("[data-raw='true']"),
        status: card.querySelector("[data-status='true']"),
        reloadBtn: card.querySelector("[data-reload='true']"),
        saveBtn: card.querySelector("[data-save='true']"),
      });
    });
  };

  const bindTopActions = () => {
    [baseUrlInput, anonKeyInput, adminKeyInput].forEach((input) => {
      input?.addEventListener("change", saveConfig);
      input?.addEventListener("blur", saveConfig);
    });
    loadAllBtn?.addEventListener("click", () => {
      saveConfig();
      loadAll().catch((e) => setFeedback(e?.message || "Load failed", false));
    });
    saveAllBtn?.addEventListener("click", () => {
      saveConfig();
      saveAll().catch((e) => setFeedback(e?.message || "Save failed", false));
    });
    window.addEventListener("admin-session-ready", () => {
      if (adminKeyInput) adminKeyInput.value = "";
      saveConfig();
    });
  };

  const bootstrapFromSettings = async () => {
    if (String(baseUrlInput?.value || "").trim() && String(anonKeyInput?.value || "").trim()) return;
    try {
      const settings = await loadLocalContent("/content/settings.json");
      if (baseUrlInput && !baseUrlInput.value) baseUrlInput.value = String(settings?.api?.functionsBaseUrl || "");
      if (anonKeyInput && !anonKeyInput.value) anonKeyInput.value = String(settings?.api?.supabaseAnonKey || "");
    } catch {}
  };

  const init = async () => {
    await waitForAdminAccess();
    loadConfig();
    await bootstrapFromSettings();
    saveConfig();
    renderCards();
    bindCardActions();
    bindTopActions();
    await loadAll();
  };

  init().catch((e) => setFeedback(e?.message || "Editor failed to start", false));
})();

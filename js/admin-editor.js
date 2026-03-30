(() => {
  const allContentItems = [
    {
      slug: "homepage",
      label: "Homepage",
      navLabel: "Homepage",
      group: "Pages",
      path: "/content/homepage.json",
      hint: "Hero and story content shown on the public home page.",
      summary: "Hero image or video, intro copy, story blocks, and homepage call-to-actions."
    },
    {
      slug: "events",
      label: "Events",
      navLabel: "Events",
      group: "Pages",
      path: "/content/events.json",
      hint: "Events, dates, ticket settings, and pricing. Only future-dated events show on the public page.",
      summary: "Gatherings, dates, ticket tiers, featured event settings, and event posters."
    },
    {
      slug: "music",
      label: "Music",
      navLabel: "Music",
      group: "Pages",
      path: "/content/music.json",
      hint: "Songs, cover images, release dates, lyrics, and streaming links.",
      summary: "Music releases, cover art, lyrics, streaming links, and featured songs."
    },
    {
      slug: "settings",
      label: "Site Settings",
      navLabel: "Settings",
      group: "Global",
      path: "/content/settings.json",
      hint: "Branding, contact details, navigation, footer, and page copy.",
      summary: "Brand name, contact details, navigation, footer, social links, and shared page settings."
    },
    {
      slug: "theme",
      label: "Theme",
      navLabel: "Theme",
      group: "Global",
      path: "/content/theme.json",
      hint: "Accent colors and style classes.",
      summary: "Colors, hero overlay, card styling, and button appearance."
    },
    {
      slug: "media",
      label: "Media",
      navLabel: "Media",
      group: "Reserved",
      path: "/content/media.json",
      hint: "Reserved gallery content. The current public pages do not display this file.",
      summary: "Reserved media items and thumbnails. This file is not currently rendered on the public website."
    },
  ];
  const editorQuery = new URLSearchParams(window.location.search);
  const requestedSectionSlug = String(editorQuery.get("section") || "").trim().toLowerCase();
  const fullEditorMode = String(editorQuery.get("view") || "").trim().toLowerCase() === "all";
  const selectedContentItem = allContentItems.find((item) => item.slug === requestedSectionSlug) || null;
  const chooserMode = !selectedContentItem && !fullEditorMode;
  const contentItems = selectedContentItem ? [selectedContentItem] : fullEditorMode ? allContentItems : [];

  const baseUrlInput = document.getElementById("functions-base-url");
  const anonKeyInput = document.getElementById("anon-key");
  const adminKeyInput = document.getElementById("admin-key");
  const editorTitleEl = document.getElementById("editor-title");
  const editorIntroEl = document.getElementById("editor-intro");
  const editorBackLinkEl = document.getElementById("editor-back-link");
  const editorContextLinksEl = document.getElementById("editor-context-links");
  const editorFlowCopyEl = document.getElementById("editor-flow-copy");
  const editorActionBarEl = document.getElementById("editor-action-bar");
  const overviewEl = document.getElementById("editor-overview");
  const navEl = document.getElementById("editor-nav");
  const navSectionEl = document.getElementById("editor-nav-section");
  const connectionSectionEl = document.getElementById("editor-connection-section");
  const sectionsEl = document.getElementById("editor-sections");
  const feedbackEl = document.getElementById("editor-feedback");
  const loadAllBtn = document.getElementById("load-all");
  const saveAllBtn = document.getElementById("save-all");
  const toggleAdvancedBtn = document.getElementById("toggle-advanced-json");

  const settingsStorageKey = "essy_admin_editor_config_v2";
  const contentCachePrefix = "essy_content_cache_v1:";
  const imageUploadMaxDimension = 1600;
  const imageUploadWarnBytes = 1.5 * 1024 * 1024;
  const imageUploadTargetBytes = 900 * 1024;
  const starterAssetPaths = new Set([
    "/assets/hero.jpg",
    "/assets/event-1.jpg",
    "/assets/music-1.jpg",
    "/assets/gallery-1.jpg"
  ]);
  const refsByPath = new Map();
  const payloadByPath = new Map();
  const contentStateByPath = new Map();
  let advancedJsonVisible = false;

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

  const clearCachedContent = (path) => {
    try {
      localStorage.removeItem(`${contentCachePrefix}${path}`);
    } catch {}
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
    const cleanPath = String(path || "").replace(/^\/+/, "");
    return baseUrl ? `${baseUrl}/${cleanPath}` : `/${cleanPath}`;
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

  const setSectionSaveState = (path) => {
    const refs = refsByPath.get(path);
    if (!refs?.saveBtn) return;
    const state = contentStateByPath.get(path);
    const canSave = state?.canSave !== false;
    refs.saveBtn.disabled = !canSave;
    refs.saveBtn.classList.toggle("opacity-50", !canSave);
    refs.saveBtn.classList.toggle("cursor-not-allowed", !canSave);
    refs.saveBtn.title = canSave ? "Save this section" : "Reload from backend before saving";
  };

  const loadContent = async (path) => {
    const url = functionUrl(`/content-get?path=${encodeURIComponent(path)}`);
    if (url) {
      try {
        const response = await fetch(url, { cache: "no-store", headers: apiHeaders(false) });
        if (response.ok) {
          const data = await response.json();
          const source = String(data?.source || "db");
          return {
            payload: data.payload,
            state: {
              source,
              canSave: true,
              message: source === "db"
                ? "Loaded from site content database."
                : "Loaded from deployed static content. Saving will store a database copy.",
            },
          };
        }

        let apiMessage = "";
        try {
          const data = await response.json();
          apiMessage = String(data?.error || "").trim();
        } catch {}

        const payload = await loadLocalContent(path);
        const missingSavedCopy = response.status === 404 && /content not found/i.test(apiMessage);
        return {
          payload,
          state: missingSavedCopy
            ? {
                source: "local-seed",
                canSave: true,
                message: "Loaded the bundled file because the live database does not have a saved copy yet. Saving will publish the first live version.",
              }
            : {
                source: "local-fallback",
                canSave: false,
                message: `Loaded the bundled file because the live content service could not be reached${apiMessage ? ` (${apiMessage})` : ""}. Reload from the backend before saving so newer live content is not overwritten.`,
              },
        };
      } catch (error) {
        const payload = await loadLocalContent(path);
        return {
          payload,
          state: {
            source: "local-fallback",
            canSave: false,
            message: `Loaded the bundled file because the live content service could not be reached (${error?.message || "network error"}). Reload from the backend before saving so newer live content is not overwritten.`,
          },
        };
      }
    }
    const payload = await loadLocalContent(path);
    return {
      payload,
      state: {
        source: "local-only",
        canSave: true,
        message: "Loaded the bundled file. Live save routes are not available in this environment.",
      },
    };
  };

  const saveContent = async (path, payload) => {
    const url = functionUrl("/content-upsert");
    const { adminSession, adminKey } = getConfig();
    if (!adminSession && !adminKey) throw new Error("Login required. Unlock admin access first.");
    const response = await fetch(url, {
      method: "POST",
      headers: apiHeaders(true),
      body: JSON.stringify({ path, payload }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) throw new Error("Your admin session is no longer active. Sign in again or use the backup access key if one is configured.");
    if (response.status === 413) throw new Error("This content payload is too large. Use smaller or compressed images, then try again.");
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
      <p class="text-[11px] text-amber-100/70">Uploads are stored in database content as image data. Large files are resized before saving.</p>
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

  const cardIdForPath = (path) =>
    `editor-${String(path || "")
      .replace(/^\/+/, "")
      .replaceAll("/", "-")
      .replaceAll(".", "-")}`;

  const editorHrefForItem = (item) => `./editor.html?section=${encodeURIComponent(item.slug)}`;

  const renderEditorContext = () => {
    if (chooserMode) {
      if (editorTitleEl) editorTitleEl.textContent = "Choose What To Edit";
      if (editorIntroEl) {
        editorIntroEl.textContent = "Open one page or setting at a time for a simpler editing experience.";
      }
      if (editorBackLinkEl) editorBackLinkEl.textContent = "Dashboard";
      if (editorFlowCopyEl) {
        editorFlowCopyEl.textContent = "Pick the page or setting you want to update. The editor will then open only that area.";
      }
      if (editorActionBarEl) editorActionBarEl.classList.add("hidden");
      if (navSectionEl) navSectionEl.classList.add("hidden");
      if (connectionSectionEl) connectionSectionEl.classList.add("hidden");
      if (editorContextLinksEl) editorContextLinksEl.innerHTML = "";
      return;
    }

    if (selectedContentItem) {
      if (editorTitleEl) editorTitleEl.textContent = `${selectedContentItem.label} Editor`;
      if (editorIntroEl) {
        editorIntroEl.textContent = `Edit only the ${selectedContentItem.label.toLowerCase()} section on this page. Other areas remain untouched.`;
      }
      if (editorBackLinkEl) editorBackLinkEl.textContent = "Dashboard";
      if (editorFlowCopyEl) {
        editorFlowCopyEl.textContent = "Editing flow: 1) Load this section 2) Make your changes 3) Save this section when you are ready.";
      }
      if (loadAllBtn) loadAllBtn.textContent = "Load Section";
      if (saveAllBtn) saveAllBtn.textContent = "Save Section";
      if (editorActionBarEl) editorActionBarEl.classList.remove("hidden");
      if (overviewEl) overviewEl.classList.add("hidden");
      if (navSectionEl) navSectionEl.classList.remove("hidden");
      if (connectionSectionEl) connectionSectionEl.classList.add("hidden");
      if (toggleAdvancedBtn) toggleAdvancedBtn.classList.add("hidden");
      if (editorContextLinksEl) {
        editorContextLinksEl.innerHTML = `
          <a href="#editor-nav" class="btn-secondary rounded-full px-4 py-2 text-sm">Switch Section</a>
        `;
      }
      return;
    }

    if (editorTitleEl) editorTitleEl.textContent = "Website Editor";
    if (editorIntroEl) {
      editorIntroEl.textContent = "Update each page section in guided form fields, then save when you are ready.";
    }
    if (editorBackLinkEl) editorBackLinkEl.textContent = "Back";
    if (editorFlowCopyEl) {
      editorFlowCopyEl.textContent = "Editing flow: 1) Load the latest content 2) Update the page section you need 3) Save that section or save everything together.";
    }
    if (loadAllBtn) loadAllBtn.textContent = "Load All";
    if (saveAllBtn) saveAllBtn.textContent = "Save All";
    if (editorActionBarEl) editorActionBarEl.classList.remove("hidden");
    if (overviewEl) overviewEl.classList.remove("hidden");
    if (navSectionEl) navSectionEl.classList.remove("hidden");
    if (connectionSectionEl) connectionSectionEl.classList.remove("hidden");
    if (toggleAdvancedBtn) toggleAdvancedBtn.classList.remove("hidden");
    if (editorContextLinksEl) editorContextLinksEl.innerHTML = "";
  };

  const renderOverview = () => {
    if (!overviewEl) return;
    if (chooserMode) {
      overviewEl.innerHTML = allContentItems
        .map(
          (item) => `
            <a href="${esc(editorHrefForItem(item))}" class="section-shell block p-5 transition hover:border-amber-200/35 hover:bg-black/30">
              <p class="text-xs uppercase tracking-[0.3em] text-amber-200">${esc(item.group)}</p>
              <h2 class="mt-2 font-display text-2xl text-white">${esc(item.label)}</h2>
              <p class="mt-2 text-sm text-amber-50/80">${esc(item.summary || item.hint)}</p>
            </a>
          `,
        )
        .join("");
      return;
    }
    const grouped = allContentItems.reduce((acc, item) => {
      acc[item.group] = acc[item.group] || [];
      acc[item.group].push(item);
      return acc;
    }, {});

    overviewEl.innerHTML = Object.entries(grouped)
      .map(([group, items]) => {
        const labels = items.map((item) => item.navLabel || item.label).join(" · ");
        return `
          <article class="section-shell p-5">
            <p class="text-xs uppercase tracking-[0.3em] text-amber-200">${esc(group)}</p>
            <h2 class="mt-2 font-display text-2xl text-white">${esc(group === "Pages" ? "Public Pages" : group === "Global" ? "Shared Site Settings" : "Reserved Content")}</h2>
            <p class="mt-2 text-sm text-amber-50/80">${esc(labels)}</p>
          </article>
        `;
      })
      .join("");
  };

  const renderSectionNav = () => {
    if (!navEl) return;
    navEl.innerHTML = allContentItems
      .map(
        (item) => `
          <a href="${esc(editorHrefForItem(item))}" class="btn-secondary rounded-full px-4 py-2 text-xs ${selectedContentItem?.slug === item.slug ? "opacity-100" : "opacity-80"}">
            ${esc(item.navLabel || item.label)}
          </a>
        `,
      )
      .join("");
  };

  const renderCardShell = () =>
    contentItems
      .map(
        (item) => `
      <article id="${esc(cardIdForPath(item.path))}" class="section-shell scroll-mt-24 p-5" data-content-path="${item.path}">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="max-w-3xl">
            <div class="flex flex-wrap items-center gap-2">
              <span class="rounded-full border border-amber-200/20 bg-black/20 px-3 py-1 text-[11px] uppercase tracking-[0.3em] text-amber-200">${esc(item.group)}</span>
            </div>
            <h2 class="mt-3 font-display text-3xl text-white">${esc(item.label)}</h2>
            <p class="mt-2 text-sm text-amber-50/80">${esc(item.summary || item.hint)}</p>
            <p class="mt-2 text-xs text-amber-100/70">${esc(item.hint)}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button type="button" data-reload="true" class="btn-secondary rounded-full px-4 py-2 text-xs">Reload Section</button>
            <button type="button" data-save="true" class="btn-primary rounded-full px-4 py-2 text-xs">Save Section</button>
          </div>
        </div>
        <div class="mt-5 grid gap-3" data-easy="true"></div>
        <details class="mt-5 hidden" data-advanced-json="true">
          <summary class="cursor-pointer text-xs uppercase tracking-[0.3em] text-amber-200">Advanced JSON</summary>
          <p class="mt-2 text-xs text-amber-100/65">Use this only when you need to edit raw structured content directly.</p>
          <textarea data-raw="true" rows="10" class="mt-2 w-full rounded-md border border-amber-200/25 bg-black/35 p-3 text-xs text-amber-50"></textarea>
        </details>
        <p data-status="true" class="mt-4 text-xs text-amber-100/75"></p>
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

  const setStatus = (path, message, tone = "ok") => {
    const refs = refsByPath.get(path);
    if (!refs?.status) return;
    refs.status.textContent = message;
    const toneClass = tone === "error" ? "text-rose-200" : tone === "warn" ? "text-amber-200" : "text-emerald-200";
    refs.status.className = `mt-3 text-xs ${toneClass}`;
  };

  const isPastDate = (value) => {
    if (!value) return false;
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return false;
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    return date.getTime() < startOfToday;
  };

  const usesStarterAsset = (value) => starterAssetPaths.has(String(value || "").trim());

  const collectWarnings = (path, payload) => {
    const warnings = [];

    if (path === "/content/settings.json") {
      const contact = ensureObject(payload.contact);
      if (!String(contact.email || "").trim() && !String(contact.phone || "").trim()) {
        warnings.push("No public contact email or phone number is set.");
      }
    }

    if (path === "/content/homepage.json") {
      const hero = ensureObject(payload.hero);
      const story = ensureObject(payload.story);
      const sections = ensureArray(payload.sections);
      const storySection = ensureObject(sections.find((section) => section?.id === "story"));
      if (String(hero.backgroundType || "").trim().toLowerCase() === "image" && !String(hero.backgroundImage || "").trim()) {
        warnings.push("The hero is set to use an image, but no hero image is provided.");
      }
      if (String(hero.backgroundType || "").trim().toLowerCase() === "video" && !String(hero.backgroundVideo || "").trim()) {
        warnings.push("The hero is set to use a video, but no video URL is provided.");
      }
      if (storySection.enabled !== false && ensureArray(story.blocks).length === 0) {
        warnings.push("The story section is enabled, but it has no content blocks.");
      }
      if (usesStarterAsset(hero.backgroundImage)) {
        warnings.push("The hero image is still using a starter asset.");
      }
      const storyUsesStarterImage = ensureArray(story.blocks).some((block) => usesStarterAsset(block?.image));
      if (storyUsesStarterImage) {
        warnings.push("One or more story images are still using starter assets.");
      }
    }

    if (path === "/content/events.json") {
      const items = ensureArray(payload.items).filter((item) => item?.enabled !== false);
      if (!items.length) {
        warnings.push("No enabled events are available for the public events page.");
      }
      const visibleUpcoming = items.filter((item) => {
        const date = String(item?.date || "").trim();
        const parsed = new Date(`${date}T00:00:00`).getTime();
        return !Number.isNaN(parsed) && !isPastDate(date);
      });
      if (items.length > 0 && visibleUpcoming.length === 0) {
        warnings.push("All enabled events are dated in the past, so the public events page will appear empty.");
      }
      items.forEach((item) => {
        const title = String(item?.title || "Untitled event").trim();
        const date = String(item?.date || "").trim();
        if (!date || Number.isNaN(new Date(`${date}T00:00:00`).getTime())) {
          warnings.push(`"${title}" has an invalid date and will not display correctly.`);
          return;
        }
        if (isPastDate(date) && String(item?.status || "").trim().toLowerCase() === "available") {
          warnings.push(`"${title}" is in the past and will be hidden on the public events page.`);
        }
        if (usesStarterAsset(item?.bannerImage)) {
          warnings.push(`"${title}" is still using a starter poster image.`);
        }
      });
    }

    if (path === "/content/music.json") {
      const items = ensureArray(payload.items);
      if (items.length === 0) {
        warnings.push("No music releases are published yet, so the page will show an empty state.");
      }
      if (items.some((item) => usesStarterAsset(item?.coverImage))) {
        warnings.push("One or more music covers are still using starter assets.");
      }
    }

    if (path === "/content/media.json") {
      warnings.push("This file is currently not used by the public site.");
      if (ensureArray(payload.items).some((item) => usesStarterAsset(item?.thumbnail))) {
        warnings.push("One or more media thumbnails are still using starter assets.");
      }
    }

    return warnings;
  };

  const applyStatusWithWarnings = (path, message, baseTone = "ok") => {
    const warnings = collectWarnings(path, payloadByPath.get(path) || {});
    if (!warnings.length) {
      setStatus(path, message, baseTone);
      return;
    }
    const tone = baseTone === "error" ? "error" : "warn";
    setStatus(path, `${message} Review: ${warnings.join(" ")}`, tone);
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

      <h3 class="mt-2 text-sm font-semibold uppercase tracking-wide text-amber-100">Website API (optional)</h3>
      <div class="grid gap-3 sm:grid-cols-2">
        ${row("Functions Base URL", textInput(path, "api.functionsBaseUrl", p.api.functionsBaseUrl || "", "Leave blank on Netlify same-origin"))}
        ${row("Public API Key", textInput(path, "api.supabaseAnonKey", p.api.supabaseAnonKey || "", "Leave blank unless you expose a public browser key"))}
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
        ${row("Hero WhatsApp Text", textInput(path, "contactPage.heroWhatsappText", p.contactPage.heroWhatsappText || ""))}
        ${row("Hero Email Text", textInput(path, "contactPage.heroEmailText", p.contactPage.heroEmailText || ""))}
        ${row("Email CTA Text", textInput(path, "contactPage.emailCtaText", p.contactPage.emailCtaText || ""))}
        ${row("WhatsApp CTA Text", textInput(path, "contactPage.whatsappCtaText", p.contactPage.whatsappCtaText || ""))}
        ${row("Events CTA Text", textInput(path, "contactPage.eventsCtaText", p.contactPage.eventsCtaText || ""))}
        ${row("Events CTA Link", textInput(path, "contactPage.eventsCtaHref", p.contactPage.eventsCtaHref || ""))}
        ${row("Form Submit Text", textInput(path, "contactPage.formSubmitText", p.contactPage.formSubmitText || ""))}
      </div>
      ${row("Contact Subtitle", textArea(path, "contactPage.subtitle", p.contactPage.subtitle || "", 2))}
      ${row("Details Subtitle", textArea(path, "contactPage.detailsSubtitle", p.contactPage.detailsSubtitle || "", 2))}
      ${row("Quick Subtitle", textArea(path, "contactPage.quickSubtitle", p.contactPage.quickSubtitle || "", 2))}
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

  const readFileAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Could not read selected image"));
      reader.readAsDataURL(file);
    });

  const loadImageElement = (src) =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Could not process selected image"));
      image.src = src;
    });

  const estimateDataUrlBytes = (dataUrl) => {
    const base64 = String(dataUrl || "").split(",")[1] || "";
    return Math.ceil((base64.length * 3) / 4);
  };

  const optimizeImageFile = async (file) => {
    const type = String(file?.type || "").toLowerCase();
    const originalDataUrl = await readFileAsDataUrl(file);

    if (!type || type === "image/svg+xml" || type === "image/gif") {
      return {
        dataUrl: originalDataUrl,
        note: "Image attached. Save section to persist."
      };
    }

    const image = await loadImageElement(originalDataUrl);
    const largestSide = Math.max(image.naturalWidth || 0, image.naturalHeight || 0);
    const shouldResize = largestSide > imageUploadMaxDimension || file.size > imageUploadWarnBytes;
    if (!shouldResize) {
      return {
        dataUrl: originalDataUrl,
        note: "Image attached. Save section to persist."
      };
    }

    const scale = largestSide > imageUploadMaxDimension ? imageUploadMaxDimension / largestSide : 1;
    const width = Math.max(1, Math.round((image.naturalWidth || 1) * Math.min(1, scale)));
    const height = Math.max(1, Math.round((image.naturalHeight || 1) * Math.min(1, scale)));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      return {
        dataUrl: originalDataUrl,
        note: "Image attached. Save section to persist."
      };
    }

    context.drawImage(image, 0, 0, width, height);

    const outputType = type === "image/png" ? "image/png" : type === "image/webp" ? "image/webp" : "image/jpeg";
    let quality = outputType === "image/png" ? undefined : 0.88;
    let optimizedDataUrl = canvas.toDataURL(outputType, quality);
    while (quality && estimateDataUrlBytes(optimizedDataUrl) > imageUploadTargetBytes && quality > 0.62) {
      quality = Number((quality - 0.08).toFixed(2));
      optimizedDataUrl = canvas.toDataURL(outputType, quality);
    }

    const optimizedBytes = estimateDataUrlBytes(optimizedDataUrl);
    const note = optimizedBytes > imageUploadWarnBytes
      ? "Image attached, but it is still large. If saving fails, use a smaller/compressed image."
      : "Image attached and optimized for faster loading. Save section to persist.";

    return {
      dataUrl: optimizedDataUrl,
      note
    };
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
        const sectionState = contentStateByPath.get(fieldPath);
        if (sectionState?.canSave === false) {
          applyStatusWithWarnings(fieldPath, `${sectionState.message} Changes remain local until backend reload succeeds.`, "warn");
        } else {
          applyStatusWithWarnings(fieldPath, "Changes ready to save.", "ok");
        }
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
      input.addEventListener("change", async () => {
        const file = input.files?.[0];
        if (!file) return;
        const uploadPath = input.getAttribute("data-upload-input-path") || "";
        const uploadKey = input.getAttribute("data-upload-input-key") || "";
        try {
          const { dataUrl, note } = await optimizeImageFile(file);
          const targetInput = refs.easy.querySelector(`[data-field="${uploadPath}:${uploadKey}"]`);
          if (targetInput) {
            targetInput.value = dataUrl;
            targetInput.dispatchEvent(new Event("input", { bubbles: true }));
            applyStatusWithWarnings(path, note, "ok");
          }
        } catch (error) {
          setStatus(path, error?.message || "Could not attach the selected image.", "error");
        } finally {
          input.value = "";
        }
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
        const sectionState = contentStateByPath.get(path);
        if (sectionState?.canSave === false) {
          applyStatusWithWarnings(path, `${sectionState.message} Changes remain local until backend reload succeeds.`, "warn");
        } else {
          applyStatusWithWarnings(path, "Changes ready to save.", "ok");
        }
      });
    });
  };

  const loadSection = async (path) => {
    setStatus(path, "Loading...", "ok");
    try {
      const result = await loadContent(path);
      payloadByPath.set(path, result.payload);
      contentStateByPath.set(path, result.state);
      renderEasyForPath(path);
      setSectionSaveState(path);
      applyStatusWithWarnings(path, result.state.message, result.state.canSave === false ? "warn" : "ok");
      return true;
    } catch (error) {
      contentStateByPath.delete(path);
      setSectionSaveState(path);
      setStatus(path, error?.message || "This section could not be loaded.", "error");
      return false;
    }
  };

  const saveSection = async (path) => {
    setStatus(path, "Saving...", "ok");
    try {
      const state = contentStateByPath.get(path);
      if (state?.canSave === false) {
        throw new Error("This section was loaded from the bundled file because the live backend could not be reached. Reload from the backend before saving.");
      }
      const refs = refsByPath.get(path);
      if (refs?.raw?.value) {
        try {
          const parsed = JSON.parse(refs.raw.value);
          payloadByPath.set(path, parsed);
        } catch {
          throw new Error("The advanced JSON contains invalid formatting.");
        }
      }
      const payload = payloadByPath.get(path);
      await saveContent(path, payload);
      clearCachedContent(path);
      if (path === "/content/settings.json") clearCachedContent("/content/settings.json");
      contentStateByPath.set(path, {
        source: "db",
        canSave: true,
        message: "Saved to site content database.",
      });
      setSectionSaveState(path);
      applyStatusWithWarnings(path, "Saved to site content database.", "ok");
      return true;
    } catch (error) {
      setStatus(path, error?.message || "This section could not be saved.", "error");
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
          const state = contentStateByPath.get(item.path);
          if (state?.canSave === false) {
            applyStatusWithWarnings(item.path, `${state.message} JSON edits are local only until backend reload succeeds.`, "warn");
          } else {
            applyStatusWithWarnings(item.path, "Advanced JSON applied.", "ok");
          }
        } catch {
          setStatus(item.path, "The advanced JSON contains invalid formatting.", "error");
        }
      });
    });
  };

  const loadAll = async () => {
    if (chooserMode) return;
    setFeedback("Loading all sections...");
    let failed = 0;
    let blocked = 0;
    for (const item of contentItems) {
      const ok = await loadSection(item.path);
      if (!ok) failed += 1;
      else if (contentStateByPath.get(item.path)?.canSave === false) blocked += 1;
    }
    if (failed) return setFeedback(`Loaded with ${failed} issue(s).`, false);
    if (blocked) {
      return setFeedback(`Loaded with warning: ${blocked} section(s) are using bundled fallback content. Reload those sections from the backend before saving.`, false);
    }
    setFeedback("All sections loaded.");
  };

  const saveAll = async () => {
    if (chooserMode) return;
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
    if (chooserMode) {
      sectionsEl.innerHTML = "";
      refsByPath.clear();
      return;
    }
    sectionsEl.innerHTML = renderCardShell();
    contentItems.forEach((item) => {
      const card = sectionsEl.querySelector(`[data-content-path="${item.path}"]`);
      if (!card) return;
      refsByPath.set(item.path, {
        easy: card.querySelector("[data-easy='true']"),
        details: card.querySelector("[data-advanced-json='true']"),
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
    toggleAdvancedBtn?.addEventListener("click", () => {
      advancedJsonVisible = !advancedJsonVisible;
      toggleAdvancedBtn.textContent = advancedJsonVisible ? "Hide Advanced JSON" : "Show Advanced JSON";
      refsByPath.forEach((refs) => {
        if (!refs?.details) return;
        refs.details.classList.toggle("hidden", !advancedJsonVisible);
        refs.details.open = advancedJsonVisible;
      });
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
    renderEditorContext();
    renderOverview();
    renderSectionNav();
    renderCards();
    bindCardActions();
    bindTopActions();
    await loadAll();
  };

  init().catch((e) => setFeedback(e?.message || "Editor failed to start", false));
})();

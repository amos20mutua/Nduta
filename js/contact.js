(() => {
  const heroWhatsappEl = document.getElementById('hero-whatsapp');
  const heroEmailEl = document.getElementById('hero-email');
  const emailEl = document.getElementById('contact-email');
  const phoneEl = document.getElementById('contact-phone');
  const contactEmailCta = document.getElementById('contact-email-cta');
  const contactWhatsappCta = document.getElementById('contact-whatsapp-cta');
  const contactEventsCta = document.getElementById('contact-events-cta');
  const bookingForm = document.getElementById('booking-request-form');
  const bookingSubmitBtn = document.getElementById('contact-submit');
  const formFeedbackEl = document.getElementById('contact-form-feedback');

  const eyebrowEl = document.getElementById('contact-eyebrow');
  const titleEl = document.getElementById('contact-title');
  const subtitleEl = document.getElementById('contact-subtitle');
  const detailsTitleEl = document.getElementById('contact-details-title');
  const detailsSubtitleEl = document.getElementById('contact-details-subtitle');
  const quickTitleEl = document.getElementById('contact-quick-title');
  const quickSubtitleEl = document.getElementById('contact-quick-subtitle');

  let apiConfig = {};
  let siteEmail = '';

  const cleanPhone = (input) => String(input || '').replace(/\D/g, '');

  const normalizeWhatsappNumber = (input) => {
    const digits = cleanPhone(input);
    if (!digits) return '';
    if (digits.startsWith('254')) return digits;
    if (digits.startsWith('0')) return `254${digits.slice(1)}`;
    return digits;
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
    return headers;
  };

  const setFormFeedback = (message, ok = true) => {
    if (!formFeedbackEl) return;
    formFeedbackEl.textContent = message;
    formFeedbackEl.className = `text-sm ${ok ? 'text-emerald-200' : 'text-rose-200'}`;
    formFeedbackEl.classList.remove('hidden');
  };

  const setLinkState = (element, href, label, { external = false } = {}) => {
    if (!element) return;
    if (!href) {
      element.classList.add('hidden');
      element.removeAttribute('href');
      return;
    }
    element.classList.remove('hidden');
    element.href = href;
    if (label) element.textContent = label;
    if (external) {
      element.target = '_blank';
      element.rel = 'noopener noreferrer';
    }
  };

  const toggleDetailCard = (element, visible) => {
    const card = element?.closest('div');
    if (card) card.classList.toggle('hidden', !visible);
  };

  const submitBookingRequest = async (payload) => {
    const response = await fetch(buildFunctionUrl('/contact-submit'), {
      method: 'POST',
      headers: buildFunctionHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || 'Could not send booking request');
    return data;
  };

  if (bookingForm instanceof HTMLFormElement) {
    bookingForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(bookingForm);
      if (String(formData.get('company') || '').trim()) {
        bookingForm.reset();
        setFormFeedback('Booking request sent. We will respond soon.');
        return;
      }

      const payload = {
        name: String(formData.get('name') || '').trim(),
        email: String(formData.get('email') || '').trim(),
        phone: String(formData.get('phone') || '').trim(),
        organization: String(formData.get('organization') || '').trim(),
        eventDate: String(formData.get('eventDate') || '').trim(),
        location: String(formData.get('location') || '').trim(),
        message: String(formData.get('message') || '').trim(),
        source: 'website-contact-form'
      };

      if (!payload.name || !payload.email || !payload.message) {
        setFormFeedback('Please fill in your name, email, and message.', false);
        return;
      }

      if (bookingSubmitBtn instanceof HTMLButtonElement) bookingSubmitBtn.disabled = true;
      setFormFeedback('Sending booking request...');

      try {
        const data = await submitBookingRequest(payload);
        bookingForm.reset();
        setFormFeedback(data?.message || 'Booking request sent. You will receive a response soon.');
      } catch (error) {
        const fallback = siteEmail
          ? `Could not submit online right now. Please email ${siteEmail} instead.`
          : 'Could not submit online right now. Please use the direct contact buttons below.';
        setFormFeedback(error?.message || fallback, false);
      } finally {
        if (bookingSubmitBtn instanceof HTMLButtonElement) bookingSubmitBtn.disabled = false;
      }
    });
  }

  SiteApp.ready
    .then((settings) => {
      const page = settings.contactPage || {};
      apiConfig = settings.api || {};

      if (eyebrowEl) eyebrowEl.textContent = page.eyebrow || 'Contact / Booking';
      if (titleEl) titleEl.textContent = page.title || 'Book Essy for worship ministry.';
      if (subtitleEl) subtitleEl.textContent = page.subtitle || 'Share your date and location. You will get a response with availability.';
      if (detailsTitleEl) detailsTitleEl.textContent = page.detailsTitle || 'Contact Details';
      if (detailsSubtitleEl) detailsSubtitleEl.textContent = page.detailsSubtitle || 'For churches, fellowships, conferences, and worship nights.';
      if (quickTitleEl) quickTitleEl.textContent = page.quickTitle || 'Booking Request';
      if (quickSubtitleEl) quickSubtitleEl.textContent = page.quickSubtitle || 'Need a worship minister for your gathering? Share the details below and a response will follow.';
      if (bookingSubmitBtn) bookingSubmitBtn.textContent = page.formSubmitText || 'Send Booking Request';

      const emailTarget = String(settings.contact?.email || settings.email || '').trim();
      const phoneTarget = String(settings.contact?.phone || settings.phone || '').trim();
      const whatsappDigits = normalizeWhatsappNumber(phoneTarget);
      const whatsappHref = whatsappDigits ? `https://wa.me/${encodeURIComponent(whatsappDigits)}` : '';

      siteEmail = emailTarget;

      setLinkState(heroWhatsappEl, whatsappHref, page.heroWhatsappText || 'Chat on WhatsApp', { external: true });
      setLinkState(heroEmailEl, emailTarget ? `mailto:${emailTarget}` : '', page.heroEmailText || 'Send Email');
      setLinkState(contactEmailCta, emailTarget ? `mailto:${emailTarget}` : '', page.emailCtaText || 'Email Essy');
      setLinkState(contactWhatsappCta, whatsappHref, page.whatsappCtaText || 'WhatsApp Chat', { external: true });

      if (contactEventsCta) {
        contactEventsCta.href = SiteApp.resolvePath(page.eventsCtaHref || '/events.html');
        contactEventsCta.textContent = page.eventsCtaText || 'View Events';
      }

      if (emailEl) {
        if (emailTarget) {
          emailEl.textContent = emailTarget;
          emailEl.href = `mailto:${emailTarget}`;
        }
        toggleDetailCard(emailEl, Boolean(emailTarget));
      }

      if (phoneEl) {
        if (phoneTarget) {
          phoneEl.textContent = phoneTarget;
          phoneEl.href = `tel:${phoneTarget}`;
        }
        toggleDetailCard(phoneEl, Boolean(phoneTarget));
      }
    })
    .catch(() => {});
})();

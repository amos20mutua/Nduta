(() => {
  const heroWhatsappEl = document.getElementById('hero-whatsapp');
  const heroEmailEl = document.getElementById('hero-email');
  const emailEl = document.getElementById('contact-email');
  const phoneEl = document.getElementById('contact-phone');
  const contactEmailCta = document.getElementById('contact-email-cta');
  const contactWhatsappCta = document.getElementById('contact-whatsapp-cta');
  const contactEventsCta = document.getElementById('contact-events-cta');

  const eyebrowEl = document.getElementById('contact-eyebrow');
  const titleEl = document.getElementById('contact-title');
  const subtitleEl = document.getElementById('contact-subtitle');
  const detailsTitleEl = document.getElementById('contact-details-title');
  const detailsSubtitleEl = document.getElementById('contact-details-subtitle');
  const quickTitleEl = document.getElementById('contact-quick-title');
  const quickSubtitleEl = document.getElementById('contact-quick-subtitle');

  const cleanPhone = (input) => String(input || '').replace(/[^\d+]/g, '').replace(/^\+/, '');

  SiteApp.ready
    .then((settings) => {
      const page = settings.contactPage || {};
      if (eyebrowEl) eyebrowEl.textContent = page.eyebrow || 'Contact / Booking';
      if (titleEl) titleEl.textContent = page.title || 'Book Essy for worship ministry.';
      if (subtitleEl) subtitleEl.textContent = page.subtitle || 'Share your date and location. You will get a response with availability.';
      if (detailsTitleEl) detailsTitleEl.textContent = page.detailsTitle || 'Contact Details';
      if (detailsSubtitleEl) detailsSubtitleEl.textContent = page.detailsSubtitle || 'For churches, fellowships, conferences, and worship nights.';
      if (quickTitleEl) quickTitleEl.textContent = page.quickTitle || 'Booking Request';
      if (quickSubtitleEl) quickSubtitleEl.textContent = page.quickSubtitle || 'Need a worship minister for your gathering? Reach out through any channel below.';

      const emailTarget = settings.contact?.email || settings.email || '';
      const phoneTarget = settings.contact?.phone || settings.phone || '';
      const digits = cleanPhone(phoneTarget);
      const whatsappHref = `https://wa.me/${encodeURIComponent(digits)}`;

      if (heroWhatsappEl) {
        heroWhatsappEl.href = whatsappHref;
        heroWhatsappEl.textContent = page.heroWhatsappText || 'Chat on WhatsApp';
      }
      if (heroEmailEl) {
        heroEmailEl.href = `mailto:${emailTarget}`;
        heroEmailEl.textContent = page.heroEmailText || 'Send Email';
      }
      if (contactEmailCta) {
        contactEmailCta.href = `mailto:${emailTarget}`;
        contactEmailCta.textContent = page.emailCtaText || 'Email Essy';
      }
      if (contactWhatsappCta) {
        contactWhatsappCta.href = whatsappHref;
        contactWhatsappCta.textContent = page.whatsappCtaText || 'WhatsApp Chat';
      }
      if (contactEventsCta) {
        contactEventsCta.href = SiteApp.resolvePath(page.eventsCtaHref || '/events.html');
        contactEventsCta.textContent = page.eventsCtaText || 'View Events';
      }
      if (emailEl) {
        emailEl.textContent = emailTarget;
        emailEl.href = `mailto:${emailTarget}`;
      }
      if (phoneEl) {
        phoneEl.textContent = phoneTarget;
        phoneEl.href = `tel:${phoneTarget}`;
      }
    })
    .catch(() => {});
})();

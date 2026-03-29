insert into site_content (path, payload, updated_at)
values
  (
    '/content/settings.json',
    $${
      "siteName": "Essy Singer",
      "logoText": "Essy Singer",
      "tagline": "Worship Minister | Music Educator",
      "location": "Nairobi, Kenya",
      "contact": {
        "email": "missgikaba@gmail.com",
        "phone": ""
      },
      "nav": {
        "items": [
          { "label": "Home", "href": "/index.html" },
          { "label": "Music", "href": "/music.html" },
          { "label": "Events", "href": "/events.html" },
          { "label": "Contact", "href": "/contact.html" }
        ]
      },
      "socialLinks": {
        "youtube": "",
        "instagram": "",
        "tiktok": "",
        "facebook": "",
        "spotify": "",
        "appleMusic": ""
      },
      "streamingLinks": {
        "spotify": "",
        "appleMusic": "",
        "youtube": ""
      },
      "footer": {
        "legalText": "All rights reserved.",
        "links": [
          { "label": "Privacy", "href": "/privacy.html" },
          { "label": "Terms", "href": "/terms.html" }
        ]
      },
      "mpesa": {
        "enabled": true,
        "paybillOrTill": "",
        "accountReference": "ESSY TICKETS",
        "instructions": "Open M-Pesa Express, enter the event amount, confirm the prompt, then keep your SMS as proof."
      },
      "api": {
        "functionsBaseUrl": "",
        "supabaseAnonKey": ""
      },
      "musicPage": {
        "eyebrow": "Music",
        "title": "Songs For Worship Moments",
        "subtitle": "A growing home for songs, live worship moments, and releases that carry hope and reverence.",
        "tags": []
      },
      "eventsPage": {
        "enabled": true,
        "eyebrow": "Events",
        "title": "Worship Nights and Gatherings",
        "subtitle": "See upcoming gatherings, ticket moments when available, and recent ministry events in one place.",
        "tags": []
      },
      "contactPage": {
        "eyebrow": "Contact / Booking",
        "title": "Book Essy for worship ministry.",
        "subtitle": "Share your date, location, and vision for the gathering. A response will follow with availability.",
        "detailsTitle": "Contact Details",
        "detailsSubtitle": "For churches, fellowships, conferences, and worship nights.",
        "quickTitle": "Booking Request",
        "quickSubtitle": "Need a worship minister for your gathering? Share the details below and a response will follow.",
        "heroWhatsappText": "Chat on WhatsApp",
        "heroEmailText": "Send Email",
        "emailCtaText": "Email Essy",
        "whatsappCtaText": "WhatsApp Chat",
        "eventsCtaText": "View Events",
        "eventsCtaHref": "/events.html",
        "formSubmitText": "Send Booking Request"
      }
    }$$::jsonb,
    now()
  ),
  (
    '/content/homepage.json',
    $${
      "hero": {
        "headline": "ESSY SINGER",
        "subheadline": "Worship Minister | Music Educator",
        "description": "Creating sacred worship experiences that draw hearts back to Jesus.",
        "humanNote": "Every gathering is prayer-led, Scripture-anchored, and deeply personal.",
        "backgroundType": "image",
        "backgroundImage": "/assets/hero.jpg",
        "backgroundVideo": "",
        "primaryCta": { "text": "Watch Live", "href": "/music.html" },
        "secondaryCta": { "text": "Book Essy", "href": "/contact.html" }
      },
      "sections": [
        { "id": "story", "enabled": true, "order": 0 }
      ],
      "story": {
        "eyebrow": "About Essy",
        "title": "Worship Minister with a Sound for Revival",
        "intro": "Essy Singer serves with a worship expression shaped by prayer, Scripture, and reverence, creating room for people to respond to Jesus with sincerity, freedom, and hope.",
        "blocks": [
          {
            "type": "text",
            "eyebrow": "Ministry",
            "title": "A Worship Journey Rooted in Prayer",
            "body": "Essy serves churches, conferences, and worship nights with a prayer-led and Scripture-centered approach.\n\nEvery gathering is designed to help people encounter Jesus with sincerity and depth.",
            "ctaText": "Contact for Ministry",
            "ctaHref": "/contact.html"
          },
          {
            "type": "image",
            "image": "/assets/event-1.jpg",
            "imageAlt": "Essy Singer event poster",
            "imageCaption": "Moments from worship gatherings and ministry events."
          },
          {
            "type": "split",
            "eyebrow": "Gatherings",
            "title": "Spaces Marked by Reverence and Joy",
            "body": "From worship nights to conferences, each gathering is prepared with prayer, musical excellence, and a heart for authentic ministry.\n\nThe goal is simple: create space where people can encounter God deeply and respond wholeheartedly.",
            "image": "/assets/hero.jpg",
            "imageAlt": "Essy Singer leading worship",
            "imageCaption": "Live worship moment",
            "imagePosition": "right",
            "ctaText": "View Events",
            "ctaHref": "/events.html"
          }
        ]
      }
    }$$::jsonb,
    now()
  ),
  (
    '/content/events.json',
    $${
      "items": [
        {
          "enabled": true,
          "id": "tales-and-tunes-2026",
          "title": "Tales & Tunes Live Recording",
          "yearTheme": "Obey. Go. Be Great.",
          "description": "A worship encounter of storytelling, prophetic songs, and surrendered worship.",
          "date": "2026-03-27",
          "time": "6:00 PM - 8:00 PM",
          "venue": "WEAL HOUSE, Upperhill, Nairobi",
          "ticketing": {
            "capacity": 150,
            "maxPerPurchase": 4
          },
          "bannerImage": "/assets/event-1.jpg",
          "galleryImages": [
            "/assets/event-1.jpg"
          ],
          "galleryVideos": [],
          "featured": true,
          "status": "available",
          "buttons": {
            "buyTicketEnabled": true,
            "addToCalendarEnabled": true,
            "shareEnabled": true
          },
          "ticketTiers": [
            { "name": "General", "priceKsh": 500 }
          ]
        }
      ]
    }$$::jsonb,
    now()
  ),
  (
    '/content/music.json',
    $${
      "items": []
    }$$::jsonb,
    now()
  ),
  (
    '/content/media.json',
    $${
      "sectionTitle": "Media",
      "items": [
        {
          "type": "image",
          "thumbnail": "/assets/hero.jpg",
          "title": "Live Worship Session",
          "link": "/music.html",
          "embed": ""
        },
        {
          "type": "image",
          "thumbnail": "/assets/event-1.jpg",
          "title": "Worship Gathering Moments",
          "link": "/events.html#upcoming",
          "embed": ""
        }
      ]
    }$$::jsonb,
    now()
  ),
  (
    '/content/theme.json',
    $${
      "accent": "#D4AF37",
      "bg": "from-[#3A0D1E] via-[#1a0b11] to-black",
      "heroOverlay": "from-black/70 via-black/55 to-black/75",
      "card": "bg-black/35 border-amber-200/20",
      "button": {
        "primary": "bg-[#D4AF37] hover:bg-[#b69022] text-[#1b1300]",
        "secondary": "bg-black/40 hover:bg-black/60 text-[#f8eecf] border border-amber-200/30"
      }
    }$$::jsonb,
    now()
  )
on conflict (path) do update
set
  payload = excluded.payload,
  updated_at = excluded.updated_at;

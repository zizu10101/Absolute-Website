import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { SEO } from '../context/SettingsContext';

const STORE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "SportingGoodsStore",
  "name": "Absolute Soccer Mississauga",
  "alternateName": "Toronto Soccer Shop",
  "image": "https://torontosoccershop.com/logo.svg",
  "description": "Premier soccer store in Mississauga offering cleats, jerseys, boots and gear. Official licensed soccer apparel for national teams and clubs.",
  "url": "https://torontosoccershop.com",
  "telephone": "+19055933600",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Mississauga",
    "addressRegion": "ON",
    "addressCountry": "CA"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": "43.5890",
    "longitude": "-79.6441"
  },
  "openingHoursSpecification": [
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday"],
      "opens": "10:00",
      "closes": "18:00"
    },
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": "Saturday",
      "opens": "10:00",
      "closes": "17:00"
    }
  ],
  "priceRange": "$$",
  "hasMap": "https://maps.google.com/?q=Absolute+Soccer+Mississauga",
  "sameAs": ["https://www.instagram.com/absolutemississauga"]
};

/**
 * Manages the homepage JSON-LD schema side-effect only.
 * Static meta tags (title, description, og:*, twitter:*) live in index.html as
 * the global default — no Helmet re-injection here to avoid runtime duplicates.
 * Page-specific overrides are done with <Helmet> directly in each page component.
 */
export function useSEO(_seoSettings: SEO) {
  const { pathname } = useLocation();

  useEffect(() => {
    const existing = document.getElementById('schema-markup');
    if (existing) existing.remove();
    if (pathname !== '/') return;

    const script = document.createElement('script');
    script.id = 'schema-markup';
    script.type = 'application/ld+json';
    script.text = JSON.stringify(STORE_SCHEMA);
    document.head.appendChild(script);

    return () => { document.getElementById('schema-markup')?.remove(); };
  }, [pathname]);
}

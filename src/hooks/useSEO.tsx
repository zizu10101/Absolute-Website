import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
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

export function useSEO(seoSettings: SEO) {
  const { pathname } = useLocation();

  // Sync schema-markup script — homepage only; index.html provides the static fallback for crawlers
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

  const title = seoSettings.title || '';
  const description = seoSettings.description || '';
  const ogTitle = seoSettings.ogTitle || title;
  const ogDescription = seoSettings.ogDescription || description;

  return (
    <Helmet>
      {title ? <title>{title}</title> : null}
      {description ? <meta name="description" content={description} /> : null}
      {seoSettings.keywords ? <meta name="keywords" content={seoSettings.keywords} /> : null}
      {seoSettings.canonicalUrl ? <link rel="canonical" href={seoSettings.canonicalUrl} /> : null}
      <meta property="og:type" content="website" />
      {ogTitle ? <meta property="og:title" content={ogTitle} /> : null}
      {ogDescription ? <meta property="og:description" content={ogDescription} /> : null}
      {seoSettings.ogImage ? <meta property="og:image" content={seoSettings.ogImage} /> : null}
      {seoSettings.canonicalUrl ? <meta property="og:url" content={seoSettings.canonicalUrl} /> : null}
      <meta name="twitter:card" content={seoSettings.twitterCard || 'summary_large_image'} />
      {ogTitle ? <meta name="twitter:title" content={ogTitle} /> : null}
      {ogDescription ? <meta name="twitter:description" content={ogDescription} /> : null}
      {seoSettings.ogImage ? <meta name="twitter:image" content={seoSettings.ogImage} /> : null}
    </Helmet>
  );
}

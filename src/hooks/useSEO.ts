import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { SEO } from '../context/SettingsContext';

export function useSEO(seoSettings: SEO) {
  const { pathname } = useLocation();

  useEffect(() => {
    const existing = document.getElementById('schema-markup');
    if (existing) existing.remove();

    if (pathname !== '/') return;

    const schema = {
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
      "sameAs": [
        "https://www.instagram.com/absolutemississauga"
      ]
    };

    const script = document.createElement('script');
    script.id = 'schema-markup';
    script.type = 'application/ld+json';
    script.text = JSON.stringify(schema);
    document.head.appendChild(script);

    return () => {
      document.getElementById('schema-markup')?.remove();
    };
  }, [pathname]);

  useEffect(() => {
    if (!seoSettings) return;

    // Update document title
    if (seoSettings.title) {
      document.title = seoSettings.title;
    }

    // Helper function to get or create meta tag
    const setMetaTag = (name: string, content: string, property?: boolean) => {
      if (!content) return;

      const selector = property ? `meta[property="${name}"]` : `meta[name="${name}"]`;
      let tag = document.querySelector(selector) as HTMLMetaElement;

      if (!tag) {
        tag = document.createElement('meta');
        if (property) {
          tag.setAttribute('property', name);
        } else {
          tag.setAttribute('name', name);
        }
        document.head.appendChild(tag);
      }

      tag.content = content;
    };

    // Update meta description
    setMetaTag('description', seoSettings.description);

    // Update meta keywords
    setMetaTag('keywords', seoSettings.keywords);

    // Update Open Graph tags
    setMetaTag('og:title', seoSettings.ogTitle || seoSettings.title, true);
    setMetaTag('og:description', seoSettings.ogDescription || seoSettings.description, true);
    setMetaTag('og:image', seoSettings.ogImage, true);
    setMetaTag('og:url', seoSettings.canonicalUrl, true);
    setMetaTag('og:type', 'website', true);

    // Update Twitter Card tags
    setMetaTag('twitter:card', seoSettings.twitterCard || 'summary_large_image');
    setMetaTag('twitter:title', seoSettings.ogTitle || seoSettings.title);
    setMetaTag('twitter:description', seoSettings.ogDescription || seoSettings.description);
    setMetaTag('twitter:image', seoSettings.ogImage);

    // Update canonical URL
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    if (seoSettings.canonicalUrl) {
      canonical.href = seoSettings.canonicalUrl;
    }
  }, [seoSettings]);
}

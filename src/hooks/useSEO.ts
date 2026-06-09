import { useEffect } from 'react';
import { SEO } from '../context/SettingsContext';

/**
 * Hook to dynamically inject SEO meta tags into the document head
 * Updates all meta tags based on SEO settings from Supabase
 */
export function useSEO(seoSettings: SEO) {
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

      title: seoSettings.title,
      description: seoSettings.description,
      keywords: seoSettings.keywords,
      canonicalUrl: seoSettings.canonicalUrl
    });
  }, [seoSettings]);
}

import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useSettings } from '../context/SettingsContext';

export const Meta: React.FC = () => {
  const { seoSettings } = useSettings();

  return (
    <Helmet>
      {/* General Meta Tags */}
      <title>{seoSettings.title}</title>
      <meta name="description" content={seoSettings.description} />
      <meta name="keywords" content={seoSettings.keywords} />
      {seoSettings.canonicalUrl && <link rel="canonical" href={seoSettings.canonicalUrl} />}

      {/* Open Graph / Facebook */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content={seoSettings.canonicalUrl || window.location.href} />
      <meta property="og:title" content={seoSettings.ogTitle || seoSettings.title} />
      <meta property="og:description" content={seoSettings.ogDescription || seoSettings.description} />
      <meta property="og:image" content={seoSettings.ogImage} />

      {/* Twitter */}
      <meta name="twitter:card" content={seoSettings.twitterCard} />
      <meta name="twitter:url" content={seoSettings.canonicalUrl || window.location.href} />
      <meta name="twitter:title" content={seoSettings.ogTitle || seoSettings.title} />
      <meta name="twitter:description" content={seoSettings.ogDescription || seoSettings.description} />
      <meta name="twitter:image" content={seoSettings.ogImage} />
    </Helmet>
  );
};

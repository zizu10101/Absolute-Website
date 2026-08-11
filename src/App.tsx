/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, useParams, Navigate } from 'react-router-dom';
import { Fragment, useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Meta } from './components/Meta';
import { ScrollToTop } from './components/ScrollToTop';
import { HomePage } from './pages/HomePage';
import { AdminLogin } from './pages/AdminLogin';
import { POSPage } from './pages/POSPage';
import { ReportsPageFull } from './pages/ReportsPageFull';
import { ProductProvider, useProducts } from './context/ProductContext';
import { CustomerProvider } from './context/CustomerContext';
import { SettingsProvider, useSettings } from './context/SettingsContext';
import { AuthProvider } from './context/AuthContext';
import { ProductGridPage } from './pages/ProductGridPage';
import { UniformSubmissionPage } from './pages/UniformSubmissionPage';
import { CustomizationPage } from './pages/CustomizationPage';
import { CustomLabPage } from './pages/CustomLabPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { ContactUsPage } from './pages/ContactUsPage';
import { CustomApparelPage } from './pages/CustomApparelPage';
import { BramptonSoccerPage } from './pages/BramptonSoccerPage';
import { MississaugaSoccerPage } from './pages/MississaugaSoccerPage';
import { BrandPage } from './pages/BrandPage';
import { BrandsPage } from './pages/BrandsPage';
import { BlogListPage } from './pages/BlogListPage';
import { BlogPostPage } from './pages/BlogPostPage';
import { useSEO } from './hooks/useSEO';

// Paths that exist as DB-driven navigation_menus rows but must render their own dedicated
// page component below, not the generic ProductGridPage category route.
const RESERVED_PAGE_PATHS = ['custom-lab', 'kit-orders'];

function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-white flex items-center justify-center z-50">
      <img src="/logo.svg" alt="Loading" className="w-24 h-24 animate-spin" />
    </div>
  );
}

function AppContent() {
  const { isLoading: productsLoading } = useProducts();
  const { isLoading: settingsLoading } = useSettings();
  const [isLoading, setIsLoading] = useState(true);

  // Safety fallback: Never let the loading screen stay visible for more than 2.5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2500);

    if (!productsLoading && !settingsLoading) {
      setIsLoading(false);
    }

    return () => clearTimeout(timer);
  }, [productsLoading, settingsLoading]);

  // Bypass safety check: If the user is trying to go to the admin panel or /pos, don't show the loading gate at all
  if (window.location.pathname.startsWith('/admin') || window.location.pathname.startsWith('/pos') || window.location.hash.includes('/admin')) {
    return <AppRoutes />;
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center z-50">
        <div className="text-xl font-bold">Absolute Soccer Loading...</div>
      </div>
    );
  }

  return <AppRoutes />;
}

function AdminAccessDenied() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Access Denied</h1>
        <p className="text-gray-600 mb-8">Admin access is only available at torontosoccershop.com</p>
        <a href="/" className="text-blue-600 hover:text-blue-800 font-medium">Return to Home</a>
      </div>
    </div>
  );
}

function CategorySlugRoute() {
  const { slug } = useParams<{ slug: string }>();
  const { navigationMenus } = useSettings();
  const menu = navigationMenus.find(m => m.path.replace(/^\//, '') === slug);
  if (!menu) return <Navigate to="/" replace />;
  return <ProductGridPage title={menu.label} category={menu.label} />;
}

function AppRoutes() {
  const { navigationMenus, seoSettings, storeInfo } = useSettings();
  useSEO(seoSettings, storeInfo);

  // Check if current domain is torontosoccershop.com (with or without www) or localhost for dev
  const hostname = window.location.hostname.replace(/^www\./, '');
  const isAdminDomain = hostname === 'torontosoccershop.com' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  return (
    <>
      <Meta />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />

          {/* Dynamic Routes from Navigation Menus */}
          {/* RESERVED_PAGE_PATHS are DB-driven nav menu entries that share a path with a dedicated
              page route declared below (not a product category). Without this exclusion they'd
              register an earlier ProductGridPage route at the same path, which wins the React
              Router tie-break over the real page route and renders "No products found" instead
              (confirmed for both custom-lab -> CustomLabPage and kit-orders -> UniformSubmissionPage). */}
          {navigationMenus
            .filter(menu => !RESERVED_PAGE_PATHS.includes(menu.path.startsWith('/') ? menu.path.slice(1) : menu.path))
            .map(menu => (
              <Fragment key={menu.path}>
                <Route
                  path={menu.path.startsWith('/') ? menu.path.slice(1) : menu.path}
                  element={<ProductGridPage title={menu.label} category={menu.label} />}
                />
              </Fragment>
            ))}
          {navigationMenus.flatMap(menu =>
            (menu.submenus || []).filter(s => s && typeof s === 'object' && s.heading).map(submenu => (
              <Fragment key={submenu.heading + (submenu.path || '')}>
                {submenu.path && (
                  <Route
                    path={submenu.path.startsWith('/') ? submenu.path.slice(1) : submenu.path}
                    element={<ProductGridPage title={submenu.heading} category={menu.label} submenu={submenu.heading} />}
                  />
                )}
              </Fragment>
            ))
          )}
          {navigationMenus.flatMap(menu =>
            (menu.submenus || []).filter(s => s && typeof s === 'object' && Array.isArray(s.items)).flatMap(submenu =>
              submenu.items.filter(item => item && typeof item === 'object' && item.path).map(item => (
                <Fragment key={item.path}>
                  <Route
                    path={item.path.startsWith('/') ? item.path.slice(1) : item.path}
                    element={<ProductGridPage title={item.label} category={menu.label} submenu={item.label} />}
                  />
                </Fragment>
              ))
            )
          )}

          {/* Footwear — submenu heading landing pages */}
          <Route path="footwear/brands"      element={<ProductGridPage title="SHOP BY BRAND"      category="FOOTWEAR" submenu="SHOP BY BRAND" />} />
          <Route path="footwear/surface"     element={<ProductGridPage title="SHOP BY SURFACE"    category="FOOTWEAR" submenu="SHOP BY SURFACE" />} />
          <Route path="footwear/collections" element={<ProductGridPage title="SHOP BY COLLECTION" category="FOOTWEAR" submenu="SHOP BY COLLECTION" />} />

          {/* National Teams — region landing pages */}
          <Route path="national-teams/europe" element={<ProductGridPage title="EUROPE" category="NATIONAL TEAMS" submenu="EUROPE" />} />
          <Route path="national-teams/africa" element={<ProductGridPage title="AFRICA" category="NATIONAL TEAMS" submenu="AFRICA" />} />
          <Route path="national-teams/south-america" element={<ProductGridPage title="SOUTH AMERICA" category="NATIONAL TEAMS" submenu="SOUTH AMERICA" />} />
          <Route path="national-teams/north-america" element={<ProductGridPage title="NORTH AMERICA" category="NATIONAL TEAMS" submenu="NORTH AMERICA" />} />
          <Route path="national-teams/others" element={<ProductGridPage title="OTHERS" category="NATIONAL TEAMS" submenu="OTHERS" />} />

          {/* Clubs — league landing pages (submenu heading names match DB: LIGA, LIGUE 1, etc.) */}
          <Route path="clubs/la-liga" element={<ProductGridPage title="LA LIGA" category="CLUBS" submenu="LIGA" />} />
          <Route path="clubs/premier-league" element={<ProductGridPage title="PREMIER LEAGUE" category="CLUBS" submenu="PREMIER LEAGUE" />} />
          <Route path="clubs/ligue-1" element={<ProductGridPage title="LIGUE 1" category="CLUBS" submenu="LIGUE 1" />} />
          <Route path="clubs/serie-a" element={<ProductGridPage title="SERIE A" category="CLUBS" submenu="SERIE A" />} />
          <Route path="clubs/bundesliga" element={<ProductGridPage title="BUNDESLIGA" category="CLUBS" submenu="BUNDESLIGA" />} />
          <Route path="clubs/mls" element={<ProductGridPage title="MLS" category="CLUBS" submenu="MLS" />} />
          <Route path="clubs/liga-portugal" element={<ProductGridPage title="LIGA PORTUGAL" category="CLUBS" submenu="liga portugal" />} />

          {/* Category alias — handles /category/:slug URLs e.g. /category/national-teams?region=europe */}
          <Route path="category/:slug" element={<CategorySlugRoute />} />

          {/* Static Routes */}
          <Route path="best-sellers" element={<ProductGridPage title="Best Sellers" />} />
          <Route path="new-arrivals" element={<ProductGridPage title="New Arrivals" />} />
          <Route path="sale" element={<ProductGridPage title="Sale" />} />
          <Route path="search" element={<ProductGridPage title="Search Results" />} />
          <Route path="brands" element={<BrandsPage />} />
          <Route path="brand/:brandName" element={<BrandPage />} />
          <Route path="customization" element={<CustomizationPage />} />
          <Route path="custom-lab" element={<CustomLabPage />} />
          <Route path="kit-orders" element={<UniformSubmissionPage />} />
          <Route path="uniform-submission" element={<UniformSubmissionPage />} />
          <Route path="contact-us" element={<ContactUsPage />} />
          <Route path="custom-apparel" element={<CustomApparelPage />} />
          <Route path="brampton-soccer-uniforms" element={<BramptonSoccerPage />} />
          <Route path="mississauga-soccer-store" element={<MississaugaSoccerPage />} />
          <Route path="blog" element={<BlogListPage />} />
          <Route path="blog/:slug" element={<BlogPostPage />} />
          <Route path="product/:slug" element={<ProductDetailPage />} />
          <Route path="products" element={<Navigate to="/category/footwear" replace />} />
        </Route>

        {/* Admin, POS, Reports - Only on torontosoccershop.com */}
        <Route path="/admin" element={isAdminDomain ? <AdminLogin /> : <AdminAccessDenied />} />
        <Route path="/pos" element={isAdminDomain ? <POSPage /> : <AdminAccessDenied />} />
        <Route path="/reports" element={isAdminDomain ? <ReportsPageFull /> : <AdminAccessDenied />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ProductProvider>
        <CustomerProvider>
          <BrowserRouter>
            <SettingsProvider>
              <ScrollToTop />
              <AppContent />
            </SettingsProvider>
          </BrowserRouter>
        </CustomerProvider>
      </ProductProvider>
    </AuthProvider>
  );
}

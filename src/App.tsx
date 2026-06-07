/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
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
import { useSEO } from './hooks/useSEO';

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

function AppRoutes() {
  const { navigationMenus, seoSettings } = useSettings();
  useSEO(seoSettings);

  // Check if current domain is torontosoccershop.com or localhost for dev
  const isAdminDomain = window.location.hostname === 'torontosoccershop.com' || window.location.hostname === 'www.torontosoccershop.com' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  return (
    <>
      <Meta />
      <Routes>
        <Route path="/custom-lab" element={<CustomLabPage />} />

        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />

          {/* Dynamic Routes from Navigation Menus */}
          {navigationMenus.map(menu => (
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

          {/* Static Routes */}
          <Route path="best-sellers" element={<ProductGridPage title="Best Sellers" />} />
          <Route path="new-arrivals" element={<ProductGridPage title="New Arrivals" />} />
          <Route path="sale" element={<ProductGridPage title="Sale" />} />
          <Route path="search" element={<ProductGridPage title="Search Results" />} />
          <Route path="customization" element={<CustomizationPage />} />
          <Route path="uniform-submission" element={<UniformSubmissionPage />} />
          <Route path="contact-us" element={<ContactUsPage />} />
          <Route path="product/:id" element={<ProductDetailPage />} />
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

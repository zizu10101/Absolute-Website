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
import { ProductProvider, useProducts } from './context/ProductContext';
import { SettingsProvider, useSettings } from './context/SettingsContext';
import { AuthProvider } from './context/AuthContext';
import { ProductGridPage } from './pages/ProductGridPage';
import { UniformSubmissionPage } from './pages/UniformSubmissionPage';
import { CustomizationPage } from './pages/CustomizationPage';
import { CustomLabPage } from './pages/CustomLabPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { ContactUsPage } from './pages/ContactUsPage';

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

  useEffect(() => {
    if (!productsLoading && !settingsLoading) {
      setIsLoading(false);
    }
  }, [productsLoading, settingsLoading]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center z-50">
        <div className="text-xl font-bold">Absolute Soccer Loading...</div>
      </div>
    );
  }

  return <AppRoutes />;
}

function AppRoutes() {
  const { navigationMenus } = useSettings();

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
            menu.submenus.map(submenu => (
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
            menu.submenus.flatMap(submenu => 
              submenu.items.map(item => (
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
        <Route path="/admin" element={<AdminLogin />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ProductProvider>
        <SettingsProvider>
          <BrowserRouter>
            <ScrollToTop />
            <AppContent />
          </BrowserRouter>
        </SettingsProvider>
      </ProductProvider>
    </AuthProvider>
  );
}

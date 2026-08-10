import { Link } from 'react-router-dom';
import { Facebook, Instagram, Twitter, Youtube } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';

export function Footer() {
  const { footerLogo, footerLinks, storeInfo } = useSettings();

  const adminPaths = ['/admin', '/pos', '/reports'];
  const visibleLinks = footerLinks.filter(l => !adminPaths.includes(l.path));

  const shopLabels = ['FOOTWEAR', 'APPAREL', 'EQUIPMENT', 'TEAMS'];
  const shopLinks = visibleLinks.filter(l => shopLabels.includes(l.label.toUpperCase()));

  const resourceLabels = ['CUSTOM LAB', 'KIT ORDERS', 'CLUB REGISTRY'];
  const supportLinks = visibleLinks.filter(l =>
    !shopLabels.includes(l.label.toUpperCase()) &&
    !resourceLabels.includes(l.label.toUpperCase())
  );

  return (
    <footer className="text-white pt-20 pb-10 font-sans" style={{ backgroundColor: 'var(--secondary-color)' }}>
      <div className="max-w-7xl mx-auto px-8 mb-16 flex flex-col md:flex-row md:justify-between gap-10 items-start">

        {/* Column 1 — Logo & Info */}
        <div className="w-full md:w-56 flex-shrink-0 space-y-6">
          <img src={footerLogo} alt="ABSOLUTE SOCCER" className="h-24 w-auto" />
          <p className="text-zinc-400 text-sm leading-relaxed">
            The ultimate destination for elite performance gear. Engineered for the modern athlete who demands nothing but the best.
          </p>
          <div className="flex gap-4">
            <Facebook size={20} className="text-zinc-400 hover:text-[var(--primary-color)] cursor-pointer transition-colors" />
            <Instagram size={20} className="text-zinc-400 hover:text-[var(--primary-color)] cursor-pointer transition-colors" />
            <Twitter size={20} className="text-zinc-400 hover:text-[var(--primary-color)] cursor-pointer transition-colors" />
            <Youtube size={20} className="text-zinc-400 hover:text-[var(--primary-color)] cursor-pointer transition-colors" />
          </div>
          <address className="text-zinc-400 text-sm leading-relaxed not-italic">
            <p className="font-bold text-white">{storeInfo.name} Mississauga</p>
            <p>{storeInfo.address}</p>
            <a href={`tel:${storeInfo.phone?.replace(/\D/g, '')}`} className="hover:text-white transition-colors">
              Tel: {storeInfo.phone}
            </a>
          </address>
        </div>

        {/* Column 2 — Shop */}
        <div className="flex-1">
          <h3 className="font-bold uppercase tracking-widest text-sm mb-6">Shop</h3>
          <ul className="space-y-4 text-zinc-400 text-sm font-medium">
            {shopLinks.map((link, idx) => (
              <li key={`${link.path}-${idx}`}>
                <Link to={link.path} className="hover:text-white transition-colors">{link.label}</Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Column 3 — Resources */}
        <div className="flex-1">
          <h3 className="font-bold uppercase tracking-widest text-sm mb-6">Resources</h3>
          <ul className="space-y-4 text-zinc-400 text-sm font-medium">
            <li><Link to="/blog" className="hover:text-white transition-colors">Gear Guides</Link></li>
            <li><Link to="/custom-apparel" className="hover:text-white transition-colors">Custom Apparel</Link></li>
            <li><Link to="/kit-orders" className="hover:text-white transition-colors">Kit Orders</Link></li>
            <li><Link to="/custom-lab" className="hover:text-white transition-colors">Custom Lab</Link></li>
          </ul>
        </div>

        {/* Column 4 — Support */}
        <div className="flex-1">
          <h3 className="font-bold uppercase tracking-widest text-sm mb-6">Support</h3>
          <ul className="space-y-4 text-zinc-400 text-sm font-medium">
            {supportLinks.map((link, idx) => (
              <li key={`${link.path}-${idx}`}>
                {link.path.startsWith('/') ? (
                  <Link to={link.path} className="hover:text-white transition-colors">{link.label}</Link>
                ) : (
                  <a href={link.path} className="hover:text-white transition-colors">{link.label}</a>
                )}
              </li>
            ))}
          </ul>
        </div>

      </div>

      <div className="max-w-7xl mx-auto px-8 pt-8 border-t border-zinc-800 mb-6">
        <p className="text-zinc-400 text-xs leading-relaxed text-center">
          Serving soccer players across Mississauga, Brampton, Oakville and the GTA. Located conveniently near major transit and Highway 403. Find Nike, Adidas, PUMA soccer cleats, jerseys and gear in store and online.
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-8 pt-3 text-center">
        <p className="text-zinc-400 text-[10px]">Absolute Soccer Mississauga (formerly Golazo Store)</p>
        <p className="text-zinc-400 text-xs leading-relaxed max-w-2xl mx-auto mt-3">
          Absolute Soccer is the premier destination for elite performance footwear, official jerseys, and professional team uniform engineering across the Greater Toronto Area. Whether you are training with a club in Brampton, looking for premium firm-ground boots in Oakville, ordering custom-printed squad kits in Milton, or hitting an indoor turf league in Etobicoke, we provide rapid local shipping and expert team gear sizing directly to your doorstep. Visit our flagship showroom in Mississauga.
        </p>
      </div>

      <div className="border-t border-zinc-800 mt-8 pt-6 text-center text-xs text-zinc-400">
        &copy; 2026 Absolute Soccer Mississauga. All rights reserved.
      </div>
    </footer>
  );
}

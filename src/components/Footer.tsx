import { Link } from 'react-router-dom';
import { Facebook, Instagram, Twitter, Youtube } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';

export function Footer() {
  const { footerLogo, footerLinks, storeInfo } = useSettings();

  // Group links into categories for the footer columns
  const shopLabels = ['FOOTWEAR', 'APPAREL', 'EQUIPMENT', 'TEAMS'];
  const customLabels = ['CUSTOM LAB', 'KIT ORDERS', 'CLUB REGISTRY'];
  const adminPaths = ['/admin', '/pos', '/reports'];

  // Filter out admin routes
  const visibleLinks = footerLinks.filter(l => !adminPaths.includes(l.path));

  const shopLinks = visibleLinks.filter(l => shopLabels.includes(l.label.toUpperCase()));
  const customLinks = visibleLinks.filter(l => customLabels.includes(l.label.toUpperCase()));
  const supportLinks = visibleLinks.filter(l =>
    !shopLabels.includes(l.label.toUpperCase()) &&
    !customLabels.includes(l.label.toUpperCase())
  );

  return (
    <footer className="text-white pt-20 pb-10" style={{ backgroundColor: 'var(--secondary-color)' }}>
      <div className="max-w-7xl mx-auto px-8 grid grid-cols-1 md:grid-cols-5 gap-12 mb-16">
        <div className="space-y-6">
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
            <p>Tel: {storeInfo.phone}</p>
          </address>
        </div>
        
        <div>
          <h3 className="font-headline font-bold uppercase tracking-widest text-sm mb-6">Shop</h3>
          <ul className="space-y-4 text-zinc-400 text-sm font-medium">
            {shopLinks.map((link, idx) => (
              <li key={`${link.path}-${idx}`}><Link to={link.path} className="hover:text-white transition-colors">{link.label}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="font-headline font-bold uppercase tracking-widest text-sm mb-6">Custom Lab</h3>
          <ul className="space-y-4 text-zinc-400 text-sm font-medium">
            {customLinks.map((link, idx) => (
              <li key={`${link.path}-${idx}`}><Link to={link.path} className="hover:text-white transition-colors">{link.label}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="font-headline font-bold uppercase tracking-widest text-sm mb-6">Gear Guides</h3>
          <ul className="space-y-4 text-zinc-400 text-sm font-medium">
            <li><Link to="/blog" className="hover:text-white transition-colors">Blog</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="font-headline font-bold uppercase tracking-widest text-sm mb-6">Support</h3>
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
        <p className="text-zinc-500 text-xs leading-relaxed text-center">
          Serving soccer players across Mississauga, Brampton, Oakville and the GTA. Located conveniently near major transit and Highway 403. Find Nike, Adidas, PUMA soccer cleats, jerseys and gear in store and online.
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-8 pt-8 border-t border-zinc-900 flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-[0.3em]">
          Â© 2024 ABSOLUTE SOCCER. ALL RIGHTS RESERVED.
        </p>
      </div>
      <div className="max-w-7xl mx-auto px-8 pt-3 text-center">
        <p className="text-zinc-700 text-[10px]">Absolute Soccer Mississauga (formerly Golazo Store)</p>
        <p className="text-zinc-500 text-xs leading-relaxed max-w-2xl mx-auto text-center mt-3">
          Absolute Soccer is the premier destination for elite performance footwear, official jerseys, and professional team uniform engineering across the Greater Toronto Area. Whether you are training with a club in Brampton, looking for premium firm-ground boots in Oakville, ordering custom-printed squad kits in Milton, or hitting an indoor turf league in Etobicoke, we provide rapid local shipping and expert team gear sizing directly to your doorstep. Visit our flagship showroom in Mississauga.
        </p>
      </div>
    </footer>
  );
}

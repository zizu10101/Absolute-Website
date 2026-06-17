import { Link } from 'react-router-dom';
import { Facebook, Instagram, Twitter, Youtube } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';

export function Footer() {
  const { footerLogo, footerLinks } = useSettings();

  // Group links into categories for the footer columns
  const shopLabels = ['FOOTWEAR', 'APPAREL', 'EQUIPMENT', 'TEAMS'];
  const customLabels = ['CUSTOM LAB', 'UNIFORM SUBMISSION', 'CLUB REGISTRY'];
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
    <footer className="bg-zinc-950 text-white pt-20 pb-10">
      <div className="max-w-7xl mx-auto px-8 grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
        <div className="space-y-6">
          <img src={footerLogo} alt="ABSOLUTE SOCCER" className="h-24 w-auto" />
          <p className="text-zinc-400 text-sm leading-relaxed">
            The ultimate destination for elite performance gear. Engineered for the modern athlete who demands nothing but the best.
          </p>
          <div className="flex gap-4">
            <Facebook size={20} className="text-zinc-400 hover:text-[#b90014] cursor-pointer transition-colors" />
            <Instagram size={20} className="text-zinc-400 hover:text-[#b90014] cursor-pointer transition-colors" />
            <Twitter size={20} className="text-zinc-400 hover:text-[#b90014] cursor-pointer transition-colors" />
            <Youtube size={20} className="text-zinc-400 hover:text-[#b90014] cursor-pointer transition-colors" />
          </div>
        </div>
        
        <div>
          <h4 className="font-headline font-bold uppercase tracking-widest text-sm mb-6">Shop</h4>
          <ul className="space-y-4 text-zinc-400 text-sm font-medium">
            {shopLinks.map((link, idx) => (
              <li key={`${link.path}-${idx}`}><Link to={link.path} className="hover:text-white transition-colors">{link.label}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="font-headline font-bold uppercase tracking-widest text-sm mb-6">Custom Lab</h4>
          <ul className="space-y-4 text-zinc-400 text-sm font-medium">
            {customLinks.map((link, idx) => (
              <li key={`${link.path}-${idx}`}><Link to={link.path} className="hover:text-white transition-colors">{link.label}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="font-headline font-bold uppercase tracking-widest text-sm mb-6">Support</h4>
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
      
      <div className="max-w-7xl mx-auto px-8 pt-8 border-t border-zinc-900 flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-[0.3em]">
          © 2024 ABSOLUTE SOCCER. ALL RIGHTS RESERVED.
        </p>
      </div>
      <div className="max-w-7xl mx-auto px-8 pt-3 text-center">
        <p className="text-zinc-700 text-[10px]">Absolute Soccer Mississauga (formerly Golazo Store)</p>
      </div>
    </footer>
  );
}

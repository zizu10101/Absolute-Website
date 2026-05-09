import { MapPin, Phone, Mail, Instagram } from 'lucide-react';

export function ContactUsPage() {
  return (
    <div className="max-w-7xl mx-auto px-8 py-20">
      <h1 className="text-5xl md:text-7xl font-headline font-black uppercase italic tracking-tighter leading-none mb-16">Contact Us</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
        <div className="space-y-8">
          <div className="bg-zinc-50 p-8 rounded-2xl border border-zinc-100">
            <h2 className="text-2xl font-bold mb-6">Visit Our Store</h2>
            <div className="flex items-start gap-4 mb-4">
              <MapPin className="text-[#b90014] mt-1" />
              <p className="text-zinc-600">5600 Rose Cherry Place,<br />Mississauga, Ontario</p>
            </div>
            <div className="flex items-center gap-4 mb-4">
              <Phone className="text-[#b90014]" />
              <p className="text-zinc-600">905-593-3600</p>
            </div>
            <a 
              href="https://www.instagram.com/absolutemississauga?igsh=MXNrOW15Mmhna2Q5ZA==" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-4 text-zinc-600 hover:text-[#b90014] transition-colors"
            >
              <Instagram className="text-[#b90014]" />
              <span>Follow us on Instagram</span>
            </a>
          </div>
        </div>

        <div className="h-[400px] w-full rounded-2xl overflow-hidden border border-zinc-200">
          <iframe 
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2888.665324329243!2d-79.67389232352885!3d43.62649067102604!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x882b3f9479b4a45f%3A0x6e7e4e1e4e1e4e1e!2s5600%20Rose%20Cherry%20Pl%2C%20Mississauga%2C%20ON%20L4Z%204B6!5e0!3m2!1sen!2sca!4v1712456789012!5m2!1sen!2sca" 
            width="100%" 
            height="100%" 
            style={{ border: 0 }} 
            allowFullScreen 
            loading="lazy" 
            referrerPolicy="no-referrer-when-downgrade"
            title="Store Location"
          ></iframe>
        </div>
      </div>
    </div>
  );
}

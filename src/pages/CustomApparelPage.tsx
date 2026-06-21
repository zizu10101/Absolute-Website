import React, { useState } from 'react';
import {
  UtensilsCrossed,
  Building2,
  HardHat,
  GraduationCap,
  Trophy,
  PartyPopper,
  Shirt,
  Star,
  Wind,
  Layers,
  Wrench,
  Crown,
  Phone,
  MapPin,
  Globe,
  CheckCircle,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  PenTool,
  Truck,
} from 'lucide-react';

const WHO_WE_SERVE = [
  { icon: UtensilsCrossed, label: 'Restaurants & Hospitality', desc: 'Staff uniforms, aprons, branded polos for front-of-house and kitchen teams.' },
  { icon: Building2, label: 'Corporate & Office', desc: 'Branded shirts, hoodies, and jackets that represent your company culture.' },
  { icon: HardHat, label: 'Construction & Trades', desc: 'Durable workwear with your logo — hi-vis vests, safety shirts, and more.' },
  { icon: GraduationCap, label: 'Schools & Universities', desc: 'Spirit wear, staff uniforms, and team gear for schools across the GTA.' },
  { icon: Trophy, label: 'Sports Teams & Clubs', desc: 'Custom jerseys, training kits, and fan gear for any sport or level.' },
  { icon: PartyPopper, label: 'Events & Promotions', desc: 'Branded giveaways, volunteer shirts, and event staff apparel.' },
];

const WHAT_WE_OFFER = [
  { icon: Shirt, label: 'T-Shirts', desc: 'Classic and performance tees in any colour, any logo.' },
  { icon: Star, label: 'Polo Shirts', desc: 'Professional polos perfect for staff and corporate wear.' },
  { icon: Wind, label: 'Hoodies & Sweatshirts', desc: 'Comfortable fleece with screen print or embroidery.' },
  { icon: Layers, label: 'Jackets & Vests', desc: 'Softshells, windbreakers, and puffer vests with your branding.' },
  { icon: Wrench, label: 'Workwear', desc: 'Durable, functional clothing built for demanding environments.' },
  { icon: Crown, label: 'Hats & Caps', desc: 'Embroidered snapbacks, dad hats, and beanies.' },
];

const STEPS = [
  {
    icon: ClipboardList,
    step: '01',
    title: 'Contact Us',
    description: 'Tell us what you need — garment type, quantity, colors and your logo or design ideas.',
  },
  {
    icon: PenTool,
    step: '02',
    title: 'We Create Your Proof',
    description: 'Our team designs a digital proof so you can review and approve every detail before we print.',
  },
  {
    icon: Truck,
    step: '03',
    title: 'Production & Delivery',
    description: 'We produce your order with premium materials and deliver it on time, right across the GTA.',
  },
];

const HIGHLIGHTS = [
  'Premium printing & embroidery',
  'Fast local turnaround',
  'No order too large',
];

const WHY_US = [
  'Local Mississauga business — we know the GTA',
  'Fast turnaround times',
  'Premium quality printing and embroidery',
  'Competitive, transparent pricing',
  'No minimum orders on select items',
  'Serving businesses across the GTA for years',
];

const APPAREL_TYPES = [
  'T-Shirts',
  'Polo Shirts',
  'Hoodies & Sweatshirts',
  'Jackets & Vests',
  'Workwear',
  'Hats & Caps',
  'Jerseys / Sports Kits',
  'Other',
];

export function CustomApparelPage() {
  const [form, setForm] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    apparelType: '',
    quantity: '',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent(`Custom Apparel Quote Request — ${form.company || form.name}`);
    const body = encodeURIComponent(
      `Name: ${form.name}\nCompany: ${form.company}\nEmail: ${form.email}\nPhone: ${form.phone}\nApparel Type: ${form.apparelType}\nQuantity: ${form.quantity}\n\nMessage:\n${form.message}`
    );
    window.location.href = `mailto:info@edgedbs.com?subject=${subject}&body=${body}`;
    setSubmitted(true);
  };

  return (
    <div className="bg-white text-zinc-900">
      {/* ── HERO ── */}
      <section id="top" className="relative overflow-hidden bg-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:px-6 md:py-24">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600">
              <MapPin className="size-3.5 text-[#b90014]" />
              Serving Mississauga & the GTA
            </div>
            <h1 className="mt-5 text-balance text-4xl font-bold leading-tight tracking-tight text-zinc-900 md:text-5xl lg:text-6xl">
              Custom Apparel for{' '}
              <span className="text-[#b90014]">Your Business</span>
            </h1>
            <p className="mt-5 max-w-md text-pretty text-lg leading-relaxed text-zinc-500">
              Professional uniforms and branded clothing for businesses, events,
              schools and organizations in Mississauga and the GTA.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <a
                href="#quote"
                className="inline-flex items-center justify-center px-6 py-3 text-base font-medium text-white bg-[#b90014] rounded-md hover:bg-red-800 transition-colors"
              >
                Get a Free Quote
              </a>
              <a
                href="tel:9055933600"
                className="inline-flex items-center justify-center px-6 py-3 text-base font-medium text-zinc-900 border border-zinc-300 rounded-md hover:bg-zinc-50 transition-colors"
              >
                Call 905-593-3600
              </a>
            </div>

            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
              {HIGHLIGHTS.map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm font-medium text-zinc-900">
                  <CheckCircle2 className="size-4 text-[#b90014]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative">
            <div className="overflow-hidden rounded-2xl border border-zinc-200 shadow-xl">
              <img
                src="/custom-apparel-banner.jpg"
                alt="Custom business apparel and uniforms in Mississauga"
                className="aspect-[4/3] w-full object-cover"
              />
            </div>
            <div className="absolute -bottom-5 -left-5 hidden rounded-xl border border-zinc-200 bg-white px-5 py-4 shadow-lg sm:block">
              <p className="text-3xl font-bold text-[#b90014]">10+</p>
              <p className="text-xs font-medium text-zinc-500">Years serving the GTA</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── WHO WE SERVE ── */}
      <section className="py-20 md:py-28 bg-zinc-50">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="mb-14">
            <p className="text-[#b90014] text-xs font-black uppercase tracking-widest mb-3">Who We Serve</p>
            <h2 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter leading-none">
              We Outfit Every<br />
              <span className="text-[#b90014]">Kind of Business</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {WHO_WE_SERVE.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="bg-white rounded-2xl p-8 border border-zinc-100 hover:border-[#b90014]/30 hover:shadow-md transition-all group">
                <div className="w-12 h-12 rounded-xl bg-[#b90014]/10 flex items-center justify-center mb-5 group-hover:bg-[#b90014]/20 transition-colors">
                  <Icon size={24} className="text-[#b90014]" />
                </div>
                <h3 className="text-lg font-black uppercase tracking-tight mb-2">{label}</h3>
                <p className="text-zinc-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHAT WE OFFER ── */}
      <section className="py-20 md:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="mb-14">
            <p className="text-[#b90014] text-xs font-black uppercase tracking-widest mb-3">What We Offer</p>
            <h2 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter leading-none">
              Apparel for<br />
              <span className="text-[#b90014]">Every Need</span>
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
            {WHAT_WE_OFFER.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="relative rounded-2xl p-6 md:p-8 border border-zinc-100 bg-zinc-50 hover:bg-white hover:shadow-md hover:border-[#b90014]/20 transition-all group overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-[#b90014]/5 rounded-full -translate-y-8 translate-x-8 group-hover:bg-[#b90014]/10 transition-colors" />
                <Icon size={28} className="text-[#b90014] mb-4 relative z-10" />
                <h3 className="font-black uppercase tracking-tight mb-1 relative z-10">{label}</h3>
                <p className="text-zinc-500 text-sm leading-relaxed relative z-10">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="bg-zinc-900 py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#b90014]">
              How It Works
            </p>
            <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-white md:text-4xl">
              Three simple steps to your order
            </h2>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.step} className="relative rounded-xl border border-white/10 bg-white/5 p-7">
                <span className="text-5xl font-bold text-[#b90014]">
                  {step.step}
                </span>
                <div className="mt-4 flex size-11 items-center justify-center rounded-lg bg-[#b90014] text-white">
                  <step.icon className="size-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-white">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/70">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHY CHOOSE US ── */}
      <section className="py-20 md:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-[#b90014] text-xs font-black uppercase tracking-widest mb-3">Why Choose Us</p>
              <h2 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter leading-none mb-8">
                Your Local GTA<br />
                <span className="text-[#b90014]">Custom Apparel Partner</span>
              </h2>
              <p className="text-zinc-500 text-lg leading-relaxed">
                Absolute Soccer is a Mississauga-based retail store that has expanded into full custom apparel services for local businesses and organizations. We bring the same quality and care to your branded clothing that we bring to our sports products.
              </p>
            </div>
            <div className="space-y-4">
              {WHY_US.map(point => (
                <div key={point} className="flex items-start gap-4 p-5 bg-zinc-50 rounded-xl border border-zinc-100">
                  <CheckCircle size={20} className="text-[#b90014] shrink-0 mt-0.5" />
                  <span className="font-semibold text-zinc-800">{point}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── QUOTE FORM ── */}
      <section id="quote" className="py-20 md:py-28 bg-zinc-50">
        <div className="max-w-3xl mx-auto px-6 md:px-12">
          <div className="mb-12 text-center">
            <p className="text-[#b90014] text-xs font-black uppercase tracking-widest mb-3">Get Started</p>
            <h2 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter leading-none mb-4">
              Get a <span className="text-[#b90014]">Free Quote</span>
            </h2>
            <p className="text-zinc-500">Fill out the form and we'll get back to you within one business day.</p>
          </div>

          {submitted ? (
            <div className="text-center bg-white border border-zinc-100 rounded-2xl p-12 shadow-sm">
              <CheckCircle size={48} className="text-[#b90014] mx-auto mb-4" />
              <h3 className="text-2xl font-black uppercase tracking-tight mb-2">Quote Request Sent</h3>
              <p className="text-zinc-500">Your email client should have opened. We'll get back to you shortly.</p>
              <p className="text-zinc-400 text-sm mt-2">Or call us directly: <a href="tel:9055933600" className="text-[#b90014] font-bold">905-593-3600</a></p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-8 md:p-12 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-zinc-600 mb-2">Your Name *</label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={form.name}
                    onChange={handleChange}
                    placeholder="John Smith"
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#b90014]/30 focus:border-[#b90014] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-zinc-600 mb-2">Company Name</label>
                  <input
                    type="text"
                    name="company"
                    value={form.company}
                    onChange={handleChange}
                    placeholder="Acme Corp"
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#b90014]/30 focus:border-[#b90014] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-zinc-600 mb-2">Email Address *</label>
                  <input
                    type="email"
                    name="email"
                    required
                    value={form.email}
                    onChange={handleChange}
                    placeholder="john@example.com"
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#b90014]/30 focus:border-[#b90014] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-zinc-600 mb-2">Phone Number</label>
                  <input
                    type="tel"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="905-000-0000"
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#b90014]/30 focus:border-[#b90014] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-zinc-600 mb-2">Apparel Type *</label>
                  <select
                    name="apparelType"
                    required
                    value={form.apparelType}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-zinc-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#b90014]/30 focus:border-[#b90014] transition-colors"
                  >
                    <option value="">Select type...</option>
                    {APPAREL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-zinc-600 mb-2">Estimated Quantity *</label>
                  <input
                    type="text"
                    name="quantity"
                    required
                    value={form.quantity}
                    onChange={handleChange}
                    placeholder="e.g. 50 pieces"
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#b90014]/30 focus:border-[#b90014] transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-zinc-600 mb-2">Message / Additional Details</label>
                <textarea
                  name="message"
                  rows={5}
                  value={form.message}
                  onChange={handleChange}
                  placeholder="Tell us about your design, colours, logo requirements, deadline, etc."
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#b90014]/30 focus:border-[#b90014] transition-colors resize-none"
                />
              </div>
              <button
                type="submit"
                className="w-full py-4 bg-[#b90014] text-white font-black uppercase tracking-widest text-sm rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-[#b90014]/20"
              >
                Send My Quote Request
              </button>
              <p className="text-center text-zinc-400 text-xs">
                Prefer to call? Reach us at{' '}
                <a href="tel:9055933600" className="text-[#b90014] font-bold">905-593-3600</a>
              </p>
            </form>
          )}
        </div>
      </section>

      {/* ── FOOTER CONTACT BAR ── */}
      <section className="bg-zinc-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
            <div className="flex flex-col sm:flex-row items-center gap-8">
              <a href="tel:9055933600" className="flex items-center gap-3 text-white hover:text-[#b90014] transition-colors">
                <Phone size={20} className="text-[#b90014]" />
                <span className="font-bold">905-593-3600</span>
              </a>
              <div className="flex items-center gap-3 text-zinc-400">
                <MapPin size={20} className="text-[#b90014]" />
                <span>Mississauga, ON</span>
              </div>
              <a href="https://torontosoccershop.com" className="flex items-center gap-3 text-zinc-400 hover:text-white transition-colors">
                <Globe size={20} className="text-[#b90014]" />
                <span>torontosoccershop.com</span>
              </a>
            </div>
            <a
              href="#quote"
              className="px-8 py-3 bg-[#b90014] text-white font-black uppercase tracking-widest text-sm rounded-xl hover:bg-red-700 transition-colors whitespace-nowrap"
            >
              Get a Free Quote
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

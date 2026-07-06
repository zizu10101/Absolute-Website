import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import {
  MapPin,
  Phone,
  Globe,
  CheckCircle,
  CheckCircle2,
  Shirt,
  Star,
  Layers,
  ClipboardList,
  PenTool,
  Truck,
} from 'lucide-react';

const THREE_COLUMNS = [
  {
    icon: MapPin,
    title: 'Visit Us Easily from Brampton',
    desc: 'Located just minutes from Brampton, our Mississauga showroom is fully stocked with sample kits, sizing runs, and the latest footwear collections. Easy access from Highway 410.',
  },
  {
    icon: Star,
    title: 'Premium Brand Selection',
    desc: 'Equip your squad in the best. We supply and customize authentic blanks from Nike, Adidas, Puma and more, matching premium fabrication with top-tier design.',
  },
  {
    icon: Shirt,
    title: 'Complete Roster Customization',
    desc: 'From custom sponsor logo integration and official typography numbering to personalized player names — your squad will look like pros. Simply upload your roster and we handle the rest.',
  },
];

const STEPS = [
  {
    icon: ClipboardList,
    step: '01',
    title: 'Submit Your Roster',
    description: 'Tell us your squad size, preferred kit style, colours, and any sponsor or crest details. We can work from a sketch or a finished file.',
  },
  {
    icon: PenTool,
    step: '02',
    title: 'Approve Your Proof',
    description: 'Our team creates a full digital mockup for every player number and name. Approve it before a single jersey gets printed.',
  },
  {
    icon: Truck,
    step: '03',
    title: 'Pick Up or Deliver',
    description: 'Collect your finished kits at our Mississauga showroom or arrange delivery across Brampton and the GTA.',
  },
];

const HIGHLIGHTS = [
  'Heat-press, sublimation & embroidery',
  'Full squad turnaround in days',
  'All sizes — youth to adult',
];

const APPAREL_TYPES = [
  'Soccer Jerseys / Kits',
  'Training Tops & Shorts',
  'Warm-Up / Track Suits',
  'Goalkeeper Kits',
  'Hoodies & Jackets',
  'Hats & Caps',
  'Other',
];

export function BramptonSoccerPage() {
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
    const subject = encodeURIComponent(`Squad Uniform Quote — ${form.company || form.name}`);
    const body = encodeURIComponent(
      `Name: ${form.name}\nClub / Team: ${form.company}\nEmail: ${form.email}\nPhone: ${form.phone}\nKit Type: ${form.apparelType}\nQuantity: ${form.quantity}\n\nMessage:\n${form.message}`
    );
    window.location.href = `mailto:info@edgedbs.com?subject=${subject}&body=${body}`;
    setSubmitted(true);
  };

  return (
    <>
      <Helmet>
        <title>Custom Soccer Uniforms &amp; Jersey Printing Brampton | Absolute Soccer</title>
        <meta
          name="description"
          content="The premier team uniform destination for Brampton soccer clubs. Custom jersey printing, numbering, and club apparel. Visit us in Mississauga."
        />
      </Helmet>

      <div className="bg-white text-zinc-900">

        {/* ── HERO ── */}
        <section id="top" className="relative overflow-hidden bg-white">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:px-6 md:py-24">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600">
                <MapPin className="size-3.5 text-[#b90014]" />
                Serving Brampton &amp; the GTA
              </div>
              <h1 className="mt-5 text-balance text-4xl font-bold leading-tight tracking-tight text-zinc-900 md:text-5xl lg:text-6xl">
                Custom Soccer Uniforms &amp;{' '}
                <span className="text-[#b90014]">Team Printing in Brampton</span>
              </h1>
              <p className="mt-5 max-w-md text-pretty text-lg leading-relaxed text-zinc-500">
                Engineered for elite performance. Custom jerseys, training kits, and full club
                apparel packages for Brampton soccer clubs and leagues.
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <a
                  href="#quote"
                  className="inline-flex items-center justify-center px-6 py-3 text-base font-medium text-white bg-[#b90014] rounded-md hover:bg-red-800 transition-colors"
                >
                  Get a Fast Squad Quote
                </a>
                <Link
                  to="/custom-apparel"
                  className="inline-flex items-center justify-center px-6 py-3 text-base font-medium text-zinc-900 border border-zinc-300 rounded-md hover:bg-zinc-50 transition-colors"
                >
                  Browse Custom Apparel
                </Link>
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
                  src="/hero-apparel.png"
                  alt="Custom soccer uniforms and jersey printing for Brampton clubs"
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

        {/* ── WHY BRAMPTON CLUBS CHOOSE US ── */}
        <section className="py-20 md:py-28 bg-zinc-50">
          <div className="max-w-7xl mx-auto px-6 md:px-12">
            <div className="mb-14 max-w-3xl">
              <p className="text-[#b90014] text-xs font-black uppercase tracking-widest mb-3">Why Brampton Clubs Choose Us</p>
              <h2 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter leading-none mb-6">
                Professional Kit Engineering for{' '}
                <span className="text-[#b90014]">Brampton Soccer Leagues</span>
              </h2>
              <p className="text-zinc-500 text-lg leading-relaxed">
                From competitive youth academies in the Brampton Soccer League to indoor turf teams
                running out of local community centres, we provide high-caliber, commercial-grade
                uniform printing. We specialize in precision heat-press, vibrant sublimation, and
                durable club crest embroidery that stands up to the toughest tackles all season long.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
              {THREE_COLUMNS.map(({ icon: Icon, title, desc }) => (
                <div
                  key={title}
                  className="bg-white rounded-2xl p-8 border border-zinc-100 hover:border-[#b90014]/30 hover:shadow-md transition-all group"
                >
                  <div className="w-12 h-12 rounded-xl bg-[#b90014]/10 flex items-center justify-center mb-5 group-hover:bg-[#b90014]/20 transition-colors">
                    <Icon size={24} className="text-[#b90014]" />
                  </div>
                  <h3 className="text-lg font-black uppercase tracking-tight mb-2">{title}</h3>
                  <p className="text-zinc-500 text-sm leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section id="how-it-works" className="bg-zinc-900 py-16 md:py-24">
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-wide text-[#b90014]">How It Works</p>
              <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-white md:text-4xl">
                Your squad in custom kits — three simple steps
              </h2>
            </div>

            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {STEPS.map((step) => (
                <div key={step.step} className="relative rounded-xl border border-white/10 bg-white/5 p-7">
                  <span className="text-5xl font-bold text-[#b90014]">{step.step}</span>
                  <div className="mt-4 flex size-11 items-center justify-center rounded-lg bg-[#b90014] text-white">
                    <step.icon className="size-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-white">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/70">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── VISIT US ── */}
        <section className="py-20 md:py-28 bg-white">
          <div className="max-w-7xl mx-auto px-6 md:px-12">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div>
                <p className="text-[#b90014] text-xs font-black uppercase tracking-widest mb-3">Visit Our Showroom</p>
                <h2 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter leading-none mb-6">
                  Visit Our{' '}
                  <span className="text-[#b90014]">Mississauga Showroom</span>
                </h2>
                <p className="text-zinc-500 text-lg leading-relaxed mb-8">
                  Located just a short drive from Brampton on Highway 410, our flagship showroom
                  is fully stocked with sample kits, sizing runs, and footwear collections.
                  Brampton team managers can also submit rosters and finalize uniform mockups
                  virtually.
                </p>
                <div className="flex flex-col gap-4">
                  <a
                    href="tel:9055933600"
                    className="flex items-center gap-3 text-zinc-900 hover:text-[#b90014] transition-colors font-semibold text-lg"
                  >
                    <Phone size={22} className="text-[#b90014]" />
                    905-593-3600
                  </a>
                  <div className="flex items-center gap-3 text-zinc-500">
                    <MapPin size={22} className="text-[#b90014]" />
                    Mississauga, ON
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                {[
                  'Custom sublimation & heat-press printing',
                  'Club crest embroidery',
                  'Sponsor logo integration',
                  'Player name & number typography',
                  'Full squad sizing runs on request',
                  'Youth and adult sizes available',
                ].map(point => (
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
                Get a <span className="text-[#b90014]">Fast Squad Quote</span>
              </h2>
              <p className="text-zinc-500">Fill out the form and we'll get back to you within one business day.</p>
            </div>

            {submitted ? (
              <div className="text-center bg-white border border-zinc-100 rounded-2xl p-12 shadow-sm">
                <CheckCircle size={48} className="text-[#b90014] mx-auto mb-4" />
                <h3 className="text-2xl font-black uppercase tracking-tight mb-2">Quote Request Sent</h3>
                <p className="text-zinc-500">Your email client should have opened. We'll get back to you shortly.</p>
                <p className="text-zinc-400 text-sm mt-2">
                  Or call us directly:{' '}
                  <a href="tel:9055933600" className="text-[#b90014] font-bold">905-593-3600</a>
                </p>
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
                    <label className="block text-xs font-black uppercase tracking-widest text-zinc-600 mb-2">Club / Team Name</label>
                    <input
                      type="text"
                      name="company"
                      value={form.company}
                      onChange={handleChange}
                      placeholder="Brampton United FC"
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
                    <label className="block text-xs font-black uppercase tracking-widest text-zinc-600 mb-2">Kit Type *</label>
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
                    <label className="block text-xs font-black uppercase tracking-widest text-zinc-600 mb-2">Squad Size / Quantity *</label>
                    <input
                      type="text"
                      name="quantity"
                      required
                      value={form.quantity}
                      onChange={handleChange}
                      placeholder="e.g. 18 players"
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
                    placeholder="Tell us about your design, colours, crest or sponsor logo requirements, deadline, etc."
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
                Get a Fast Squad Quote
              </a>
            </div>
          </div>
        </section>

      </div>
    </>
  );
}

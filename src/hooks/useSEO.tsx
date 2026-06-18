import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { SEO, StoreInfo } from '../context/SettingsContext';

function toSchemaTime(timeStr: string): string {
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return timeStr;
  let h = parseInt(match[1]);
  const m = match[2];
  const meridiem = match[3].toUpperCase();
  if (meridiem === 'PM' && h !== 12) h += 12;
  if (meridiem === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${m}`;
}

function parseHoursRange(hoursStr: string): { opens: string; closes: string } | null {
  if (!hoursStr || hoursStr.toLowerCase() === 'closed') return null;
  const parts = hoursStr.split('-').map(s => s.trim());
  if (parts.length !== 2) return null;
  return { opens: toSchemaTime(parts[0]), closes: toSchemaTime(parts[1]) };
}

const DAY_NAMES: Record<keyof StoreInfo['hours'], string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

function buildOpeningHours(hours: StoreInfo['hours']) {
  const groups: Record<string, string[]> = {};
  for (const [day, hoursStr] of Object.entries(hours) as [keyof StoreInfo['hours'], string][]) {
    const key = hoursStr.trim();
    if (key.toLowerCase() === 'closed') continue;
    if (!groups[key]) groups[key] = [];
    groups[key].push(DAY_NAMES[day]);
  }
  return Object.entries(groups).map(([hoursStr, days]) => {
    const parsed = parseHoursRange(hoursStr);
    if (!parsed) return null;
    return {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: days.length === 1 ? days[0] : days,
      opens: parsed.opens,
      closes: parsed.closes,
    };
  }).filter(Boolean);
}

function buildSchema(storeInfo: StoreInfo) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SportingGoodsStore',
    name: storeInfo.name,
    alternateName: 'Toronto Soccer Shop',
    image: 'https://torontosoccershop.com/logo.svg',
    description: 'Premier soccer store in Mississauga offering cleats, jerseys, boots and gear. Official licensed soccer apparel for national teams and clubs.',
    url: 'https://torontosoccershop.com',
    telephone: '+1' + storeInfo.phone.replace(/\D/g, ''),
    address: {
      '@type': 'PostalAddress',
      streetAddress: storeInfo.address.split(',')[0]?.trim() || storeInfo.address,
      addressLocality: 'Mississauga',
      addressRegion: 'ON',
      addressCountry: 'CA',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: '43.5890',
      longitude: '-79.6441',
    },
    openingHoursSpecification: buildOpeningHours(storeInfo.hours),
    priceRange: '$$',
    hasMap: 'https://maps.google.com/?q=Absolute+Soccer+Mississauga',
    sameAs: ['https://www.instagram.com/absolutemississauga'],
  };
}

export function useSEO(_seoSettings: SEO, storeInfo?: StoreInfo) {
  const { pathname } = useLocation();

  useEffect(() => {
    const existing = document.getElementById('schema-markup');
    if (existing) existing.remove();
    if (pathname !== '/') return;

    const schema = storeInfo ? buildSchema(storeInfo) : buildSchema({
      name: 'Absolute Soccer Mississauga',
      address: '5600 Rose Cherry Place, Mississauga, Ontario',
      phone: '905-593-3600',
      email: '',
      hours: {
        monday: '10:00 AM - 6:00 PM',
        tuesday: '10:00 AM - 6:00 PM',
        wednesday: '10:00 AM - 6:00 PM',
        thursday: '10:00 AM - 6:00 PM',
        friday: '10:00 AM - 6:00 PM',
        saturday: '10:00 AM - 5:00 PM',
        sunday: 'Closed',
      },
    });

    const script = document.createElement('script');
    script.id = 'schema-markup';
    script.type = 'application/ld+json';
    script.text = JSON.stringify(schema);
    document.head.appendChild(script);

    return () => { document.getElementById('schema-markup')?.remove(); };
  }, [pathname, storeInfo]);
}

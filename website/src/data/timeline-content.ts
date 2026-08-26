/**
 * The single timeline dataset every timeline on the website renders.
 * Same data, different presentation — that is the library's whole pitch,
 * so the site must not duplicate this per variant.
 *
 * `icon` is inline SVG markup (Lucide paths, ISC-licensed) placed inside
 * the date link; the library's stylesheet pins it to the medallion disc.
 * Only the `list` / `list-alternating` variants render it.
 */
export interface TimelineEntry {
  year: string;
  title: string;
  text: string;
  image: string;
  alt: string;
  icon: string;
}

export const TIMELINE: TimelineEntry[] = [
  {
    year: '1900',
    title: 'A new century',
    text: 'The city added its first electric streetlights this year, and the old gas lamps went dark for good.',
    image: 'https://picsum.photos/seed/timelinr-1/480/320',
    alt: 'A new century',
    icon: '<path d="M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z"/>',
  },
  {
    year: '1930',
    title: 'Hard times',
    text: 'Storefronts sat empty along the main road as the depression tightened its grip on daily life.',
    image: 'https://picsum.photos/seed/timelinr-2/480/320',
    alt: 'Hard times',
    icon: '<path d="M16.247 7.761a6 6 0 0 1 0 8.478"/><path d="M19.075 4.933a10 10 0 0 1 0 14.134"/><path d="M4.925 19.067a10 10 0 0 1 0-14.134"/><path d="M7.753 16.239a6 6 0 0 1 0-8.478"/><circle cx="12" cy="12" r="2"/>',
  },
  {
    year: '1944',
    title: 'Turning point',
    text: 'Supply lines shifted overnight, and for the first time in years the harbor saw new construction.',
    image: 'https://picsum.photos/seed/timelinr-3/480/320',
    alt: 'Turning point',
    icon: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M16 3.128a4 4 0 0 1 0 7.744"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/>',
  },
  {
    year: '1950',
    title: 'Rebuilding',
    text: 'Cranes returned to the skyline as entire blocks were rebuilt from the ground up.',
    image: 'https://picsum.photos/seed/timelinr-4/480/320',
    alt: 'Rebuilding',
    icon: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  },
  {
    year: '1971',
    title: 'First steps',
    text: 'The transit line opened three stops early, connecting neighborhoods that had never been linked before.',
    image: 'https://picsum.photos/seed/timelinr-5/480/320',
    alt: 'First steps',
    icon: '<path d="M10 18v-7"/><path d="M11.119 2.205a2 2 0 0 1 1.762 0l7.84 3.846A.5.5 0 0 1 20.5 7h-17a.5.5 0 0 1-.22-.949z"/><path d="M14 18v-7"/><path d="M18 18v-7"/><path d="M3 22h18"/><path d="M6 18v-7"/>',
  },
  {
    year: '1977',
    title: 'New wave',
    text: 'A wave of independent venues opened downtown, reshaping the local music scene almost overnight.',
    image: 'https://picsum.photos/seed/timelinr-6/480/320',
    alt: 'New wave',
    icon: '<path d="M12 20h.01"/><path d="M2 8.82a15 15 0 0 1 20 0"/><path d="M5 12.859a10 10 0 0 1 14 0"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/>',
  },
  {
    year: '1989',
    title: 'Walls fall',
    text: 'Crowds gathered at the border crossing as decades-old barriers came down within hours.',
    image: 'https://picsum.photos/seed/timelinr-7/480/320',
    alt: 'Walls fall',
    icon: '<path d="M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z"/>',
  },
  {
    year: '1999',
    title: 'Millennium eve',
    text: 'Fireworks lit the harbor as the city counted down to a new millennium amid cautious optimism.',
    image: 'https://picsum.photos/seed/timelinr-8/480/320',
    alt: 'Millennium eve',
    icon: '<path d="M16.247 7.761a6 6 0 0 1 0 8.478"/><path d="M19.075 4.933a10 10 0 0 1 0 14.134"/><path d="M4.925 19.067a10 10 0 0 1 0-14.134"/><path d="M7.753 16.239a6 6 0 0 1 0-8.478"/><circle cx="12" cy="12" r="2"/>',
  },
  {
    year: '2001',
    title: 'A new era',
    text: 'The first fiber lines reached downtown offices, and dial-up modems finally became a memory.',
    image: 'https://picsum.photos/seed/timelinr-9/480/320',
    alt: 'A new era',
    icon: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M16 3.128a4 4 0 0 1 0 7.744"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/>',
  },
  {
    year: '2011',
    title: 'Connected world',
    text: 'Free public wifi reached every district, and the last of the payphones were finally removed.',
    image: 'https://picsum.photos/seed/timelinr-10/480/320',
    alt: 'Connected world',
    icon: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  },
];

export type TimelineVariant = 'rail' | 'stack' | 'tabs' | 'list' | 'list-alternating';

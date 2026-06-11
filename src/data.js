const CLIENTS = ['Lumenworks', 'Northbeam', 'Atlas & Co', 'Verdantia', 'Halcyon',
  'Mosaic Labs', 'Quartzline', 'Driftwood', 'Polaris', 'Embergrove'];
const QUALIFIERS = ['Pixel', 'Global', 'Festive', 'Annoying', 'Ultimate',
  'Spherical', 'Walking', 'Visitor', 'Brand', 'Travel'];
const SUBJECTS = ['Compass', 'Takeover', 'Experience', 'Generator', 'Tour',
  'Standards', 'Report', 'Guide', 'Resilience', 'Heroes'];
const TAGS = ['EXPERIENCE', 'WEBSITE', '3D', 'CAMPAIGN', 'AI',
  'MOTION', 'CONTENT', 'BRAND', 'EVENT', 'TOOL'];

export const COLS = 10;
export const ROWS = 10;
export const CARD_COUNT = COLS * ROWS;

export function makeCards() {
  return Array.from({ length: CARD_COUNT }, (_, i) => ({
    id: i,
    client: CLIENTS[i % CLIENTS.length],
    title: `${QUALIFIERS[Math.floor(i / 10) % 10]} ${SUBJECTS[(i * 7) % 10]}`,
    tags: [TAGS[i % 10], TAGS[(i + 3) % 10]],
    year: 2017 + (i % 10),
    image: `${import.meta.env.BASE_URL}assets/img-${i}.jpg`,
  }));
}

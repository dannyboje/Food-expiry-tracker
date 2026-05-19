import * as Location from 'expo-location';
import type { ProductAlternative } from '@/types/food-item';

// ISO 3166-1 alpha-2 → Open Food Facts countries_tags value
const ISO_TO_OFF_COUNTRY: Record<string, string> = {
  GB: 'en:united-kingdom', US: 'en:united-states', FR: 'en:france',
  DE: 'en:germany', IT: 'en:italy', ES: 'en:spain', NL: 'en:netherlands',
  BE: 'en:belgium', CH: 'en:switzerland', AT: 'en:austria', SE: 'en:sweden',
  NO: 'en:norway', DK: 'en:denmark', FI: 'en:finland', PL: 'en:poland',
  PT: 'en:portugal', GR: 'en:greece', IE: 'en:ireland', CZ: 'en:czechia',
  HU: 'en:hungary', RO: 'en:romania', CA: 'en:canada', AU: 'en:australia',
  NZ: 'en:new-zealand', IN: 'en:india', JP: 'en:japan', KR: 'en:south-korea',
  CN: 'en:china', SG: 'en:singapore', MY: 'en:malaysia', TH: 'en:thailand',
  PH: 'en:philippines', ID: 'en:indonesia', BR: 'en:brazil', MX: 'en:mexico',
  AR: 'en:argentina', CO: 'en:colombia', CL: 'en:chile', ZA: 'en:south-africa',
  NG: 'en:nigeria', EG: 'en:egypt', SA: 'en:saudi-arabia', AE: 'en:united-arab-emirates',
  TR: 'en:turkey', UA: 'en:ukraine', RU: 'en:russia', PK: 'en:pakistan',
  BD: 'en:bangladesh', LK: 'en:sri-lanka', IL: 'en:israel',
};

// undefined = not yet tried, null = tried and denied/failed, string = resolved tag
let cachedUserCountryTag: string | null | undefined;

export async function resolveUserCountryTag(): Promise<string | undefined> {
  if (cachedUserCountryTag) return cachedUserCountryTag;
  if (cachedUserCountryTag === null) {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return undefined;
    cachedUserCountryTag = undefined;
  }
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') { cachedUserCountryTag = null; return undefined; }
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest });
    const [place] = await Location.reverseGeocodeAsync(
      { latitude: pos.coords.latitude, longitude: pos.coords.longitude },
    );
    const tag = ISO_TO_OFF_COUNTRY[(place?.isoCountryCode ?? '').toUpperCase()] ?? null;
    cachedUserCountryTag = tag;
    return tag ?? undefined;
  } catch {
    cachedUserCountryTag = null;
    return undefined;
  }
}

export function formatCountryTag(tag: string): string {
  const name = tag.includes(':') ? tag.slice(tag.indexOf(':') + 1) : tag;
  return name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

const ALT_FIELDS = 'code,product_name,brands,nutriscore_grade,nova_group,image_front_small_url,categories_tags';

const TYPE_KEYWORDS = [
  'protein', 'energy', 'whey', 'collagen',
  'gelato', 'sorbet', 'ice-cream', 'lolly', 'frozen',
  'chocolate', 'hazelnut', 'caramel', 'nougat', 'praline', 'truffle',
  'crisp', 'chip', 'popcorn', 'pretzel', 'nacho',
  'almond', 'peanut', 'walnut', 'cashew', 'pistachio', 'pecan', 'sesame',
  'strawberry', 'blueberry', 'raspberry', 'blackberry', 'cranberry',
  'mango', 'coconut', 'banana', 'pineapple', 'watermelon', 'kiwi',
  'apricot', 'peach', 'cherry', 'plum', 'fig', 'grape',
  'orange', 'lemon', 'lime', 'grapefruit', 'apple', 'pear',
  'chicken', 'beef', 'pork', 'lamb', 'turkey', 'duck', 'bacon', 'ham',
  'tuna', 'salmon', 'cod', 'sardine', 'mackerel', 'shrimp', 'prawn', 'crab',
  'yogurt', 'cheddar', 'mozzarella', 'parmesan', 'brie', 'gouda',
  'cheese', 'butter', 'cream', 'milk',
  'pasta', 'noodle', 'spaghetti', 'lasagne', 'risotto',
  'oat', 'wheat', 'rye', 'barley', 'quinoa', 'buckwheat',
  'bread', 'sourdough', 'baguette', 'croissant', 'brioche',
  'biscuit', 'cookie', 'cracker', 'wafer', 'waffle', 'pancake',
  'cereal', 'granola', 'muesli', 'cornflake',
  'rice', 'corn',
  'tomato', 'carrot', 'spinach', 'broccoli', 'cauliflower', 'courgette',
  'potato', 'mushroom', 'avocado', 'cucumber',
  'lentil', 'chickpea', 'soy', 'tofu', 'bean', 'pea',
  'garlic', 'onion', 'ginger', 'pepper', 'chilli', 'paprika', 'cumin',
  'cinnamon', 'vanilla', 'mint', 'basil', 'oregano', 'thyme', 'rosemary',
  'honey', 'maple', 'jam', 'marmalade', 'herb', 'seasoning', 'spice',
  'coffee', 'cocoa', 'matcha', 'tea', 'juice', 'smoothie',
  'pizza', 'burger', 'soup', 'curry', 'hummus', 'salsa', 'guacamole',
  'berry', 'fruit',
];

function fetchWithTimeout(url: string, ms = 5000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

function parseAlts(products: Record<string, unknown>[], requiredTag?: string): ProductAlternative[] {
  return products
    .filter((p) => {
      const grade = ((p.nutriscore_grade as string) ?? '').toLowerCase();
      if (!p.product_name || !(grade === 'a' || grade === 'b')) return false;
      if (requiredTag) {
        const tags = Array.isArray(p.categories_tags) ? (p.categories_tags as string[]) : [];
        if (!tags.includes(requiredTag)) return false;
      }
      return true;
    })
    .slice(0, 3)
    .map((p) => {
      const novaRaw = Number(p.nova_group);
      return {
        barcode: p.code as string,
        name: p.product_name as string,
        brand: p.brands as string | undefined,
        nutriScore: ((p.nutriscore_grade as string) ?? '').toLowerCase(),
        novaGroup: novaRaw >= 1 && novaRaw <= 4 ? novaRaw : undefined,
        imageUri: (p.image_front_small_url as string | undefined) || undefined,
      };
    });
}

async function doFetchAlternatives(
  offCategories: string[],
  countryTag: string | undefined,
): Promise<{ alts: ProductAlternative[]; wasLocal: boolean }> {
  const BASE = 'https://world.openfoodfacts.org/api/v2/search';
  const common = `page_size=50&fields=${ALT_FIELDS}&sort_by=popularity`;
  const country = countryTag ? `&countries_tags=${encodeURIComponent(countryTag)}` : '';

  const typedTags = [...offCategories]
    .reverse()
    .filter(tag => TYPE_KEYWORDS.some(kw => tag.includes(kw)))
    .slice(0, 3);

  const candidateTags = typedTags.length > 0 ? typedTags : offCategories.slice(-2).reverse();

  const urlEntries: { url: string; isLocal: boolean; tag: string }[] = [];
  if (country) {
    for (const tag of candidateTags) {
      urlEntries.push({
        url: `${BASE}?categories_tags=${encodeURIComponent(tag)}&${common}${country}`,
        isLocal: true, tag,
      });
    }
  }
  for (const tag of candidateTags) {
    urlEntries.push({
      url: `${BASE}?categories_tags=${encodeURIComponent(tag)}&${common}`,
      isLocal: false, tag,
    });
  }

  for (const { url, isLocal, tag } of urlEntries) {
    try {
      const res = await fetchWithTimeout(url);
      if (!res.ok) continue;
      const json = await res.json();
      const alts = parseAlts(json.products ?? [], tag);
      if (alts.length > 0) return { alts, wasLocal: isLocal };
    } catch { /* try next */ }
  }
  return { alts: [], wasLocal: false };
}

export async function fetchAlternatives(
  offCategories: string[],
  countryTag: string | undefined,
): Promise<{ alts: ProductAlternative[]; wasLocal: boolean }> {
  if (offCategories.length === 0) return { alts: [], wasLocal: false };
  return Promise.race([
    doFetchAlternatives(offCategories, countryTag),
    new Promise<{ alts: ProductAlternative[]; wasLocal: boolean }>((resolve) =>
      setTimeout(() => resolve({ alts: [], wasLocal: false }), 10_000)
    ),
  ]);
}

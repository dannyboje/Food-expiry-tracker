const BASE_URL = 'https://search.openfoodfacts.org';
const FIELDS = 'code,product_name,brands,nutriscore_grade,nova_group,categories_tags,image_front_small_url';

export interface SALProduct {
  barcode: string;
  name: string;
  brand?: string;
  nutriScore?: string;
  novaGroup?: number;
  offCategories: string[];
  imageUri?: string;
}

// Shared category mapper — used by scanner and add form
export function mapCategory(tag: string): string | undefined {
  if (!tag) return undefined;
  const t = tag.toLowerCase();
  if (t.includes('dairy') || t.includes('milk') || t.includes('cheese')) return 'dairy';
  if (t.includes('meat') || t.includes('beef') || t.includes('chicken') || t.includes('pork')) return 'meat';
  if (t.includes('fish') || t.includes('seafood')) return 'seafood';
  if (t.includes('vegetable') || t.includes('fruit') || t.includes('produce')) return 'produce';
  if (t.includes('bread') || t.includes('bakery') || t.includes('pastry')) return 'bakery';
  if (t.includes('frozen')) return 'frozen';
  if (t.includes('canned') || t.includes('conserve')) return 'canned';
  if (t.includes('beverage') || t.includes('drink') || t.includes('juice')) return 'beverages';
  if (t.includes('snack') || t.includes('chip') || t.includes('cookie')) return 'snacks';
  if (t.includes('grain') || t.includes('cereal') || t.includes('pasta') || t.includes('rice')) return 'grains';
  return undefined;
}

function parseHit(hit: Record<string, unknown>): SALProduct | null {
  const barcode = hit.code as string;
  const productName = hit.product_name as string | undefined;
  if (!barcode || !productName) return null;

  const rawGrade = (hit.nutriscore_grade as string | undefined)?.toLowerCase();
  const nutriScore = rawGrade && ['a', 'b', 'c', 'd', 'e'].includes(rawGrade) ? rawGrade : undefined;
  const novaRaw = Number(hit.nova_group);
  const novaGroup = novaRaw >= 1 && novaRaw <= 4 ? novaRaw : undefined;
  const brand = (hit.brands as string | undefined) || undefined;
  const offCategories = Array.isArray(hit.categories_tags)
    ? (hit.categories_tags as string[])
    : [];
  const imageUri = (hit.image_front_small_url as string | undefined) || undefined;

  return { barcode, name: productName, brand, nutriScore, novaGroup, offCategories, imageUri };
}

function parseResponse(json: Record<string, unknown>): Record<string, unknown>[] {
  // Search-a-licious returns { hits: [...] }; OFf v2 returns { products: [...] }
  if (Array.isArray(json.hits)) return json.hits as Record<string, unknown>[];
  if (Array.isArray(json.products)) return json.products as Record<string, unknown>[];
  return [];
}

function fetchWithTimeout(url: string, ms = 7000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

/** Full-text product search — used for name-based typeahead in the add form. */
export async function searchProducts(query: string, pageSize = 5): Promise<SALProduct[]> {
  if (!query.trim()) return [];
  try {
    const url =
      `${BASE_URL}/search?q=${encodeURIComponent(query.trim())}` +
      `&page_size=${pageSize}&fields=${FIELDS}`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return [];
    const json = await res.json();
    return parseResponse(json).map(parseHit).filter((p): p is SALProduct => p !== null);
  } catch {
    return [];
  }
}

/**
 * Barcode lookup via Search-a-licious — prefers an exact `code` match.
 * NOTE: SAL is a full-text search engine; barcode numbers are not indexed as searchable
 * text, so this will rarely return results. Kept as a best-effort last resort.
 */
export async function lookupProductByBarcode(barcode: string): Promise<SALProduct | null> {
  try {
    // Try filter_by first (Elasticsearch field filter), then fall back to text query
    for (const url of [
      `${BASE_URL}/search?filter_by=code%3A${encodeURIComponent(barcode)}&page_size=1&fields=${FIELDS}`,
      `${BASE_URL}/search?q=${encodeURIComponent(barcode)}&page_size=5&fields=${FIELDS}`,
    ]) {
      const res = await fetchWithTimeout(url, 5000);
      if (!res.ok) continue;
      const json = await res.json();
      const hits = parseResponse(json);
      const exact = hits.find((h) => (h.code as string) === barcode);
      if (exact) return parseHit(exact);
    }
    return null;
  } catch {
    return null;
  }
}

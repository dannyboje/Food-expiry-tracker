import KVStore from 'expo-sqlite/kv-store';
import { NativeModules, Platform } from 'react-native';
import type { FoodItem } from '@/types/food-item';

// ── Types ──────────────────────────────────────────────────────────────────

export interface RecallItem {
  id: string;
  source: 'FDA' | 'USDA' | 'FSA' | 'FSSAI';
  productDescription: string;
  reason: string;
  date: string;
  riskLevel?: string;
}

export interface RecallMatch {
  pairId: string;         // `${recallId}:${pantryItemId}` — stable dedup key
  pantryItemId: string;
  pantryItemName: string;
  recall: RecallItem;
}

// ── KVStore keys ───────────────────────────────────────────────────────────

const LAST_CHECK_KEY   = '@recall_last_check';
const ALERTS_KEY       = '@recall_alerts';
const DISMISSED_KEY    = '@recall_dismissed';
const RECALLS_CACHE_KEY = '@recall_cache';

// ── Network helper ─────────────────────────────────────────────────────────

// AbortSignal.timeout() is not available in all React Native environments —
// Hermes polyfills AbortSignal but not the static .timeout() factory method.
function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

// ── Region detection ───────────────────────────────────────────────────────

// Extracts a 2-letter ISO country code from a locale string like "en_GB", "en-US".
function countryFromLocale(locale: string): string {
  const parts = locale.split(/[-_]/);
  if (parts.length >= 2) {
    const candidate = parts[parts.length - 1].toUpperCase();
    if (/^[A-Z]{2}$/.test(candidate)) return candidate;
  }
  return '';
}

// Returns ISO 3166-1 alpha-2 country code. Tries native OS APIs first (most
// reliable on Hermes where Intl locale may omit the region tag), then falls
// back to Intl. Returns '' when nothing resolves — caller maps '' to all APIs.
export function getDeviceRegion(): string {
  try {
    // iOS: AppleLocale is in "en_GB" format; AppleLanguages[0] is "en-GB".
    if (Platform.OS === 'ios') {
      const settings = (NativeModules.SettingsManager as any)?.settings ?? {};
      const raw: string = settings.AppleLocale ?? settings.AppleLanguages?.[0] ?? '';
      const country = countryFromLocale(raw);
      if (country) return country;
    }

    // Android: localeIdentifier is "en_GB" format.
    if (Platform.OS === 'android') {
      const raw: string = (NativeModules.I18nManager as any)?.localeIdentifier ?? '';
      const country = countryFromLocale(raw);
      if (country) return country;
    }

    // Fallback: Intl API (may return just "en" on some Hermes builds).
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    return countryFromLocale(locale);
  } catch {
    return '';
  }
}

// ── API fetchers ───────────────────────────────────────────────────────────

async function fetchFDARecalls(): Promise<RecallItem[]> {
  const res = await fetchWithTimeout(
    'https://api.fda.gov/food/enforcement.json?limit=100&sort=report_date:desc',
    12_000,
  );
  if (!res.ok) return [];
  const json = await res.json() as { results?: Record<string, string>[] };
  return (json.results ?? []).map((r, i) => ({
    id: r.recall_number ?? `fda-${i}`,
    source: 'FDA' as const,
    productDescription: r.product_description ?? '',
    reason: r.reason_for_recall ?? '',
    date: r.recall_initiation_date ?? '',
    riskLevel: r.classification,
  }));
}

async function fetchUSDARecalls(): Promise<RecallItem[]> {
  const res = await fetchWithTimeout(
    'https://www.fsis.usda.gov/fsis/api/recall/v/1?field=RecalledDate&direction=desc&limit=50',
    12_000,
  );
  if (!res.ok) return [];
  const json = await res.json() as Record<string, string>[];
  const rows = Array.isArray(json) ? json : [];
  return rows.map((r, i) => ({
    id: String(r.RecallNumber ?? r.nid ?? `usda-${i}`),
    source: 'USDA' as const,
    productDescription: String(r.ProductName ?? r.field_title ?? r.RecallTitle ?? r.title ?? ''),
    reason: String(r.ReasonforRecall ?? r.field_recall_reason ?? r.Reason ?? ''),
    date: String(r.RecalledDate ?? r.field_recalled_date ?? ''),
    riskLevel: String(r.RiskLevel ?? r.field_risk_level ?? ''),
  }));
}

// FSA Food Alerts API (UK Food Standards Agency) — free, no key required.
async function fetchFSARecalls(): Promise<RecallItem[]> {
  const res = await fetchWithTimeout(
    'https://data.food.gov.uk/food-alerts/v1/?limit=50&sort=-modified',
    12_000,
  );
  if (!res.ok) return [];
  const json = await res.json() as { items?: Record<string, unknown>[] };
  return (json.items ?? []).map((r, i) => {
    // productDetails can be an array or a single object — handle both.
    const rawDetails = r.productDetails;
    const details: Record<string, string>[] = Array.isArray(rawDetails)
      ? rawDetails as Record<string, string>[]
      : rawDetails && typeof rawDetails === 'object'
        ? [rawDetails as Record<string, string>]
        : [];

    // Try both camelCase and snake_case field names used by different FSA API versions.
    const productDescription = details.length > 0
      ? details
          .map((d) => [
            d.productName ?? d.product_name ?? d.name ?? '',
            d.brandName  ?? d.brand_name  ?? d.brand ?? '',
          ].filter(Boolean).join(' '))
          .filter(Boolean)
          .join(', ')
      // Fall back to the alert title — still useful for substring matching
      : String(r.title ?? r.shortTitle ?? r.alertTitle ?? '');

    const problem = Array.isArray(r.problem)
      ? r.problem as Record<string, string>[]
      : r.problem && typeof r.problem === 'object'
        ? [r.problem as Record<string, string>]
        : [];
    const reason = problem.map((p) => p.description ?? p.type ?? '').filter(Boolean).join('; ')
      || String(r.description ?? r.riskStatement ?? '');

    return {
      id: String(r.id ?? `fsa-${i}`),
      source: 'FSA' as const,
      productDescription,
      reason,
      date: String(r.created ?? r.modified ?? ''),
      riskLevel: String(r.riskStatement ?? ''),
    };
  });
}

// ── RSS/XML parser (React Native has no DOM — parse with regex) ────────────

// Extracts inner text from a tag, handling both <![CDATA[...]]> and plain text.
function xmlField(block: string, tag: string): string {
  const re = new RegExp(
    `<${tag}[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))<\\/${tag}>`,
    'i',
  );
  const m = block.match(re);
  return ((m?.[1] ?? m?.[2]) || '').replace(/<[^>]+>/g, '').trim();
}

function parseRssItems(xml: string): Array<{
  title: string; description: string; pubDate: string; guid: string;
}> {
  const out: Array<{ title: string; description: string; pubDate: string; guid: string }> = [];
  const itemRe = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null) {
    const b = m[1];
    out.push({
      title:       xmlField(b, 'title'),
      description: xmlField(b, 'description'),
      pubDate:     xmlField(b, 'pubDate') || xmlField(b, 'dc:date'),
      guid:        xmlField(b, 'guid') || xmlField(b, 'link'),
    });
  }
  return out;
}

// FSSAI (Food Safety and Standards Authority of India) — RSS feed.
// Best-effort: silently returns [] on any network or parse failure.
async function fetchFSSAIRecalls(): Promise<RecallItem[]> {
  const FSSAI_URLS = [
    'https://www.fssai.gov.in/rss/food-safety-alerts.xml',
    'https://www.fssai.gov.in/rss/fssai_news.xml',
  ];

  let xml = '';
  for (const url of FSSAI_URLS) {
    try {
      const res = await fetchWithTimeout(url, 12_000);
      if (res.ok) { xml = await res.text(); break; }
    } catch { /* try next */ }
  }
  if (!xml) return [];

  const RECALL_RE = /recall|withdraw|alert|unsafe|contamina|prohibit|ban|seizure|adulterat/i;

  return parseRssItems(xml)
    .filter((item) => RECALL_RE.test(item.title) || RECALL_RE.test(item.description))
    .map((item, i) => ({
      id:                 item.guid || `fssai-${i}`,
      source:             'FSSAI' as const,
      productDescription: item.title,
      reason:             item.description,
      date:               item.pubDate,
      riskLevel:          '',
    }));
}

// ── Keyword matching ───────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'with', 'from', 'that', 'this', 'have', 'each', 'than', 'them',
  'they', 'will', 'been', 'were', 'said', 'what', 'when', 'your',
  'also', 'into', 'more', 'some', 'such', 'used', 'most', 'over',
  'only', 'both', 'very', 'brand', 'item', 'items', 'food', 'product',
  'products', 'size', 'pack', 'case', 'label', 'alert', 'recall',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    // Fix: was > 3, missing common 3-letter food words (ham, egg, cod, oat, etc.)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
}

function normalise(text: string): string {
  return text.trim().toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function itemMatchesRecall(itemName: string, recallDescription: string): boolean {
  if (!recallDescription) return false;

  const itemTokens = tokenize(itemName);

  // Single-word item names (e.g. "Milk", "Eggs", "Beef") are too generic to match
  // reliably — they would produce false positives against almost every recall.
  if (itemTokens.length < 2) return false;

  const itemNorm   = normalise(itemName);
  const recallNorm = normalise(recallDescription);

  // Rule 1 — Exact phrase: the full item name appears as a contiguous phrase in the
  // recall description. "Smoked Salmon" ⊂ "Kirkland Smoked Salmon Fillets" → match.
  if (recallNorm.includes(itemNorm)) return true;

  // Rule 2 — All tokens present: every meaningful word in the item name appears in the
  // recall text. Only applied when the item has 3+ tokens to avoid 2-word scatter matches
  // (e.g. "Organic Milk" matching "organic ... milk of magnesia").
  if (itemTokens.length >= 3 && itemTokens.every((t) => recallNorm.includes(t))) return true;

  return false;
}

function matchRecalls(
  recalls: RecallItem[],
  items: FoodItem[],
  dismissed: Set<string>,
): RecallMatch[] {
  const matches: RecallMatch[] = [];
  for (const item of items) {
    if (!item.name.trim()) continue;
    for (const recall of recalls) {
      const pairId = `${recall.id}:${item.id}`;
      if (dismissed.has(pairId)) continue;
      if (itemMatchesRecall(item.name, recall.productDescription)) {
        matches.push({ pairId, pantryItemId: item.id, pantryItemName: item.name, recall });
      }
    }
  }
  return matches;
}

// ── Persistence helpers ────────────────────────────────────────────────────

export async function getLastCheckDate(): Promise<string | null> {
  return KVStore.getItem(LAST_CHECK_KEY);
}

async function setLastCheckDate(date: string): Promise<void> {
  await KVStore.setItem(LAST_CHECK_KEY, date);
}

export async function getStoredAlerts(): Promise<RecallMatch[]> {
  const raw = await KVStore.getItem(ALERTS_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as RecallMatch[]; } catch { return []; }
}

async function storeAlerts(alerts: RecallMatch[]): Promise<void> {
  await KVStore.setItem(ALERTS_KEY, JSON.stringify(alerts));
}

async function getDismissed(): Promise<Set<string>> {
  const raw = await KVStore.getItem(DISMISSED_KEY);
  if (!raw) return new Set();
  try { return new Set(JSON.parse(raw) as string[]); } catch { return new Set(); }
}

export async function dismissAlert(pairId: string): Promise<void> {
  const dismissed = await getDismissed();
  dismissed.add(pairId);
  await KVStore.setItem(DISMISSED_KEY, JSON.stringify([...dismissed]));
  const alerts = await getStoredAlerts();
  await storeAlerts(alerts.filter((a) => a.pairId !== pairId));
}

export async function shouldRunCheck(): Promise<boolean> {
  const last = await getLastCheckDate();
  return last !== new Date().toISOString().split('T')[0];
}

// Re-run matching against cached recalls without hitting the network.
// Used when items are added/updated mid-day so new items are checked immediately.
export async function runMatchOnCachedRecalls(items: FoodItem[]): Promise<RecallMatch[]> {
  const raw = await KVStore.getItem(RECALLS_CACHE_KEY);
  if (!raw) return [];
  let cached: RecallItem[];
  try { cached = JSON.parse(raw) as RecallItem[]; } catch { return []; }
  const dismissed = await getDismissed();
  const matches = matchRecalls(cached, items, dismissed);
  await storeAlerts(matches);
  return matches;
}

// ── Region → fetchers map ──────────────────────────────────────────────────

type Fetcher = () => Promise<RecallItem[]>;

function getFetchersForRegion(region: string): Fetcher[] {
  switch (region) {
    case 'US': return [fetchFDARecalls, fetchUSDARecalls];
    case 'GB': return [fetchFSARecalls];
    case 'IN': return [fetchFSSAIRecalls];
    default:   return [fetchFDARecalls, fetchUSDARecalls, fetchFSARecalls, fetchFSSAIRecalls];
  }
}

// ── Main entry point ───────────────────────────────────────────────────────

export async function runRecallCheck(items: FoodItem[]): Promise<RecallMatch[]> {
  const region   = getDeviceRegion();
  const fetchers = getFetchersForRegion(region);

  const results  = await Promise.allSettled(fetchers.map((f: Fetcher) => f()));
  const allRecalls: RecallItem[] = results.flatMap((r) =>
    r.status === 'fulfilled' ? r.value : ([] as RecallItem[]),
  );

  // Cache the fetched recalls so mid-day item additions can match against them
  // without another network round-trip.
  if (allRecalls.length > 0) {
    await KVStore.setItem(RECALLS_CACHE_KEY, JSON.stringify(allRecalls));
  }

  const dismissed = await getDismissed();
  const matches = matchRecalls(allRecalls, items, dismissed);
  await storeAlerts(matches);
  // Only stamp today's date when at least one API responded — prevents silently
  // skipping tomorrow's check when all three APIs were unreachable today.
  if (allRecalls.length > 0) {
    await setLastCheckDate(new Date().toISOString().split('T')[0]);
  }
  return matches;
}

// ── Regional recall browser ────────────────────────────────────────────────

// Parses a raw date string from any of the four APIs into a Date.
// Returns null when the string cannot be interpreted.
export function parseRecallDate(raw: string): Date | null {
  if (!raw) return null;
  // FDA uses YYYYMMDD; convert to ISO before parsing.
  const iso = raw.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3');
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

// Maps region code to the recall sources that are authoritative for that country.
function sourcesForRegion(region: string): RecallItem['source'][] {
  switch (region) {
    case 'US': return ['FDA', 'USDA'];
    case 'GB': return ['FSA'];
    case 'IN': return ['FSSAI'];
    default:   return ['FDA', 'USDA', 'FSA', 'FSSAI'];
  }
}

// Returns cached recalls filtered to:
//   1. Sources relevant to the device's region — UK users never see USDA/FDA.
//   2. Recalls dated within the last 30 days.
// Also prunes stale (>30 day) entries from the cache in-place.
// Items whose date cannot be parsed are kept rather than silently dropped.
export async function getRegionalRecalls(): Promise<RecallItem[]> {
  const raw = await KVStore.getItem(RECALLS_CACHE_KEY);
  if (!raw) return [];
  let recalls: RecallItem[];
  try { recalls = JSON.parse(raw) as RecallItem[]; } catch { return []; }

  // Prune stale items from cache, but keep all sources intact so a locale
  // change doesn't empty the cache before the next daily fetch.
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const agePruned = recalls.filter(r => {
    const d = parseRecallDate(r.date);
    return d === null || d >= cutoff;
  });
  if (agePruned.length < recalls.length) {
    await KVStore.setItem(RECALLS_CACHE_KEY, JSON.stringify(agePruned));
  }

  // Now filter the output to only the sources relevant to this device's region.
  const region  = getDeviceRegion();
  const sources = sourcesForRegion(region);
  return agePruned.filter(r => sources.includes(r.source));
}

export async function dismissAllAlerts(pairIds: string[]): Promise<void> {
  if (pairIds.length === 0) return;
  const dismissed = await getDismissed();
  for (const pairId of pairIds) dismissed.add(pairId);
  await KVStore.setItem(DISMISSED_KEY, JSON.stringify([...dismissed]));
  await storeAlerts([]);
}

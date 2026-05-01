import KVStore from 'expo-sqlite/kv-store';
import type { FoodItem } from '@/types/food-item';

// ── Types ──────────────────────────────────────────────────────────────────

export interface RecallItem {
  id: string;
  source: 'FDA' | 'USDA' | 'FSA';
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

// ── API fetchers ───────────────────────────────────────────────────────────

async function fetchFDARecalls(): Promise<RecallItem[]> {
  const res = await fetch(
    'https://api.fda.gov/food/enforcement.json?limit=100&sort=report_date:desc',
    { signal: AbortSignal.timeout(12_000) },
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
  const res = await fetch(
    'https://www.fsis.usda.gov/fsis/api/recall/v/1?field=RecalledDate&direction=desc&limit=50',
    { signal: AbortSignal.timeout(12_000) },
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
  const res = await fetch(
    'https://data.food.gov.uk/food-alerts/v1/?limit=50&sort=-modified',
    { signal: AbortSignal.timeout(12_000) },
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

function itemMatchesRecall(itemName: string, recallDescription: string): boolean {
  if (!recallDescription) return false;

  const itemLower  = itemName.trim().toLowerCase();
  const recallLower = recallDescription.toLowerCase();

  // 1. Direct substring match — most reliable signal.
  //    "Smoked Salmon" inside "Scottish Smoked Salmon Fillets" → match.
  if (recallLower.includes(itemLower)) return true;

  // 2. All significant words from item name appear somewhere in the recall text.
  //    Guards against the item being a single generic word (e.g. "milk").
  const itemTokens = tokenize(itemName);
  if (itemTokens.length >= 2) {
    if (itemTokens.every((t) => recallLower.includes(t))) return true;
  }

  // 3. Token-level intersection — at least one meaningful word matches.
  //    Also catches partial stems: "chicken" matches "chickens", "chickpeas" would not.
  const recallTokens = new Set(tokenize(recallDescription));
  return itemTokens.some((t) =>
    recallTokens.has(t) ||
    // Simple stem check: recall token starts with item token (plural/suffix handling)
    [...recallTokens].some((rt) => rt.startsWith(t) && rt.length <= t.length + 3)
  );
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

// ── Main entry point ───────────────────────────────────────────────────────

export async function runRecallCheck(items: FoodItem[]): Promise<RecallMatch[]> {
  const [fdaResult, usdaResult, fsaResult] = await Promise.allSettled([
    fetchFDARecalls(),
    fetchUSDARecalls(),
    fetchFSARecalls(),
  ]);
  const allRecalls: RecallItem[] = [
    ...(fdaResult.status === 'fulfilled' ? fdaResult.value : []),
    ...(usdaResult.status === 'fulfilled' ? usdaResult.value : []),
    ...(fsaResult.status === 'fulfilled' ? fsaResult.value : []),
  ];

  // Cache the fetched recalls so mid-day item additions can match against them
  // without another network round-trip.
  if (allRecalls.length > 0) {
    await KVStore.setItem(RECALLS_CACHE_KEY, JSON.stringify(allRecalls));
  }

  const dismissed = await getDismissed();
  const matches = matchRecalls(allRecalls, items, dismissed);
  await storeAlerts(matches);
  await setLastCheckDate(new Date().toISOString().split('T')[0]);
  return matches;
}

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

const LAST_CHECK_KEY = '@recall_last_check';
const ALERTS_KEY     = '@recall_alerts';
const DISMISSED_KEY  = '@recall_dismissed';

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
    // FSIS API field names vary across versions — try all known variants
    productDescription: String(r.ProductName ?? r.field_title ?? r.RecallTitle ?? r.title ?? ''),
    reason: String(r.ReasonforRecall ?? r.field_recall_reason ?? r.Reason ?? ''),
    date: String(r.RecalledDate ?? r.field_recalled_date ?? ''),
    riskLevel: String(r.RiskLevel ?? r.field_risk_level ?? ''),
  }));
}

// FSA Food Alerts API (UK Food Standards Agency) — free, no key required.
// Docs: https://data.food.gov.uk/food-alerts/v1/
async function fetchFSARecalls(): Promise<RecallItem[]> {
  const res = await fetch(
    'https://data.food.gov.uk/food-alerts/v1/?limit=50&sort=-modified',
    { signal: AbortSignal.timeout(12_000) },
  );
  if (!res.ok) return [];
  const json = await res.json() as { items?: Record<string, unknown>[] };
  return (json.items ?? []).map((r, i) => {
    // productDetails is an array; join all product names for matching.
    const details = Array.isArray(r.productDetails) ? r.productDetails as Record<string, string>[] : [];
    const productDescription = details
      .map((d) => [d.productName, d.brandName].filter(Boolean).join(' '))
      .filter(Boolean)
      .join(', ') || String(r.title ?? '');
    const problem = Array.isArray(r.problem) ? r.problem as Record<string, string>[] : [];
    const reason = problem.map((p) => p.description).filter(Boolean).join('; ')
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

// Words that appear in food recall text but carry no signal for matching.
const STOP_WORDS = new Set([
  'with', 'from', 'that', 'this', 'have', 'each', 'than', 'them',
  'they', 'will', 'been', 'were', 'said', 'what', 'when', 'your',
  'also', 'into', 'more', 'some', 'such', 'used', 'most', 'over',
  'only', 'both', 'very', 'brand', 'item', 'items', 'food', 'product',
  'products', 'size', 'pack', 'case', 'label',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP_WORDS.has(w));
}

function matchRecalls(
  recalls: RecallItem[],
  items: FoodItem[],
  dismissed: Set<string>,
): RecallMatch[] {
  const matches: RecallMatch[] = [];
  for (const item of items) {
    const itemTokens = tokenize(item.name);
    if (itemTokens.length === 0) continue;
    for (const recall of recalls) {
      if (!recall.productDescription) continue;
      const pairId = `${recall.id}:${item.id}`;
      if (dismissed.has(pairId)) continue;
      const recallTokens = new Set(tokenize(recall.productDescription));
      if (itemTokens.some((t) => recallTokens.has(t))) {
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
  // Also prune from stored alerts so they don't reappear on cold start.
  const alerts = await getStoredAlerts();
  await storeAlerts(alerts.filter((a) => a.pairId !== pairId));
}

export async function shouldRunCheck(): Promise<boolean> {
  const last = await getLastCheckDate();
  return last !== new Date().toISOString().split('T')[0];
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
  const dismissed = await getDismissed();
  const matches = matchRecalls(allRecalls, items, dismissed);
  await storeAlerts(matches);
  await setLastCheckDate(new Date().toISOString().split('T')[0]);
  return matches;
}

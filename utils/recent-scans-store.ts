import KVStore from 'expo-sqlite/kv-store';

const KEY = '@recent_scans_v1';
const MAX = 20;

export interface RecentScan {
  barcode: string;
  name: string;
  nutriScore?: string;
  novaGroup?: number;
  rawScore?: number;     // USDA-derived 0–100 score
  scannedAt: string;    // ISO timestamp
}

export async function saveRecentScan(scan: RecentScan): Promise<void> {
  try {
    const existing = await getRecentScans();
    // Deduplicate by barcode — latest scan wins
    const deduped = existing.filter((s) => s.barcode !== scan.barcode);
    const updated = [scan, ...deduped].slice(0, MAX);
    await KVStore.setItem(KEY, JSON.stringify(updated));
  } catch {
    // non-critical; swallow errors
  }
}

export async function getRecentScans(): Promise<RecentScan[]> {
  try {
    const val = await KVStore.getItem(KEY);
    if (!val) return [];
    return JSON.parse(val) as RecentScan[];
  } catch {
    return [];
  }
}

import KVStore from 'expo-sqlite/kv-store';
import { generateId } from './id';

export type ConsumptionType = 'used' | 'wasted';

export interface ConsumptionEvent {
  id: string;
  itemId: string;
  itemName: string;
  category: string;
  type: ConsumptionType;
  quantity: number;
  unit: string;
  recordedAt: string;
}

export interface ConsumptionStats {
  totalUsed: number;
  totalWasted: number;
  wasteRate: number;
  thisMonth: { used: number; wasted: number };
}

const STORE_KEY = '@consumption_events';

export async function recordConsumption(
  itemId: string,
  itemName: string,
  category: string,
  type: ConsumptionType,
  quantity: number,
  unit: string,
): Promise<void> {
  const event: ConsumptionEvent = {
    id: generateId(),
    itemId,
    itemName,
    category,
    type,
    quantity,
    unit,
    recordedAt: new Date().toISOString(),
  };
  const existing = await getConsumptionEvents();
  const updated = [event, ...existing].slice(0, 500);
  await KVStore.setItem(STORE_KEY, JSON.stringify(updated));
}

export async function getConsumptionEvents(): Promise<ConsumptionEvent[]> {
  try {
    const raw = await KVStore.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function getConsumptionStats(): Promise<ConsumptionStats> {
  const events = await getConsumptionEvents();
  const totalUsed = events.filter((e) => e.type === 'used').length;
  const totalWasted = events.filter((e) => e.type === 'wasted').length;
  const total = totalUsed + totalWasted;
  const wasteRate = total > 0 ? Math.round((totalWasted / total) * 100) : 0;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const thisMonthEvents = events.filter((e) => e.recordedAt >= monthStart);

  return {
    totalUsed,
    totalWasted,
    wasteRate,
    thisMonth: {
      used: thisMonthEvents.filter((e) => e.type === 'used').length,
      wasted: thisMonthEvents.filter((e) => e.type === 'wasted').length,
    },
  };
}

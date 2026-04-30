import * as Notifications from 'expo-notifications';
import KVStore from 'expo-sqlite/kv-store';
import type { FoodItemWithStatus } from '@/types/food-item';

const WIDGET_DATA_KEY = '@widget_data';
const DIGEST_NOTIF_ID_KEY = '@digest_notification_id';
export const DIGEST_ENABLED_KEY = '@digest_enabled';

export interface WidgetData {
  expiringCount: number;
  expiredCount: number;
  totalItems: number;
  topExpiring: { name: string; daysUntilExpiry: number }[];
  updatedAt: string;
}

export async function syncWidgetData(items: FoodItemWithStatus[]): Promise<void> {
  const expired = items.filter((i) => i.status === 'expired');
  const expiringSoon = items.filter((i) => i.status === 'expiring_soon');
  const topExpiring = [...expiringSoon, ...expired]
    .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)
    .slice(0, 5)
    .map((i) => ({ name: i.name, daysUntilExpiry: i.daysUntilExpiry }));

  const data: WidgetData = {
    expiringCount: expiringSoon.length,
    expiredCount: expired.length,
    totalItems: items.length,
    topExpiring,
    updatedAt: new Date().toISOString(),
  };

  await KVStore.setItem(WIDGET_DATA_KEY, JSON.stringify(data));
}

export async function getWidgetData(): Promise<WidgetData | null> {
  try {
    const raw = await KVStore.getItem(WIDGET_DATA_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function scheduleDailyDigest(items: FoodItemWithStatus[]): Promise<void> {
  const existingId = await KVStore.getItem(DIGEST_NOTIF_ID_KEY);
  if (existingId) {
    try { await Notifications.cancelScheduledNotificationAsync(existingId); } catch { /* ignore */ }
  }

  const urgent = items.filter((i) => i.status === 'expiring_soon' || i.status === 'expired');
  if (urgent.length === 0) {
    await KVStore.setItem(DIGEST_NOTIF_ID_KEY, '');
    return;
  }

  const sorted = [...urgent].sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  const top3 = sorted.slice(0, 3);

  const itemList = top3.map((i) => {
    if (i.daysUntilExpiry <= 0) return `${i.name} (expired)`;
    if (i.daysUntilExpiry === 1) return `${i.name} (today)`;
    return `${i.name} (${i.daysUntilExpiry}d)`;
  }).join(', ');

  const body =
    `${urgent.length} item${urgent.length !== 1 ? 's' : ''} need attention: ${itemList}` +
    (urgent.length > 3 ? ` +${urgent.length - 3} more` : '');

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Fresh Track — Daily Pantry Update',
        body,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 9,
        minute: 0,
      },
    });
    await KVStore.setItem(DIGEST_NOTIF_ID_KEY, id);
  } catch {
    // Notifications not permitted or not available
  }
}

export async function cancelDailyDigest(): Promise<void> {
  const existingId = await KVStore.getItem(DIGEST_NOTIF_ID_KEY);
  if (existingId) {
    try { await Notifications.cancelScheduledNotificationAsync(existingId); } catch { /* ignore */ }
    await KVStore.setItem(DIGEST_NOTIF_ID_KEY, '');
  }
}

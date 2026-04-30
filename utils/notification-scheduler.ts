import * as Notifications from 'expo-notifications';
import KVStore from 'expo-sqlite/kv-store';
import type { FoodItem } from '@/types/food-item';
import { shelfLifeDays } from './food-item-utils';

// Suppress OS banners when app is in foreground — the in-app NotificationBanner handles display.
// When the app is backgrounded/closed, iOS shows scheduled notifications normally.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: false,
    shouldShowList: false,
  }),
});

export interface AlertThresholds {
  tier1: number; // shelf life < 5 days  → alert this many days before
  tier2: number; // shelf life 5–14 days
  tier3: number; // shelf life 15–29 days
  tier4: number; // shelf life 30+ days
}

export const DEFAULT_THRESHOLDS: AlertThresholds = {
  tier1: 1,
  tier2: 3,
  tier3: 7,
  tier4: 30,
};

const THRESHOLDS_KEY = '@alert_thresholds';

export async function getAlertThresholds(): Promise<AlertThresholds> {
  const raw = await KVStore.getItem(THRESHOLDS_KEY);
  if (!raw) return DEFAULT_THRESHOLDS;
  try {
    return { ...DEFAULT_THRESHOLDS, ...(JSON.parse(raw) as Partial<AlertThresholds>) };
  } catch {
    return DEFAULT_THRESHOLDS;
  }
}

export async function saveAlertThresholds(thresholds: AlertThresholds): Promise<void> {
  await KVStore.setItem(THRESHOLDS_KEY, JSON.stringify(thresholds));
}

function getAlertDaysBefore(lifeDays: number, t: AlertThresholds): number {
  if (lifeDays < 5) return t.tier1;
  if (lifeDays < 15) return t.tier2;
  if (lifeDays < 30) return t.tier3;
  return t.tier4;
}

const LOCATION_LABEL: Record<FoodItem['storageLocation'], string> = {
  fridge: 'fridge',
  freezer: 'freezer',
  pantry: 'pantry',
};

export async function cancelItemNotifications(ids: string[]): Promise<void> {
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
}

export async function scheduleItemNotification(item: FoodItem): Promise<string[]> {
  await cancelItemNotifications(item.notificationIds);

  const lifeDays = shelfLifeDays(item.purchaseDate, item.expiryDate);
  const thresholds = await getAlertThresholds();
  const alertDaysBefore = getAlertDaysBefore(lifeDays, thresholds);

  const expiryMs = new Date(item.expiryDate + 'T09:00:00').getTime();
  const triggerMs = expiryMs - alertDaysBefore * 24 * 60 * 60 * 1000;
  const triggerDate = new Date(triggerMs);

  if (triggerDate <= new Date()) {
    return [];
  }

  const label = alertDaysBefore === 1 ? '1 day' : `${alertDaysBefore} days`;
  const location = LOCATION_LABEL[item.storageLocation];

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: `${item.name} expires soon`,
      body: `Expires in ${label} — check your ${location}`,
      data: { itemId: item.id },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
    },
  });

  return [id];
}

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

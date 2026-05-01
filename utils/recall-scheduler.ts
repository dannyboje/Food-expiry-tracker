import * as Notifications from 'expo-notifications';
import KVStore from 'expo-sqlite/kv-store';

const TRIGGER_ID_KEY = '@recall_trigger_id';

// Schedules (or re-schedules) a daily 8 AM local notification that prompts the
// app to run its recall check when the user opens it.
export async function scheduleDailyRecallCheck(): Promise<void> {
  const existingId = await KVStore.getItem(TRIGGER_ID_KEY);
  if (existingId) {
    await Notifications.cancelScheduledNotificationAsync(existingId).catch(() => {});
  }
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: '🔍 Daily Food Safety Check',
      body: 'Open the app to check your pantry for recalled products.',
      data: { type: 'recall_check' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 9,
      minute: 30,
    },
  });
  await KVStore.setItem(TRIGGER_ID_KEY, id);
}

export async function cancelDailyRecallCheck(): Promise<void> {
  const id = await KVStore.getItem(TRIGGER_ID_KEY);
  if (id) {
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    await KVStore.removeItem(TRIGGER_ID_KEY);
  }
}

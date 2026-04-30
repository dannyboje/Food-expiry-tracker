import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import KVStore from 'expo-sqlite/kv-store';
import { Brand } from '@/constants/theme';
import type { FoodItemWithStatus } from '@/types/food-item';

const DISMISSED_IDS_KEY = '@notification_permanently_dismissed';

interface Props {
  items: FoodItemWithStatus[];
}

export function NotificationBanner({ items }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Session-only dismiss — resets every app launch
  const [sessionDismissed, setSessionDismissed] = useState(false);
  // Permanent dismiss — persisted in KVStore across launches
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    KVStore.getItem(DISMISSED_IDS_KEY).then((raw) => {
      if (!raw) return;
      try {
        setDismissedIds(new Set(JSON.parse(raw) as string[]));
      } catch {}
    });
  }, []);

  const visibleItems = items.filter((i) => !dismissedIds.has(i.id));

  if (visibleItems.length === 0 || sessionDismissed) return null;

  const expired = visibleItems.filter((i) => i.status === 'expired');
  const expiring = visibleItems.filter((i) => i.status === 'expiring_soon');
  const isUrgent = expired.length > 0;

  let message = '';
  if (expired.length > 0 && expiring.length > 0) {
    message = `${expired.length} expired, ${expiring.length} expiring soon`;
  } else if (expired.length > 0) {
    message = expired.length === 1 ? `${expired[0].name} has expired` : `${expired.length} items have expired`;
  } else {
    message = expiring.length === 1 ? `${expiring[0].name} is expiring soon` : `${expiring.length} items expiring soon`;
  }

  async function handleCancelAlways() {
    const allIds = visibleItems.map((i) => i.id);
    const merged = Array.from(new Set([...dismissedIds, ...allIds]));
    await KVStore.setItem(DISMISSED_IDS_KEY, JSON.stringify(merged));
    setDismissedIds(new Set(merged));
  }

  function handleDismissPress() {
    Alert.alert(
      'Hide notification',
      'How long would you like to hide this alert?',
      [
        {
          text: 'Just for now',
          onPress: () => setSessionDismissed(true),
        },
        {
          text: 'Cancel always',
          style: 'destructive',
          onPress: handleCancelAlways,
        },
        { text: 'Back', style: 'cancel' },
      ]
    );
  }

  return (
    <Animated.View
      entering={FadeInDown}
      exiting={FadeOutUp}
      style={[styles.wrapper, { top: insets.top + 8 }]}>
      <View style={[styles.banner, { backgroundColor: isUrgent ? Brand.red : Brand.orange }]}>
        <TouchableOpacity
          style={styles.bannerBody}
          onPress={() => router.push('/(tabs)/pantry')}
          activeOpacity={0.85}>
          <Text style={styles.emoji}>{isUrgent ? '⚠️' : '⏰'}</Text>
          <Text style={styles.text}>{message}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDismissPress} hitSlop={10} style={styles.closeBtn}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 999,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingLeft: 16,
    paddingRight: 10,
    paddingVertical: 12,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  bannerBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  emoji: {
    fontSize: 18,
  },
  text: {
    flex: 1,
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  closeBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  closeText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 15,
    fontWeight: '700',
  },
});

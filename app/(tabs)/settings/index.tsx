import { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import KVStore from 'expo-sqlite/kv-store';
import { Brand, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  type AlertThresholds,
  DEFAULT_THRESHOLDS,
  getAlertThresholds,
  saveAlertThresholds,
  requestNotificationPermissions,
} from '@/utils/notification-scheduler';

const NOTIF_PREF_KEY = '@notifications_enabled';

const TIERS: { key: keyof AlertThresholds; shelf: string; min: number; max: number }[] = [
  { key: 'tier1', shelf: 'Under 5 days shelf life', min: 1, max: 4 },
  { key: 'tier2', shelf: '5–14 days shelf life', min: 1, max: 14 },
  { key: 'tier3', shelf: '15–29 days shelf life', min: 1, max: 28 },
  { key: 'tier4', shelf: '30+ days shelf life', min: 1, max: 60 },
];

function Stepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={stepperStyles.row}>
      <TouchableOpacity
        style={[stepperStyles.btn, value <= min && stepperStyles.btnDisabled]}
        onPress={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        hitSlop={6}>
        <Text style={stepperStyles.btnText}>−</Text>
      </TouchableOpacity>
      <Text style={stepperStyles.value}>{value}d</Text>
      <TouchableOpacity
        style={[stepperStyles.btn, value >= max && stepperStyles.btnDisabled]}
        onPress={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        hitSlop={6}>
        <Text style={stepperStyles.btnText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const stepperStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Brand.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { backgroundColor: '#D1D5DB' },
  btnText: { color: '#fff', fontSize: 18, fontWeight: '700', lineHeight: 20 },
  value: { fontSize: 14, fontWeight: '700', minWidth: 30, textAlign: 'center', color: '#111827' },
});

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [thresholds, setThresholds] = useState<AlertThresholds>(DEFAULT_THRESHOLDS);

  useEffect(() => {
    KVStore.getItem(NOTIF_PREF_KEY)
      .then((val) => { if (val !== null) setNotificationsEnabled(val === 'true'); })
      .catch(() => {});
    getAlertThresholds().then(setThresholds).catch(() => {});
  }, []);

  async function toggleNotifications(value: boolean) {
    setNotificationsEnabled(value);
    await KVStore.setItem(NOTIF_PREF_KEY, String(value));
    if (value) await requestNotificationPermissions();
  }

  async function updateTier(key: keyof AlertThresholds, value: number) {
    const updated = { ...thresholds, [key]: value };
    setThresholds(updated);
    await saveAlertThresholds(updated);
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Brand header */}
        <View style={styles.brandHeader}>
          <Image source={require('@/assets/images/logo.png')} style={styles.logo} />
          <Text style={styles.brandName}>FreshAhead</Text>
          <Text style={[styles.tagline, { color: colors.subtext }]}>Track it. Use it. Waste less.</Text>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>⚙️  Settings</Text>

        {/* Notifications toggle */}
        <Text style={[styles.sectionHeader, { color: colors.subtext }]}>NOTIFICATIONS</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.row}>
            <View style={styles.rowContent}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>Expiry Alerts</Text>
              <Text style={[styles.rowSub, { color: colors.subtext }]}>
                Get notified before items expire
              </Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={toggleNotifications}
              trackColor={{ false: colors.border, true: Brand.green }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Alert schedule — editable */}
        <Text style={[styles.sectionHeader, { color: colors.subtext }]}>ALERT SCHEDULE</Text>
        <Text style={[styles.sectionHint, { color: colors.subtext }]}>
          How many days before expiry to send the alert, based on shelf life.
        </Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {TIERS.map((tier, i) => (
            <View
              key={tier.key}
              style={[
                styles.tierRow,
                i < TIERS.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: colors.border,
                },
              ]}>
              <Text style={[styles.tierShelf, { color: colors.subtext }]}>{tier.shelf}</Text>
              <View style={styles.tierRight}>
                <Text style={[styles.tierLabel, { color: colors.text }]}>Alert</Text>
                <Stepper
                  value={thresholds[tier.key]}
                  min={tier.min}
                  max={tier.max}
                  onChange={(v) => updateTier(tier.key, v)}
                />
                <Text style={[styles.tierLabel, { color: colors.text }]}>before</Text>
              </View>
            </View>
          ))}
        </View>

        {/* About */}
        <Text style={[styles.sectionHeader, { color: colors.subtext }]}>ABOUT</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.row, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>App Name</Text>
            <Text style={[styles.rowSub, { color: colors.subtext }]}>FreshAhead</Text>
          </View>
          <View style={styles.row}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>Version</Text>
            <Text style={[styles.rowSub, { color: colors.subtext }]}>1.0.0</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  brandHeader: { alignItems: 'center', paddingTop: 24, paddingBottom: 8, gap: 6 },
  logo: { width: 72, height: 72, resizeMode: 'contain' },
  brandName: { fontSize: 26, fontWeight: '800', color: '#1A5C2A' },
  tagline: { fontSize: 12, fontWeight: '500', letterSpacing: 0.4 },
  title: { fontSize: 20, fontWeight: '700', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  sectionHeader: {
    fontSize: 12, fontWeight: '600', letterSpacing: 0.6,
    paddingHorizontal: 16, paddingTop: 20, paddingBottom: 4,
  },
  sectionHint: {
    fontSize: 12, paddingHorizontal: 16, paddingBottom: 8, lineHeight: 16,
  },
  card: {
    marginHorizontal: 16, borderRadius: 12, borderWidth: 1, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, justifyContent: 'space-between',
  },
  rowContent: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: '500' },
  rowSub: { fontSize: 13 },
  tierRow: { paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
  tierShelf: { fontSize: 12, fontWeight: '500' },
  tierRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tierLabel: { fontSize: 13, fontWeight: '500' },
});

import {
  Alert, Image, ScrollView, StyleSheet, Switch, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import KVStore from 'expo-sqlite/kv-store';
import { getConsumptionStats, resetConsumptionEvents, type ConsumptionStats } from '@/utils/consumption-store';
import { DIGEST_ENABLED_KEY, scheduleDailyDigest, cancelDailyDigest } from '@/utils/widget-data-sync';
import { usePantry } from '@/hooks/use-pantry';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { BgFoodDecor, HeaderFoodDecor } from '@/components/ui/food-decor';
import { Brand, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  type HouseholdProfile,
  addMember,
  createHousehold,
  loadHousehold,
  removeMember,
  updateMemberEmoji,
  updateProfile,
} from '@/utils/household-storage';
import { persistPhoto, resolvePhotoUri } from '@/utils/photo-storage';
import {
  type AlertThresholds,
  DEFAULT_THRESHOLDS,
  getAlertThresholds,
  saveAlertThresholds,
  requestNotificationPermissions,
} from '@/utils/notification-scheduler';

const NOTIF_PREF_KEY = '@notifications_enabled';

const EMOJI_OPTIONS = [
  '👤', '👦', '👧', '👨', '👩', '🧑', '👴', '👵', '🧒', '👶',
  '🧔', '👱', '🧕', '🎅', '🤶', '🧙', '🦸', '🦹', '😀', '😎',
  '🤓', '😏', '🤗', '😄', '😸', '🐱', '🐶', '🦊', '🐻', '🐼',
  '🦁', '🐯', '🐨', '🐸', '🦄', '🐲', '🐙', '🦋', '🌟', '🍀',
];

const TIERS: { key: keyof AlertThresholds; shelf: string; min: number; max: number }[] = [
  { key: 'tier1', shelf: 'Under 5 days shelf life', min: 1, max: 4 },
  { key: 'tier2', shelf: '5–14 days shelf life', min: 1, max: 14 },
  { key: 'tier3', shelf: '15–29 days shelf life', min: 1, max: 28 },
  { key: 'tier4', shelf: '30+ days shelf life', min: 1, max: 60 },
];

function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
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
  btn: { width: 30, height: 30, borderRadius: 15, backgroundColor: Brand.green, alignItems: 'center', justifyContent: 'center' },
  btnDisabled: { backgroundColor: '#D1D5DB' },
  btnText: { color: '#fff', fontSize: 18, fontWeight: '700', lineHeight: 20 },
  value: { fontSize: 14, fontWeight: '700', minWidth: 30, textAlign: 'center', color: '#111827' },
});

type Screen = 'loading' | 'setup' | 'dashboard';

export default function HouseholdScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [screen, setScreen] = useState<Screen>('loading');
  const [profile, setProfile] = useState<HouseholdProfile | null>(null);

  // Setup form state
  const [displayName, setDisplayName] = useState('');
  const [householdName, setHouseholdName] = useState('');

  // Add member
  const [newMemberName, setNewMemberName] = useState('');
  const [showAddMember, setShowAddMember] = useState(false);

  // Emoji picker
  const [pickingEmojiForMemberId, setPickingEmojiForMemberId] = useState<string | null>(null);

  // Edit profile
  const [editingName, setEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');

  // Settings state
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [thresholds, setThresholds] = useState<AlertThresholds>(DEFAULT_THRESHOLDS);
  const [digestEnabled, setDigestEnabled] = useState(false);
  const [consumptionStats, setConsumptionStats] = useState<ConsumptionStats | null>(null);
  const { enrichedItems, clearAllPantryItems, clearRecentPantryItems } = usePantry();

  useEffect(() => {
    loadHousehold().then((p) => {
      setProfile(p);
      setScreen(p ? 'dashboard' : 'setup');
    });
    KVStore.getItem(NOTIF_PREF_KEY)
      .then((val) => { if (val !== null) setNotificationsEnabled(val === 'true'); })
      .catch(() => {});
    KVStore.getItem(DIGEST_ENABLED_KEY)
      .then((val) => { if (val !== null) setDigestEnabled(val === 'true'); })
      .catch(() => {});
    getAlertThresholds().then(setThresholds).catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => {
    getConsumptionStats().then(setConsumptionStats).catch(() => {});
  }, []));

  async function toggleNotifications(value: boolean) {
    setNotificationsEnabled(value);
    await KVStore.setItem(NOTIF_PREF_KEY, String(value));
    if (value) await requestNotificationPermissions();
  }

  async function toggleDigest(value: boolean) {
    setDigestEnabled(value);
    await KVStore.setItem(DIGEST_ENABLED_KEY, String(value));
    if (value) {
      await requestNotificationPermissions();
      await scheduleDailyDigest(enrichedItems);
    } else {
      await cancelDailyDigest();
    }
  }

  async function updateTier(key: keyof AlertThresholds, value: number) {
    const updated = { ...thresholds, [key]: value };
    setThresholds(updated);
    await saveAlertThresholds(updated);
  }

  async function handleCreate() {
    if (!displayName.trim()) {
      Alert.alert('Name required', 'Please enter your name.');
      return;
    }
    if (!householdName.trim()) {
      Alert.alert('Household name required', 'Please enter a household name.');
      return;
    }
    const p = await createHousehold(displayName.trim(), householdName.trim());
    setProfile(p);
    setScreen('dashboard');
  }

  async function handleAddMember() {
    if (!newMemberName.trim() || !profile) return;
    const updated = await addMember(profile, newMemberName.trim());
    setProfile(updated);
    setNewMemberName('');
    setShowAddMember(false);
  }

  async function handlePickEmoji(memberId: string, emoji: string) {
    if (!profile) return;
    const updated = await updateMemberEmoji(profile, memberId, emoji);
    setProfile(updated);
    setPickingEmojiForMemberId(null);
  }

  async function handleRemoveMember(memberId: string, memberName: string) {
    if (!profile) return;
    if (profile.members.find((m) => m.id === memberId)?.role === 'owner') {
      Alert.alert('Cannot remove', 'The owner cannot be removed from the household.');
      return;
    }
    Alert.alert(`Remove ${memberName}?`, '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          const updated = await removeMember(profile, memberId);
          setProfile(updated);
        },
      },
    ]);
  }

  async function handleSaveHouseholdName() {
    if (!profile || !editedName.trim()) return;
    const updated = await updateProfile(profile, { householdName: editedName.trim() });
    setProfile(updated);
    setEditingName(false);
  }

  async function handlePickProfileImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library in Settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0] && profile) {
      const permanentUri = await persistPhoto(result.assets[0].uri, 'profile');
      const updated = await updateProfile(profile, { imageUri: permanentUri });
      setProfile(updated);
    }
  }

  function handleClearRecent() {
    Alert.alert(
      'Clear recent items?',
      'This will permanently remove all pantry items added in the last 24 hours.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: () => clearRecentPantryItems().catch(() => {}) },
      ],
    );
  }

  function handleClearAll() {
    Alert.alert(
      'Clear entire pantry?',
      'This will permanently delete ALL items from your pantry. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear everything', style: 'destructive', onPress: () => clearAllPantryItems().catch(() => {}) },
      ],
    );
  }

  function handleResetStats() {
    Alert.alert(
      'Reset Food Waste Tracker?',
      'This will permanently delete all your usage and waste history. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset', style: 'destructive',
          onPress: async () => {
            await resetConsumptionEvents();
            const fresh = await getConsumptionStats();
            setConsumptionStats(fresh);
          },
        },
      ],
    );
  }

  if (screen === 'loading') {
    return <View style={[styles.container, { backgroundColor: colors.background }]} />;
  }

  if (screen === 'setup') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <BgFoodDecor />
        <LinearGradient
          colors={['#8BD1A5', '#91E2AF', '#A5EFC0']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.setupGradient}>
          <HeaderFoodDecor />
          <SafeAreaView edges={['top']}>
            <Text style={styles.setupHeaderTitle}>👨‍👩‍👧‍👦  Household</Text>
            <Text style={styles.setupHeaderSub}>Create your household profile</Text>
          </SafeAreaView>
        </LinearGradient>

        <ScrollView contentContainerStyle={styles.setupForm} keyboardShouldPersistTaps="handled">
          <View style={styles.setupCard}>
            <Text style={[styles.setupLabel, { color: colors.subtext }]}>YOUR NAME</Text>
            <TextInput
              style={[styles.setupInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="e.g. Alex"
              placeholderTextColor={colors.subtext}
              autoFocus
            />

            <Text style={[styles.setupLabel, { color: colors.subtext, marginTop: 16 }]}>HOUSEHOLD NAME</Text>
            <TextInput
              style={[styles.setupInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
              value={householdName}
              onChangeText={setHouseholdName}
              placeholder="e.g. The Smith Family"
              placeholderTextColor={colors.subtext}
            />

            <TouchableOpacity style={styles.createBtn} onPress={handleCreate}>
              <Text style={styles.createBtnText}>Create Household</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // Dashboard
  const p = profile!;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <BgFoodDecor />
      {/* Gradient header */}
      <LinearGradient
        colors={['#8BD1A5', '#91E2AF', '#A5EFC0']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.dashGradient}>
        <HeaderFoodDecor />
        <SafeAreaView edges={['top']}>
          <View style={styles.dashHeader}>
            {/* Profile avatar — tap to change */}
            <TouchableOpacity onPress={handlePickProfileImage} style={styles.avatarContainer} activeOpacity={0.8}>
              {resolvePhotoUri(p.imageUri) ? (
                <Image source={{ uri: resolvePhotoUri(p.imageUri) }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarEmoji}>
                  <Text style={styles.avatarEmojiText}>{p.userEmoji}</Text>
                </View>
              )}
              <View style={styles.avatarEditBadge}>
                <IconSymbol name="camera.fill" size={10} color="#fff" />
              </View>
            </TouchableOpacity>

            <View style={styles.dashNameBlock}>
              <Text style={styles.dashWelcome}>Welcome back,</Text>
              <Text style={styles.dashName}>{p.displayName}</Text>
            </View>
          </View>

          {/* Household name */}
          <View style={styles.householdNameRow}>
            {editingName ? (
              <View style={styles.editNameRow}>
                <TextInput
                  style={styles.editNameInput}
                  value={editedName}
                  onChangeText={setEditedName}
                  autoFocus
                  onSubmitEditing={handleSaveHouseholdName}
                  returnKeyType="done"
                />
                <TouchableOpacity onPress={handleSaveHouseholdName} style={styles.editSaveBtn}>
                  <IconSymbol name="checkmark" size={18} color="#166534" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => { setEditedName(p.householdName); setEditingName(true); }}
                style={styles.householdNameBtn}>
                <Text style={styles.householdName}>{p.householdName}</Text>
                <IconSymbol name="pencil" size={14} color="rgba(22, 101, 52, 0.6)" />
              </TouchableOpacity>
            )}
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.dashContent} showsVerticalScrollIndicator={false}>

        {/* Members card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.cardTitle, { color: colors.subtext }]}>MEMBERS ({p.members.length})</Text>
            <TouchableOpacity onPress={() => setShowAddMember(true)}>
              <Text style={[styles.addMemberLink, { color: Brand.green }]}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {p.members.map((member, i) => {
            const isPickingThis = pickingEmojiForMemberId === member.id;
            return (
              <View key={member.id}>
                <View style={styles.memberRow}>
                  <TouchableOpacity
                    style={[styles.memberAvatar, isPickingThis && styles.memberAvatarActive]}
                    onPress={() => setPickingEmojiForMemberId(isPickingThis ? null : member.id)}
                    activeOpacity={0.7}
                    hitSlop={4}>
                    <Text style={styles.memberEmoji}>{member.emoji}</Text>
                  </TouchableOpacity>
                  <View style={styles.memberInfo}>
                    <Text style={[styles.memberName, { color: colors.text }]}>{member.name}</Text>
                    <Text style={[styles.memberRole, { color: colors.subtext }]}>
                      {member.role === 'owner' ? '👑 Owner' : '✓ Member'}
                    </Text>
                  </View>
                  {member.role !== 'owner' && (
                    <TouchableOpacity
                      onPress={() => handleRemoveMember(member.id, member.name)}
                      style={styles.removeMemberBtn}>
                      <IconSymbol name="xmark" size={14} color={colors.subtext} />
                    </TouchableOpacity>
                  )}
                </View>

                {isPickingThis && (
                  <View style={[styles.emojiGrid, { borderTopColor: colors.border }]}>
                    {EMOJI_OPTIONS.map((e) => (
                      <TouchableOpacity
                        key={e}
                        style={[styles.emojiOption, member.emoji === e && styles.emojiOptionSelected]}
                        onPress={() => handlePickEmoji(member.id, e)}
                        activeOpacity={0.6}>
                        <Text style={styles.emojiOptionText}>{e}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {i < p.members.length - 1 && (
                  <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />
                )}
              </View>
            );
          })}

          {showAddMember && (
            <View style={[styles.addMemberRow, { borderTopColor: colors.border }]}>
              <TextInput
                style={[styles.addMemberInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                value={newMemberName}
                onChangeText={setNewMemberName}
                placeholder="Member name"
                placeholderTextColor={colors.subtext}
                autoFocus
                onSubmitEditing={handleAddMember}
                returnKeyType="done"
              />
              <TouchableOpacity style={styles.addMemberSubmit} onPress={handleAddMember}>
                <Text style={styles.addMemberSubmitText}>Add</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={[styles.comingSoonRow, { borderTopColor: colors.border }]}>
            <Text style={styles.comingSoonIcon}>🔮</Text>
            <Text style={[styles.comingSoonText, { color: colors.subtext }]}>
              <Text style={{ fontWeight: '600' }}>Shared household access</Text> — real-time pantry sync across multiple devices is on the way.
            </Text>
          </View>
        </View>

        {/* ── Food Waste Stats ──────────────────────── */}
        {consumptionStats !== null && (consumptionStats.totalUsed + consumptionStats.totalWasted) > 0 && (
          <>
            <Text style={[styles.settingsSub, { color: colors.subtext }]}>FOOD WASTE TRACKER</Text>
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.statsRow}>
                <View style={styles.statCell}>
                  <Text style={[styles.statNumber, { color: Brand.green }]}>{consumptionStats.thisMonth.used}</Text>
                  <Text style={[styles.statLabel, { color: colors.subtext }]}>Used this month</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <View style={styles.statCell}>
                  <Text style={[styles.statNumber, { color: '#EF4444' }]}>{consumptionStats.thisMonth.wasted}</Text>
                  <Text style={[styles.statLabel, { color: colors.subtext }]}>Wasted this month</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <View style={styles.statCell}>
                  <Text style={[styles.statNumber, { color: consumptionStats.wasteRate > 30 ? '#EF4444' : consumptionStats.wasteRate > 15 ? '#F97316' : Brand.green }]}>
                    {consumptionStats.wasteRate}%
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.subtext }]}>Waste rate</Text>
                </View>
              </View>
              <Text style={[styles.statsHint, { color: colors.subtext }]}>
                Long-press any pantry item to mark it as used or wasted.
              </Text>
              <TouchableOpacity onPress={handleResetStats} style={styles.resetBtn}>
                <IconSymbol name="arrow.counterclockwise" size={13} color="#EF4444" />
                <Text style={styles.resetBtnText}>Reset tracker</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {consumptionStats !== null && (consumptionStats.totalUsed + consumptionStats.totalWasted) === 0 && (
          <>
            <Text style={[styles.settingsSub, { color: colors.subtext }]}>FOOD WASTE TRACKER</Text>
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.codeHint, { color: colors.subtext }]}>
                Long-press any pantry item and tap "I used it" or "It expired / wasted" to start tracking your food usage.
              </Text>
            </View>
          </>
        )}

        {/* ── Settings ─────────────────────────────── */}
        <View style={styles.settingsHeading}>
          <IconSymbol name="gear" size={16} color={colors.subtext} />
          <Text style={[styles.settingsTitle, { color: colors.subtext }]}>SETTINGS</Text>
        </View>

        {/* Notifications toggle */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.settingsRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingsRowTitle, { color: colors.text }]}>Expiry Alerts</Text>
              <Text style={[styles.settingsRowSub, { color: colors.subtext }]}>
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
          <View style={styles.settingsRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingsRowTitle, { color: colors.text }]}>Daily Pantry Digest</Text>
              <Text style={[styles.settingsRowSub, { color: colors.subtext }]}>
                Morning summary of items needing attention (9 AM)
              </Text>
            </View>
            <Switch
              value={digestEnabled}
              onValueChange={toggleDigest}
              trackColor={{ false: colors.border, true: Brand.green }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Alert schedule */}
        <Text style={[styles.settingsSub, { color: colors.subtext }]}>ALERT SCHEDULE</Text>
        <Text style={[styles.settingsHint, { color: colors.subtext }]}>
          Days before expiry to send the alert, based on shelf life.
        </Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {TIERS.map((tier, i) => (
            <View
              key={tier.key}
              style={[
                styles.tierRow,
                i < TIERS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
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

        {/* ── Data Management ───────────────────────── */}
        <Text style={[styles.settingsSub, { color: colors.subtext }]}>DATA MANAGEMENT</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.dangerRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
            onPress={handleClearRecent}
            activeOpacity={0.7}>
            <IconSymbol name="clock.arrow.trianglehead.counterclockwise.rotate.90" size={16} color="#F97316" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.dangerTitle, { color: colors.text }]}>Clear last 24 hours</Text>
              <Text style={[styles.dangerSub, { color: colors.subtext }]}>Remove items added in the past 24 hours</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dangerRow}
            onPress={handleClearAll}
            activeOpacity={0.7}>
            <IconSymbol name="trash" size={16} color="#EF4444" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.dangerTitle, { color: '#EF4444' }]}>Clear entire pantry</Text>
              <Text style={[styles.dangerSub, { color: colors.subtext }]}>Delete all items and start fresh</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* About */}
        <Text style={[styles.settingsSub, { color: colors.subtext }]}>ABOUT</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.settingsRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
            <Text style={[styles.settingsRowTitle, { color: colors.text }]}>App Name</Text>
            <Text style={[styles.settingsRowSub, { color: colors.subtext }]}>Fresh Ahead</Text>
          </View>
          <View style={styles.settingsRow}>
            <Text style={[styles.settingsRowTitle, { color: colors.text }]}>Version</Text>
            <Text style={[styles.settingsRowSub, { color: colors.subtext }]}>1.0.0</Text>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Setup
  setupGradient: { paddingBottom: 20 },
  setupHeaderTitle: { fontSize: 24, fontWeight: '800', color: '#166534', paddingHorizontal: 20, paddingTop: 12 },
  setupHeaderSub: { fontSize: 14, color: 'rgba(22, 101, 52, 0.75)', paddingHorizontal: 20, marginTop: 2 },
  setupForm: { padding: 16, gap: 0 },
  setupCard: { gap: 4 },
  setupLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 4, marginTop: 4 },
  setupInput: {
    height: 48, borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 14, fontSize: 16,
  },
  createBtn: {
    marginTop: 20, backgroundColor: Brand.green,
    paddingVertical: 14, borderRadius: 14, alignItems: 'center',
  },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  // Dashboard gradient header
  dashGradient: { paddingBottom: 16 },
  dashHeader: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 14 },
  dashNameBlock: { flex: 1 },
  dashWelcome: { color: 'rgba(22, 101, 52, 0.7)', fontSize: 13 },
  dashName: { color: '#166534', fontSize: 22, fontWeight: '800' },
  avatarContainer: { position: 'relative' },
  avatarImage: {
    width: 56, height: 56, borderRadius: 28,
    borderWidth: 2, borderColor: 'rgba(22, 101, 52, 0.35)',
  },
  avatarEmoji: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(22, 101, 52, 0.25)',
  },
  avatarEmojiText: { fontSize: 26 },
  avatarEditBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: Brand.green,
    borderWidth: 2, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  householdNameRow: { paddingHorizontal: 20, paddingBottom: 4 },
  householdNameBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  householdName: { color: 'rgba(22, 101, 52, 0.85)', fontSize: 15, fontWeight: '600' },
  editNameRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  editNameInput: {
    flex: 1, color: '#166534', borderBottomWidth: 1,
    borderBottomColor: 'rgba(22, 101, 52, 0.3)', fontSize: 15, paddingVertical: 4,
  },
  editSaveBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(22, 101, 52, 0.12)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Dashboard content
  dashContent: { padding: 16, gap: 16 },
  card: {
    borderRadius: 16, borderWidth: 1, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cardTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 10 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  addMemberLink: { fontSize: 14, fontWeight: '600' },

  // Members
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  memberAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Brand.greenLight, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'transparent',
  },
  memberAvatarActive: {
    borderColor: Brand.green,
  },
  memberEmoji: { fontSize: 20 },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 15, fontWeight: '600' },
  memberRole: { fontSize: 12, marginTop: 2 },
  removeMemberBtn: { padding: 8 },
  emojiGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 4, paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  emojiOption: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  emojiOptionSelected: { backgroundColor: Brand.greenLight },
  emojiOptionText: { fontSize: 22 },

  // Add member
  addMemberRow: {
    flexDirection: 'row', gap: 8, marginTop: 10,
    paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth,
  },
  addMemberInput: { flex: 1, height: 40, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, fontSize: 15 },
  addMemberSubmit: { backgroundColor: Brand.green, paddingHorizontal: 16, borderRadius: 10, justifyContent: 'center' },
  addMemberSubmitText: { color: '#fff', fontWeight: '700' },
  comingSoonRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    marginTop: 12, paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  comingSoonIcon: { fontSize: 14, lineHeight: 18 },
  comingSoonText: { flex: 1, fontSize: 12, lineHeight: 17 },

  // Settings section
  settingsHeading: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4, marginTop: 8 },
  settingsTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6 },
  settingsSub: { fontSize: 12, fontWeight: '600', letterSpacing: 0.6, marginTop: 12 },
  settingsHint: { fontSize: 12, lineHeight: 16, marginBottom: 4 },
  settingsRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, justifyContent: 'space-between',
  },
  settingsRowTitle: { fontSize: 15, fontWeight: '500' },
  settingsRowSub: { fontSize: 13 },
  tierRow: { paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
  tierShelf: { fontSize: 12, fontWeight: '500' },
  tierRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tierLabel: { fontSize: 13, fontWeight: '500' },
  // Consumption stats
  statsRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  statCell: { flex: 1, alignItems: 'center', gap: 4 },
  statDivider: { width: StyleSheet.hairlineWidth, height: 40 },
  statNumber: { fontSize: 28, fontWeight: '900' },
  statLabel: { fontSize: 11, textAlign: 'center' },
  statsHint: { fontSize: 12, marginTop: 10, lineHeight: 16 },
  resetBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-end', marginTop: 12, padding: 6,
  },
  resetBtnText: { fontSize: 12, fontWeight: '600', color: '#EF4444' },
  dangerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 4, paddingVertical: 14,
  },
  dangerTitle: { fontSize: 15, fontWeight: '500' },
  dangerSub: { fontSize: 12, marginTop: 2 },
});

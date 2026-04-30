import {
  Alert, Clipboard, Image, ScrollView, StyleSheet, Switch, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import KVStore from 'expo-sqlite/kv-store';
import { getConsumptionStats, type ConsumptionStats } from '@/utils/consumption-store';
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
  regenerateCode,
  removeMember,
  updateProfile,
} from '@/utils/household-storage';
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

  // Join by code
  const [joinCode, setJoinCode] = useState('');
  const [showJoin, setShowJoin] = useState(false);

  // Add member
  const [newMemberName, setNewMemberName] = useState('');
  const [showAddMember, setShowAddMember] = useState(false);

  // Edit profile
  const [editingName, setEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');

  // Settings state
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [thresholds, setThresholds] = useState<AlertThresholds>(DEFAULT_THRESHOLDS);
  const [digestEnabled, setDigestEnabled] = useState(false);
  const [consumptionStats, setConsumptionStats] = useState<ConsumptionStats | null>(null);
  const { enrichedItems } = usePantry();

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
    getConsumptionStats().then(setConsumptionStats).catch(() => {});
  }, []);

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

  async function handleJoinCode() {
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) {
      Alert.alert('Invalid code', 'Household codes are 6 characters long.');
      return;
    }
    // In a local-only app, joining means updating the displayed code.
    // Full sync requires a backend — this stores intent locally.
    Alert.alert(
      'Code Saved',
      `Code "${code}" saved. Share this code with family members so they can add it on their devices.\n\nFull sync across devices will be available in a future update.`,
      [{ text: 'OK', onPress: () => setShowJoin(false) }]
    );
    setJoinCode('');
  }

  async function handleAddMember() {
    if (!newMemberName.trim() || !profile) return;
    const updated = await addMember(profile, newMemberName.trim());
    setProfile(updated);
    setNewMemberName('');
    setShowAddMember(false);
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

  async function handleRegenerateCode() {
    if (!profile) return;
    Alert.alert(
      'Generate New Code?',
      'The old code will stop working. Family members will need to use the new code.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Generate', onPress: async () => {
            const updated = await regenerateCode(profile);
            setProfile(updated);
          },
        },
      ]
    );
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
      const updated = await updateProfile(profile, { imageUri: result.assets[0].uri });
      setProfile(updated);
    }
  }

  function copyCode() {
    if (!profile) return;
    Clipboard.setString(profile.householdCode);
    Alert.alert('Copied!', `Household code "${profile.householdCode}" copied to clipboard.`);
  }

  if (screen === 'loading') {
    return <View style={[styles.container, { backgroundColor: colors.background }]} />;
  }

  if (screen === 'setup') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <BgFoodDecor />
        <LinearGradient
          colors={['#16A34A', '#22C55E', '#4ADE80']}
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

            {/* Divider */}
            <View style={[styles.divider, { borderColor: colors.border }]}>
              <Text style={[styles.dividerText, { color: colors.subtext }]}>or join with a code</Text>
            </View>

            <TouchableOpacity
              style={[styles.joinCodeBtn, { borderColor: Brand.green }]}
              onPress={() => setShowJoin(true)}>
              <Text style={[styles.joinCodeBtnText, { color: Brand.green }]}>Enter Household Code</Text>
            </TouchableOpacity>

            {showJoin && (
              <View style={styles.joinRow}>
                <TextInput
                  style={[styles.joinInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
                  value={joinCode}
                  onChangeText={(t) => setJoinCode(t.toUpperCase())}
                  placeholder="ABC123"
                  placeholderTextColor={colors.subtext}
                  maxLength={6}
                  autoCapitalize="characters"
                />
                <TouchableOpacity style={styles.joinSubmitBtn} onPress={handleJoinCode}>
                  <Text style={styles.joinSubmitText}>Join</Text>
                </TouchableOpacity>
              </View>
            )}
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
        colors={['#16A34A', '#22C55E', '#4ADE80']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.dashGradient}>
        <HeaderFoodDecor />
        <SafeAreaView edges={['top']}>
          <View style={styles.dashHeader}>
            {/* Profile avatar — tap to change */}
            <TouchableOpacity onPress={handlePickProfileImage} style={styles.avatarContainer} activeOpacity={0.8}>
              {p.imageUri ? (
                <Image source={{ uri: p.imageUri }} style={styles.avatarImage} />
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
                  <IconSymbol name="checkmark" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => { setEditedName(p.householdName); setEditingName(true); }}
                style={styles.householdNameBtn}>
                <Text style={styles.householdName}>{p.householdName}</Text>
                <IconSymbol name="pencil" size={14} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            )}
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.dashContent} showsVerticalScrollIndicator={false}>

        {/* Household Code card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.subtext }]}>HOUSEHOLD CODE</Text>
          <View style={styles.codeRow}>
            <Text style={[styles.codeText, { color: colors.text }]}>{p.householdCode}</Text>
            <TouchableOpacity onPress={copyCode} style={styles.copyBtn}>
              <IconSymbol name="doc.on.doc" size={18} color={Brand.green} />
              <Text style={[styles.copyBtnText, { color: Brand.green }]}>Copy</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.codeHint, { color: colors.subtext }]}>
            Share this code with family members. They enter it on their device to join your household.
          </Text>
          <TouchableOpacity onPress={handleRegenerateCode} style={styles.regenBtn}>
            <Text style={[styles.regenBtnText, { color: colors.subtext }]}>Generate new code</Text>
          </TouchableOpacity>
        </View>

        {/* Members card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.cardTitle, { color: colors.subtext }]}>MEMBERS ({p.members.length})</Text>
            <TouchableOpacity onPress={() => setShowAddMember(true)}>
              <Text style={[styles.addMemberLink, { color: Brand.green }]}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {p.members.map((member, i) => (
            <View
              key={member.id}
              style={[
                styles.memberRow,
                i < p.members.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
              ]}>
              <View style={styles.memberAvatar}>
                <Text style={styles.memberEmoji}>{member.emoji}</Text>
              </View>
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
          ))}

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
        </View>

        {/* Join another household */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.subtext }]}>JOIN ANOTHER HOUSEHOLD</Text>
          <Text style={[styles.codeHint, { color: colors.subtext }]}>
            Have a household code from a family member? Enter it here to use their pantry list.
          </Text>
          <View style={[styles.joinRow, { marginTop: 10 }]}>
            <TextInput
              style={[styles.joinInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              value={joinCode}
              onChangeText={(t) => setJoinCode(t.toUpperCase())}
              placeholder="ABC123"
              placeholderTextColor={colors.subtext}
              maxLength={6}
              autoCapitalize="characters"
            />
            <TouchableOpacity style={styles.joinSubmitBtn} onPress={handleJoinCode}>
              <Text style={styles.joinSubmitText}>Join</Text>
            </TouchableOpacity>
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

        {/* About */}
        <Text style={[styles.settingsSub, { color: colors.subtext }]}>ABOUT</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.settingsRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
            <Text style={[styles.settingsRowTitle, { color: colors.text }]}>App Name</Text>
            <Text style={[styles.settingsRowSub, { color: colors.subtext }]}>Fresh Track</Text>
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
  setupHeaderTitle: { fontSize: 24, fontWeight: '800', color: '#fff', paddingHorizontal: 20, paddingTop: 12 },
  setupHeaderSub: { fontSize: 14, color: 'rgba(255,255,255,0.85)', paddingHorizontal: 20, marginTop: 2 },
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
  divider: { borderTopWidth: StyleSheet.hairlineWidth, marginVertical: 20, alignItems: 'center' },
  dividerText: { fontSize: 13, marginTop: -9, backgroundColor: 'transparent', paddingHorizontal: 12 },
  joinCodeBtn: {
    paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, alignItems: 'center',
  },
  joinCodeBtnText: { fontWeight: '700', fontSize: 15 },

  // Dashboard gradient header
  dashGradient: { paddingBottom: 16 },
  dashHeader: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 14 },
  dashNameBlock: { flex: 1 },
  dashWelcome: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  dashName: { color: '#fff', fontSize: 22, fontWeight: '800' },
  avatarContainer: { position: 'relative' },
  avatarImage: {
    width: 56, height: 56, borderRadius: 28,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)',
  },
  avatarEmoji: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
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
  householdName: { color: 'rgba(255,255,255,0.9)', fontSize: 15, fontWeight: '600' },
  editNameRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  editNameInput: {
    flex: 1, color: '#fff', borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.5)', fontSize: 15, paddingVertical: 4,
  },
  editSaveBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
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

  // Code
  codeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  codeText: { fontSize: 32, fontWeight: '900', letterSpacing: 6 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 8 },
  copyBtnText: { fontWeight: '600', fontSize: 14 },
  codeHint: { fontSize: 13, lineHeight: 18 },
  regenBtn: { marginTop: 8 },
  regenBtnText: { fontSize: 12 },

  // Members
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  memberAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Brand.greenLight, alignItems: 'center', justifyContent: 'center',
  },
  memberEmoji: { fontSize: 20 },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 15, fontWeight: '600' },
  memberRole: { fontSize: 12, marginTop: 2 },
  removeMemberBtn: { padding: 8 },

  // Add member
  addMemberRow: {
    flexDirection: 'row', gap: 8, marginTop: 10,
    paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth,
  },
  addMemberInput: { flex: 1, height: 40, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, fontSize: 15 },
  addMemberSubmit: { backgroundColor: Brand.green, paddingHorizontal: 16, borderRadius: 10, justifyContent: 'center' },
  addMemberSubmitText: { color: '#fff', fontWeight: '700' },

  // Join
  joinRow: { flexDirection: 'row', gap: 8 },
  joinInput: {
    flex: 1, height: 44, borderRadius: 10, borderWidth: 1,
    paddingHorizontal: 14, fontSize: 18, fontWeight: '700', letterSpacing: 4, textAlign: 'center',
  },
  joinSubmitBtn: { backgroundColor: Brand.green, paddingHorizontal: 18, borderRadius: 10, justifyContent: 'center' },
  joinSubmitText: { color: '#fff', fontWeight: '700', fontSize: 15 },

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
});

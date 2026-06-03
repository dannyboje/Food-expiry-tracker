import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SiriShortcuts } from '@freshahead/siri-shortcuts';
import { Audio } from 'expo-av';
import { transcribeAudio } from '@/utils/whisper';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LocationPicker } from './location-picker';
import { DatePickerField } from './date-picker-field';
import { QuantityField } from './quantity-field';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Brand, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { usePantry } from '@/hooks/use-pantry';
import { generateId } from '@/utils/id';
import { todayISO } from '@/utils/food-item-utils';
import { consumeCameraResult } from '@/utils/camera-result-store';
import { consumeScanResult } from '@/utils/scan-result-store';
import { loadHousehold } from '@/utils/household-storage';
import { computeScore, scoreColor, scoreLabel } from '@/utils/food-score';
import { resolvePhotoUri } from '@/utils/photo-storage';
import type { FoodItem, ProductAlternative, QuantityUnit, StorageLocation } from '@/types/food-item';

const NUTRI_COLOR: Record<string, string> = {
  a: '#1EA54C', b: '#85BB2F', c: '#F5C900', d: '#EF8714', e: '#E63E11',
};

interface Props {
  initialItem?: FoodItem;
  prefill?: Partial<FoodItem> & { barcode?: string; expiryHint?: string };
}

interface HistoryMatch {
  name: string;
  category: string;
  nutriScore?: string;
  novaGroup?: number;
  rawScore?: number;
  barcode?: string;
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  return (
    <View style={styles.formRow}>
      <Text style={[styles.rowLabel, { color: colors.subtext }]}>{label}</Text>
      {children}
    </View>
  );
}

export function AddEditForm({ initialItem, prefill }: Props) {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { addItem, updateItem, enrichedItems } = usePantry();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  const isEdit = !!initialItem;
  const base = initialItem ?? prefill;

  const [name, setName] = useState(base?.name ?? '');
  const [location, setLocation] = useState<StorageLocation>(base?.storageLocation ?? 'pantry');
  const [quantity, setQuantity] = useState(base?.quantity ?? 1);
  const [unit, setUnit] = useState<QuantityUnit>(base?.quantityUnit ?? 'pcs');
  const [purchaseDate, setPurchaseDate] = useState(base?.purchaseDate ?? todayISO());
  const [expiryDate, setExpiryDate] = useState(() => {
    if (base?.expiryDate) return base.expiryDate;
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
  });
  const [barcode, setBarcode] = useState<string | undefined>(base?.barcode);
  const [category, setCategory] = useState<string>(base?.category || 'other');
  const [nutriScore, setNutriScore] = useState<string | undefined>(base?.nutriScore);
  const [novaGroup, setNovaGroup] = useState<number | undefined>(base?.novaGroup);
  const [rawScore, setRawScore] = useState<number | undefined>(base?.rawScore);
  const [expiryPhotoUri, setExpiryPhotoUri] = useState<string | undefined>(base?.expiryPhotoUri);
  const [nutritionPhotoUri, setNutritionPhotoUri] = useState<string | undefined>(base?.nutritionPhotoUri);
  const [expiryHint, setExpiryHint] = useState<string | undefined>(prefill?.expiryHint);
  const [alternatives, setAlternatives] = useState<ProductAlternative[]>(base?.alternatives ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [historySuggestions, setHistorySuggestions] = useState<HistoryMatch[]>([]);

  type VoiceState = 'idle' | 'recording' | 'transcribing';
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const recordingRef = useRef<Audio.Recording | null>(null);

  useFocusEffect(
    useCallback(() => {
      const camera = consumeCameraResult();
      if (camera?.type === 'nutrition') setNutritionPhotoUri(camera.uri);
      if (camera?.type === 'expiry') {
        setExpiryPhotoUri(camera.uri);
        if (camera.date) setExpiryDate(camera.date);
      }

      const scan = consumeScanResult();
      if (scan) {
        if (scan.name) setName(scan.name);
        if (scan.barcode) setBarcode(scan.barcode);
        if (scan.category) setCategory(scan.category);
        if (scan.nutriScore !== undefined) setNutriScore(scan.nutriScore);
        if (scan.novaGroup !== undefined) setNovaGroup(scan.novaGroup);
        if (scan.rawScore !== undefined) setRawScore(scan.rawScore);
        if (scan.expiryDate) setExpiryDate(scan.expiryDate);
        if (scan.expiryHint) setExpiryHint(scan.expiryHint);
        if (scan.alternatives?.length) setAlternatives(scan.alternatives);

        if (scan.barcode && !isEdit) {
          const duplicate = enrichedItems.find((i) => i.barcode === scan.barcode);
          if (duplicate) {
            Alert.alert(
              'Already in Pantry',
              `"${duplicate.name}" with this barcode is already tracked. Add another entry or edit the existing one?`,
              [
                {
                  text: 'Cancel',
                  style: 'cancel',
                  onPress: () => { if (router.canDismiss()) router.dismiss(); else router.back(); },
                },
                { text: 'Add Anyway', style: 'default' },
                {
                  text: 'Edit Existing',
                  onPress: () => router.replace({ pathname: '/add-item', params: { editId: duplicate.id } }),
                },
              ]
            );
          }
        }
      }
    }, [enrichedItems, isEdit, router])
  );

  const score = computeScore(nutriScore, novaGroup, rawScore);

  function handleNameChange(text: string) {
    setName(text);
    setHistorySuggestions([]);

    const q = text.trim().toLowerCase();
    if (!q) return;

    const seen = new Set<string>();
    const history: HistoryMatch[] = [];
    for (const item of enrichedItems) {
      const key = item.name.toLowerCase();
      if (item.id === initialItem?.id) continue;
      if (seen.has(key)) continue;
      if (!key.includes(q)) continue;
      seen.add(key);
      history.push({
        name: item.name,
        category: item.category,
        nutriScore: item.nutriScore,
        novaGroup: item.novaGroup,
        rawScore: item.rawScore,
        barcode: item.barcode,
      });
      if (history.length === 5) break;
    }
    setHistorySuggestions(history);
  }

  // Stop any in-progress recording if the form is dismissed mid-session
  useEffect(() => {
    return () => {
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
    };
  }, []);

  async function toggleVoice() {
    if (voiceState === 'transcribing') return;

    if (voiceState === 'recording') {
      // ── Stop & transcribe ──────────────────────────────────────────────────
      const rec = recordingRef.current;
      recordingRef.current = null;
      setVoiceState('transcribing');
      try {
        await rec?.stopAndUnloadAsync();
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
        const uri = rec?.getURI();
        if (uri) {
          const text = await transcribeAudio(uri);
          if (text) handleNameChange(text);
        }
      } catch (e: any) {
        Alert.alert('Voice Input', e?.message ?? 'Transcription failed. Please try again.');
      } finally {
        setVoiceState('idle');
      }
    } else {
      // ── Start recording ────────────────────────────────────────────────────
      try {
        const { granted } = await Audio.requestPermissionsAsync();
        if (!granted) {
          Alert.alert('Microphone Access', 'Please allow microphone access in Settings to use voice input.');
          return;
        }
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const { recording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
        recordingRef.current = recording;
        setVoiceState('recording');
      } catch {
        setVoiceState('idle');
        Alert.alert('Voice Input', 'Could not start recording. Please try again.');
      }
    }
  }

  function applyHistorySuggestion(match: HistoryMatch) {
    setName(match.name);
    setCategory(match.category);
    if (match.nutriScore) setNutriScore(match.nutriScore);
    if (match.novaGroup)  setNovaGroup(match.novaGroup);
    if (match.rawScore)   setRawScore(match.rawScore);
    if (match.barcode)    setBarcode(match.barcode);
    setHistorySuggestions([]);
  }

  async function handleSave() {
    if (!name.trim()) {
      setError('Product name is required');
      return;
    }
    if (expiryDate < purchaseDate) {
      setError('Expiry date cannot be before purchase date');
      return;
    }
    setError('');
    setSaving(true);

    try {
      const now = new Date().toISOString();
      const itemId = initialItem?.id ?? generateId();

      let addedBy = initialItem?.addedBy;
      if (!isEdit) {
        const household = await loadHousehold();
        addedBy = household?.displayName ?? undefined;
      }

      const item: FoodItem = {
        id: itemId,
        name: name.trim(),
        category: (category || 'other') as FoodItem['category'],
        storageLocation: location,
        quantity,
        quantityUnit: unit,
        purchaseDate,
        expiryDate,
        barcode,
        nutriScore,
        novaGroup,
        rawScore,
        addedBy,
        expiryPhotoUri,
        nutritionPhotoUri,
        alternatives: alternatives.length > 0 ? alternatives : undefined,
        notificationIds: initialItem?.notificationIds ?? [],
        createdAt: initialItem?.createdAt ?? now,
        updatedAt: now,
      };

      if (isEdit) {
        await updateItem(item);
      } else {
        await addItem(item);
        // Donate shortcut so Siri learns "Add [name] to pantry"
        SiriShortcuts.donateShortcut('pantry', item.name).catch(() => {});
      }

      if (router.canDismiss()) {
        router.dismiss();
      } else {
        router.replace('/(tabs)');
      }
    } catch (e) {
      console.error('[AddEditForm] save failed:', e);
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function openNutritionCamera() {
    router.push('/camera/nutrition');
  }

  function openBarcodeScanner() {
    router.push('/scan');
  }

  return (
    <View style={[
        styles.container,
        {
          backgroundColor: colors.background,
          ...(Platform.OS === 'ios' && { height: windowHeight * 0.92 }),
        },
      ]}>
      <View style={[styles.modalHeader, { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
        {Platform.OS === 'android' && (
          <TouchableOpacity
            onPress={() => router.canDismiss() ? router.dismiss() : router.back()}
            style={styles.headerCloseBtn}
            hitSlop={8}>
            <IconSymbol name="xmark" size={20} color={colors.subtext} />
          </TouchableOpacity>
        )}
        <Text style={[styles.modalTitle, { color: colors.text }]}>
          {isEdit ? 'Edit Item' : 'Add Item'}
        </Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        enabled={Platform.OS !== 'ios'}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          scrollIndicatorInsets={{ bottom: 0 }}>

          <FormRow label="Product name">
            <View style={styles.nameRow}>
              <TextInput
                style={[
                  styles.nameInput,
                  { color: colors.text, borderColor: colors.border, backgroundColor: colors.card },
                ]}
                value={name}
                onChangeText={handleNameChange}
                onBlur={() => setTimeout(() => setHistorySuggestions([]), 150)}
                placeholder="e.g. Banana"
                placeholderTextColor={colors.subtext}
                returnKeyType="done"
                multiline
                blurOnSubmit
              />
              <TouchableOpacity
                style={[
                  styles.micBtn,
                  voiceState === 'recording'
                    ? { borderColor: '#EF4444', backgroundColor: '#FEF2F2' }
                    : { borderColor: colors.border, backgroundColor: colors.card },
                ]}
                onPress={toggleVoice}
                disabled={voiceState === 'transcribing'}
                activeOpacity={0.7}>
                {voiceState === 'transcribing' ? (
                  <ActivityIndicator size="small" color={colors.subtext} />
                ) : (
                  <IconSymbol
                    name={voiceState === 'recording' ? 'mic.fill' : 'mic'}
                    size={24}
                    color={voiceState === 'recording' ? '#EF4444' : colors.subtext}
                  />
                )}
                <Text style={[
                  styles.scanBtnText,
                  { color: voiceState === 'recording' ? '#EF4444' : colors.subtext },
                ]}>
                  {voiceState === 'recording' ? 'Stop' : voiceState === 'transcribing' ? '…' : 'Voice'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.scanBtn, { borderColor: Brand.green, backgroundColor: colors.card }]}
                onPress={openBarcodeScanner}>
                <IconSymbol name="barcode.viewfinder" size={28} color={Brand.green} />
                <Text style={[styles.scanBtnText, { color: Brand.green }]}>Scan</Text>
              </TouchableOpacity>
            </View>

            {historySuggestions.length > 0 && (
              <View style={[styles.suggestions, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {historySuggestions.map((h, i) => (
                  <TouchableOpacity
                    key={`history-${h.name}`}
                    style={[
                      styles.suggestionRow,
                      { borderBottomColor: colors.border },
                      i === historySuggestions.length - 1 && { borderBottomWidth: 0 },
                    ]}
                    onPress={() => applyHistorySuggestion(h)}
                    activeOpacity={0.7}>
                    <View style={styles.suggestionInfo}>
                      <Text style={[styles.suggestionName, { color: colors.text }]} numberOfLines={1}>
                        {h.name}
                      </Text>
                      <Text style={[styles.suggestionBrand, { color: colors.subtext }]} numberOfLines={1}>
                        {h.category.charAt(0).toUpperCase() + h.category.slice(1)}
                      </Text>
                    </View>
                    <View style={styles.suggestionBadges}>
                      {h.nutriScore ? (
                        <View style={[styles.nutriBadge, { backgroundColor: NUTRI_COLOR[h.nutriScore] }]}>
                          <Text style={styles.nutriBadgeText}>{h.nutriScore.toUpperCase()}</Text>
                        </View>
                      ) : null}
                      {h.novaGroup ? (
                        <Text style={[styles.novaBadgeText, { color: colors.subtext }]}>
                          NOVA {h.novaGroup}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </FormRow>

          {score !== undefined && (
            <View style={[styles.scoreChip, { borderColor: scoreColor(score) }]}>
              <View style={[styles.scoreDot, { backgroundColor: scoreColor(score) }]}>
                <Text style={styles.scoreDotText}>{score}</Text>
              </View>
              <Text style={[styles.scoreChipText, { color: scoreColor(score) }]}>
                Health Score · {scoreLabel(score)}
              </Text>
              {nutriScore && (
                <Text style={[styles.scoreChipSub, { color: colors.subtext }]}>
                  Nutri-Score {nutriScore.toUpperCase()}
                  {novaGroup ? `  ·  NOVA ${novaGroup}` : ''}
                </Text>
              )}
            </View>
          )}

          <FormRow label="Product image (optional)">
            <Text style={[styles.photoHint, { color: colors.subtext }]}>
              Used as the product icon in your pantry
            </Text>
            <TouchableOpacity
              style={[styles.photoBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
              onPress={openNutritionCamera}>
              <IconSymbol name="camera.fill" size={18} color={Brand.green} />
              <Text style={[styles.photoBtnLabel, { color: colors.subtext }]}>
                {nutritionPhotoUri ? 'Retake photo' : 'Take photo'}
              </Text>
            </TouchableOpacity>
            {resolvePhotoUri(nutritionPhotoUri) && (
              <Image source={{ uri: resolvePhotoUri(nutritionPhotoUri) }} style={styles.photoThumb} />
            )}
          </FormRow>

          <FormRow label="Storage location">
            <LocationPicker value={location} onChange={setLocation} />
          </FormRow>

          <FormRow label="Quantity">
            <QuantityField
              quantity={quantity}
              unit={unit}
              onQuantityChange={setQuantity}
              onUnitChange={setUnit}
            />
          </FormRow>

          <FormRow label="Purchase date">
            <DatePickerField label="" value={purchaseDate} onChange={setPurchaseDate} />
          </FormRow>

          <FormRow label="Expiry / best before">
            <DatePickerField label="" value={expiryDate} onChange={setExpiryDate} />
            {resolvePhotoUri(expiryPhotoUri) && (
              <Image source={{ uri: resolvePhotoUri(expiryPhotoUri) }} style={styles.photoThumb} />
            )}
            {expiryHint && (
              <Text style={[styles.expiryHint, { color: Brand.green }]}>
                💡 {expiryHint}
              </Text>
            )}
          </FormRow>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Absolutely pinned footer — immune to sheet animation and KAV layout shifts */}
      <View style={[
        styles.stickyFooter,
        { paddingBottom: insets.bottom + 12, borderTopColor: colors.border, backgroundColor: colors.background },
      ]}>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}>
          <Text style={styles.saveBtnText}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add to Pantry'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  headerCloseBtn: { position: 'absolute', left: 16, padding: 4 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 130, gap: 20 },
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  scoreChip: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  scoreDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreDotText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  scoreChipText: { fontSize: 14, fontWeight: '700', flex: 1 },
  scoreChipSub: { fontSize: 11, width: '100%', marginTop: -4 },
  formRow: { gap: 8 },
  rowLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  nameRow: { flexDirection: 'row', gap: 8 },
  nameInput: {
    flex: 1,
    minHeight: 64,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  micBtn: {
    width: 60,
    height: 64,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  scanBtn: {
    width: 76,
    height: 64,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  scanBtnText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  photoHint: { fontSize: 12, marginTop: -4, marginBottom: 2 },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  photoBtnLabel: { fontSize: 14 },
  photoThumb: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    resizeMode: 'cover',
    marginTop: 8,
  },
  expiryHint: { fontSize: 12, fontStyle: 'italic', marginTop: 4 },
  errorText: { color: '#EF4444', fontSize: 13, fontWeight: '500' },
  saveBtn: {
    backgroundColor: Brand.green,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: Brand.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  searchSpinner: { alignSelf: 'flex-start', marginTop: 4 },
  suggestions: {
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 4,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  suggestionInfo: { flex: 1 },
  suggestionName: { fontSize: 14, fontWeight: '600' },
  suggestionBrand: { fontSize: 12, marginTop: 1 },
  suggestionBadges: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  nutriBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  nutriBadgeText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  novaBadgeText: { fontSize: 11, fontWeight: '600' },
});

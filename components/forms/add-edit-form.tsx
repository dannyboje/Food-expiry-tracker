import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
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
import type { FoodItem, QuantityUnit, StorageLocation } from '@/types/food-item';

interface Props {
  initialItem?: FoodItem;
  prefill?: Partial<FoodItem> & { barcode?: string; expiryHint?: string };
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
  const { addItem, updateItem } = usePantry();
  const insets = useSafeAreaInsets();

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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
      }
    }, [])
  );

  const score = computeScore(nutriScore, novaGroup, rawScore);

  async function handleSave() {
    if (!name.trim()) {
      setError('Product name is required');
      return;
    }
    setError('');
    setSaving(true);

    try {
      const now = new Date().toISOString();
      const itemId = initialItem?.id ?? generateId();

      // Resolve who is adding this item (only for new items)
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
        notificationIds: initialItem?.notificationIds ?? [],
        createdAt: initialItem?.createdAt ?? now,
        updatedAt: now,
      };

      if (isEdit) {
        await updateItem(item);
      } else {
        await addItem(item);
      }

      if (router.canDismiss()) {
        router.dismiss();
      } else {
        router.replace('/(tabs)');
      }
    } catch {
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.modalHeader, { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
        <Text style={[styles.modalTitle, { color: colors.text }]}>
          {isEdit ? 'Edit Item' : 'Add Item'}
        </Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          {/* Health score chip — shown when product was scanned */}
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

          <FormRow label="Product name">
            <View style={styles.nameRow}>
              <TextInput
                style={[
                  styles.nameInput,
                  { color: colors.text, borderColor: colors.border, backgroundColor: colors.card },
                ]}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Banana"
                placeholderTextColor={colors.subtext}
                returnKeyType="done"
              />
              <TouchableOpacity
                style={[styles.iconBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
                onPress={openBarcodeScanner}>
                <IconSymbol name="barcode.viewfinder" size={22} color={Brand.green} />
              </TouchableOpacity>
            </View>
          </FormRow>

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
        </ScrollView>
      </KeyboardAvoidingView>
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
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 16, gap: 20 },
  // Score chip
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
  // Form
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
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  iconBtn: {
    width: 46,
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    marginTop: 8,
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
});

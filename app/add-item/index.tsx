import { Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AddEditForm } from '@/components/forms/add-edit-form';
import type { FoodCategory, FoodItem } from '@/types/food-item';
import { usePantry } from '@/hooks/use-pantry';

export default function AddItemScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    editId?: string;
    name?: string;
    barcode?: string;
    category?: string;
    expiryDate?: string;
    expiryHint?: string;
    expiryPhotoUri?: string;
    nutritionPhotoUri?: string;
    nutriScore?: string;
    novaGroup?: string;
    rawScore?: string;
  }>();

  const { enrichedItems, state } = usePantry();
  const duplicateChecked = useRef(false);

  useEffect(() => {
    if (state.isLoading || duplicateChecked.current || !params.barcode || params.editId) return;
    duplicateChecked.current = true;
    const duplicate = enrichedItems.find((i) => i.barcode === params.barcode);
    if (!duplicate) return;
    Alert.alert(
      'Already in Pantry',
      `"${duplicate.name}" with this barcode is already tracked. Add another entry or edit the existing one?`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => router.back() },
        { text: 'Add Anyway', style: 'default' },
        {
          text: 'Edit Existing',
          onPress: () => router.replace({ pathname: '/add-item', params: { editId: duplicate.id } }),
        },
      ]
    );
  }, [state.isLoading, enrichedItems]);

  if (params.editId) {
    const item = enrichedItems.find((i) => i.id === params.editId);
    if (item) return <AddEditForm initialItem={item} />;
  }

  const prefill: Partial<FoodItem> & { barcode?: string; expiryHint?: string } = {
    name: params.name,
    barcode: params.barcode,
    category: params.category as FoodCategory | undefined,
    expiryDate: params.expiryDate,
    expiryHint: params.expiryHint || undefined,
    expiryPhotoUri: params.expiryPhotoUri,
    nutritionPhotoUri: params.nutritionPhotoUri,
    nutriScore: params.nutriScore || undefined,
    novaGroup: params.novaGroup ? Number(params.novaGroup) : undefined,
    rawScore: params.rawScore ? Number(params.rawScore) : undefined,
  };

  return <AddEditForm prefill={prefill} />;
}

import { useLocalSearchParams } from 'expo-router';
import { AddEditForm } from '@/components/forms/add-edit-form';
import type { FoodCategory, FoodItem } from '@/types/food-item';
import { usePantry } from '@/hooks/use-pantry';

export default function AddItemScreen() {
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

  const { enrichedItems } = usePantry();

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

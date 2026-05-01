import KVStore from 'expo-sqlite/kv-store';
import type { FoodItem, FoodItemWithStatus } from '@/types/food-item';

export interface ShoppingItem {
  id: string;
  name: string;
  quantity?: string;   // e.g. "2 kg"
  checked: boolean;
  fromPantry: boolean;
  pantryId?: string;   // used to deduplicate auto-added items
}

const STORAGE_KEY = '@shopping_list';

export async function getShoppingList(): Promise<ShoppingItem[]> {
  const val = await KVStore.getItem(STORAGE_KEY);
  if (!val) return [];
  try { return JSON.parse(val); } catch { return []; }
}

export async function saveShoppingList(items: ShoppingItem[]): Promise<void> {
  await KVStore.setItem(STORAGE_KEY, JSON.stringify(items));
}

// Adds a single pantry item to the shopping list (e.g. after deletion or wasting).
// Skips if the item is already present by pantryId so re-runs are safe.
export async function addRemovedToShoppingList(item: FoodItem): Promise<void> {
  const current = await getShoppingList();
  if (current.some((i) => i.pantryId === item.id)) return;
  const entry: ShoppingItem = {
    id: `pantry_${item.id}`,
    name: item.name,
    quantity: item.quantity && item.quantityUnit ? `${item.quantity} ${item.quantityUnit}` : undefined,
    checked: false,
    fromPantry: true,
    pantryId: item.id,
  };
  await saveShoppingList([entry, ...current]);
}

// Adds expired pantry items that are not already in the list (by pantryId).
// New entries are prepended so the user sees them immediately.
export async function syncExpiredToShoppingList(expiredItems: FoodItemWithStatus[]): Promise<void> {
  if (expiredItems.length === 0) return;
  const current = await getShoppingList();
  const existingPantryIds = new Set(current.map((i) => i.pantryId).filter(Boolean));

  const toAdd: ShoppingItem[] = expiredItems
    .filter((item) => !existingPantryIds.has(item.id))
    .map((item) => ({
      id: `pantry_${item.id}`,
      name: item.name,
      quantity: `${item.quantity} ${item.quantityUnit}`,
      checked: false,
      fromPantry: true,
      pantryId: item.id,
    }));

  if (toAdd.length > 0) {
    await saveShoppingList([...toAdd, ...current]);
  }
}

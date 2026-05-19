import KVStore from 'expo-sqlite/kv-store';
import type { FoodItem, FoodItemWithStatus } from '@/types/food-item';

export interface ShoppingItem {
  id: string;
  name: string;
  quantity?: string;
  checked: boolean;
  fromPantry: boolean;
  pantryId?: string;
  isFavorite?: boolean;
  // Nutritional info preserved from pantry
  nutriScore?: string;
  novaGroup?: number;
  barcode?: string;
}

export interface ShoppingList {
  id: string;
  name: string;
  collapsed: boolean;
  items: ShoppingItem[];
  createdAt: string;
}

export interface FavoriteItem {
  id: string;
  name: string;
  quantity?: string;
  nutriScore?: string;
  novaGroup?: number;
  barcode?: string;
}

const LISTS_KEY  = '@shopping_lists_v2';
const FAVS_KEY   = '@shopping_favorites_v1';
const LEGACY_KEY = '@shopping_list';

function makeDefaultList(items: ShoppingItem[] = []): ShoppingList {
  return {
    id: 'default',
    name: 'Shopping List',
    collapsed: false,
    items,
    createdAt: new Date().toISOString(),
  };
}

// ── Lists ──────────────────────────────────────────────────────────────────

export async function getShoppingLists(): Promise<ShoppingList[]> {
  try {
    const val = await KVStore.getItem(LISTS_KEY);
    if (val) return JSON.parse(val) as ShoppingList[];

    // Migrate from legacy flat list
    const legacy = await KVStore.getItem(LEGACY_KEY);
    if (legacy) {
      const oldItems = JSON.parse(legacy) as ShoppingItem[];
      const migrated = [makeDefaultList(oldItems)];
      await saveShoppingLists(migrated);
      return migrated;
    }

    const initial = [makeDefaultList()];
    await saveShoppingLists(initial);
    return initial;
  } catch {
    return [makeDefaultList()];
  }
}

export async function saveShoppingLists(lists: ShoppingList[]): Promise<void> {
  await KVStore.setItem(LISTS_KEY, JSON.stringify(lists));
}

// ── Favourites ─────────────────────────────────────────────────────────────

export async function getFavorites(): Promise<FavoriteItem[]> {
  try {
    const val = await KVStore.getItem(FAVS_KEY);
    if (!val) return [];
    return JSON.parse(val) as FavoriteItem[];
  } catch { return []; }
}

export async function saveFavorites(items: FavoriteItem[]): Promise<void> {
  await KVStore.setItem(FAVS_KEY, JSON.stringify(items));
}

function itemToFavorite(item: ShoppingItem): FavoriteItem {
  return {
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    nutriScore: item.nutriScore,
    novaGroup: item.novaGroup,
    barcode: item.barcode,
  };
}

export async function toggleFavorite(item: ShoppingItem): Promise<{ favs: FavoriteItem[]; nowFavorite: boolean }> {
  const favs = await getFavorites();
  const exists = favs.some((f) => f.id === item.id);
  const updated = exists
    ? favs.filter((f) => f.id !== item.id)
    : [itemToFavorite(item), ...favs];
  await saveFavorites(updated);
  return { favs: updated, nowFavorite: !exists };
}

// When deleting a list, migrate any starred items so they persist in favourites.
export async function migrateStarredOnDelete(list: ShoppingList): Promise<void> {
  const starred = list.items.filter((i) => i.isFavorite);
  if (starred.length === 0) return;
  const favs = await getFavorites();
  const existingIds = new Set(favs.map((f) => f.id));
  const toAdd = starred.filter((i) => !existingIds.has(i.id)).map(itemToFavorite);
  if (toAdd.length > 0) await saveFavorites([...toAdd, ...favs]);
}

// ── Pantry → shopping helpers ───────────────────────────────────────────────

async function getOrEnsureList(): Promise<[ShoppingList[], number]> {
  const lists = await getShoppingLists();
  if (lists.length > 0) return [lists, 0];
  const initial = [makeDefaultList()];
  await saveShoppingLists(initial);
  return [initial, 0];
}

export async function addRemovedToShoppingList(item: FoodItem): Promise<void> {
  const [lists, idx] = await getOrEnsureList();
  const target = lists[idx];
  if (target.items.some((i) => i.pantryId === item.id)) return;
  const entry: ShoppingItem = {
    id: `pantry_${item.id}`,
    name: item.name,
    quantity: item.quantity && item.quantityUnit ? `${item.quantity} ${item.quantityUnit}` : undefined,
    checked: false,
    fromPantry: true,
    pantryId: item.id,
    nutriScore: item.nutriScore,
    novaGroup: item.novaGroup,
    barcode: item.barcode,
  };
  lists[idx] = { ...target, items: [entry, ...target.items] };
  await saveShoppingLists(lists);
}

export async function syncExpiredToShoppingList(expiredItems: FoodItemWithStatus[]): Promise<void> {
  if (expiredItems.length === 0) return;
  const [lists, idx] = await getOrEnsureList();
  const target = lists[idx];
  const existingIds = new Set(target.items.map((i) => i.pantryId).filter(Boolean));
  const toAdd: ShoppingItem[] = expiredItems
    .filter((item) => !existingIds.has(item.id))
    .map((item) => ({
      id: `pantry_${item.id}`,
      name: item.name,
      quantity: `${item.quantity} ${item.quantityUnit}`,
      checked: false,
      fromPantry: true,
      pantryId: item.id,
      nutriScore: item.nutriScore,
      novaGroup: item.novaGroup,
      barcode: item.barcode,
    }));
  if (toAdd.length > 0) {
    lists[idx] = { ...target, items: [...toAdd, ...target.items] };
    await saveShoppingLists(lists);
  }
}

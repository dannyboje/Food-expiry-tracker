import { useMemo } from 'react';
import { usePantryContext } from '@/context/pantry-context';
import { enrichItem } from '@/utils/food-item-utils';
import type { FoodItemWithStatus, StorageLocation } from '@/types/food-item';

export function usePantry() {
  const ctx = usePantryContext();
  const { state } = ctx;

  const enrichedItems = useMemo(
    () => state.items.map(enrichItem),
    [state.items]
  );

  const filteredItems = useMemo<FoodItemWithStatus[]>(() => {
    let result = enrichedItems;

    if (state.activeFilter !== 'all') {
      result = result.filter((i) => i.storageLocation === state.activeFilter);
    }

    if (state.searchQuery.trim()) {
      const q = state.searchQuery.toLowerCase();
      result = result.filter((i) => i.name.toLowerCase().includes(q));
    }

    return result.slice().sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  }, [enrichedItems, state.activeFilter, state.searchQuery]);

  const counts = useMemo(() => {
    const all = enrichedItems.length;
    const fridge = enrichedItems.filter((i) => i.storageLocation === 'fridge').length;
    const freezer = enrichedItems.filter((i) => i.storageLocation === 'freezer').length;
    const pantry = enrichedItems.filter((i) => i.storageLocation === 'pantry').length;
    return { all, fridge, freezer, pantry } as Record<StorageLocation | 'all', number>;
  }, [enrichedItems]);

  const alertItems = useMemo(
    () => enrichedItems.filter((i) => i.status === 'expiring_soon' || i.status === 'expired'),
    [enrichedItems]
  );

  const expiredCount = useMemo(
    () => enrichedItems.filter((i) => i.status === 'expired').length,
    [enrichedItems]
  );

  return {
    ...ctx,
    enrichedItems,
    filteredItems,
    counts,
    alertItems,
    expiredCount,
  };
}

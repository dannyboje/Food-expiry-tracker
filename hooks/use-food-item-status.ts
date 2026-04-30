import { useMemo } from 'react';
import { enrichItem } from '@/utils/food-item-utils';
import type { FoodItem, FoodItemWithStatus } from '@/types/food-item';

export function useFoodItemStatus(item: FoodItem): FoodItemWithStatus {
  return useMemo(() => enrichItem(item), [item]);
}

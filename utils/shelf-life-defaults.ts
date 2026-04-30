import type { FoodCategory, StorageLocation } from '@/types/food-item';
import { todayISO } from './food-item-utils';

// Typical shelf life in days from purchase date, by category × storage location
const SHELF_LIFE: Record<FoodCategory, Partial<Record<StorageLocation, number>>> = {
  dairy:      { fridge: 7,   freezer: 180, pantry: 365 },
  meat:       { fridge: 3,   freezer: 90,  pantry: 2   },
  seafood:    { fridge: 2,   freezer: 90,  pantry: 2   },
  produce:    { fridge: 7,   freezer: 365, pantry: 3   },
  bakery:     { fridge: 7,   freezer: 90,  pantry: 5   },
  frozen:     { fridge: 3,   freezer: 365, pantry: 2   },
  canned:     { fridge: 5,   freezer: 365, pantry: 730 },
  condiments: { fridge: 180, freezer: 180, pantry: 365 },
  beverages:  { fridge: 14,  freezer: 180, pantry: 365 },
  snacks:     { fridge: 30,  freezer: 180, pantry: 90  },
  grains:     { fridge: 30,  freezer: 365, pantry: 365 },
  medicines:  { fridge: 30,  freezer: 180, pantry: 365 },
  other:      { fridge: 7,   freezer: 180, pantry: 30  },
};

// Most common storage location per category (used at scan time before user picks)
const DEFAULT_LOCATION: Record<FoodCategory, StorageLocation> = {
  dairy:      'fridge',
  meat:       'fridge',
  seafood:    'fridge',
  produce:    'fridge',
  bakery:     'pantry',
  frozen:     'freezer',
  canned:     'pantry',
  condiments: 'fridge',
  beverages:  'pantry',
  snacks:     'pantry',
  grains:     'pantry',
  medicines:  'pantry',
  other:      'fridge',
};

/**
 * Returns a suggested YYYY-MM-DD expiry date based on the product's category.
 * Uses the most common storage location for that category when none is provided.
 */
export function getSuggestedExpiryDate(
  category: string | undefined,
  location?: StorageLocation,
): string | undefined {
  if (!category) return undefined;
  const shelfLife = SHELF_LIFE[category as FoodCategory];
  if (!shelfLife) return undefined;

  const loc = location ?? DEFAULT_LOCATION[category as FoodCategory];
  const days = shelfLife[loc] ?? shelfLife[DEFAULT_LOCATION[category as FoodCategory]];
  if (!days) return undefined;

  const expiry = new Date();
  expiry.setDate(expiry.getDate() + days);
  return expiry.toISOString().split('T')[0];
}

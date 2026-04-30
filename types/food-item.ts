export type StorageLocation = 'fridge' | 'freezer' | 'pantry';

export type FoodCategory =
  | 'dairy'
  | 'meat'
  | 'seafood'
  | 'produce'
  | 'bakery'
  | 'frozen'
  | 'canned'
  | 'condiments'
  | 'beverages'
  | 'snacks'
  | 'grains'
  | 'medicines'
  | 'other';

export type QuantityUnit = 'pcs' | 'g' | 'kg' | 'ml' | 'l' | 'oz' | 'lbs';

export interface FoodItem {
  id: string;
  name: string;
  category: FoodCategory;
  storageLocation: StorageLocation;
  quantity: number;
  quantityUnit: QuantityUnit;
  purchaseDate: string;       // YYYY-MM-DD
  expiryDate: string;         // YYYY-MM-DD
  barcode?: string;
  nutriScore?: string;        // 'a'–'e' from Open Food Facts Nutri-Score
  novaGroup?: number;         // 1–4 food processing level
  rawScore?: number;          // 0–100 fallback score (USDA) when OFF has no grade
  addedBy?: string;           // display name of the household member who added this item
  expiryPhotoUri?: string;    // permanent local file URI
  nutritionPhotoUri?: string; // permanent local file URI, optional
  notificationIds: string[];  // expo-notifications IDs
  createdAt: string;          // ISO timestamp
  updatedAt: string;          // ISO timestamp
}

export type ExpiryStatus = 'expired' | 'expiring_soon' | 'fresh';

export interface FoodItemWithStatus extends FoodItem {
  daysUntilExpiry: number;  // negative = already expired
  daysInPantry: number;
  shelfLifeDays: number;    // expiryDate − purchaseDate
  status: ExpiryStatus;
}

/**
 * Demo seed — loads realistic sample data so you can take screenshots / record
 * a walkthrough without manually entering items.
 *
 * Call seedDemoData() from the Settings screen "Load Demo Data" button.
 * It wipes all existing stores first so you get a clean, consistent state.
 */

import KVStore from 'expo-sqlite/kv-store';
import type { FoodItem } from '@/types/food-item';
import { insertItem, deleteAllItems } from '@/utils/storage';
import type { ShoppingList, FavoriteItem } from '@/utils/shopping-store';
import type { RecentScan } from '@/utils/recent-scans-store';
import type { RecallMatch } from '@/utils/recall-checker';

// ── Date helpers ───────────────────────────────────────────────────────────

function daysFromToday(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

const TODAY = daysFromToday(0);

// ── Clear everything ───────────────────────────────────────────────────────

async function clearAll(): Promise<void> {
  // Use the shared storage module so the write goes through the serialised queue
  // and avoids "database is locked" errors from competing connections on Android.
  await deleteAllItems();

  const kvKeys = [
    '@shopping_lists_v2',
    '@shopping_favorites_v1',
    '@shopping_list',
    '@recent_scans_v1',
    '@household_profile',
    '@consumption_events',
    '@recall_alerts',
    '@recall_dismissed',
    'email_capture_shown',
    'email_capture_email',
  ];
  await Promise.all(kvKeys.map((k) => KVStore.removeItem(k).catch(() => {})));
}

// ── Pantry items ───────────────────────────────────────────────────────────

const PANTRY_ITEMS: FoodItem[] = [
  // ── Fridge — fresh ──────────────────────────────────────────────────────
  {
    id: 'demo-01',
    name: 'Organic Whole Milk',
    category: 'dairy',
    storageLocation: 'fridge',
    quantity: 2,
    quantityUnit: 'l',
    purchaseDate: daysFromToday(-2),
    expiryDate: daysFromToday(9),
    barcode: '5000169105017',
    nutriScore: 'b',
    novaGroup: 1,
    addedBy: 'Alex',
    alternatives: [],
    notificationIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'demo-02',
    name: 'Free Range Chicken Breast',
    category: 'meat',
    storageLocation: 'fridge',
    quantity: 500,
    quantityUnit: 'g',
    purchaseDate: daysFromToday(-1),
    expiryDate: daysFromToday(2), // expiring soon
    barcode: '5051790000095',
    nutriScore: 'a',
    novaGroup: 1,
    addedBy: 'Sam',
    alternatives: [],
    notificationIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'demo-03',
    name: 'Mature Cheddar Cheese',
    category: 'dairy',
    storageLocation: 'fridge',
    quantity: 200,
    quantityUnit: 'g',
    purchaseDate: daysFromToday(-5),
    expiryDate: daysFromToday(25),
    barcode: '5010477305041',
    nutriScore: 'c',
    novaGroup: 2,
    addedBy: 'Alex',
    alternatives: [],
    notificationIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'demo-04',
    name: 'Greek Yogurt',
    category: 'dairy',
    storageLocation: 'fridge',
    quantity: 500,
    quantityUnit: 'g',
    purchaseDate: daysFromToday(-3),
    expiryDate: daysFromToday(7),
    barcode: '5011546301498',
    nutriScore: 'b',
    novaGroup: 1,
    addedBy: 'Sam',
    alternatives: [],
    notificationIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'demo-05',
    name: 'Baby Spinach',
    category: 'produce',
    storageLocation: 'fridge',
    quantity: 150,
    quantityUnit: 'g',
    purchaseDate: daysFromToday(-4),
    expiryDate: daysFromToday(1), // expiring tomorrow
    nutriScore: 'a',
    novaGroup: 1,
    addedBy: 'Alex',
    alternatives: [],
    notificationIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'demo-06',
    name: 'Fresh Orange Juice',
    category: 'beverages',
    storageLocation: 'fridge',
    quantity: 1,
    quantityUnit: 'l',
    purchaseDate: daysFromToday(-6),
    expiryDate: daysFromToday(-2), // expired
    barcode: '5000299274249',
    nutriScore: 'c',
    novaGroup: 1,
    addedBy: 'Sam',
    alternatives: [],
    notificationIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  // ── Pantry — fresh ──────────────────────────────────────────────────────
  {
    id: 'demo-07',
    name: 'Heinz Baked Beans',
    category: 'canned',
    storageLocation: 'pantry',
    quantity: 3,
    quantityUnit: 'pcs',
    purchaseDate: daysFromToday(-10),
    expiryDate: daysFromToday(210),
    barcode: '5000157024728',
    nutriScore: 'b',
    novaGroup: 3,
    addedBy: 'Alex',
    alternatives: [],
    notificationIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'demo-08',
    name: 'Wholewheat Spaghetti',
    category: 'grains',
    storageLocation: 'pantry',
    quantity: 500,
    quantityUnit: 'g',
    purchaseDate: daysFromToday(-7),
    expiryDate: daysFromToday(365),
    barcode: '8001120000520',
    nutriScore: 'a',
    novaGroup: 1,
    addedBy: 'Sam',
    alternatives: [],
    notificationIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'demo-09',
    name: 'Extra Virgin Olive Oil',
    category: 'condiments',
    storageLocation: 'pantry',
    quantity: 750,
    quantityUnit: 'ml',
    purchaseDate: daysFromToday(-14),
    expiryDate: daysFromToday(395),
    barcode: '5011546304772',
    addedBy: 'Alex',
    alternatives: [],
    notificationIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'demo-10',
    name: 'Pringles Original',
    category: 'snacks',
    storageLocation: 'pantry',
    quantity: 2,
    quantityUnit: 'pcs',
    purchaseDate: daysFromToday(-20),
    expiryDate: daysFromToday(2), // expiring soon
    barcode: '5053827193994',
    nutriScore: 'd',
    novaGroup: 4,
    addedBy: 'Sam',
    alternatives: [
      { barcode: '5000436091221', name: 'Popchips Sea Salt', brand: 'Popchips', nutriScore: 'b', novaGroup: 3 },
      { barcode: '5060077919021', name: 'Keogh\'s Atlantic Sea Salt', brand: 'Keogh\'s', nutriScore: 'b', novaGroup: 3 },
    ],
    notificationIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'demo-11',
    name: 'Basmati Rice',
    category: 'grains',
    storageLocation: 'pantry',
    quantity: 1,
    quantityUnit: 'kg',
    purchaseDate: daysFromToday(-30),
    expiryDate: daysFromToday(540),
    barcode: '5011546505019',
    nutriScore: 'b',
    novaGroup: 1,
    addedBy: 'Alex',
    alternatives: [],
    notificationIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  // ── Freezer ─────────────────────────────────────────────────────────────
  {
    id: 'demo-12',
    name: 'Frozen Garden Peas',
    category: 'frozen',
    storageLocation: 'freezer',
    quantity: 800,
    quantityUnit: 'g',
    purchaseDate: daysFromToday(-15),
    expiryDate: daysFromToday(130),
    barcode: '5000116003849',
    nutriScore: 'a',
    novaGroup: 1,
    addedBy: 'Sam',
    alternatives: [],
    notificationIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'demo-13',
    name: 'Captain Birds Eye Fish Fingers',
    category: 'frozen',
    storageLocation: 'freezer',
    quantity: 10,
    quantityUnit: 'pcs',
    purchaseDate: daysFromToday(-8),
    expiryDate: daysFromToday(86),
    barcode: '5000118060019',
    nutriScore: 'c',
    novaGroup: 3,
    addedBy: 'Alex',
    alternatives: [],
    notificationIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  // ── Meds ────────────────────────────────────────────────────────────────
  {
    id: 'demo-14',
    name: 'Vitamin D3 1000 IU',
    category: 'medicines',
    storageLocation: 'meds',
    quantity: 90,
    quantityUnit: 'pcs',
    purchaseDate: daysFromToday(-60),
    expiryDate: daysFromToday(184),
    addedBy: 'Alex',
    alternatives: [],
    notificationIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'demo-15',
    name: 'Ibuprofen 200mg',
    category: 'medicines',
    storageLocation: 'meds',
    quantity: 16,
    quantityUnit: 'pcs',
    purchaseDate: daysFromToday(-90),
    expiryDate: daysFromToday(1), // expiring soon
    addedBy: 'Sam',
    alternatives: [],
    notificationIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// ── Shopping lists ─────────────────────────────────────────────────────────

const SHOPPING_LISTS: ShoppingList[] = [
  {
    id: 'demo-list-1',
    name: 'Weekly Shop',
    collapsed: false,
    createdAt: new Date().toISOString(),
    items: [
      {
        id: 'sl-01',
        name: 'Organic Whole Milk',
        quantity: '2 l',
        checked: false,
        fromPantry: true,
        pantryId: 'demo-01',
        nutriScore: 'b',
        novaGroup: 1,
        barcode: '5000169105017',
        isFavorite: true,
      },
      {
        id: 'sl-02',
        name: 'Wholemeal Bread',
        quantity: '1 pcs',
        checked: false,
        fromPantry: false,
        nutriScore: 'a',
        novaGroup: 2,
      },
      {
        id: 'sl-03',
        name: 'Bananas',
        quantity: '6 pcs',
        checked: true,
        fromPantry: false,
      },
      {
        id: 'sl-04',
        name: 'Free Range Eggs',
        quantity: '12 pcs',
        checked: false,
        fromPantry: false,
        nutriScore: 'b',
        novaGroup: 1,
        isFavorite: true,
      },
      {
        id: 'sl-05',
        name: 'Pringles Original',
        quantity: '2 pcs',
        checked: true,
        fromPantry: true,
        pantryId: 'demo-10',
        nutriScore: 'd',
        novaGroup: 4,
        barcode: '5053827193994',
      },
    ],
  },
  {
    id: 'demo-list-2',
    name: 'Meal Prep',
    collapsed: false,
    createdAt: new Date().toISOString(),
    items: [
      {
        id: 'sl-06',
        name: 'Sweet Potatoes',
        quantity: '1 kg',
        checked: false,
        fromPantry: false,
        nutriScore: 'a',
        novaGroup: 1,
      },
      {
        id: 'sl-07',
        name: 'Tinned Chickpeas',
        quantity: '4 pcs',
        checked: false,
        fromPantry: false,
        nutriScore: 'a',
        novaGroup: 1,
      },
      {
        id: 'sl-08',
        name: 'Coconut Milk',
        quantity: '2 pcs',
        checked: false,
        fromPantry: false,
        nutriScore: 'c',
        novaGroup: 1,
      },
    ],
  },
];

const FAVORITES: FavoriteItem[] = [
  { id: 'fav-01', name: 'Organic Whole Milk', quantity: '2 l', nutriScore: 'b', novaGroup: 1, barcode: '5000169105017' },
  { id: 'fav-02', name: 'Free Range Eggs', quantity: '12 pcs', nutriScore: 'b', novaGroup: 1 },
  { id: 'fav-03', name: 'Greek Yogurt', quantity: '500 g', nutriScore: 'b', novaGroup: 1, barcode: '5011546301498' },
  { id: 'fav-04', name: 'Bananas', quantity: '6 pcs', nutriScore: 'a', novaGroup: 1 },
];

// ── Recent scans ───────────────────────────────────────────────────────────

const RECENT_SCANS: RecentScan[] = [
  {
    barcode: '5053827193994',
    name: 'Pringles Original',
    nutriScore: 'd',
    novaGroup: 4,
    rawScore: 22,
    offCategories: ['en:snacks', 'en:salty-snacks', 'en:chips-and-fries'],
    scannedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    barcode: '5000169105017',
    name: 'Organic Whole Milk',
    nutriScore: 'b',
    novaGroup: 1,
    rawScore: 74,
    offCategories: ['en:dairy', 'en:milks', 'en:whole-milks'],
    scannedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
  },
  {
    barcode: '7613034626844',
    name: 'Kellogg\'s Corn Flakes',
    nutriScore: 'c',
    novaGroup: 4,
    rawScore: 41,
    offCategories: ['en:cereals', 'en:breakfast-cereals', 'en:corn-flakes'],
    scannedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    barcode: '5010677800046',
    name: 'Quaker Oats',
    nutriScore: 'a',
    novaGroup: 1,
    rawScore: 91,
    offCategories: ['en:cereals', 'en:breakfast-cereals', 'en:oatmeals'],
    scannedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
  },
  {
    barcode: '5000118060019',
    name: 'Innocent Orange Smoothie',
    nutriScore: 'b',
    novaGroup: 1,
    rawScore: 68,
    offCategories: ['en:beverages', 'en:fruit-juices', 'en:smoothies'],
    scannedAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
  },
];

// ── Household profile ──────────────────────────────────────────────────────

const HOUSEHOLD_PROFILE = {
  userId: 'demo-user-alex',
  displayName: 'Alex',
  userEmoji: '🧑',
  householdName: 'The Garcia Family',
  householdCode: 'GRC492',
  members: [
    {
      id: 'demo-user-alex',
      name: 'Alex',
      emoji: '🧑',
      role: 'owner',
      joinedAt: new Date().toISOString(),
    },
    {
      id: 'demo-user-sam',
      name: 'Sam',
      emoji: '👩',
      role: 'member',
      joinedAt: new Date().toISOString(),
    },
  ],
  createdAt: new Date().toISOString(),
};

// ── Demo recall alerts ─────────────────────────────────────────────────────
// One per region so the banner shows FDA / USDA / FSA / FSSAI badges.

const DEMO_RECALLS: RecallMatch[] = [
  {
    pairId: 'fda-recall-001:demo-05',
    pantryItemId: 'demo-05',
    pantryItemName: 'Baby Spinach',
    recall: {
      id: 'fda-recall-001',
      source: 'FDA',
      productDescription: 'Organicgirl Baby Spinach — 5 oz & 16 oz bags — Lot codes L240312 & L240313',
      reason: 'Potential contamination with Listeria monocytogenes. Consuming food contaminated with Listeria can cause serious illness in young children, frail or elderly people, and others with weakened immune systems.',
      date: '20240312',
      riskLevel: 'Class I',
    },
  },
  {
    pairId: 'usda-recall-002:demo-02',
    pantryItemId: 'demo-02',
    pantryItemName: 'Free Range Chicken Breast',
    recall: {
      id: 'usda-recall-002',
      source: 'USDA',
      productDescription: 'Happy Farms Free Range Chicken Breast Fillets — 500g vacuum packs — Use By 15 Mar 2024',
      reason: 'Possible Salmonella contamination detected during routine microbiological testing. All affected products were produced on 10–11 March 2024 at facility EST. 9400.',
      date: '20240314',
      riskLevel: 'Class I',
    },
  },
  {
    pairId: 'fsa-recall-003:demo-03',
    pantryItemId: 'demo-03',
    pantryItemName: 'Mature Cheddar Cheese',
    recall: {
      id: 'fsa-recall-003',
      source: 'FSA',
      productDescription: 'Davidstow Mature Cheddar Cheese 400g — Brand: Davidstow — Batch codes: DC240101, DC240102',
      reason: 'Undeclared mustard allergen. The product contains mustard which is not declared on the label. This makes the product a possible health risk for anyone with an allergy or sensitivity to mustard.',
      date: '2024-03-10T09:00:00Z',
      riskLevel: 'Allergy alert',
    },
  },
  {
    pairId: 'fssai-recall-004:demo-11',
    pantryItemId: 'demo-11',
    pantryItemName: 'Basmati Rice',
    recall: {
      id: 'fssai-recall-004',
      source: 'FSSAI',
      productDescription: 'Golden Star Extra Long Basmati Rice 1kg — Brand: Golden Star — Batch No. GS-BR-2024-02',
      reason: 'Excessive pesticide residue (Tricyclazole) detected above permissible limits as per Food Safety and Standards (Contaminants, Toxins and Residues) Regulations. Product seized from distributor warehouses in Delhi and Mumbai.',
      date: 'Fri, 08 Mar 2024 10:30:00 +0530',
      riskLevel: 'Unsafe for consumption',
    },
  },
];

// ── Main export ────────────────────────────────────────────────────────────

export async function seedDemoData(): Promise<void> {
  await clearAll();

  // Insert pantry items sequentially to respect the write queue
  for (const item of PANTRY_ITEMS) {
    await insertItem(item);
  }

  await KVStore.setItem('@shopping_lists_v2', JSON.stringify(SHOPPING_LISTS));
  await KVStore.setItem('@shopping_favorites_v1', JSON.stringify(FAVORITES));
  await KVStore.setItem('@recent_scans_v1', JSON.stringify(RECENT_SCANS));
  await KVStore.setItem('@household_profile', JSON.stringify(HOUSEHOLD_PROFILE));
  await KVStore.setItem('@recall_alerts', JSON.stringify(DEMO_RECALLS));
  await KVStore.setItem('email_capture_shown', 'true');
}

// Static food knowledge database — no API, works offline at any scale.
// CO2 estimates: WRAP / BCF Food & Climate report (kg CO2e per item, ~300g avg item weight)
// Cost estimates: UK ONS average food prices 2024 (£ per item, ~300g avg)

export interface TipEntry {
  emoji: string;
  canFreeze: boolean;
  freezeHow?: string;
  storageTip: string;
  useIdeas: string[];
  co2PerItem: number;   // kg CO2e per wasted item
  costPerItem: number;  // £ per wasted item estimate
}

export const CATEGORY_TIPS: Record<string, TipEntry> = {
  dairy: {
    emoji: '🥛',
    canFreeze: true,
    freezeHow: 'Milk: freeze in portions — leave 10% space for expansion. Hard cheese: grate first then freeze. Butter: wrap tightly in foil.',
    storageTip: 'Store at the back of the fridge where it is coldest. The door is 4–5°C warmer — never keep milk there.',
    useIdeas: ['White sauce or béchamel', 'Pancakes or crêpes', 'Add to mashed potato', 'Rice pudding', 'Smoothie base'],
    co2PerItem: 0.96,
    costPerItem: 0.80,
  },
  meat: {
    emoji: '🥩',
    canFreeze: true,
    freezeHow: 'Freeze on the day of purchase. Wrap tightly in foil or a freezer bag, label with date. Use within 3 months.',
    storageTip: 'Store on the bottom shelf of the fridge to prevent drips. Cook or freeze within 2 days of buying.',
    useIdeas: ['Batch cook and portion for later', 'Slow cooker stew or curry', 'Stir-fry with vegetables', 'Pasta meat sauce'],
    co2PerItem: 8.10,
    costPerItem: 2.40,
  },
  seafood: {
    emoji: '🐟',
    canFreeze: true,
    freezeHow: 'Pat dry, wrap tightly and freeze same day. Use within 3 months. Thaw overnight in the fridge — never at room temperature.',
    storageTip: 'Keep at the bottom of the fridge. Eat within 1–2 days of purchase.',
    useIdeas: ['Fish pie or fish cakes', 'Pasta with seafood', 'Stir-fry with noodles', 'Chowder or soup'],
    co2PerItem: 1.53,
    costPerItem: 3.60,
  },
  produce: {
    emoji: '🥦',
    canFreeze: true,
    freezeHow: 'Blanch veg 2 min in boiling water, cool in iced water, freeze flat on a tray then bag. Most fruit: freeze in slices on a tray first.',
    storageTip: 'Store ethylene producers (bananas, apples, tomatoes) away from other veg — they speed ripening. Wrap fresh herbs in damp paper towel.',
    useIdeas: ['Blend into soup', 'Add to a smoothie', 'Quick stir-fry or sauté', 'Frittata or omelette', 'Roast with olive oil'],
    co2PerItem: 0.27,
    costPerItem: 0.60,
  },
  bakery: {
    emoji: '🍞',
    canFreeze: true,
    freezeHow: 'Slice bread before freezing. Freeze pastries in airtight bags. Reheat or toast straight from frozen — no need to defrost.',
    storageTip: 'Store in a cool dry place or freeze. Never refrigerate bread — cold air stales it faster than the counter.',
    useIdeas: ['Croutons for soup or salad', 'French toast or eggy bread', 'Bread and butter pudding', 'Breadcrumbs for coating'],
    co2PerItem: 0.33,
    costPerItem: 0.75,
  },
  frozen: {
    emoji: '🧊',
    canFreeze: true,
    storageTip: 'Keep your freezer at −18°C or below. Do not refreeze once thawed. Keep oldest items at the front so they get used first.',
    useIdeas: ['Cook from frozen per pack instructions', 'Add directly to soups or stews', 'Stir-fry straight from frozen'],
    co2PerItem: 0.60,
    costPerItem: 0.90,
  },
  canned: {
    emoji: '🥫',
    canFreeze: false,
    storageTip: 'Store in a cool dry cupboard. Once opened, transfer to a covered container and refrigerate — use within 2 days.',
    useIdeas: ['Soup or stew base', 'Quick pasta sauce', 'Rice and grain dishes', 'Bean salad'],
    co2PerItem: 0.15,
    costPerItem: 0.45,
  },
  condiments: {
    emoji: '🫙',
    canFreeze: false,
    storageTip: 'Refrigerate after opening even if the label says optional. Keep lids tight to prevent oxidation and contamination.',
    useIdeas: ['Marinade for meat or tofu', 'Salad dressing base', 'Stir into sauces', 'Dipping sauce'],
    co2PerItem: 0.24,
    costPerItem: 0.90,
  },
  beverages: {
    emoji: '🥤',
    canFreeze: true,
    freezeHow: 'Freeze into ice cubes and store in a bag — perfect for smoothies or iced drinks. Leave space in containers for expansion.',
    storageTip: 'Reseal cartons tightly and refrigerate after opening. Most juice lasts 5–7 days once opened.',
    useIdeas: ['Freeze into ice lollies', 'Blend into smoothies', 'Use in porridge or overnight oats', 'Add to sauces or marinades'],
    co2PerItem: 0.15,
    costPerItem: 0.45,
  },
  snacks: {
    emoji: '🍪',
    canFreeze: false,
    storageTip: 'Transfer to an airtight container immediately after opening to maintain freshness and crunch.',
    useIdeas: ['Crush as a crumble or tray-bake topping', 'Crumble over yogurt or ice cream', 'Add to trail mix', 'Cheesecake or pie base'],
    co2PerItem: 0.45,
    costPerItem: 1.20,
  },
  grains: {
    emoji: '🌾',
    canFreeze: true,
    freezeHow: 'Cook in large batches and freeze in individual portions. Rice, pasta, quinoa, and lentils all freeze well once cooked.',
    storageTip: 'Store dry grains in airtight containers away from moisture and light. Properly stored dry grains last 1–2 years.',
    useIdeas: ['Egg fried rice with leftover veg', 'Grain salad bowl', 'Add to soups or stews', 'Stuffed peppers'],
    co2PerItem: 0.39,
    costPerItem: 0.45,
  },
  other: {
    emoji: '📦',
    canFreeze: false,
    storageTip: 'Check the packaging for specific storage instructions.',
    useIdeas: ['Check if it works as a recipe substitute', 'Search the item name for serving ideas'],
    co2PerItem: 0.30,
    costPerItem: 0.60,
  },
};

// Best Before = quality date (usually safe after).
// Use By     = safety date (do not use after).
export const CATEGORY_DATE_LABEL: Record<string, 'use_by' | 'best_before' | 'varies'> = {
  dairy:      'varies',   // milk/yogurt = use_by; hard cheese/butter = best_before
  meat:       'use_by',
  seafood:    'use_by',
  produce:    'best_before',
  bakery:     'best_before',
  frozen:     'best_before',
  canned:     'best_before',
  condiments: 'best_before',
  beverages:  'varies',
  snacks:     'best_before',
  grains:     'best_before',
  other:      'varies',
};

export function getTip(category: string): TipEntry {
  return CATEGORY_TIPS[category] ?? CATEGORY_TIPS.other;
}

export function estimateCost(wasteByCategory: Record<string, number>): number {
  return Object.entries(wasteByCategory).reduce(
    (sum, [cat, count]) => sum + getTip(cat).costPerItem * count,
    0,
  );
}

export function estimateCO2(wasteByCategory: Record<string, number>): number {
  return Object.entries(wasteByCategory).reduce(
    (sum, [cat, count]) => sum + getTip(cat).co2PerItem * count,
    0,
  );
}

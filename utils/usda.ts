// USDA FoodData Central — free API, no OAuth required.
// Get your free key in ~30 seconds at https://api.data.gov/signup/
// Replace the placeholder below, then barcode lookups will automatically
// fall back to USDA whenever Open Food Facts is unavailable.
export const USDA_API_KEY = 'rCv14lubu5sLhNZGc3J1YnQJOKVt9vWppk9MNv7b';

const BASE = 'https://api.nal.usda.gov/fdc/v1';

export interface UsdaResult {
  name?: string;
  brand?: string;
  /** 0–100 health score computed from USDA nutrient data */
  score?: number;
  nutrients?: UsdaNutrientsPer100g;
}

export interface UsdaNutrientsPer100g {
  kcal?: number;
  fat?: number;
  saturatedFat?: number;
  carbs?: number;
  sugar?: number;
  fiber?: number;
  protein?: number;
  /** mg per 100 g */
  sodium?: number;
}

// USDA nutrient IDs that are stable across databases
const IDS = {
  kcal: 1008,
  fat: 1004,
  saturatedFat: 1258,
  carbs: 1005,
  sugar: 2000,
  fiber: 1079,
  protein: 1003,
  sodium: 1093,
} as const;

function extractNutrients(
  foodNutrients: { nutrientId?: number; nutrientName?: string; value?: number }[],
  servingSize?: number,
  servingSizeUnit?: string
): UsdaNutrientsPer100g {
  const map: Record<number, number> = {};
  for (const n of foodNutrients) {
    if (n.nutrientId !== undefined && n.value !== undefined) map[n.nutrientId] = n.value;
  }

  // USDA branded foods report nutrients per serving; scale to per 100 g/ml.
  // SR-Legacy and Foundation foods already report per 100 g.
  const unit = (servingSizeUnit ?? '').toLowerCase();
  const isPerServing = servingSize !== undefined && servingSize > 0 && (unit === 'g' || unit === 'ml');
  const scale = isPerServing ? 100 / servingSize : 1;

  const v = (id: number) => map[id] !== undefined ? map[id] * scale : undefined;
  return {
    kcal:         v(IDS.kcal),
    fat:          v(IDS.fat),
    saturatedFat: v(IDS.saturatedFat),
    carbs:        v(IDS.carbs),
    sugar:        v(IDS.sugar),
    fiber:        v(IDS.fiber),
    protein:      v(IDS.protein),
    sodium:       v(IDS.sodium),
  };
}

/** Compute a 0–100 health score from USDA nutritional data (per 100 g). */
export function scoreFromUsdaNutrients(n: UsdaNutrientsPer100g): number {
  let score = 100;

  // ── Negative factors ───────────────────────────────
  const kcal = n.kcal ?? 0;
  if (kcal > 400) score -= 20;
  else if (kcal > 250) score -= 12;
  else if (kcal > 150) score -= 5;

  const satFat = n.saturatedFat ?? 0;
  if (satFat > 10) score -= 15;
  else if (satFat > 5) score -= 8;
  else if (satFat > 2) score -= 4;

  const sugar = n.sugar ?? 0;
  if (sugar > 22.5) score -= 15;
  else if (sugar > 12) score -= 8;
  else if (sugar > 5) score -= 4;

  const sodium = n.sodium ?? 0;
  if (sodium > 600) score -= 15;
  else if (sodium > 300) score -= 8;
  else if (sodium > 100) score -= 4;

  // ── Positive factors ───────────────────────────────
  const fiber = n.fiber ?? 0;
  if (fiber > 4.7) score += 10;
  else if (fiber > 3.5) score += 7;
  else if (fiber > 2.8) score += 5;
  else if (fiber > 1.9) score += 3;

  const protein = n.protein ?? 0;
  if (protein > 8) score += 10;
  else if (protein > 6.4) score += 7;
  else if (protein > 4.8) score += 5;
  else if (protein > 3.2) score += 3;

  return Math.max(0, Math.min(100, score));
}

function fetchWithTimeout(url: string, ms = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

export async function lookupBarcodeOnUsda(barcode: string): Promise<UsdaResult> {
  if (!USDA_API_KEY) return {};

  try {
    // FoodData Central barcode search — GTIN/UPC barcodes map directly
    const url =
      `${BASE}/foods/search?query=${encodeURIComponent(barcode)}` +
      `&dataType=Branded&pageSize=1&api_key=${USDA_API_KEY}`;

    const res = await fetchWithTimeout(url);
    if (!res.ok) return {};

    const json = await res.json();
    const food = json?.foods?.[0];
    if (!food) return {};

    // Prefer exact barcode match
    if (food.gtinUpc && food.gtinUpc !== barcode) return {};

    const nutrients = extractNutrients(
      food.foodNutrients ?? [],
      food.servingSize,
      food.servingSizeUnit
    );
    const score = scoreFromUsdaNutrients(nutrients);

    return {
      name: food.description ?? undefined,
      brand: food.brandOwner ?? food.brandName ?? undefined,
      score,
      nutrients,
    };
  } catch {
    return {};
  }
}

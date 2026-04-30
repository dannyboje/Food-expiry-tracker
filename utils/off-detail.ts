export interface OFFNutrients {
  energyKcal?: number;
  fat?: number;
  saturatedFat?: number;
  carbohydrates?: number;
  sugars?: number;
  fiber?: number;
  proteins?: number;
  salt?: number;
}

export interface OFFDetail {
  nutrients: OFFNutrients;
  additives: string[];      // cleaned E-numbers e.g. ['E150D', 'E330']
  ingredientsText?: string;
}

export async function fetchOFFDetail(barcode: string): Promise<OFFDetail | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const url =
      `https://world.openfoodfacts.org/api/v2/product/${barcode}` +
      `?fields=nutriments,additives_tags,ingredients_text_en,ingredients_text`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = await res.json();
    if (json.status !== 1 || !json.product) return null;

    const p = json.product;
    const n: Record<string, number> = p.nutriments ?? {};

    const energyKcal =
      n['energy-kcal_100g'] !== undefined
        ? n['energy-kcal_100g']
        : n['energy_100g'] !== undefined
          ? Math.round(n['energy_100g'] / 4.184)
          : undefined;

    const nutrients: OFFNutrients = {
      energyKcal,
      fat: n['fat_100g'],
      saturatedFat: n['saturated-fat_100g'],
      carbohydrates: n['carbohydrates_100g'],
      sugars: n['sugars_100g'],
      fiber: n['fiber_100g'],
      proteins: n['proteins_100g'],
      salt: n['salt_100g'],
    };

    const additives: string[] = ((p.additives_tags as string[]) ?? [])
      .map((tag) => tag.replace(/^[a-z]{2}:/, '').toUpperCase())
      .filter((e) => /^E\d/.test(e));

    const ingredientsText: string | undefined =
      p.ingredients_text_en || p.ingredients_text || undefined;

    return { nutrients, additives, ingredientsText };
  } catch {
    clearTimeout(timer);
    return null;
  }
}

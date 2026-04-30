// Nutri-Score A–E → 0–100 points
const NUTRI_POINTS: Record<string, number> = { a: 100, b: 75, c: 50, d: 25, e: 0 };
// NOVA 1–4 (processing level) → 0–100 points
const NOVA_POINTS: Record<number, number> = { 1: 100, 2: 75, 3: 40, 4: 0 };

/**
 * Composite score. Priority:
 *  1. OFF Nutri-Score + NOVA combined (70/30 weighting)
 *  2. Whichever OFF signal is available alone
 *  3. rawScore stored on the item (USDA-derived fallback)
 */
export function computeScore(
  nutriScore?: string,
  novaGroup?: number,
  rawScore?: number
): number | undefined {
  const ns = nutriScore !== undefined ? NUTRI_POINTS[nutriScore] : undefined;
  const nova = novaGroup !== undefined ? NOVA_POINTS[novaGroup] : undefined;
  if (ns !== undefined && nova !== undefined) return Math.round(ns * 0.7 + nova * 0.3);
  if (ns !== undefined) return ns;
  if (nova !== undefined) return nova;
  if (rawScore !== undefined) return Math.max(0, Math.min(100, Math.round(rawScore)));
  return undefined;
}

// 5-tier A–E bands: 80-100=A, 60-79=B, 40-59=C, 20-39=D, 0-19=E
export function scoreColor(score: number): string {
  if (score >= 80) return '#1EA54C';
  if (score >= 60) return '#85BB2F';
  if (score >= 40) return '#F5C900';
  if (score >= 20) return '#EF8714';
  return '#E63E11';
}

export function scoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  if (score >= 20) return 'Poor';
  return 'Bad';
}

import { Animated, ActivityIndicator, Image, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { Brand } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { computeScore, scoreColor, scoreLabel } from '@/utils/food-score';
import { lookupBarcodeOnUsda } from '@/utils/usda';
import { lookupProductByBarcode, mapCategory } from '@/utils/search-a-licious';
import { fetchOFFDetail, type OFFDetail } from '@/utils/off-detail';
import { classifyAdditives, computeAdditiveModifier } from '@/utils/additive-classifier';
import { saveRecentScan } from '@/utils/recent-scans-store';
import { getSuggestedExpiryDate } from '@/utils/shelf-life-defaults';
import { fetchAlternatives, resolveUserCountryTag, formatCountryTag } from '@/utils/alternatives';
import type { ProductAlternative } from '@/types/food-item';


interface ScanResult {
  barcode: string;
  name?: string;
  category?: string;
  /** Raw categories_tags from Open Food Facts — used for accurate alternative lookups */
  offCategories?: string[];
  /** First countries_tags entry from OFF (e.g. "en:united-kingdom") — used to localise alternatives */
  countryTag?: string;
  nutriScore?: string;
  novaGroup?: number;
  /** Direct 0–100 score from USDA (used only when OFF has no data) */
  fatSecretScore?: number;
  /** Which API provided the score */
  scoreSource?: 'openfoodfacts' | 'usda' | 'search-a-licious';
  /** YYYY-MM-DD expiry estimate based on category shelf life */
  suggestedExpiryDate?: string;
  /** Healthier alternatives surfaced during the scan — stored with the pantry item */
  alternatives?: ProductAlternative[];
  /** True when all upstream sources returned no data (e.g. OFf server outage) */
  allSourcesFailed?: boolean;
  /** True when the product is non-food (bags, packaging, household items, etc.) */
  isNonFood?: boolean;
}

// Category tags that identify non-food / non-drink products in Open Food Facts
const NON_FOOD_TAGS = new Set([
  'en:non-food-products', 'en:non-food',
  'en:bags', 'en:reusable-bags', 'en:carrier-bags', 'en:plastic-bags',
  'en:shopping-bags', 'en:tote-bags', 'en:grocery-bags',
  'en:packaging', 'en:packaging-materials',
  'en:household-products', 'en:cleaning-products', 'en:cleaning',
  'en:cosmetics', 'en:beauty-products', 'en:personal-care',
  'en:textiles', 'en:clothing', 'en:paper-products',
  'en:bin-bags', 'en:bin-liners', 'en:refuse-sacks',
]);

// Name fragments that unambiguously identify non-food items.
// Kept narrow on purpose — a false positive hides nutrition for real food.
const NON_FOOD_NAME_RE = /\b(bag\s+for\s+life|bags\s+for\s+life|carrier\s+bag|shopping\s+bag|reusable\s+bag|plastic\s+bag|tote\s+bag|bin\s+bag|bin\s+liner|refuse\s+sack|kitchen\s+roll|toilet\s+(paper|tissue|roll)|baby\s+wipe|wet\s+wipe|cleaning\s+wipe|nappy|diaper)\b/i;

function detectNonFood(tags: string[], productName?: string): boolean {
  // 1. Exact OFF category tag match
  if (tags.some(t => NON_FOOD_TAGS.has(t))) return true;
  // 2. Substring scan across all category tags
  const joined = tags.join(' ');
  if (
    joined.includes('non-food') ||
    joined.includes(':bags') ||
    joined.includes('packaging-material') ||
    joined.includes('household-product') ||
    joined.includes('cleaning-product')
  ) return true;
  // 3. Fallback: product name contains an unambiguous non-food phrase
  if (productName && NON_FOOD_NAME_RE.test(productName)) return true;
  return false;
}

interface Props {
  onScan: (result: ScanResult) => void;
  onCancel: () => void;
}

const NOVA_LABEL: Record<number, string> = {
  1: 'Unprocessed', 2: 'Culinary ingredient', 3: 'Processed', 4: 'Ultra-processed',
};

const SCORE_LETTER_COLOR: Record<string, string> = {
  a: '#1EA54C', b: '#85BB2F', c: '#F5C900', d: '#EF8714', e: '#E63E11',
};

function fetchWithTimeout(url: string, ms = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

// UK FSA traffic-light thresholds per 100g
const TRAFFIC_THRESHOLDS: Record<string, [number, number]> = {
  fat: [3, 17.5], saturatedFat: [1.5, 5], sugars: [5, 22.5], salt: [0.3, 1.5],
};
function trafficColor(key: string, value: number): string {
  const t = TRAFFIC_THRESHOLDS[key];
  if (!t) return '#374151';
  if (value < t[0]) return '#1EA54C';
  if (value < t[1]) return '#EF8714';
  return '#E63E11';
}

async function lookupOnOpenFoodFacts(barcode: string): Promise<Omit<ScanResult, 'barcode'>> {
  try {
    // v2 API with field selection is faster and more reliable than v0
    const fields = 'product_name,brands,categories_tags,countries_tags,nutriscore_grade,nutrition_grade_fr,nova_group';
    const res = await fetchWithTimeout(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}?fields=${fields}`
    );
    // Check Content-Type — OFf returns an HTML error page on 502/503 outages
    const ct = res.headers.get('content-type') ?? '';
    if (!res.ok || !ct.includes('json')) return {};
    const json = await res.json();
    if (json.status === 1 && json.product) {
      const p = json.product;
      const name = p.product_name || p.product_name_en;
      const brand = p.brands;
      const categoriesTags: string[] = Array.isArray(p.categories_tags) ? p.categories_tags : [];
      const countriesTags: string[] = Array.isArray(p.countries_tags) ? p.countries_tags : [];
      const rawScore: string | undefined = p.nutriscore_grade || p.nutrition_grade_fr;
      const nutriScore = rawScore ? rawScore.toLowerCase() : undefined;
      const novaGroup = p.nova_group ? Number(p.nova_group) : undefined;
      const validNutriScore = ['a', 'b', 'c', 'd', 'e'].includes(nutriScore ?? '') ? nutriScore : undefined;
      const validNova = novaGroup && novaGroup >= 1 && novaGroup <= 4 ? novaGroup : undefined;
      const displayName = [name, brand].filter(Boolean).join(' — ') || undefined;
      const isNonFood = detectNonFood(categoriesTags, displayName);
      return {
        name: displayName,
        category: mapCategory(categoriesTags[0] ?? ''),
        offCategories: categoriesTags,
        countryTag: countriesTags[0] ?? undefined,
        nutriScore: isNonFood ? undefined : validNutriScore,
        novaGroup: isNonFood ? undefined : validNova,
        scoreSource: (!isNonFood && (validNutriScore || validNova)) ? 'openfoodfacts' : undefined,
        isNonFood,
      };
    }
  } catch {
    // network error or timeout
  }
  return {};
}

async function lookupBarcode(barcode: string): Promise<Omit<ScanResult, 'barcode'>> {
  // Try Open Food Facts first
  const off = await lookupOnOpenFoodFacts(barcode);

  // If OFF gave us a score we're done
  if (off.nutriScore || off.novaGroup) return off;

  // OFF is down or has no score data — try USDA FoodData Central
  try {
    const usda = await lookupBarcodeOnUsda(barcode);
    if (usda.score !== undefined || usda.name) {
      const displayName = off.name ?? (usda.brand ? `${usda.name ?? ''} — ${usda.brand}` : usda.name) ?? undefined;
      return {
        name: displayName,
        category: off.category,
        offCategories: off.offCategories,
        countryTag: off.countryTag,
        fatSecretScore: usda.score,
        scoreSource: usda.score !== undefined ? 'usda' : undefined,
      };
    }
  } catch {
    // USDA also failed — fall through to Search-a-licious
  }

  // Last resort: Search-a-licious (Elasticsearch-backed OFf search)
  try {
    const sal = await lookupProductByBarcode(barcode);
    if (sal) {
      return {
        name: off.name ?? sal.name,
        category: off.category ?? (sal.offCategories[0] ? mapCategory(sal.offCategories[0]) : undefined),
        offCategories: off.offCategories ?? sal.offCategories,
        countryTag: off.countryTag,
        nutriScore: sal.nutriScore,
        novaGroup: sal.novaGroup,
        scoreSource: sal.nutriScore || sal.novaGroup ? 'search-a-licious' : undefined,
      };
    }
  } catch {
    // All sources exhausted
  }

  // Nothing found anywhere — flag it so the UI can show a meaningful message
  return { ...off, allSourcesFailed: !off.name };
}

// Local alias — ProductAlternative is the same shape, imported for type safety
type Alternative = ProductAlternative;

function openShoppingSearch(name: string, brand?: string) {
  const q = [brand, name].filter(Boolean).join(' ');
  Linking.openURL(`https://www.google.com/search?tbm=shop&q=${encodeURIComponent(q)}`).catch(() => {
    // Fallback to plain search if Shopping URL can't be opened (e.g. simulator restriction)
    Linking.openURL(`https://www.google.com/search?q=${encodeURIComponent(q)}+buy+online`).catch(() => {});
  });
}

function ScannerFrame() {
  const scanAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(scanAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  }, [scanAnim]);

  const translateY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 126],
  });

  return (
    <View style={styles.guideFrame}>
      <View style={[styles.cornerAccent, { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 }]} />
      <View style={[styles.cornerAccent, { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 }]} />
      <View style={[styles.cornerAccent, { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 }]} />
      <View style={[styles.cornerAccent, { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 }]} />
      <Animated.View style={[styles.scanLineWrap, { transform: [{ translateY }] }]}>
        <View style={styles.scanLineGlow} />
        <View style={styles.scanLine} />
        <View style={styles.scanLineGlow} />
      </Animated.View>
    </View>
  );
}

export function BarcodeScannerView({ onScan, onCancel }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  // useRef so the guard is synchronous — useState is async and lets duplicate
  // camera events slip through before the state update settles.
  const scanLock = useRef(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [alternatives, setAlternatives] = useState<Alternative[]>([]);
  const [altsWereLocal, setAltsWereLocal] = useState(false);
  const [loadingAlts, setLoadingAlts] = useState(false);
  const [userCountryTag, setUserCountryTag] = useState<string | undefined>();
  const [offDetail, setOffDetail] = useState<OFFDetail | null | 'loading'>(null);

  // Resolve user's GPS country once on mount — used to find locally-available alternatives
  useEffect(() => {
    resolveUserCountryTag().then(setUserCountryTag);
  }, []);

  // Fetch nutritional detail whenever a scan result arrives — skip for non-food items
  useEffect(() => {
    if (!result?.barcode || result.isNonFood) { setOffDetail(null); return; }
    setOffDetail('loading');
    fetchOFFDetail(result.barcode).then(setOffDetail);
  }, [result?.barcode, result?.isNonFood]);

  useEffect(() => {
    if (!result || result.isNonFood) { setAlternatives([]); setAltsWereLocal(false); setLoadingAlts(false); return; }

    // Only suggest alternatives for Fair and below (score < 60).
    // Good / Excellent products don't need a healthier alternative.
    const resultScore = computeScore(result.nutriScore, result.novaGroup, result.fatSecretScore);
    if (resultScore !== undefined && resultScore >= 60) {
      setAlternatives([]);
      setAltsWereLocal(false);
      setLoadingAlts(false);
      return;
    }

    let cancelled = false;
    setLoadingAlts(true);
    const countryForAlts = userCountryTag ?? result.countryTag;
    fetchAlternatives(result.offCategories ?? [], countryForAlts).then(({ alts, wasLocal }) => {
      if (cancelled) return;
      setAlternatives(alts);
      setAltsWereLocal(wasLocal);
      setLoadingAlts(false);
    });
    return () => { cancelled = true; };
  }, [result, userCountryTag]);

  async function handleBarcode(data: string) {
    if (scanLock.current) return;
    scanLock.current = true;
    setLoading(true);
    const info = await lookupBarcode(data);
    setLoading(false);
    const suggestedExpiryDate = getSuggestedExpiryDate(info.category);
    const full = { barcode: data, ...info, suggestedExpiryDate };
    setResult(full);
    // Persist every scan so Health Scores can show recently scanned products
    saveRecentScan({
      barcode: data,
      name: full.name ?? `Barcode ${data}`,
      nutriScore: full.nutriScore,
      novaGroup: full.novaGroup,
      rawScore: full.fatSecretScore,
      offCategories: full.offCategories,
      scannedAt: new Date().toISOString(),
    });
  }

  function handleAddToPantry() {
    if (result) onScan({ ...result, alternatives: alternatives.length > 0 ? alternatives : undefined });
  }

  function handleScanAgain() {
    setResult(null);
    setAlternatives([]);
    setAltsWereLocal(false);
    setOffDetail(null);
    scanLock.current = false;
  }

  if (!permission) return null;

  if (!permission.granted) {
    return (
      <View style={styles.permContainer}>
        <Text style={styles.permText}>Camera access is needed to scan barcodes.</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Allow Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onCancel} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const baseScore = result
    ? computeScore(result.nutriScore, result.novaGroup, result.fatSecretScore)
    : undefined;

  // Adjust score once additive data is available — harmful additives reduce it,
  // safe additives barely move it (see computeAdditiveModifier for caps).
  const { score, scoreAdjustment } = (() => {
    if (baseScore === undefined || !offDetail || offDetail === 'loading') {
      return { score: baseScore, scoreAdjustment: 0 };
    }
    const { harmful, preservatives, safe } = classifyAdditives(offDetail.additives ?? []);
    const modifier = computeAdditiveModifier(harmful, preservatives, safe);
    const adjusted = modifier !== 0
      ? Math.max(0, Math.min(100, Math.round(baseScore + modifier)))
      : baseScore;
    return { score: adjusted, scoreAdjustment: adjusted - baseScore };
  })();

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr', 'code128', 'code39'] }}
        onBarcodeScanned={({ data }) => handleBarcode(data)}>
        <View style={styles.overlay}>
          <View style={styles.topBar}>
            <TouchableOpacity onPress={onCancel} style={styles.backBtn}>
              <IconSymbol name="xmark" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.title}>Scan Barcode</Text>
            <View style={{ width: 44 }} />
          </View>

          {!result && (
            <View style={styles.guideBox}>
              <ScannerFrame />
              <Text style={styles.guideHint}>Point at the barcode on the packaging</Text>
            </View>
          )}

          {loading && (
            <View style={styles.loadingBox}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.loadingText}>Looking up product…</Text>
            </View>
          )}
        </View>
      </CameraView>

      {/* Score result card — slides up after scan */}
      {result && !loading && (
        <View style={styles.resultCard}>
          <ScrollView
            style={styles.resultScroll}
            contentContainerStyle={styles.resultScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">

            {/* Score circle + product name */}
            <View style={styles.scoreRow}>
              {score !== undefined ? (
                <View style={[styles.scoreCircle, { borderColor: scoreColor(score) }]}>
                  <Text style={[styles.scoreNumber, { color: scoreColor(score) }]}>{score}</Text>
                  <Text style={[styles.scoreOutOf, { color: scoreColor(score) }]}>/100</Text>
                </View>
              ) : (
                <View style={[styles.scoreCircle, { borderColor: '#D1D5DB' }]}>
                  <Text style={[styles.scoreNumber, { color: '#9CA3AF' }]}>—</Text>
                </View>
              )}

              <View style={styles.scoreDetails}>
                <Text style={styles.productName} numberOfLines={2}>
                  {result.name ?? `Barcode ${result.barcode}`}
                </Text>
                {score !== undefined && !result.isNonFood && (
                  <Text style={[styles.scoreLabelText, { color: scoreColor(score) }]}>
                    {scoreLabel(score)}
                  </Text>
                )}
                {scoreAdjustment < 0 && !result.isNonFood && (
                  <Text style={styles.scoreAdjustNote}>{scoreAdjustment} for additives</Text>
                )}
                {result.isNonFood && (
                  <Text style={styles.noScoreText}>
                    Fresh Ahead doesn't rate these types of products
                  </Text>
                )}
                {!result.isNonFood && score === undefined && !result.allSourcesFailed && (
                  <Text style={styles.noScoreText}>No score data available</Text>
                )}
                {result.allSourcesFailed && (
                  <Text style={styles.noScoreText}>
                    Product database temporarily unavailable — you can still add this item manually
                  </Text>
                )}
              </View>
            </View>

            {/* Nutri-Score + NOVA breakdown */}
            {(result.nutriScore || result.novaGroup) && (
              <View style={styles.breakdown}>
                {result.nutriScore && (
                  <View style={styles.breakdownItem}>
                    <View style={[styles.gradeBox, { backgroundColor: SCORE_LETTER_COLOR[result.nutriScore] }]}>
                      <Text style={styles.gradeLetter}>{result.nutriScore.toUpperCase()}</Text>
                    </View>
                    <View>
                      <Text style={styles.breakdownLabel}>Nutri-Score</Text>
                      <Text style={styles.breakdownSub}>Nutritional quality</Text>
                    </View>
                  </View>
                )}
                {result.novaGroup && (
                  <View style={styles.breakdownItem}>
                    <View style={[styles.gradeBox, { backgroundColor: '#6B7280' }]}>
                      <Text style={styles.gradeLetter}>{result.novaGroup}</Text>
                    </View>
                    <View>
                      <Text style={styles.breakdownLabel}>NOVA {result.novaGroup}</Text>
                      <Text style={styles.breakdownSub}>{NOVA_LABEL[result.novaGroup]}</Text>
                    </View>
                  </View>
                )}
              </View>
            )}

            {result?.scoreSource && (
              <View style={styles.scoreSource}>
                <Text style={styles.sourceText}>
                  {result.scoreSource === 'usda'
                    ? 'Score via USDA FoodData Central'
                    : result.scoreSource === 'search-a-licious'
                    ? 'Score via Search-a-licious · Open Food Facts'
                    : 'Score via Open Food Facts'}
                </Text>
              </View>
            )}

            {/* Nutrition facts — fetched in background after scan; hidden for non-food items */}
            {!result?.isNonFood && offDetail !== null && (
              <View style={styles.nutritionSection}>
                <Text style={styles.nutritionTitle}>Nutrition per 100g</Text>
                {offDetail === 'loading' ? (
                  <ActivityIndicator size="small" color="#9CA3AF" style={{ alignSelf: 'flex-start', marginTop: 4 }} />
                ) : offDetail?.nutrients && Object.values(offDetail.nutrients).some(v => v !== undefined) ? (
                  <>
                    <View style={styles.nutritionGrid}>
                      {offDetail.nutrients.energyKcal !== undefined && (
                        <View style={styles.nutritionRow}>
                          <Text style={styles.nutritionLabel}>⚡ Energy</Text>
                          <Text style={styles.nutritionValue}>{offDetail.nutrients.energyKcal.toFixed(0)} kcal</Text>
                        </View>
                      )}
                      {offDetail.nutrients.fat !== undefined && (
                        <View style={styles.nutritionRow}>
                          <Text style={styles.nutritionLabel}>🧈 Fat</Text>
                          <Text style={[styles.nutritionValue, { color: trafficColor('fat', offDetail.nutrients.fat) }]}>
                            {offDetail.nutrients.fat.toFixed(1)}g
                          </Text>
                        </View>
                      )}
                      {offDetail.nutrients.saturatedFat !== undefined && (
                        <View style={styles.nutritionRow}>
                          <Text style={[styles.nutritionLabel, styles.nutritionIndent]}>💧 Sat fat</Text>
                          <Text style={[styles.nutritionValue, { color: trafficColor('saturatedFat', offDetail.nutrients.saturatedFat) }]}>
                            {offDetail.nutrients.saturatedFat.toFixed(1)}g
                          </Text>
                        </View>
                      )}
                      {offDetail.nutrients.carbohydrates !== undefined && (
                        <View style={styles.nutritionRow}>
                          <Text style={styles.nutritionLabel}>🌾 Carbs</Text>
                          <Text style={styles.nutritionValue}>{offDetail.nutrients.carbohydrates.toFixed(1)}g</Text>
                        </View>
                      )}
                      {offDetail.nutrients.sugars !== undefined && (
                        <View style={styles.nutritionRow}>
                          <Text style={[styles.nutritionLabel, styles.nutritionIndent]}>🍬 Sugars</Text>
                          <Text style={[styles.nutritionValue, { color: trafficColor('sugars', offDetail.nutrients.sugars) }]}>
                            {offDetail.nutrients.sugars.toFixed(1)}g
                          </Text>
                        </View>
                      )}
                      {offDetail.nutrients.proteins !== undefined && (
                        <View style={styles.nutritionRow}>
                          <Text style={styles.nutritionLabel}>💪 Protein</Text>
                          <Text style={styles.nutritionValue}>{offDetail.nutrients.proteins.toFixed(1)}g</Text>
                        </View>
                      )}
                      {offDetail.nutrients.salt !== undefined && (
                        <View style={styles.nutritionRow}>
                          <Text style={styles.nutritionLabel}>🧂 Salt</Text>
                          <Text style={[styles.nutritionValue, { color: trafficColor('salt', offDetail.nutrients.salt) }]}>
                            {offDetail.nutrients.salt.toFixed(2)}g
                          </Text>
                        </View>
                      )}
                    </View>
                    {offDetail.additives.length > 0 && (() => {
                      const { harmful, preservatives, safe } = classifyAdditives(offDetail.additives);
                      return (
                        <View style={styles.additivesSection}>
                          <Text style={styles.nutritionTitle}>Additives</Text>
                          {harmful.length > 0 && (
                            <View style={styles.additivesRow}>
                              <Text style={[styles.additivesLabel, { color: '#DC2626' }]}>☠️ Harmful</Text>
                              <View style={[styles.additiveBadge, { backgroundColor: '#FEE2E2' }]}>
                                <Text style={[styles.additiveBadgeText, { color: '#DC2626' }]}>{harmful.length}</Text>
                              </View>
                              <Text style={[styles.additivesText, { color: '#DC2626' }]} numberOfLines={2}>
                                {harmful.join('  ·  ')}
                              </Text>
                            </View>
                          )}
                          {preservatives.length > 0 && (
                            <View style={[styles.additivesRow, harmful.length > 0 && { borderTopColor: '#BFDBFE' }]}>
                              <Text style={[styles.additivesLabel, { color: '#2563EB' }]}>🧪 Preservatives</Text>
                              <View style={[styles.additiveBadge, { backgroundColor: '#DBEAFE' }]}>
                                <Text style={[styles.additiveBadgeText, { color: '#2563EB' }]}>{preservatives.length}</Text>
                              </View>
                              <Text style={[styles.additivesText, { color: '#2563EB' }]} numberOfLines={2}>
                                {preservatives.join('  ·  ')}
                              </Text>
                            </View>
                          )}
                          {safe.length > 0 && (
                            <View style={[styles.additivesRow, (harmful.length > 0 || preservatives.length > 0) && { borderTopColor: '#FED7AA' }]}>
                              <Text style={[styles.additivesLabel, { color: '#D97706' }]}>🌱 Generally safe</Text>
                              <View style={[styles.additiveBadge, { backgroundColor: '#FEF3C7' }]}>
                                <Text style={[styles.additiveBadgeText, { color: '#D97706' }]}>{safe.length}</Text>
                              </View>
                              <Text style={[styles.additivesText, { color: '#D97706' }]} numberOfLines={2}>
                                {safe.join('  ·  ')}
                              </Text>
                            </View>
                          )}
                        </View>
                      );
                    })()}
                  </>
                ) : null}
              </View>
            )}

            {/* Healthier alternatives — only for Fair / Poor / Bad food scores */}
            {!result?.isNonFood && (score === undefined || score < 60) && (
              <View style={styles.altsSection}>
                <View style={styles.altsTitleRow}>
                  <Text style={styles.altsTitle}>Healthier alternatives</Text>
                  {altsWereLocal && (userCountryTag ?? result.countryTag) && (
                    <Text style={styles.altsCountry}>
                      {`Local to ${formatCountryTag(userCountryTag ?? result.countryTag ?? '')}`}
                    </Text>
                  )}
                </View>
                {loadingAlts ? (
                  <ActivityIndicator color={Brand.green} size="small" style={{ alignSelf: 'flex-start', marginTop: 4 }} />
                ) : alternatives.length > 0 ? (
                  alternatives.map((alt) => {
                    const altScore = computeScore(alt.nutriScore, alt.novaGroup, undefined);
                    return (
                      <View key={alt.barcode} style={styles.altRow}>
                        {alt.imageUri
                          ? <Image source={{ uri: alt.imageUri }} style={styles.altImage} />
                          : <View style={[styles.altImagePlaceholder, { backgroundColor: SCORE_LETTER_COLOR[alt.nutriScore] ?? '#1EA54C' }]}>
                              <Text style={styles.altGradeLetter}>{alt.nutriScore.toUpperCase()}</Text>
                            </View>
                        }
                        <View style={styles.altInfo}>
                          <Text style={styles.altName} numberOfLines={1}>{alt.name}</Text>
                          {alt.brand ? <Text style={styles.altBrand} numberOfLines={1}>{alt.brand}</Text> : null}
                        </View>
                        <View style={styles.altRating}>
                          {altScore !== undefined && (
                            <Text style={[styles.altScoreNum, { color: SCORE_LETTER_COLOR[alt.nutriScore] ?? '#1EA54C' }]}>
                              {altScore}
                            </Text>
                          )}
                          <View style={[styles.altGradeBadge, { backgroundColor: SCORE_LETTER_COLOR[alt.nutriScore] ?? '#1EA54C' }]}>
                            <Text style={styles.altGradeLetter}>{alt.nutriScore.toUpperCase()}</Text>
                          </View>
                        </View>
                        <TouchableOpacity
                          style={styles.altShopBtn}
                          onPress={() => openShoppingSearch(alt.name, alt.brand)}
                          hitSlop={8}>
                          <IconSymbol name="cart.fill" size={16} color={Brand.green} />
                        </TouchableOpacity>
                      </View>
                    );
                  })
                ) : (
                  <Text style={styles.altsNone}>No alternatives found for this product</Text>
                )}
              </View>
            )}

          </ScrollView>

          {/* Pinned action buttons */}
          <View style={styles.resultActions}>
            <TouchableOpacity style={styles.addBtn} onPress={handleAddToPantry}>
              <Text style={styles.addBtnText}>Want it? Start adding to Pantry</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.scanAgainBtn} onPress={handleScanAgain}>
              <Text style={styles.scanAgainText}>Scan Another</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  overlay: { flex: 1, justifyContent: 'space-between' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: { padding: 10 },
  title: { color: '#fff', fontSize: 17, fontWeight: '700' },
  guideBox: {
    alignItems: 'center',
    gap: 16,
    paddingBottom: 120,
  },
  guideFrame: {
    width: 260,
    height: 140,
    borderRadius: 10,
    backgroundColor: 'rgba(34,197,94,0.05)',
    overflow: 'hidden',
  },
  cornerAccent: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderColor: Brand.green,
    borderRadius: 3,
  },
  scanLineWrap: {
    width: '100%',
  },
  scanLineGlow: {
    height: 6,
    backgroundColor: 'rgba(34,197,94,0.18)',
  },
  scanLine: {
    height: 2,
    backgroundColor: Brand.green,
    shadowColor: Brand.green,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  guideHint: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginBottom: 60,
  },
  loadingText: { color: '#fff', fontSize: 14 },
  // Result card — scrollable with pinned action buttons
  resultCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '86%',
  },
  resultScroll: { flex: 0 },
  resultScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
    gap: 16,
  },
  resultActions: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  scoreCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  scoreNumber: { fontSize: 26, fontWeight: '900', lineHeight: 30 },
  scoreOutOf: { fontSize: 11, fontWeight: '600', marginTop: -2 },
  scoreDetails: { flex: 1, gap: 4 },
  productName: { fontSize: 16, fontWeight: '700', color: '#111827' },
  scoreLabelText: { fontSize: 14, fontWeight: '700' },
  noScoreText: { fontSize: 13, color: '#9CA3AF' },
  scoreAdjustNote: { fontSize: 11, color: '#EF8714', fontWeight: '600' },
  breakdown: {
    flexDirection: 'row',
    gap: 12,
  },
  breakdownItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 10,
  },
  gradeBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradeLetter: { color: '#fff', fontSize: 16, fontWeight: '900' },
  breakdownLabel: { fontSize: 13, fontWeight: '700', color: '#111827' },
  breakdownSub: { fontSize: 11, color: '#6B7280' },
  scoreSource: { alignItems: 'center' },
  sourceText: { fontSize: 11, color: '#9CA3AF' },
  addBtn: {
    backgroundColor: Brand.green,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  addBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  scanAgainBtn: { alignItems: 'center', paddingVertical: 4 },
  scanAgainText: { fontSize: 15, color: '#6B7280', fontWeight: '600' },
  altsSection: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  altsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  altsTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#166534',
    letterSpacing: 0.2,
  },
  altsCountry: {
    fontSize: 11,
    color: '#4ADE80',
    fontWeight: '600',
  },
  altRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  altImage: {
    width: 60,
    height: 60,
    borderRadius: 10,
    resizeMode: 'contain',
    backgroundColor: '#F9FAFB',
    flexShrink: 0,
  },
  altImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  altRating: { alignItems: 'center', gap: 2, flexShrink: 0 },
  altScoreNum: { fontSize: 13, fontWeight: '900', lineHeight: 15 },
  altGradeBadge: {
    width: 26,
    height: 26,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  altGradeLetter: { color: '#fff', fontSize: 12, fontWeight: '900' },
  altShopBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  altInfo: { flex: 1 },
  altName: { fontSize: 13, fontWeight: '600', color: '#111827' },
  altBrand: { fontSize: 11, color: '#6B7280', marginTop: 1 },
  altsNone: { fontSize: 12, color: '#6B7280', fontStyle: 'italic' },
  // Nutrition section
  nutritionSection: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  additivesSection: {
    backgroundColor: '#FFF5F5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 12,
    gap: 6,
  },
  nutritionTitle: { fontSize: 12, fontWeight: '800', color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  nutritionGrid: { gap: 0 },
  nutritionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  nutritionLabel: { fontSize: 13, color: '#374151', fontWeight: '500' },
  nutritionIndent: { paddingLeft: 12, color: '#6B7280' },
  nutritionValue: { fontSize: 13, fontWeight: '700', color: '#374151' },
  additivesRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  additivesLabel: { fontSize: 12, fontWeight: '700', color: '#374151', flexShrink: 0 },
  additiveBadge: {
    minWidth: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, flexShrink: 0,
  },
  additiveBadgeText: { fontSize: 11, fontWeight: '800' },
  additivesText: { fontSize: 12, color: '#6B7280', flex: 1, lineHeight: 18 },
  permContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16, backgroundColor: '#000' },
  permText: { textAlign: 'center', fontSize: 16, color: '#fff' },
  permBtn: { backgroundColor: Brand.green, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  permBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  cancelBtn: { padding: 12 },
  cancelText: { color: '#aaa', fontSize: 14 },
});

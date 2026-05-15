import { Animated, ActivityIndicator, Image, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { Brand } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { computeScore, scoreColor, scoreLabel } from '@/utils/food-score';
import { lookupBarcodeOnUsda } from '@/utils/usda';
import { saveRecentScan } from '@/utils/recent-scans-store';
import { getSuggestedExpiryDate } from '@/utils/shelf-life-defaults';
import type { ProductAlternative } from '@/types/food-item';

// ISO 3166-1 alpha-2 → Open Food Facts countries_tags value
const ISO_TO_OFF_COUNTRY: Record<string, string> = {
  GB: 'en:united-kingdom', US: 'en:united-states', FR: 'en:france',
  DE: 'en:germany', IT: 'en:italy', ES: 'en:spain', NL: 'en:netherlands',
  BE: 'en:belgium', CH: 'en:switzerland', AT: 'en:austria', SE: 'en:sweden',
  NO: 'en:norway', DK: 'en:denmark', FI: 'en:finland', PL: 'en:poland',
  PT: 'en:portugal', GR: 'en:greece', IE: 'en:ireland', CZ: 'en:czechia',
  HU: 'en:hungary', RO: 'en:romania', CA: 'en:canada', AU: 'en:australia',
  NZ: 'en:new-zealand', IN: 'en:india', JP: 'en:japan', KR: 'en:south-korea',
  CN: 'en:china', SG: 'en:singapore', MY: 'en:malaysia', TH: 'en:thailand',
  PH: 'en:philippines', ID: 'en:indonesia', BR: 'en:brazil', MX: 'en:mexico',
  AR: 'en:argentina', CO: 'en:colombia', CL: 'en:chile', ZA: 'en:south-africa',
  NG: 'en:nigeria', EG: 'en:egypt', SA: 'en:saudi-arabia', AE: 'en:united-arab-emirates',
  TR: 'en:turkey', UA: 'en:ukraine', RU: 'en:russia', PK: 'en:pakistan',
  BD: 'en:bangladesh', LK: 'en:sri-lanka', IL: 'en:israel',
};

// undefined = not yet tried, null = tried and denied/failed, string = resolved tag
let cachedUserCountryTag: string | null | undefined;

async function resolveUserCountryTag(): Promise<string | undefined> {
  // Valid tag cached — return immediately without any system calls
  if (cachedUserCountryTag) return cachedUserCountryTag;

  // Previously denied — check current permission status without showing a prompt.
  // Handles the case where the user granted location in Settings after the first denial.
  if (cachedUserCountryTag === null) {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return undefined;
    cachedUserCountryTag = undefined; // reset so the full flow below runs
  }

  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') { cachedUserCountryTag = null; return undefined; }
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest });
    const [place] = await Location.reverseGeocodeAsync(
      { latitude: pos.coords.latitude, longitude: pos.coords.longitude },
    );
    const isoCode = place?.isoCountryCode ?? '';
    const tag = ISO_TO_OFF_COUNTRY[isoCode.toUpperCase()] ?? null;
    cachedUserCountryTag = tag;
    return tag ?? undefined;
  } catch {
    cachedUserCountryTag = null;
    return undefined;
  }
}

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
  scoreSource?: 'openfoodfacts' | 'usda';
  /** YYYY-MM-DD expiry estimate based on category shelf life */
  suggestedExpiryDate?: string;
  /** Healthier alternatives surfaced during the scan — stored with the pantry item */
  alternatives?: ProductAlternative[];
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

async function lookupOnOpenFoodFacts(barcode: string): Promise<Omit<ScanResult, 'barcode'>> {
  try {
    // v2 API with field selection is faster and more reliable than v0
    const fields = 'product_name,brands,categories_tags,countries_tags,nutriscore_grade,nutrition_grade_fr,nova_group';
    const res = await fetchWithTimeout(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}?fields=${fields}`
    );
    if (!res.ok) return {};
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
      return {
        name: [name, brand].filter(Boolean).join(' — ') || undefined,
        category: mapCategory(categoriesTags[0] ?? ''),
        offCategories: categoriesTags,
        countryTag: countriesTags[0] ?? undefined,
        nutriScore: validNutriScore,
        novaGroup: validNova,
        scoreSource: (validNutriScore || validNova) ? 'openfoodfacts' : undefined,
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
    // USDA also failed — return whatever OFF gave us
  }

  return off;
}

function mapCategory(tag: string): string | undefined {
  if (!tag) return undefined;
  const t = tag.toLowerCase();
  if (t.includes('dairy') || t.includes('milk') || t.includes('cheese')) return 'dairy';
  if (t.includes('meat') || t.includes('beef') || t.includes('chicken') || t.includes('pork')) return 'meat';
  if (t.includes('fish') || t.includes('seafood')) return 'seafood';
  if (t.includes('vegetable') || t.includes('fruit') || t.includes('produce')) return 'produce';
  if (t.includes('bread') || t.includes('bakery') || t.includes('pastry')) return 'bakery';
  if (t.includes('frozen')) return 'frozen';
  if (t.includes('canned') || t.includes('conserve')) return 'canned';
  if (t.includes('beverage') || t.includes('drink') || t.includes('juice')) return 'beverages';
  if (t.includes('snack') || t.includes('chip') || t.includes('cookie')) return 'snacks';
  if (t.includes('grain') || t.includes('cereal') || t.includes('pasta') || t.includes('rice')) return 'grains';
  return undefined;
}


// Local alias — ProductAlternative is the same shape, imported for type safety
type Alternative = ProductAlternative;

const ALT_FIELDS = 'code,product_name,brands,nutriscore_grade,image_front_small_url,categories_tags';

// requiredTag: the exact OFF tag we searched with — post-validates the API actually
// returned relevant products (guards against broad fallback contamination).
function parseAlts(products: Record<string, unknown>[], requiredTag?: string): Alternative[] {
  return products
    .filter((p) => {
      const grade = ((p.nutriscore_grade as string) ?? '').toLowerCase();
      if (!p.product_name || !(grade === 'a' || grade === 'b')) return false;
      if (requiredTag) {
        const tags = Array.isArray(p.categories_tags) ? (p.categories_tags as string[]) : [];
        if (!tags.includes(requiredTag)) return false;
      }
      return true;
    })
    .slice(0, 3)
    .map((p) => ({
      barcode: p.code as string,
      name: p.product_name as string,
      brand: p.brands as string | undefined,
      nutriScore: ((p.nutriscore_grade as string) ?? '').toLowerCase(),
      imageUri: (p.image_front_small_url as string | undefined) || undefined,
    }));
}

// "en:united-kingdom" → "United Kingdom", "en:france" → "France"
function formatCountryTag(tag: string): string {
  const name = tag.includes(':') ? tag.slice(tag.indexOf(':') + 1) : tag;
  return name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// Ordered most-specific first — first match in product name + category tags wins.
// Covers a wide range of food types so the logic works for any scanned product,
// not just the specific examples we've tested.
const TYPE_KEYWORDS = [
  // Sports & nutrition bars — must be early so en:protein-bars beats en:snacks
  'protein', 'energy', 'whey', 'collagen',
  // Frozen desserts — before generic "cream" so ice cream beats dairy cream
  'gelato', 'sorbet', 'ice-cream', 'lolly', 'frozen',
  // Chocolate / confectionery specifics
  'chocolate', 'hazelnut', 'caramel', 'nougat', 'praline', 'truffle',
  // Crisps / chips
  'crisp', 'chip', 'popcorn', 'pretzel', 'nacho',
  // Nuts & seeds
  'almond', 'peanut', 'walnut', 'cashew', 'pistachio', 'pecan', 'sesame',
  // Specific fruits
  'strawberry', 'blueberry', 'raspberry', 'blackberry', 'cranberry',
  'mango', 'coconut', 'banana', 'pineapple', 'watermelon', 'kiwi',
  'apricot', 'peach', 'cherry', 'plum', 'fig', 'grape',
  'orange', 'lemon', 'lime', 'grapefruit', 'apple', 'pear',
  // Meat & fish
  'chicken', 'beef', 'pork', 'lamb', 'turkey', 'duck', 'bacon', 'ham',
  'tuna', 'salmon', 'cod', 'sardine', 'mackerel', 'shrimp', 'prawn', 'crab',
  // Dairy specifics
  'yogurt', 'cheddar', 'mozzarella', 'parmesan', 'brie', 'gouda',
  'cheese', 'butter', 'cream', 'milk',
  // Grains & bakery
  'pasta', 'noodle', 'spaghetti', 'lasagne', 'risotto',
  'oat', 'wheat', 'rye', 'barley', 'quinoa', 'buckwheat',
  'bread', 'sourdough', 'baguette', 'croissant', 'brioche',
  'biscuit', 'cookie', 'cracker', 'wafer', 'waffle', 'pancake',
  'cereal', 'granola', 'muesli', 'cornflake',
  'rice', 'corn',
  // Vegetables & legumes
  'tomato', 'carrot', 'spinach', 'broccoli', 'cauliflower', 'courgette',
  'potato', 'mushroom', 'avocado', 'cucumber',
  'lentil', 'chickpea', 'soy', 'tofu', 'bean', 'pea',
  // Condiments & flavours
  'garlic', 'onion', 'ginger', 'pepper', 'chilli', 'paprika', 'cumin',
  'cinnamon', 'vanilla', 'mint', 'basil', 'oregano', 'thyme', 'rosemary',
  'honey', 'maple', 'jam', 'marmalade', 'herb', 'seasoning', 'spice',
  // Drinks
  'coffee', 'cocoa', 'matcha', 'tea', 'juice', 'smoothie',
  // Other common descriptors
  'pizza', 'burger', 'soup', 'curry', 'hummus', 'salsa', 'guacamole',
  'berry', 'fruit',
];

const ALTS_DEADLINE_MS = 10_000;

async function fetchAlternatives(
  offCategories: string[],
  countryTag: string | undefined,
): Promise<{ alts: Alternative[]; wasLocal: boolean }> {
  if (offCategories.length === 0) return { alts: [], wasLocal: false };
  return Promise.race([
    doFetchAlternatives(offCategories, countryTag),
    new Promise<{ alts: Alternative[]; wasLocal: boolean }>((resolve) =>
      setTimeout(() => resolve({ alts: [], wasLocal: false }), ALTS_DEADLINE_MS)
    ),
  ]);
}

async function doFetchAlternatives(
  offCategories: string[],
  countryTag: string | undefined,
): Promise<{ alts: Alternative[]; wasLocal: boolean }> {

  const BASE = 'https://world.openfoodfacts.org/api/v2/search';
  const common = `page_size=50&fields=${ALT_FIELDS}&sort_by=popularity`;
  const country = countryTag ? `&countries_tags=${encodeURIComponent(countryTag)}` : '';

  // Use only tags that contain a TYPE_KEYWORD — these describe the actual food type
  // (en:chocolates, en:pasta-sauces) rather than broad buckets (en:confectioneries,
  // en:condiments) that lump unrelated products together.
  // Walk from most-specific to least-specific so we try the closest match first.
  const typedTags = [...offCategories]
    .reverse()
    .filter(tag => TYPE_KEYWORDS.some(kw => tag.includes(kw)))
    .slice(0, 3);

  const candidateTags: string[] = typedTags.length > 0
    ? typedTags
    : offCategories.slice(-2).reverse();

  // LOCAL PHASE: exhaust all candidate categories with the country filter before
  // falling back to global results — keeps alternatives as local as possible.
  const urlEntries: { url: string; isLocal: boolean; tag: string }[] = [];
  if (country) {
    for (const tag of candidateTags) {
      urlEntries.push({
        url: `${BASE}?categories_tags=${encodeURIComponent(tag)}&${common}${country}`,
        isLocal: true,
        tag,
      });
    }
  }
  // GLOBAL PHASE: only reached if no local results found in any category level.
  for (const tag of candidateTags) {
    urlEntries.push({
      url: `${BASE}?categories_tags=${encodeURIComponent(tag)}&${common}`,
      isLocal: false,
      tag,
    });
  }

  for (const { url, isLocal, tag } of urlEntries) {
    try {
      const res = await fetchWithTimeout(url, 5000);
      if (!res.ok) continue;
      const json = await res.json();
      const alts = parseAlts(json.products ?? [], tag);
      if (alts.length > 0) return { alts, wasLocal: isLocal };
    } catch { /* try next */ }
  }

  return { alts: [], wasLocal: false };
}

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

  // Resolve user's GPS country once on mount — used to find locally-available alternatives
  useEffect(() => {
    resolveUserCountryTag().then(setUserCountryTag);
  }, []);

  useEffect(() => {
    if (!result) { setAlternatives([]); setAltsWereLocal(false); setLoadingAlts(false); return; }

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

  const score = result
    ? computeScore(result.nutriScore, result.novaGroup, result.fatSecretScore)
    : undefined;

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
          {/* Score circle */}
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
              {score !== undefined && (
                <Text style={[styles.scoreLabelText, { color: scoreColor(score) }]}>
                  {scoreLabel(score)}
                </Text>
              )}
              {score === undefined && (
                <Text style={styles.noScoreText}>No score data available</Text>
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
                  : 'Score via Open Food Facts'}
              </Text>
            </View>
          )}

          {/* Healthier alternatives — only for Fair / Poor / Bad scores */}
          {(score === undefined || score < 60) && <View style={styles.altsSection}>
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
              alternatives.map((alt) => (
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
                  <View style={[styles.altGradeBadge, { backgroundColor: SCORE_LETTER_COLOR[alt.nutriScore] ?? '#1EA54C' }]}>
                    <Text style={styles.altGradeLetter}>{alt.nutriScore.toUpperCase()}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.altShopBtn}
                    onPress={() => openShoppingSearch(alt.name, alt.brand)}
                    hitSlop={8}>
                    <IconSymbol name="cart.fill" size={16} color={Brand.green} />
                  </TouchableOpacity>
                </View>
              ))
            ) : (
              <Text style={styles.altsNone}>No alternatives found for this product</Text>
            )}
          </View>}

          {/* Actions */}
          <TouchableOpacity style={styles.addBtn} onPress={handleAddToPantry}>
            <Text style={styles.addBtnText}>Want it? Start adding to Pantry</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.scanAgainBtn} onPress={handleScanAgain}>
            <Text style={styles.scanAgainText}>Scan Another</Text>
          </TouchableOpacity>
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
  // Result card
  resultCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    gap: 16,
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
  permContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16, backgroundColor: '#000' },
  permText: { textAlign: 'center', fontSize: 16, color: '#fff' },
  permBtn: { backgroundColor: Brand.green, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  permBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  cancelBtn: { padding: 12 },
  cancelText: { color: '#aaa', fontSize: 14 },
});

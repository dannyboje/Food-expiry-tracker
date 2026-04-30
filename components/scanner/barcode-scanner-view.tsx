import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { Brand } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { computeScore, scoreColor, scoreLabel } from '@/utils/food-score';
import { lookupBarcodeOnUsda } from '@/utils/usda';
import { saveRecentScan } from '@/utils/recent-scans-store';
import { getSuggestedExpiryDate } from '@/utils/shelf-life-defaults';

interface ScanResult {
  barcode: string;
  name?: string;
  category?: string;
  nutriScore?: string;
  novaGroup?: number;
  /** Direct 0–100 score from USDA (used only when OFF has no data) */
  fatSecretScore?: number;
  /** Which API provided the score */
  scoreSource?: 'openfoodfacts' | 'usda';
  /** YYYY-MM-DD expiry estimate based on category shelf life */
  suggestedExpiryDate?: string;
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
    const fields = 'product_name,brands,categories_tags,nutriscore_grade,nutrition_grade_fr,nova_group';
    const res = await fetchWithTimeout(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}?fields=${fields}`
    );
    if (!res.ok) return {};
    const json = await res.json();
    if (json.status === 1 && json.product) {
      const p = json.product;
      const name = p.product_name || p.product_name_en;
      const brand = p.brands;
      const categories: string = p.categories_tags?.[0] ?? '';
      const rawScore: string | undefined = p.nutriscore_grade || p.nutrition_grade_fr;
      const nutriScore = rawScore ? rawScore.toLowerCase() : undefined;
      const novaGroup = p.nova_group ? Number(p.nova_group) : undefined;
      const validNutriScore = ['a', 'b', 'c', 'd', 'e'].includes(nutriScore ?? '') ? nutriScore : undefined;
      const validNova = novaGroup && novaGroup >= 1 && novaGroup <= 4 ? novaGroup : undefined;
      return {
        name: [name, brand].filter(Boolean).join(' — ') || undefined,
        category: mapCategory(categories),
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

export function BarcodeScannerView({ onScan, onCancel }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  // useRef so the guard is synchronous — useState is async and lets duplicate
  // camera events slip through before the state update settles.
  const scanLock = useRef(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);

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
    if (result) onScan(result);
  }

  function handleScanAgain() {
    setResult(null);
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
              <View style={styles.guideFrame} />
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

          <View style={styles.scoreSource}>
            <Text style={styles.sourceText}>
              {result?.scoreSource === 'usda'
                ? 'Score via USDA FoodData Central'
                : 'Score via Open Food Facts'}
            </Text>
          </View>

          {/* Actions */}
          <TouchableOpacity style={styles.addBtn} onPress={handleAddToPantry}>
            <Text style={styles.addBtnText}>Add to Pantry</Text>
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
    borderWidth: 2.5,
    borderColor: Brand.green,
    borderRadius: 10,
    backgroundColor: 'rgba(34,197,94,0.05)',
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
  permContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16, backgroundColor: '#000' },
  permText: { textAlign: 'center', fontSize: 16, color: '#fff' },
  permBtn: { backgroundColor: Brand.green, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  permBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  cancelBtn: { padding: 12 },
  cancelText: { color: '#aaa', fontSize: 14 },
});

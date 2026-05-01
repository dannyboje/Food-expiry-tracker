import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { BgFoodDecor, HeaderFoodDecor } from '@/components/ui/food-decor';
import { useCallback, useState } from 'react';
import { Brand, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { usePantry } from '@/hooks/use-pantry';
import type { FoodItemWithStatus } from '@/types/food-item';
import { computeScore, scoreColor, scoreLabel } from '@/utils/food-score';
import { getRecentScans, type RecentScan } from '@/utils/recent-scans-store';
import { resolvePhotoUri } from '@/utils/photo-storage';

const SCORE_COLOR: Record<string, string> = {
  a: '#1EA54C', b: '#85BB2F', c: '#F5C900', d: '#EF8714', e: '#E63E11',
};

const NOVA_LABEL: Record<number, string> = {
  1: 'Unprocessed', 2: 'Culinary ingredients', 3: 'Processed', 4: 'Ultra-processed',
};

const NOVA_COLOR: Record<number, string> = {
  1: '#1EA54C', 2: '#85BB2F', 3: '#EF8714', 4: '#E63E11',
};

type Filter = 'all' | 'scored' | 'unscored' | 'a' | 'b' | 'c' | 'd' | 'e';

const GRADE_LABELS: Record<string, string> = {
  a: 'Excellent', b: 'Good', c: 'Fair', d: 'Poor', e: 'Bad',
};

function effectiveGrade(score: number): string {
  if (score >= 80) return 'a';
  if (score >= 60) return 'b';
  if (score >= 40) return 'c';
  if (score >= 20) return 'd';
  return 'e';
}

const CATEGORY_ICONS: Record<string, string> = {
  dairy: '🥛', meat: '🥩', seafood: '🐟', produce: '🥦',
  bakery: '🍞', frozen: '🧊', canned: '🥫', condiments: '🧴',
  beverages: '🥤', snacks: '🍿', grains: '🌾', medicines: '💊', other: '🍱',
};

function daysAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return '1 day ago';
  return `${diff} days ago`;
}

// ── Unified list item types ───────────────────────────────
type ListItem =
  | { kind: 'section'; title: string; subtitle: string }
  | { kind: 'pantry'; item: FoodItemWithStatus }
  | { kind: 'scan'; scan: RecentScan };

function matchesFilter(
  filter: Filter,
  nutriScore?: string,
  novaGroup?: number,
  rawScore?: number,
): boolean {
  const score = computeScore(nutriScore, novaGroup, rawScore);
  const hasScore = score !== undefined;
  if (filter === 'scored') return hasScore;
  if (filter === 'unscored') return !hasScore;
  if (['a', 'b', 'c', 'd', 'e'].includes(filter)) {
    return hasScore && effectiveGrade(score!) === filter;
  }
  return true;
}

export default function HealthScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { enrichedItems } = usePantry();
  const [filter, setFilter] = useState<Filter>('all');
  const [recentScans, setRecentScans] = useState<RecentScan[]>([]);

  // Reload scans every time this tab is focused so new scans appear immediately
  useFocusEffect(
    useCallback(() => {
      getRecentScans().then(setRecentScans);
    }, [])
  );

  // Set of barcodes already in pantry — to avoid showing them twice
  const pantryBarcodes = new Set(enrichedItems.map((i) => i.barcode).filter(Boolean) as string[]);

  // Sorted pantry items
  const sortedPantry = [...enrichedItems].sort((a, b) => {
    const sa = computeScore(a.nutriScore, a.novaGroup, a.rawScore) ?? -1;
    const sb = computeScore(b.nutriScore, b.novaGroup, b.rawScore) ?? -1;
    return sb - sa;
  });

  // Recent scans not already in pantry, sorted highest score first
  const sortedScans = recentScans
    .filter((s) => !pantryBarcodes.has(s.barcode))
    .sort((a, b) => {
      const sa = computeScore(a.nutriScore, a.novaGroup, a.rawScore) ?? -1;
      const sb = computeScore(b.nutriScore, b.novaGroup, b.rawScore) ?? -1;
      return sb - sa;
    });

  const visiblePantry = sortedPantry.filter((i) =>
    matchesFilter(filter, i.nutriScore, i.novaGroup, i.rawScore)
  );

  const visibleScans = sortedScans.filter((s) =>
    matchesFilter(filter, s.nutriScore, s.novaGroup, s.rawScore)
  );

  // Build flat list with section headers
  const listData: ListItem[] = [];
  if (visiblePantry.length > 0) {
    listData.push({ kind: 'section', title: 'In Your Pantry', subtitle: `${visiblePantry.length} item${visiblePantry.length !== 1 ? 's' : ''}` });
    listData.push(...visiblePantry.map((item): ListItem => ({ kind: 'pantry', item })));
  }
  if (visibleScans.length > 0) {
    listData.push({ kind: 'section', title: 'Recently Scanned', subtitle: `${visibleScans.length} product${visibleScans.length !== 1 ? 's' : ''}` });
    listData.push(...visibleScans.map((scan): ListItem => ({ kind: 'scan', scan })));
  }

  // Counts for legend badges
  const gradeCount = (grade: string) =>
    ([...enrichedItems, ...sortedScans] as { nutriScore?: string; novaGroup?: number; rawScore?: number }[])
      .filter((i) => {
        const s = computeScore(i.nutriScore, i.novaGroup, i.rawScore);
        return s !== undefined && effectiveGrade(s) === grade;
      }).length;

  const scoredCount = enrichedItems.filter(
    (i) => computeScore(i.nutriScore, i.novaGroup, i.rawScore) !== undefined
  ).length;

  // ── Renderers ────────────────────────────────────────────

  function renderPantryItem(item: FoodItemWithStatus) {
    const nutriGrade = item.nutriScore;
    const nova = item.novaGroup;
    const composite = computeScore(nutriGrade, nova, item.rawScore);
    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => router.push(`/item/${item.id}`)}
        activeOpacity={0.75}>
        <View style={styles.cardLeft}>
          {resolvePhotoUri(item.expiryPhotoUri ?? item.nutritionPhotoUri) ? (
            <Image
              source={{ uri: resolvePhotoUri(item.expiryPhotoUri ?? item.nutritionPhotoUri)! }}
              style={styles.itemPhoto}
            />
          ) : (
            <Text style={styles.emoji}>{CATEGORY_ICONS[item.category] ?? '🍱'}</Text>
          )}
        </View>
        <View style={styles.cardInfo}>
          <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.badgeRow}>
            {nutriGrade ? (
              <View style={[styles.gradePill, { backgroundColor: SCORE_COLOR[nutriGrade] }]}>
                <Text style={styles.gradePillText}>{nutriGrade.toUpperCase()}</Text>
              </View>
            ) : null}
            {nova ? (
              <Text style={[styles.novaText, { color: NOVA_COLOR[nova] }]}>
                NOVA {nova} · {NOVA_LABEL[nova]}
              </Text>
            ) : null}
          </View>
        </View>
        <ScoreBubble composite={composite} colors={colors} />
      </TouchableOpacity>
    );
  }

  function renderScanItem(scan: RecentScan) {
    const composite = computeScore(scan.nutriScore, scan.novaGroup, scan.rawScore);
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.cardLeft, styles.scanIcon]}>
          <Text style={styles.emoji}>🔍</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>
            {scan.name}
          </Text>
          <View style={styles.badgeRow}>
            {scan.nutriScore ? (
              <View style={[styles.gradePill, { backgroundColor: SCORE_COLOR[scan.nutriScore] }]}>
                <Text style={styles.gradePillText}>{scan.nutriScore.toUpperCase()}</Text>
              </View>
            ) : null}
            {scan.novaGroup ? (
              <Text style={[styles.novaText, { color: NOVA_COLOR[scan.novaGroup] }]}>
                NOVA {scan.novaGroup} · {NOVA_LABEL[scan.novaGroup]}
              </Text>
            ) : null}
          </View>
          <Text style={[styles.scannedAt, { color: colors.subtext }]}>
            Scanned {daysAgo(scan.scannedAt)}
          </Text>
        </View>
        <ScoreBubble composite={composite} colors={colors} />
      </View>
    );
  }

  function renderItem({ item }: { item: ListItem }) {
    if (item.kind === 'section') {
      return (
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{item.title}</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.subtext }]}>{item.subtitle}</Text>
        </View>
      );
    }
    if (item.kind === 'pantry') return renderPantryItem(item.item);
    return renderScanItem(item.scan);
  }

  const isEmpty = visiblePantry.length === 0 && visibleScans.length === 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <BgFoodDecor />
      {/* Gradient header */}
      <LinearGradient
        colors={['#8BD1A5', '#91E2AF', '#A5EFC0']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}>
        <HeaderFoodDecor />
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <Text style={styles.title}>❤️  Health Scores</Text>
            <Text style={styles.subtitle}>Eat Right, Live Bright  💪</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Score legend — tap to filter by grade */}
      <View style={[styles.legend, { borderColor: colors.border }]}>
        {(['a', 'b', 'c', 'd', 'e'] as const).map((s) => {
          const active = filter === s;
          const count = gradeCount(s);
          return (
            <TouchableOpacity
              key={s}
              style={[styles.legendItem, active && styles.legendItemActive, active && { borderColor: SCORE_COLOR[s] }]}
              onPress={() => setFilter(active ? 'all' : s)}
              activeOpacity={0.7}>
              <View style={[styles.legendDot, { backgroundColor: SCORE_COLOR[s] }, active && styles.legendDotActive]}>
                <Text style={styles.legendLetter}>{s.toUpperCase()}</Text>
              </View>
              <Text style={[styles.legendLabel, { color: active ? SCORE_COLOR[s] : colors.subtext }]}>
                {GRADE_LABELS[s]}
              </Text>
              {count > 0 && (
                <View style={[styles.legendCount, { backgroundColor: active ? SCORE_COLOR[s] : colors.border }]}>
                  <Text style={[styles.legendCountText, { color: active ? '#fff' : colors.subtext }]}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Filter pills */}
      <View style={styles.filters}>
        {([['all', 'All'], ['scored', 'Rated'], ['unscored', 'Not rated']] as [Filter, string][]).map(
          ([key, label]) => (
            <TouchableOpacity
              key={key}
              onPress={() => setFilter(key)}
              style={[styles.pill, filter === key && { backgroundColor: Brand.green }]}>
              <Text style={[styles.pillText, { color: filter === key ? '#fff' : colors.subtext }]}>
                {label}
              </Text>
            </TouchableOpacity>
          )
        )}
      </View>

      <FlatList
        data={listData}
        keyExtractor={(item) => {
          if (item.kind === 'section') return `section-${item.title}`;
          if (item.kind === 'pantry') return `pantry-${item.item.id}`;
          return `scan-${item.scan.barcode}`;
        }}
        renderItem={renderItem}
        contentContainerStyle={[styles.list, isEmpty && styles.listEmpty]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.subtext }]}>
            {filter === 'scored'
              ? 'No rated items or scans yet.\nScan a barcode to get a health score.'
              : ['a', 'b', 'c', 'd', 'e'].includes(filter)
              ? `No ${GRADE_LABELS[filter].toLowerCase()} (${filter.toUpperCase()}) products found.`
              : 'No items yet. Scan a barcode to get started.'}
          </Text>
        }
      />
    </View>
  );
}

function ScoreBubble({ composite, colors }: { composite: number | undefined; colors: { text: string; subtext: string; card: string; border: string; background: string } }) {
  return (
    <View style={styles.cardRight}>
      {composite !== undefined ? (
        <View style={[styles.scoreBubble, { borderColor: scoreColor(composite) }]}>
          <Text style={[styles.scoreNumber, { color: scoreColor(composite) }]}>{composite}</Text>
          <Text style={[styles.scoreLabel, { color: scoreColor(composite) }]}>
            {scoreLabel(composite)}
          </Text>
        </View>
      ) : (
        <View style={[styles.scoreBubble, { borderColor: '#E5E7EB' }]}>
          <Text style={[styles.scoreLabel, { color: '#9CA3AF' }]}>N/A</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerGradient: { paddingBottom: 14 },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  title: { fontSize: 28, fontWeight: '800', color: '#166534' },
  subtitle: { fontSize: 13, marginTop: 2, color: 'rgba(22, 101, 52, 0.75)', textAlign: 'right' },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: 16,
    marginTop: 10,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  legendItem: {
    alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 6,
    borderRadius: 10, borderWidth: 2, borderColor: 'transparent',
  },
  legendItemActive: { borderWidth: 2 },
  legendDot: {
    width: 28, height: 28, borderRadius: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  legendDotActive: { width: 32, height: 32, borderRadius: 8 },
  legendLetter: { color: '#fff', fontSize: 13, fontWeight: '900' },
  legendLabel: { fontSize: 10, fontWeight: '600' },
  legendCount: {
    minWidth: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  legendCountText: { fontSize: 10, fontWeight: '700' },
  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  pill: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, backgroundColor: '#E5E7EB',
  },
  pillText: { fontSize: 13, fontWeight: '600' },
  list: { paddingHorizontal: 16, paddingBottom: 100, gap: 8 },
  listEmpty: { flex: 1 },
  // Section headers
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  sectionSubtitle: { fontSize: 12 },
  // Cards
  card: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, borderWidth: 1,
    paddingVertical: 12, paddingHorizontal: 14, gap: 12,
  },
  cardLeft: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },
  scanIcon: { backgroundColor: '#EFF6FF' },
  emoji: { fontSize: 20 },
  itemPhoto: { width: 40, height: 40, borderRadius: 20 },
  cardInfo: { flex: 1, gap: 3 },
  itemName: { fontSize: 15, fontWeight: '600' },
  scannedAt: { fontSize: 11, marginTop: 1 },
  cardRight: { alignItems: 'center' },
  scoreBubble: {
    width: 56, minHeight: 56, borderRadius: 12, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center', paddingVertical: 6,
  },
  scoreNumber: { fontSize: 20, fontWeight: '900', lineHeight: 24 },
  scoreLabel: { fontSize: 9, fontWeight: '700', textAlign: 'center' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  gradePill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  gradePillText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  novaText: { fontSize: 11, fontWeight: '600' },
  empty: { textAlign: 'center', marginTop: 60, fontSize: 15, lineHeight: 24 },
});

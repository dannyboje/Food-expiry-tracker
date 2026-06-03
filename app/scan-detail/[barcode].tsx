import {
  ActivityIndicator, Image, Linking, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useLayoutEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OFFNutritionPanel } from '@/components/food/off-nutrition-panel';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { computeScore, scoreColor, scoreLabel } from '@/utils/food-score';
import { getRecentScans, type RecentScan } from '@/utils/recent-scans-store';
import { fetchAlternatives, resolveUserCountryTag } from '@/utils/alternatives';
import type { ProductAlternative } from '@/types/food-item';

const NUTRI_COLOR: Record<string, string> = {
  a: '#1EA54C', b: '#85BB2F', c: '#F5C900', d: '#EF8714', e: '#E63E11',
};

const NOVA_LABEL: Record<number, string> = {
  1: 'Unprocessed', 2: 'Culinary ingredients', 3: 'Processed', 4: 'Ultra-processed',
};
const NOVA_COLOR: Record<number, string> = {
  1: '#1EA54C', 2: '#85BB2F', 3: '#EF8714', 4: '#E63E11',
};

function openShoppingSearch(name: string, brand?: string) {
  const q = [brand, name].filter(Boolean).join(' ');
  Linking.openURL(`https://www.google.com/search?tbm=shop&q=${encodeURIComponent(q)}`).catch(() => {
    Linking.openURL(`https://www.google.com/search?q=${encodeURIComponent(q)}+buy+online`).catch(() => {});
  });
}

export default function ScanDetailScreen() {
  const { barcode } = useLocalSearchParams<{ barcode: string }>();
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [scan, setScan] = useState<RecentScan | null>(null);
  const [alternatives, setAlternatives] = useState<ProductAlternative[]>([]);
  const [loadingAlts, setLoadingAlts] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Scanned Product', headerBackTitle: 'Health' });
  }, [navigation]);

  // Load scan record from KVStore
  useEffect(() => {
    getRecentScans().then((scans) => {
      const found = scans.find((s) => s.barcode === barcode) ?? null;
      setScan(found);
    });
  }, [barcode]);

  // Fetch alternatives once we have the scan record
  useEffect(() => {
    if (!scan?.offCategories?.length) return;
    const score = computeScore(scan.nutriScore, scan.novaGroup, scan.rawScore);
    if (score !== undefined && score >= 60) return; // good products don't need alternatives

    let cancelled = false;
    setLoadingAlts(true);
    resolveUserCountryTag().then((countryTag) =>
      fetchAlternatives(scan.offCategories!, countryTag)
    ).then(({ alts }) => {
      if (!cancelled) { setAlternatives(alts); setLoadingAlts(false); }
    }).catch(() => {
      if (!cancelled) setLoadingAlts(false);
    });
    return () => { cancelled = true; };
  }, [scan]);

  if (!scan) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator style={{ marginTop: 60 }} color={colors.subtext} />
      </SafeAreaView>
    );
  }

  const composite = computeScore(scan.nutriScore, scan.novaGroup, scan.rawScore);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Product name + barcode */}
        <View style={[styles.hero, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.heroName, { color: colors.text }]}>{scan.name}</Text>
          <View style={styles.heroBadges}>
            {scan.nutriScore ? (
              <View style={[styles.nutriBadge, { backgroundColor: NUTRI_COLOR[scan.nutriScore] }]}>
                <Text style={styles.nutriBadgeText}>{scan.nutriScore.toUpperCase()}</Text>
              </View>
            ) : null}
            {scan.novaGroup ? (
              <Text style={[styles.novaBadge, { color: NOVA_COLOR[scan.novaGroup] }]}>
                NOVA {scan.novaGroup} · {NOVA_LABEL[scan.novaGroup]}
              </Text>
            ) : null}
          </View>
          <Text style={[styles.barcodeLine, { color: colors.subtext }]}>Barcode {scan.barcode}</Text>
        </View>

        {/* Health score */}
        {composite !== undefined && (
          <View style={[styles.scoreCard, { borderColor: scoreColor(composite), backgroundColor: colors.card }]}>
            <View style={[styles.scoreCircle, { borderColor: scoreColor(composite) }]}>
              <Text style={[styles.scoreNumber, { color: scoreColor(composite) }]}>{composite}</Text>
              <Text style={[styles.scoreOutOf, { color: scoreColor(composite) }]}>/100</Text>
            </View>
            <View style={styles.scoreInfo}>
              <Text style={[styles.scoreGrade, { color: scoreColor(composite) }]}>
                {scoreLabel(composite)}
              </Text>
              <Text style={[styles.scoreBreakdown, { color: colors.subtext }]}>
                {[
                  scan.nutriScore ? `Nutri-Score ${scan.nutriScore.toUpperCase()}` : null,
                  scan.novaGroup ? `NOVA ${scan.novaGroup}` : null,
                ].filter(Boolean).join('  ·  ')}
              </Text>
            </View>
          </View>
        )}

        {/* Healthier alternatives */}
        {(composite === undefined || composite < 60) && (
          <View style={[styles.altsCard, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
            <Text style={styles.altsHeading}>Healthier alternatives</Text>
            <Text style={[styles.altsSub, { color: colors.subtext }]}>
              Nutri-Score A or B products in the same category
            </Text>
            {loadingAlts ? (
              <ActivityIndicator size="small" color="#16A34A" style={{ alignSelf: 'flex-start', marginTop: 4 }} />
            ) : alternatives.length > 0 ? (
              alternatives.map((alt) => {
                const altScore = computeScore(alt.nutriScore, alt.novaGroup, undefined);
                const altColor = NUTRI_COLOR[alt.nutriScore] ?? '#1EA54C';
                return (
                  <View key={alt.barcode} style={[styles.altRow, { borderTopColor: '#D1FAE5' }]}>
                    {alt.imageUri ? (
                      <Image source={{ uri: alt.imageUri }} style={styles.altImage} />
                    ) : (
                      <View style={[styles.altPlaceholder, { backgroundColor: altColor }]}>
                        <Text style={styles.altPlaceholderLetter}>{alt.nutriScore.toUpperCase()}</Text>
                      </View>
                    )}
                    <View style={styles.altInfo}>
                      <Text style={[styles.altName, { color: colors.text }]} numberOfLines={2}>{alt.name}</Text>
                      {alt.brand ? (
                        <Text style={[styles.altBrand, { color: colors.subtext }]} numberOfLines={1}>{alt.brand}</Text>
                      ) : null}
                    </View>
                    <View style={styles.altRating}>
                      {altScore !== undefined && (
                        <Text style={[styles.altScoreNum, { color: altColor }]}>{altScore}</Text>
                      )}
                      <View style={[styles.altBadge, { backgroundColor: altColor }]}>
                        <Text style={styles.altBadgeLetter}>{alt.nutriScore.toUpperCase()}</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.shopBtn}
                      onPress={() => openShoppingSearch(alt.name, alt.brand)}
                      hitSlop={8}>
                      <Text style={styles.shopIcon}>🛒</Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            ) : (
              !loadingAlts && (
                <Text style={[styles.altsNone, { color: colors.subtext }]}>
                  {scan.offCategories?.length
                    ? 'No alternatives found for this product.'
                    : 'Scan newer products to see alternatives here.'}
                </Text>
              )
            )}
          </View>
        )}

        {/* Nutrition + additives via OFFNutritionPanel */}
        <OFFNutritionPanel
          barcode={scan.barcode}
          nutriScore={scan.nutriScore}
          novaGroup={scan.novaGroup}
        />

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: {
    margin: 16, borderRadius: 16, borderWidth: 1,
    padding: 16, gap: 8,
  },
  heroName: { fontSize: 22, fontWeight: '800' },
  heroBadges: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  nutriBadge: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6,
  },
  nutriBadgeText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  novaBadge: { fontSize: 13, fontWeight: '600' },
  barcodeLine: { fontSize: 12, marginTop: 2 },
  // Score card
  scoreCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginHorizontal: 16, marginTop: 0, marginBottom: 4,
    borderWidth: 2, borderRadius: 16, padding: 14,
  },
  scoreCircle: {
    width: 64, height: 64, borderRadius: 32, borderWidth: 3,
    alignItems: 'center', justifyContent: 'center',
  },
  scoreNumber: { fontSize: 22, fontWeight: '900', lineHeight: 26 },
  scoreOutOf: { fontSize: 10, fontWeight: '600' },
  scoreInfo: { flex: 1, gap: 2 },
  scoreGrade: { fontSize: 18, fontWeight: '800' },
  scoreBreakdown: { fontSize: 13, fontWeight: '600' },
  // Alternatives
  altsCard: {
    marginHorizontal: 16, marginTop: 12,
    borderRadius: 16, borderWidth: 1,
    padding: 14, gap: 10,
  },
  altsHeading: { fontSize: 15, fontWeight: '800', color: '#166534' },
  altsSub: { fontSize: 12, marginTop: -4, marginBottom: 2 },
  altRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth,
  },
  altImage: { width: 52, height: 52, borderRadius: 10, resizeMode: 'contain', backgroundColor: '#F9FAFB', flexShrink: 0 },
  altPlaceholder: { width: 52, height: 52, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  altPlaceholderLetter: { color: '#fff', fontSize: 18, fontWeight: '900' },
  altInfo: { flex: 1, gap: 2 },
  altName: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  altBrand: { fontSize: 11 },
  altRating: { alignItems: 'center', gap: 2, flexShrink: 0 },
  altScoreNum: { fontSize: 13, fontWeight: '800' },
  altBadge: { width: 28, height: 28, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  altBadgeLetter: { color: '#fff', fontSize: 13, fontWeight: '900' },
  shopBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  shopIcon: { fontSize: 16 },
  altsNone: { fontSize: 13 },
});

import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { fetchOFFDetail, type OFFDetail } from '@/utils/off-detail';

interface Props {
  barcode: string;
  nutriScore?: string;
  novaGroup?: number;
}

// UK FSA traffic-light thresholds per 100g
const THRESHOLDS: Record<string, [number, number]> = {
  fat:          [3,   17.5],
  saturatedFat: [1.5,  5],
  sugars:       [5,   22.5],
  salt:         [0.3,  1.5],
};

function trafficColor(key: string, value: number): string {
  const t = THRESHOLDS[key];
  if (!t) return '#9CA3AF';
  if (value < t[0]) return '#1EA54C';
  if (value < t[1]) return '#EF8714';
  return '#E63E11';
}

const NUTRI_COLORS: Record<string, string> = {
  a: '#1EA54C', b: '#85BB2F', c: '#F5C900', d: '#EF8714', e: '#E63E11',
};
const NUTRI_DESC: Record<string, string> = {
  a: 'Excellent nutritional quality',
  b: 'Good nutritional quality',
  c: 'Average nutritional quality',
  d: 'Poor nutritional quality',
  e: 'Bad nutritional quality',
};

const NOVA_COLORS: Record<number, string> = {
  1: '#1EA54C', 2: '#85BB2F', 3: '#EF8714', 4: '#E63E11',
};
const NOVA_LABELS: Record<number, string> = {
  1: 'Unprocessed or minimally processed',
  2: 'Processed culinary ingredients',
  3: 'Processed foods',
  4: 'Ultra-processed foods',
};
const NOVA_DESCS: Record<number, string> = {
  1: 'Foods in natural or minimally processed state. No industrial processing.',
  2: 'Oils, fats, flours, pasta, salt — used in home cooking.',
  3: 'Products made from food with added salt, sugar, or other group-2 substances.',
  4: 'Industrial formulations with five or more ingredients, additives, and preservatives.',
};

function fmt(v: number): string {
  return v % 1 === 0 ? String(v) : v.toFixed(1);
}

interface NutrientRowProps {
  label: string;
  value?: number;
  unit: string;
  colorKey?: string;
  indent?: boolean;
  textColor: string;
  subtextColor: string;
  borderColor: string;
}
function NutrientRow({ label, value, unit, colorKey, indent = false, textColor, subtextColor, borderColor }: NutrientRowProps) {
  if (value === undefined) return null;
  const dot = colorKey ? trafficColor(colorKey, value) : undefined;
  return (
    <View style={[styles.nutriRow, { borderTopColor: borderColor }]}>
      <Text style={[styles.nutriLabel, { color: indent ? subtextColor : textColor }, indent && styles.nutriLabelIndent]}>
        {label}
      </Text>
      <View style={styles.nutriRight}>
        <Text style={[styles.nutriValue, { color: textColor }]}>{fmt(value)} {unit}</Text>
        {dot ? <View style={[styles.trafficDot, { backgroundColor: dot }]} /> : null}
      </View>
    </View>
  );
}

export function OFFNutritionPanel({ barcode, nutriScore, novaGroup }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [detail, setDetail] = useState<OFFDetail | null | 'loading'>('loading');

  useEffect(() => {
    fetchOFFDetail(barcode).then((d) => setDetail(d));
  }, [barcode]);

  if (detail === 'loading') {
    return (
      <View style={[styles.loadingRow, { borderColor: colors.border }]}>
        <ActivityIndicator size="small" color={colors.subtext} />
        <Text style={[styles.loadingText, { color: colors.subtext }]}>Loading nutritional data…</Text>
      </View>
    );
  }

  const nutrients = detail?.nutrients;
  const additives = detail?.additives ?? [];
  const ingredientsText = detail?.ingredientsText;
  const hasNutrients = nutrients && Object.values(nutrients).some((v) => v !== undefined);

  const showPanel = nutriScore || novaGroup !== undefined || hasNutrients || additives.length > 0 || ingredientsText;
  if (!showPanel) return null;

  return (
    <View style={styles.panel}>
      {/* Panel header */}
      <View style={styles.panelHeader}>
        <Text style={[styles.panelTitle, { color: colors.text }]}>Open Food Facts</Text>
        <Text style={[styles.panelSub, { color: colors.subtext }]}>Nutritional analysis</Text>
      </View>

      {/* Nutri-Score */}
      {nutriScore && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Nutri-Score</Text>
          <View style={styles.gradeRow}>
            {(['a', 'b', 'c', 'd', 'e'] as const).map((g) => {
              const active = nutriScore === g;
              return (
                <View
                  key={g}
                  style={[
                    styles.gradeTile,
                    active
                      ? [styles.gradeTileActive, { backgroundColor: NUTRI_COLORS[g] }]
                      : { backgroundColor: colorScheme === 'dark' ? '#374151' : '#E5E7EB' },
                  ]}>
                  <Text style={[styles.gradeLetter, { color: active ? '#fff' : colors.subtext }]}>
                    {g.toUpperCase()}
                  </Text>
                </View>
              );
            })}
          </View>
          <Text style={[styles.cardDesc, { color: NUTRI_COLORS[nutriScore] }]}>
            {NUTRI_DESC[nutriScore]}
          </Text>
        </View>
      )}

      {/* NOVA Group */}
      {novaGroup !== undefined && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Food processing · NOVA</Text>
          <View style={styles.novaRow}>
            {([1, 2, 3, 4] as const).map((n) => {
              const active = novaGroup === n;
              return (
                <View
                  key={n}
                  style={[
                    styles.novaCircle,
                    active
                      ? [styles.novaCircleActive, { backgroundColor: NOVA_COLORS[n] }]
                      : { backgroundColor: colorScheme === 'dark' ? '#374151' : '#E5E7EB' },
                  ]}>
                  <Text style={[styles.gradeLetter, { color: active ? '#fff' : colors.subtext }]}>{n}</Text>
                </View>
              );
            })}
          </View>
          <Text style={[styles.novaLabel, { color: NOVA_COLORS[novaGroup] }]}>
            NOVA {novaGroup} · {NOVA_LABELS[novaGroup]}
          </Text>
          <Text style={[styles.cardDesc, { color: colors.subtext }]}>{NOVA_DESCS[novaGroup]}</Text>
        </View>
      )}

      {/* Nutrition facts */}
      {hasNutrients && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Nutrition per 100g</Text>

          {/* Traffic light legend */}
          <View style={styles.legendRow}>
            {(['#1EA54C', '#EF8714', '#E63E11'] as const).map((c, i) => (
              <View key={c} style={styles.legendItem}>
                <View style={[styles.trafficDot, { backgroundColor: c }]} />
                <Text style={[styles.legendLabel, { color: colors.subtext }]}>
                  {['Low', 'Medium', 'High'][i]}
                </Text>
              </View>
            ))}
          </View>

          <NutrientRow label="Energy" value={nutrients!.energyKcal} unit="kcal"
            textColor={colors.text} subtextColor={colors.subtext} borderColor={colors.border} />
          <NutrientRow label="Fat" value={nutrients!.fat} unit="g" colorKey="fat"
            textColor={colors.text} subtextColor={colors.subtext} borderColor={colors.border} />
          <NutrientRow label="Saturated fat" value={nutrients!.saturatedFat} unit="g" colorKey="saturatedFat" indent
            textColor={colors.text} subtextColor={colors.subtext} borderColor={colors.border} />
          <NutrientRow label="Carbohydrates" value={nutrients!.carbohydrates} unit="g"
            textColor={colors.text} subtextColor={colors.subtext} borderColor={colors.border} />
          <NutrientRow label="of which sugars" value={nutrients!.sugars} unit="g" colorKey="sugars" indent
            textColor={colors.text} subtextColor={colors.subtext} borderColor={colors.border} />
          <NutrientRow label="Dietary fiber" value={nutrients!.fiber} unit="g"
            textColor={colors.text} subtextColor={colors.subtext} borderColor={colors.border} />
          <NutrientRow label="Proteins" value={nutrients!.proteins} unit="g"
            textColor={colors.text} subtextColor={colors.subtext} borderColor={colors.border} />
          <NutrientRow label="Salt" value={nutrients!.salt} unit="g" colorKey="salt"
            textColor={colors.text} subtextColor={colors.subtext} borderColor={colors.border} />
        </View>
      )}

      {/* Additives */}
      {additives.length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.additiveHeader}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Additives</Text>
            <View style={[styles.additiveBadge, {
              backgroundColor: additives.length > 5 ? '#FEE2E2' : '#FEF3C7',
            }]}>
              <Text style={[styles.additiveBadgeText, {
                color: additives.length > 5 ? '#DC2626' : '#D97706',
              }]}>
                {additives.length}
              </Text>
            </View>
          </View>
          <Text style={[styles.additiveList, { color: colors.subtext }]}>
            {additives.join('  ·  ')}
          </Text>
        </View>
      )}

      {/* Ingredients */}
      {ingredientsText ? (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Ingredients</Text>
          <Text style={[styles.ingredients, { color: colors.subtext }]} numberOfLines={6}>
            {ingredientsText}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { marginTop: 4 },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  loadingText: { fontSize: 13 },
  panelHeader: { marginHorizontal: 16, marginTop: 20, marginBottom: 4 },
  panelTitle: { fontSize: 18, fontWeight: '800' },
  panelSub: { fontSize: 12, marginTop: 2 },
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  cardDesc: { fontSize: 13, fontWeight: '500', lineHeight: 18 },
  // Nutri-Score / NOVA grade tiles
  gradeRow: { flexDirection: 'row', gap: 8 },
  gradeTile: {
    flex: 1, height: 38, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  gradeTileActive: {
    height: 46, borderRadius: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 4, elevation: 3,
  },
  gradeLetter: { fontSize: 15, fontWeight: '900' },
  novaRow: { flexDirection: 'row', gap: 10 },
  novaCircle: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  novaCircleActive: {
    width: 52, height: 52, borderRadius: 26,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 4, elevation: 3,
  },
  novaLabel: { fontSize: 13, fontWeight: '700' },
  // Nutrition table
  legendRow: { flexDirection: 'row', gap: 14, marginBottom: -4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendLabel: { fontSize: 11 },
  nutriRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  nutriLabel: { fontSize: 14, fontWeight: '500', flex: 1 },
  nutriLabelIndent: { fontSize: 13, paddingLeft: 14 },
  nutriRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nutriValue: { fontSize: 14, fontWeight: '600' },
  trafficDot: { width: 10, height: 10, borderRadius: 5 },
  // Additives
  additiveHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  additiveBadge: {
    minWidth: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  additiveBadgeText: { fontSize: 12, fontWeight: '800' },
  additiveList: { fontSize: 13, lineHeight: 20 },
  // Ingredients
  ingredients: { fontSize: 13, lineHeight: 20 },
});

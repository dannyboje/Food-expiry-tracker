import { StyleSheet, Text, View } from 'react-native';
import { Brand, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { ExpiryStatus, FoodItemWithStatus } from '@/types/food-item';

interface Props {
  item: FoodItemWithStatus;
}

const EXPIRY_COLORS: Record<ExpiryStatus, string> = {
  expired: Brand.red,
  expiring_soon: Brand.orange,
  fresh: '#11181C',
};

export function FoodItemStats({ item }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const expiryColor = EXPIRY_COLORS[item.status];
  const expiryLabel =
    item.daysUntilExpiry < 0
      ? `${Math.abs(item.daysUntilExpiry)}d ago!`
      : item.daysUntilExpiry === 0
        ? 'Today!'
        : `in ${item.daysUntilExpiry} days${item.daysUntilExpiry <= 3 ? '!' : ''}`;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, borderColor: colors.border }]}>
      <View style={[styles.stat, styles.bordered, { borderRightColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.subtext }]}>In the pantry</Text>
        <Text style={[styles.value, { color: colors.text }]}>
          {item.daysInPantry === 0 ? 'Today' : `${item.daysInPantry} days`}
        </Text>
      </View>

      <View style={[styles.stat, styles.bordered, { borderRightColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.subtext }]}>Expiring</Text>
        <Text style={[styles.value, { color: expiryColor }]}>{expiryLabel}</Text>
      </View>

      <View style={styles.stat}>
        <Text style={[styles.label, { color: colors.subtext }]}>Amount</Text>
        <Text style={[styles.value, { color: colors.text }]}>
          {item.quantity} {item.quantityUnit}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginHorizontal: 16,
    marginVertical: 8,
  },
  stat: {
    flex: 1,
    padding: 14,
    gap: 4,
  },
  bordered: {
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  value: {
    fontSize: 15,
    fontWeight: '700',
  },
});

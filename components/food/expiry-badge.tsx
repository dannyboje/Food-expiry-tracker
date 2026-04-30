import { StyleSheet, Text, View } from 'react-native';
import { Brand } from '@/constants/theme';
import type { ExpiryStatus } from '@/types/food-item';
import { formatExpiryLabel } from '@/utils/food-item-utils';

interface Props {
  daysUntilExpiry: number;
  status: ExpiryStatus;
}

const STATUS_COLORS: Record<ExpiryStatus, { text: string; bg: string }> = {
  expired: { text: Brand.red, bg: Brand.redLight },
  expiring_soon: { text: Brand.orange, bg: Brand.orangeLight },
  fresh: { text: '#6B7280', bg: 'transparent' },
};

export function ExpiryBadge({ daysUntilExpiry, status }: Props) {
  const colors = STATUS_COLORS[status];
  const label = formatExpiryLabel(daysUntilExpiry);

  return (
    <View style={[styles.badge, status !== 'fresh' && { backgroundColor: colors.bg }]}>
      <Text style={[styles.text, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 4,
    paddingHorizontal: 2,
    paddingVertical: 1,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});

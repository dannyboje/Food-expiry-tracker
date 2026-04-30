import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Brand, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { StorageLocation } from '@/types/food-item';

type Filter = StorageLocation | 'all';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all',     label: 'All' },
  { key: 'fridge',  label: 'Fridge' },
  { key: 'freezer', label: 'Freezer' },
  { key: 'pantry',  label: 'Dry Pantry' },
];

interface Props {
  active: Filter;
  counts: Record<Filter, number>;
  onSelect: (filter: Filter) => void;
}

export function CategoryFilterBar({ active, counts, onSelect }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View style={[styles.wrapper, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
      {FILTERS.map(({ key, label }) => {
        const isActive = active === key;
        return (
          <TouchableOpacity
            key={key}
            onPress={() => onSelect(key)}
            style={styles.tab}
            activeOpacity={0.7}>
            <Text
              style={[
                styles.label,
                { color: isActive ? Brand.green : colors.subtext },
                isActive && styles.labelActive,
              ]}
              numberOfLines={1}>
              {label}
            </Text>
            <View style={[styles.countBubble, {
              backgroundColor: isActive ? Brand.green : colors.card,
              borderColor: isActive ? Brand.green : colors.border,
            }]}>
              <Text style={[styles.count, { color: isActive ? '#fff' : colors.subtext }]}>
                {counts[key]}
              </Text>
            </View>
            {isActive && <View style={styles.underline} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 8,
    gap: 4,
    position: 'relative',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  labelActive: {
    fontWeight: '700',
  },
  countBubble: {
    minWidth: 22,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  count: {
    fontSize: 11,
    fontWeight: '700',
  },
  underline: {
    position: 'absolute',
    bottom: 0,
    left: 8,
    right: 8,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: Brand.green,
  },
});

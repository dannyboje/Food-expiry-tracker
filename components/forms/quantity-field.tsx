import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { QuantityUnit } from '@/types/food-item';

const UNITS: QuantityUnit[] = ['pcs', 'g', 'kg', 'ml', 'l', 'oz', 'lbs'];

interface Props {
  quantity: number;
  unit: QuantityUnit;
  onQuantityChange: (v: number) => void;
  onUnitChange: (v: QuantityUnit) => void;
}

export function QuantityField({ quantity, unit, onQuantityChange, onUnitChange }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const currentIndex = UNITS.indexOf(unit);

  return (
    <View style={styles.row}>
      <TextInput
        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
        keyboardType="decimal-pad"
        value={String(quantity)}
        onChangeText={(t) => {
          const n = parseFloat(t);
          if (!isNaN(n)) onQuantityChange(n);
          else if (t === '') onQuantityChange(0);
        }}
        placeholder="0"
        placeholderTextColor={colors.subtext}
      />
      <View style={[styles.unitRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <TouchableOpacity
          onPress={() => {
            if (currentIndex > 0) onUnitChange(UNITS[currentIndex - 1]);
          }}
          style={styles.arrow}>
          <Text style={{ color: colors.text, fontSize: 18 }}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.unitLabel, { color: colors.text }]}>{unit}</Text>
        <TouchableOpacity
          onPress={() => {
            if (currentIndex < UNITS.length - 1) onUnitChange(UNITS[currentIndex + 1]);
          }}
          style={styles.arrow}>
          <Text style={{ color: colors.text, fontSize: 18 }}>›</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  unitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 4,
    minWidth: 90,
  },
  arrow: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  unitLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
  },
});

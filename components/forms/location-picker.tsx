import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Brand, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { StorageLocation } from '@/types/food-item';

const OPTIONS: { value: StorageLocation; label: string; emoji: string }[] = [
  { value: 'pantry', label: 'Pantry', emoji: '🫙' },
  { value: 'fridge', label: 'Fridge', emoji: '🧊' },
  { value: 'freezer', label: 'Freezer', emoji: '❄️' },
];

interface Props {
  value: StorageLocation;
  onChange: (v: StorageLocation) => void;
}

export function LocationPicker({ value, onChange }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View style={styles.row}>
      {OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[
              styles.option,
              { borderColor: active ? Brand.green : colors.border },
              active && { backgroundColor: Brand.greenLight },
            ]}
            onPress={() => onChange(opt.value)}>
            <Text style={styles.emoji}>{opt.emoji}</Text>
            <Text style={[styles.label, { color: active ? Brand.green : colors.text }]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  option: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  emoji: {
    fontSize: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
});

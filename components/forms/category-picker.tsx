import { Platform, StyleSheet, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { FoodCategory } from '@/types/food-item';

const CATEGORIES: { value: FoodCategory; label: string }[] = [
  { value: 'dairy', label: '🥛 Dairy' },
  { value: 'meat', label: '🥩 Meat' },
  { value: 'seafood', label: '🐟 Seafood' },
  { value: 'produce', label: '🥦 Produce' },
  { value: 'bakery', label: '🍞 Bakery' },
  { value: 'frozen', label: '🧊 Frozen' },
  { value: 'canned', label: '🥫 Canned' },
  { value: 'condiments', label: '🧴 Condiments' },
  { value: 'beverages', label: '🥤 Beverages' },
  { value: 'snacks', label: '🍿 Snacks' },
  { value: 'grains', label: '🌾 Grains' },
  { value: 'medicines', label: '💊 Medicines' },
  { value: 'other', label: '🍱 Other' },
];

interface Props {
  value: FoodCategory;
  onChange: (v: FoodCategory) => void;
}

export function CategoryPicker({ value, onChange }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View style={[styles.container, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <Picker
        selectedValue={value}
        onValueChange={(v) => onChange(v as FoodCategory)}
        itemStyle={{ color: colors.text }}
        style={[styles.picker, { color: colors.text }]}
        dropdownIconColor={colors.subtext}>
        {CATEGORIES.map((cat) => (
          <Picker.Item key={cat.value} label={cat.label} value={cat.value} color={colors.text} />
        ))}
      </Picker>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  picker: {
    ...Platform.select({
      ios: { height: 120 },
      android: { height: 48 },
    }),
  },
});

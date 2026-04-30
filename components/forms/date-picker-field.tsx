import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface Props {
  label: string;
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
}

function toDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function DatePickerField({ label, value, onChange }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [showAndroid, setShowAndroid] = useState(false);
  const date = toDate(value);

  const formatted = date.toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });

  if (Platform.OS === 'ios') {
    return (
      <View style={styles.iosRow}>
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
        <DateTimePicker
          value={date}
          mode="date"
          display="compact"
          accentColor="#22C55E"
          onChange={(_, d) => d && onChange(toISO(d))}
          style={styles.iosPicker}
        />
      </View>
    );
  }

  return (
    <View>
      <Pressable
        style={[styles.androidRow, { borderColor: colors.border, backgroundColor: colors.card }]}
        onPress={() => setShowAndroid(true)}>
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
        <Text style={[styles.value, { color: colors.text }]}>{formatted}</Text>
      </Pressable>
      {showAndroid && (
        <DateTimePicker
          value={date}
          mode="date"
          display="default"
          onChange={(_, d) => {
            setShowAndroid(false);
            if (d) onChange(toISO(d));
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  iosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  iosPicker: {
    marginRight: -8,
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
  },
  androidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  value: {
    fontSize: 15,
  },
});

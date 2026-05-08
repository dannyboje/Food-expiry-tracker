import { Modal, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Brand, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface Props {
  label: string;
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
}

function toDate(iso: string): Date {
  const parts = iso.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return new Date();
  const [y, m, d] = parts;
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
  const insets = useSafeAreaInsets();
  const [showPicker, setShowPicker] = useState(false);
  const [pendingDate, setPendingDate] = useState<Date>(toDate(value));

  const date = toDate(value);
  const formatted = date.toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });

  function openPicker() {
    setPendingDate(toDate(value));
    setShowPicker(true);
  }

  function handleDone() {
    onChange(toISO(pendingDate));
    setShowPicker(false);
  }

  function handleCancel() {
    setShowPicker(false);
  }

  return (
    <View>
      <Pressable
        style={[styles.row, { borderColor: colors.border, backgroundColor: colors.card }]}
        onPress={openPicker}>
        {label ? <Text style={[styles.label, { color: colors.text }]}>{label}</Text> : null}
        <Text style={[styles.dateValue, { color: colors.text }]}>{formatted}</Text>
      </Pressable>

      {/* iOS: transparent modal so the calendar appears at the top of the screen */}
      {Platform.OS === 'ios' && (
        <Modal
          visible={showPicker}
          transparent
          animationType="fade"
          onRequestClose={handleCancel}>
          {/* Tapping the backdrop cancels */}
          <Pressable style={styles.backdrop} onPress={handleCancel}>
            {/* Stop taps inside the card from closing the modal */}
            <Pressable
              style={[
                styles.card,
                {
                  marginTop: insets.top + 8,
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}>
              {/* Cancel / Done toolbar */}
              <View style={[styles.toolbar, { borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={handleCancel} hitSlop={8}>
                  <Text style={[styles.toolbarCancel, { color: colors.subtext }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDone} hitSlop={8}>
                  <Text style={[styles.toolbarDone, { color: Brand.green }]}>Done</Text>
                </TouchableOpacity>
              </View>

              <DateTimePicker
                value={pendingDate}
                mode="date"
                display="inline"
                accentColor="#22C55E"
                onChange={(_, d) => { if (d) setPendingDate(d); }}
              />
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* Android: native dialog handles its own positioning */}
      {Platform.OS === 'android' && showPicker && (
        <DateTimePicker
          value={date}
          mode="date"
          display="default"
          accentColor="#22C55E"
          onChange={(event, d) => {
            if (event.type === 'set' && d) {
              setShowPicker(false);
              onChange(toISO(d));
            } else if (event.type === 'dismissed') {
              setShowPicker(false);
            }
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  label: { fontSize: 15, fontWeight: '500' },
  dateValue: { fontSize: 15 },
  // Modal
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 16,
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 10,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  toolbarCancel: { fontSize: 15 },
  toolbarDone: { fontSize: 15, fontWeight: '700' },
});

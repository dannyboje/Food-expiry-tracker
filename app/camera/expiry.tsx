import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import TextRecognition from '@react-native-ml-kit/text-recognition';

import { PhotoCaptureView } from '@/components/scanner/photo-capture-view';
import { DatePickerField } from '@/components/forms/date-picker-field';
import { Brand, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { parseExpiryDateFromText } from '@/utils/date-ocr-parser';
import { todayISO } from '@/utils/food-item-utils';
import { setCameraResult } from '@/utils/camera-result-store';

export default function ExpiryCamera() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [parsedDate, setParsedDate] = useState<string | null>(null);
  const [confirmedDate, setConfirmedDate] = useState(todayISO());
  const [processing, setProcessing] = useState(false);
  const [ocrMessage, setOcrMessage] = useState('');

  async function handleCapture(uri: string) {
    setPhotoUri(uri);
    setProcessing(true);
    setOcrMessage('Reading date from photo…');
    try {
      const result = await TextRecognition.recognize(uri);
      const allText = result.blocks.map((b) => b.text).join('\n');
      const found = parseExpiryDateFromText(allText);
      if (found) {
        setParsedDate(found);
        setConfirmedDate(found);
        setOcrMessage(`Found date: ${found} — please confirm below`);
      } else {
        setOcrMessage("Couldn't read the date — please enter it manually");
      }
    } catch {
      setOcrMessage("Couldn't read the date — please enter it manually");
    } finally {
      setProcessing(false);
    }
  }

  function handleConfirm() {
    setCameraResult({ type: 'expiry', uri: photoUri!, date: confirmedDate });
    router.back();
  }

  if (!photoUri) {
    return (
      <PhotoCaptureView
        hint="Point at the expiry or best-before date on the packaging"
        onCapture={handleCapture}
        onCancel={() => router.back()}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>Confirm Expiry Date</Text>
        <Text style={[styles.subtitle, { color: colors.subtext }]}>{ocrMessage}</Text>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <DatePickerField
            label="Expiry / best-before date"
            value={confirmedDate}
            onChange={setConfirmedDate}
          />
        </View>

        <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} disabled={processing}>
          <Text style={styles.confirmBtnText}>Use This Date</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setPhotoUri(null)} style={styles.retakeBtn}>
          <Text style={[styles.retakeBtnText, { color: colors.subtext }]}>Retake Photo</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: 24, gap: 16 },
  title: { fontSize: 24, fontWeight: '800' },
  subtitle: { fontSize: 14, lineHeight: 20 },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  confirmBtn: {
    marginTop: 8,
    backgroundColor: Brand.green,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  retakeBtn: { alignItems: 'center', padding: 12 },
  retakeBtnText: { fontSize: 14 },
});

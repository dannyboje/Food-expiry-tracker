import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import TextRecognition from '@react-native-ml-kit/text-recognition';

import { PhotoCaptureView } from '@/components/scanner/photo-capture-view';
import { DatePickerField } from '@/components/forms/date-picker-field';
import { Brand, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { parseExpiryDateFromText } from '@/utils/date-ocr-parser';
import { todayISO } from '@/utils/food-item-utils';
import { setCameraResult } from '@/utils/camera-result-store';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function ExpiryCamera() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [confirmedDate, setConfirmedDate] = useState(todayISO());
  const [processing, setProcessing] = useState(false);
  const [ocrMessage, setOcrMessage] = useState('');
  const [ocrFound, setOcrFound] = useState(false);

  async function handleCapture(uri: string) {
    setPhotoUri(uri);
    setProcessing(true);
    setOcrMessage('Reading date from photo…');
    try {
      const result = await TextRecognition.recognize(uri);

      // Build candidate text strings from the OCR result.
      // Strategy 1: join block-level texts (most reliable — always present).
      const blockTexts = result.blocks.map((b) => b.text).join('\n');

      // Strategy 2: join individual line texts (finer-grained, may be missing).
      const lineTexts: string[] = [];
      for (const block of result.blocks) {
        for (const line of (block.lines ?? [])) {
          if (line?.text) lineTexts.push(line.text);
        }
      }
      const joinedLines = lineTexts.join('\n');

      // Try each combination. Earlier matches take priority.
      const found =
        parseExpiryDateFromText(blockTexts) ??
        parseExpiryDateFromText(joinedLines) ??
        parseExpiryDateFromText(blockTexts.replace(/\n/g, ' ')) ??
        parseExpiryDateFromText(joinedLines.replace(/\n/g, ' '));

      if (found) {
        setConfirmedDate(found);
        setOcrFound(true);
        setOcrMessage(`Detected: ${found} — confirm or adjust below`);
      } else {
        setOcrFound(false);
        setOcrMessage("Couldn't detect the date — please enter it manually below");
      }
    } catch (e) {
      setOcrFound(false);
      setOcrMessage("Couldn't read the photo — please enter the date manually");
    } finally {
      setProcessing(false);
    }
  }

  function handleConfirm() {
    setCameraResult({ type: 'expiry', uri: photoUri!, date: confirmedDate });
    router.back();
  }

  function handleCancel() {
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
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['bottom']}>
      {/* Hide Expo Router's auto-generated nav header for this screen */}
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: colors.text }]}>Confirm Expiry Date</Text>

        {/* OCR status badge */}
        <View style={[styles.statusBadge, { backgroundColor: ocrFound ? '#F0FDF4' : '#FFF7ED', borderColor: ocrFound ? '#86EFAC' : '#FED7AA' }]}>
          <Text style={[styles.statusText, { color: ocrFound ? '#166534' : '#92400E' }]}>
            {processing ? '⏳  Reading image…' : ocrFound ? `✅  ${ocrMessage}` : `⚠️  ${ocrMessage}`}
          </Text>
        </View>

        {/* Date picker */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <DatePickerField
            label="Expiry / best-before date"
            value={confirmedDate}
            onChange={setConfirmedDate}
          />
        </View>

        {/* Primary action */}
        <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} disabled={processing}>
          <Text style={styles.confirmBtnText}>Use This Date</Text>
        </TouchableOpacity>

        {/* Secondary actions */}
        <View style={styles.secondaryRow}>
          <TouchableOpacity onPress={() => setPhotoUri(null)} style={styles.secondaryBtn}>
            <IconSymbol name="camera.fill" size={15} color={colors.subtext} />
            <Text style={[styles.secondaryBtnText, { color: colors.subtext }]}>Retake Photo</Text>
          </TouchableOpacity>
          <View style={[styles.secondaryDivider, { backgroundColor: colors.border }]} />
          <TouchableOpacity onPress={handleCancel} style={styles.secondaryBtn}>
            <IconSymbol name="xmark" size={15} color={colors.subtext} />
            <Text style={[styles.secondaryBtnText, { color: colors.subtext }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },

  content: {
    padding: 20,
    // Extra top padding so the title clears the Dynamic Island / notch area
    paddingTop: 72,
    gap: 16,
  },

  title: { fontSize: 26, fontWeight: '800', marginBottom: 4 },

  statusBadge: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  statusText: { fontSize: 13, lineHeight: 18, fontWeight: '500' },

  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },

  confirmBtn: {
    backgroundColor: Brand.green,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  secondaryRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 0,
    marginTop: 4,
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
  },
  secondaryBtnText: { fontSize: 14 },
  secondaryDivider: { width: StyleSheet.hairlineWidth, height: 20 },
});

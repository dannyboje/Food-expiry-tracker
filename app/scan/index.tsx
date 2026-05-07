import { useRouter } from 'expo-router';
import { BarcodeScannerView } from '@/components/scanner/barcode-scanner-view';
import { setScanResult } from '@/utils/scan-result-store';

export default function ScanScreen() {
  const router = useRouter();

  return (
    <BarcodeScannerView
      onScan={({ barcode, name, category, nutriScore, novaGroup, fatSecretScore, suggestedExpiryDate }) => {
        setScanResult({
          barcode,
          name: name ?? undefined,
          category: category ?? undefined,
          nutriScore: nutriScore ?? undefined,
          novaGroup: novaGroup ?? undefined,
          rawScore: fatSecretScore ?? undefined,
          expiryDate: suggestedExpiryDate ?? undefined,
          expiryHint: suggestedExpiryDate ? 'Estimated from typical shelf life for this category' : undefined,
        });
        router.back();
      }}
      onCancel={() => router.back()}
    />
  );
}

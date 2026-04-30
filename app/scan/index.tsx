import { useRouter } from 'expo-router';
import { BarcodeScannerView } from '@/components/scanner/barcode-scanner-view';

export default function ScanScreen() {
  const router = useRouter();

  return (
    <BarcodeScannerView
      onScan={({ barcode, name, category, nutriScore, novaGroup, fatSecretScore, suggestedExpiryDate }) => {
        router.replace({
          pathname: '/add-item',
          params: {
            barcode,
            name: name ?? '',
            category: category ?? '',
            nutriScore: nutriScore ?? '',
            novaGroup: novaGroup?.toString() ?? '',
            rawScore: fatSecretScore?.toString() ?? '',
            expiryDate: suggestedExpiryDate ?? '',
            expiryHint: suggestedExpiryDate ? 'Estimated from typical shelf life for this category' : '',
          },
        });
      }}
      onCancel={() => router.back()}
    />
  );
}

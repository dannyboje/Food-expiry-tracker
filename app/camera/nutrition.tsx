import { useRouter } from 'expo-router';
import { PhotoCaptureView } from '@/components/scanner/photo-capture-view';
import { setCameraResult } from '@/utils/camera-result-store';

export default function NutritionCamera() {
  const router = useRouter();

  function handleCapture(uri: string) {
    setCameraResult({ type: 'nutrition', uri });
    router.back();
  }

  return (
    <PhotoCaptureView
      hint="Point at the product — this photo will be its pantry icon"
      onCapture={handleCapture}
      onCancel={() => router.back()}
    />
  );
}

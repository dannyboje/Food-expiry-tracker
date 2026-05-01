import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Brand } from '@/constants/theme';
import { persistPhoto, resolvePhotoUri } from '@/utils/photo-storage';
import { IconSymbol } from '@/components/ui/icon-symbol';

interface Props {
  onCapture: (uri: string) => void;
  onCancel: () => void;
  hint?: string;
}


export function PhotoCaptureView({ onCapture, onCancel, hint }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [processing, setProcessing] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  async function takePicture() {
    if (!cameraRef.current) return;
    setProcessing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (photo) {
        const uri = await persistPhoto(photo.uri, 'capture');
        setPreview(uri);
      }
    } finally {
      setProcessing(false);
    }
  }

  async function pickFromLibrary() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setProcessing(true);
      try {
        const uri = await persistPhoto(result.assets[0].uri, 'library');
        setPreview(uri);
      } finally {
        setProcessing(false);
      }
    }
  }

  function confirmCapture() {
    if (preview) onCapture(preview);
  }

  if (!permission) return null;

  if (!permission.granted) {
    return (
      <View style={styles.permContainer}>
        <Text style={styles.permText}>Camera access is needed to take photos.</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Allow Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onCancel} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (preview) {
    return (
      <View style={styles.previewContainer}>
        <Image source={{ uri: resolvePhotoUri(preview) }} style={styles.preview} />
        <View style={styles.previewActions}>
          <TouchableOpacity style={styles.retakeBtn} onPress={() => setPreview(null)}>
            <Text style={styles.retakeBtnText}>Retake</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.confirmBtn} onPress={confirmCapture}>
            <Text style={styles.confirmBtnText}>Use Photo</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing="back">
        <View style={styles.overlay}>
          {hint && (
            <View style={styles.hintBox}>
              <Text style={styles.hintText}>{hint}</Text>
            </View>
          )}
          <View style={styles.guide} />
          <View style={styles.controls}>
            <TouchableOpacity style={styles.libraryBtn} onPress={pickFromLibrary}>
              <IconSymbol name="photo.on.rectangle" size={26} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.captureBtn} onPress={takePicture} disabled={processing}>
              {processing
                ? <ActivityIndicator color="#fff" />
                : <View style={styles.captureInner} />
              }
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelSmallBtn} onPress={onCancel}>
              <IconSymbol name="xmark" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  overlay: { flex: 1, justifyContent: 'space-between' },
  hintBox: {
    margin: 16,
    marginTop: 60,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    padding: 12,
    alignSelf: 'center',
  },
  hintText: { color: '#fff', textAlign: 'center', fontSize: 14 },
  guide: {
    alignSelf: 'center',
    width: '80%',
    aspectRatio: 2.5,
    borderWidth: 2,
    borderColor: Brand.green,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 48,
    paddingTop: 24,
  },
  captureBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#fff',
  },
  libraryBtn: { padding: 12 },
  cancelSmallBtn: { padding: 12 },
  permContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  permText: { textAlign: 'center', fontSize: 16, color: '#fff' },
  permBtn: {
    backgroundColor: Brand.green,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  permBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  cancelBtn: { padding: 12 },
  cancelText: { color: '#aaa', fontSize: 14 },
  previewContainer: { flex: 1, backgroundColor: '#000' },
  preview: { flex: 1, resizeMode: 'contain' },
  previewActions: {
    flexDirection: 'row',
    gap: 12,
    padding: 24,
    paddingBottom: 48,
  },
  retakeBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#fff',
    alignItems: 'center',
  },
  retakeBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  confirmBtn: {
    flex: 1,
    backgroundColor: Brand.green,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

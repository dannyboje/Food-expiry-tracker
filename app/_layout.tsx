import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import * as Notifications from 'expo-notifications';
import 'react-native-reanimated';

import { PantryProvider } from '@/context/pantry-context';
import { initDatabase } from '@/utils/storage';
import { requestNotificationPermissions } from '@/utils/notification-scheduler';
import { scheduleDailyRecallCheck } from '@/utils/recall-scheduler';
import { EmailCaptureModal } from '@/components/onboarding/EmailCaptureModal';
import { hasShownEmailPrompt } from '@/utils/email-capture';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [showEmailCapture, setShowEmailCapture] = useState(false);

  useEffect(() => {
    initDatabase().catch(console.error);
    hasShownEmailPrompt().then((shown) => { if (!shown) setShowEmailCapture(true); }).catch(console.error);

    // Android requires an explicit notification channel before any scheduling.
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'Fresh Ahead',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#22C55E',
      }).catch(console.error);
    }

    requestNotificationPermissions()
      .then((granted) => { if (granted) scheduleDailyRecallCheck().catch(console.error); })
      .catch(console.error);
  }, []);

  return (
    <ThemeProvider value={DefaultTheme}>
      <PantryProvider>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          <Stack.Screen name="scan/index" options={{ presentation: 'fullScreenModal', headerShown: false }} />
          <Stack.Screen name="camera/expiry" options={{ presentation: 'fullScreenModal', headerShown: false }} />
          <Stack.Screen name="camera/nutrition" options={{ presentation: 'fullScreenModal', headerShown: false }} />
          <Stack.Screen
            name="add-item/index"
            options={{
              presentation: 'formSheet',
              headerShown: false,
              sheetGrabberVisible: true,
              sheetAllowedDetents: [0.92],
              sheetExpandsWhenScrolledToEdge: false,
            }}
          />
          <Stack.Screen
            name="item/[id]"
            options={{ title: 'Item Details', headerBackTitle: 'Pantry' }}
          />
          <Stack.Screen
            name="scan-detail/[barcode]"
            options={{ title: 'Scanned Product', headerBackTitle: 'Health' }}
          />
        </Stack>
        <EmailCaptureModal visible={showEmailCapture} onDone={() => setShowEmailCapture(false)} />
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      </PantryProvider>
    </ThemeProvider>
  );
}

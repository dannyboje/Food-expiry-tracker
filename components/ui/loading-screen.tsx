import { Image, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BgFoodDecor } from '@/components/ui/food-decor';

export function LoadingScreen() {
  return (
    <View style={styles.container}>
      <BgFoodDecor />
      <SafeAreaView style={styles.center}>
        <View style={styles.logoCard}>
          <Image
            source={require('@/assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0FDF4' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logoCard: {
    width: 148,
    height: 148,
    borderRadius: 30,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  },
  logo: { width: 116, height: 116 },
});

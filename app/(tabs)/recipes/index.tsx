import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function RecipesScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Recipes</Text>
      </View>
      <View style={styles.center}>
        <Text style={styles.emoji}>👨‍🍳</Text>
        <Text style={[styles.heading, { color: colors.text }]}>Coming Soon</Text>
        <Text style={[styles.sub, { color: colors.subtext }]}>
          Recipe suggestions based on items in your pantry are on the way.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  title: { fontSize: 32, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emoji: { fontSize: 56 },
  heading: { fontSize: 22, fontWeight: '700' },
  sub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});

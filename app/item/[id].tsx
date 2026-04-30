import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useLayoutEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FoodItemStats } from '@/components/food/food-item-stats';
import { OFFNutritionPanel } from '@/components/food/off-nutrition-panel';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { usePantry } from '@/hooks/use-pantry';
import { enrichItem } from '@/utils/food-item-utils';
import { computeScore, scoreColor, scoreLabel } from '@/utils/food-score';

const CATEGORY_EMOJIS: Record<string, string> = {
  dairy: '🥛', meat: '🥩', seafood: '🐟', produce: '🥦',
  bakery: '🍞', frozen: '🧊', canned: '🥫', condiments: '🧴',
  beverages: '🥤', snacks: '🍿', grains: '🌾', medicines: '💊', other: '🍱',
};

const LOCATION_LABEL: Record<string, string> = {
  fridge: 'Fridge', freezer: 'Freezer', pantry: 'Dry pantry',
};

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { enrichedItems, deleteItem } = usePantry();

  const rawItem = enrichedItems.find((i) => i.id === id) ?? null;
  const item = rawItem ? enrichItem(rawItem) : null;

  useLayoutEffect(() => {
    if (!item) return;
    navigation.setOptions({
      title: '',
      headerRight: () => (
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={handleEdit} style={styles.headerBtn}>
            <IconSymbol name="pencil" size={20} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} style={styles.headerBtn}>
            <IconSymbol name="trash" size={20} color="#EF4444" />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [item, colors, navigation]);

  if (!item) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.subtext, textAlign: 'center', marginTop: 40 }}>
          Item not found.
        </Text>
      </SafeAreaView>
    );
  }

  function handleEdit() {
    router.push({ pathname: '/add-item', params: { editId: item!.id } });
  }

  function handleDelete() {
    Alert.alert(
      'Delete Item',
      `Remove "${item!.name}" from your pantry?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteItem(item!.id);
            router.back();
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero header */}
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>{CATEGORY_EMOJIS[item.category]}</Text>
          <Text style={[styles.itemName, { color: colors.text }]}>{item.name}</Text>
          <Text style={[styles.categoryLocation, { color: colors.subtext }]}>
            {item.category.charAt(0).toUpperCase() + item.category.slice(1)} in{' '}
            {LOCATION_LABEL[item.storageLocation]}
          </Text>
        </View>

        {/* Health score */}
        {(() => {
          const composite = computeScore(item.nutriScore, item.novaGroup, item.rawScore);
          if (composite === undefined) return null;
          return (
            <View style={[styles.scoreCard, { borderColor: scoreColor(composite) }]}>
              <View style={[styles.scoreCircle, { borderColor: scoreColor(composite) }]}>
                <Text style={[styles.scoreNumber, { color: scoreColor(composite) }]}>{composite}</Text>
                <Text style={[styles.scoreOutOf, { color: scoreColor(composite) }]}>/100</Text>
              </View>
              <View style={styles.scoreInfo}>
                <Text style={[styles.scoreGrade, { color: scoreColor(composite) }]}>
                  {scoreLabel(composite)}
                </Text>
                <Text style={[styles.scoreBreakdown, { color: colors.subtext }]}>
                  {[
                    item.nutriScore ? `Nutri-Score ${item.nutriScore.toUpperCase()}` : null,
                    item.novaGroup ? `NOVA ${item.novaGroup}` : null,
                  ].filter(Boolean).join('  ·  ')}
                </Text>
                <Text style={[styles.scoreSource, { color: colors.subtext }]}>
                  via Open Food Facts
                </Text>
              </View>
            </View>
          );
        })()}

        {/* Stats row */}
        <FoodItemStats item={item} />

        {/* Yuka-style OFF nutritional panel */}
        {item.barcode && (
          <OFFNutritionPanel
            barcode={item.barcode}
            nutriScore={item.nutriScore}
            novaGroup={item.novaGroup}
          />
        )}

        {/* Expiry date photo */}
        {item.expiryPhotoUri && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Expiry Date Photo</Text>
            <Image source={{ uri: item.expiryPhotoUri }} style={styles.photo} />
          </View>
        )}

        {/* Nutrition photo */}
        {item.nutritionPhotoUri && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Nutrition Info</Text>
            <Image source={{ uri: item.nutritionPhotoUri }} style={styles.photo} />
          </View>
        )}

        {/* Added by */}
        {item.addedBy && (
          <View style={[styles.section, styles.metaRow]}>
            <IconSymbol name="person.fill" size={16} color={colors.subtext} />
            <Text style={[styles.metaText, { color: colors.subtext }]}>Added by {item.addedBy}</Text>
          </View>
        )}

        {/* Barcode */}
        {item.barcode && (
          <View style={[styles.section, styles.metaRow]}>
            <IconSymbol name="barcode.viewfinder" size={16} color={colors.subtext} />
            <Text style={[styles.metaText, { color: colors.subtext }]}>Barcode: {item.barcode}</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: { alignItems: 'center', paddingTop: 24, paddingBottom: 8, paddingHorizontal: 16, gap: 6 },
  heroEmoji: { fontSize: 52 },
  itemName: { fontSize: 28, fontWeight: '800', textAlign: 'center' },
  categoryLocation: { fontSize: 14, fontWeight: '500' },
  section: { marginHorizontal: 16, marginTop: 20, gap: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  photo: { width: '100%', height: 200, borderRadius: 12, resizeMode: 'cover' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  metaText: { fontSize: 13 },
  headerRight: { flexDirection: 'row', gap: 4 },
  headerBtn: { padding: 8 },
  scoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: 16,
    marginTop: 16,
    borderWidth: 2,
    borderRadius: 16,
    padding: 14,
  },
  scoreCircle: {
    width: 64, height: 64, borderRadius: 32, borderWidth: 3,
    alignItems: 'center', justifyContent: 'center',
  },
  scoreNumber: { fontSize: 22, fontWeight: '900', lineHeight: 26 },
  scoreOutOf: { fontSize: 10, fontWeight: '600' },
  scoreInfo: { flex: 1, gap: 2 },
  scoreGrade: { fontSize: 18, fontWeight: '800' },
  scoreBreakdown: { fontSize: 13, fontWeight: '600' },
  scoreSource: { fontSize: 11, marginTop: 2 },
});

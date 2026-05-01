import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useLayoutEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { FoodItemStats } from '@/components/food/food-item-stats';
import { OFFNutritionPanel } from '@/components/food/off-nutrition-panel';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { usePantry } from '@/hooks/use-pantry';
import { enrichItem } from '@/utils/food-item-utils';
import { computeScore, scoreColor, scoreLabel } from '@/utils/food-score';
import { resolvePhotoUri } from '@/utils/photo-storage';

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
        <LinearGradient
          colors={['#F0FDF4', '#DCFCE7']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}>
          <View style={styles.heroIconWrap}>
            {resolvePhotoUri(item.expiryPhotoUri ?? item.nutritionPhotoUri) ? (
              <Image
                source={{ uri: resolvePhotoUri(item.expiryPhotoUri ?? item.nutritionPhotoUri)! }}
                style={styles.heroPhoto}
              />
            ) : (
              <Text style={styles.heroEmoji}>{CATEGORY_EMOJIS[item.category]}</Text>
            )}
          </View>
          <Text style={[styles.itemName, { color: '#14532D' }]}>{item.name}</Text>
          <Text style={[styles.categoryLocation, { color: '#15803D' }]}>
            {item.category.charAt(0).toUpperCase() + item.category.slice(1)} · {LOCATION_LABEL[item.storageLocation]}
          </Text>
        </LinearGradient>

        {/* Health score */}
        {(() => {
          const composite = computeScore(item.nutriScore, item.novaGroup, item.rawScore);
          if (composite === undefined) return null;
          return (
            <View style={[styles.scoreCard, { borderColor: scoreColor(composite), backgroundColor: colors.card }]}>
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
        {resolvePhotoUri(item.expiryPhotoUri) && (
          <View style={[styles.section, styles.photoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Expiry Date Photo</Text>
            <Image source={{ uri: resolvePhotoUri(item.expiryPhotoUri) }} style={styles.photo} />
          </View>
        )}

        {/* Nutrition photo */}
        {resolvePhotoUri(item.nutritionPhotoUri) && (
          <View style={[styles.section, styles.photoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Nutrition Info</Text>
            <Image source={{ uri: resolvePhotoUri(item.nutritionPhotoUri) }} style={styles.photo} />
          </View>
        )}

        {/* Added by / Barcode meta row */}
        {(item.addedBy || item.barcode) && (
          <View style={[styles.metaCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {item.addedBy && (
              <View style={styles.metaRow}>
                <IconSymbol name="person.fill" size={15} color={colors.subtext} />
                <Text style={[styles.metaText, { color: colors.subtext }]}>Added by {item.addedBy}</Text>
              </View>
            )}
            {item.barcode && (
              <View style={[styles.metaRow, item.addedBy && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 10 }]}>
                <IconSymbol name="barcode.viewfinder" size={15} color={colors.subtext} />
                <Text style={[styles.metaText, { color: colors.subtext }]}>Barcode: {item.barcode}</Text>
              </View>
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: { alignItems: 'center', paddingTop: 28, paddingBottom: 24, paddingHorizontal: 20, gap: 8 },
  heroIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  heroEmoji: { fontSize: 44 },
  heroPhoto: { width: 88, height: 88, borderRadius: 44 },
  itemName: { fontSize: 26, fontWeight: '800', textAlign: 'center' },
  categoryLocation: { fontSize: 14, fontWeight: '600' },
  section: { marginHorizontal: 16, marginTop: 16, gap: 10 },
  photoCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  photo: { width: '100%', height: 200, borderRadius: 10, resizeMode: 'cover' },
  metaCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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

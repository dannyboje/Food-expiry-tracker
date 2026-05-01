import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ExpiryBadge } from './expiry-badge';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Brand, Colors } from '@/constants/theme';
import type { FoodCategory, FoodItemWithStatus } from '@/types/food-item';
import { computeScore, scoreColor } from '@/utils/food-score';
import { resolvePhotoUri } from '@/utils/photo-storage';
import { usePantry } from '@/hooks/use-pantry';

const STATUS_STRIPE: Record<string, string> = {
  expired: Brand.red,
  expiring_soon: Brand.orange,
  fresh: Brand.green,
};

const CATEGORY_ICONS: Record<FoodCategory, string> = {
  dairy: '🥛',
  meat: '🥩',
  seafood: '🐟',
  produce: '🥦',
  bakery: '🍞',
  frozen: '🧊',
  canned: '🥫',
  condiments: '🧴',
  beverages: '🥤',
  snacks: '🍿',
  grains: '🌾',
  medicines: '💊',
  other: '🍱',
};

const LOCATION_LABEL: Record<string, string> = {
  fridge: 'Fridge',
  freezer: 'Freezer',
  pantry: 'Dry pantry',
};

interface Props {
  item: FoodItemWithStatus;
}

export function FoodItemCard({ item }: Props) {
  const router = useRouter();
  const colors = Colors[useColorScheme() ?? 'light'];
  const { markAsUsed } = usePantry();

  function handleLongPress() {
    Alert.alert(
      item.name,
      'What would you like to do?',
      [
        {
          text: 'I used it',
          onPress: () => markAsUsed(item.id, 'used'),
        },
        {
          text: 'It expired / wasted',
          style: 'destructive',
          onPress: () => markAsUsed(item.id, 'wasted'),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }

  return (
    // Outer view carries the shadow; inner TouchableOpacity clips the stripe with overflow:hidden
    <View style={[styles.cardShadow, { backgroundColor: colors.card }]}>
      <TouchableOpacity
        style={styles.cardInner}
        onPress={() => router.push(`/item/${item.id}`)}
        onLongPress={handleLongPress}
        delayLongPress={400}
        activeOpacity={0.75}>
        {/* Colored left stripe */}
        <View style={[styles.stripe, { backgroundColor: STATUS_STRIPE[item.status] }]} />
        <View style={[styles.iconContainer, { backgroundColor: colors.card }]}>
          {resolvePhotoUri(item.expiryPhotoUri ?? item.nutritionPhotoUri) ? (
            <Image
              source={{ uri: resolvePhotoUri(item.expiryPhotoUri ?? item.nutritionPhotoUri)! }}
              style={styles.itemPhoto}
            />
          ) : (
            <Text style={styles.categoryEmoji}>{CATEGORY_ICONS[item.category]}</Text>
          )}
        </View>
        <View style={styles.info}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
          <ExpiryBadge daysUntilExpiry={item.daysUntilExpiry} status={item.status} />
        </View>
        <View style={styles.meta}>
          <Text style={[styles.quantity, { color: colors.text }]}>
            {item.quantity} {item.quantityUnit}
          </Text>
          <Text style={[styles.location, { color: colors.subtext }]}>
            {LOCATION_LABEL[item.storageLocation]}
          </Text>
          {(() => {
            const score = computeScore(item.nutriScore, item.novaGroup, item.rawScore);
            if (score === undefined) return null;
            return (
              <View style={[styles.scoreBadge, { backgroundColor: scoreColor(score) }]}>
                <Text style={styles.scoreNumber}>{score}</Text>
              </View>
            );
          })()}
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  // Shadow lives here so iOS renders it outside the card bounds
  cardShadow: {
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  // overflow:hidden clips the stripe to the rounded corners
  cardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    overflow: 'hidden',
    paddingRight: 12,
    paddingVertical: 13,
  },
  stripe: {
    width: 4,
    alignSelf: 'stretch',
    marginRight: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  categoryEmoji: {
    fontSize: 22,
  },
  itemPhoto: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  info: {
    flex: 1,
    gap: 4,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
  },
  meta: {
    alignItems: 'flex-end',
    gap: 3,
  },
  quantity: {
    fontSize: 13,
    fontWeight: '500',
  },
  location: { fontSize: 12 },
  scoreBadge: {
    marginTop: 4,
    minWidth: 32,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
    paddingHorizontal: 4,
  },
  scoreNumber: { color: '#fff', fontSize: 11, fontWeight: '900' },
});

import { FlatList, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';

import { FoodItemCard } from '@/components/food/food-item-card';
import { CategoryFilterBar } from '@/components/food/category-filter-bar';
import { EmptyState } from '@/components/food/empty-state';
import { NotificationBanner } from '@/components/ui/notification-banner';
import { RecallAlertBanner } from '@/components/ui/recall-alert-banner';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BgFoodDecor, HeaderFoodDecor } from '@/components/ui/food-decor';
import { LoadingScreen } from '@/components/ui/loading-screen';
import { Brand, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { usePantry } from '@/hooks/use-pantry';
import { useDebounce } from '@/hooks/use-debounce';
import type { StorageLocation } from '@/types/food-item';

export default function PantryScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { state, filteredItems, counts, alertItems, expiredCount, setSearch, setFilter, dismissRecallAlert } = usePantry();
  const [localSearch, setLocalSearch] = useState('');
  const debounced = useDebounce(localSearch, 250);

  // Drive context search from debounced input — must be in effect, not render body
  useEffect(() => {
    setSearch(debounced);
  }, [debounced]);

  if (state.isLoading) return <LoadingScreen />;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <BgFoodDecor />
      <NotificationBanner items={alertItems} />

      {/* Gradient header */}
      <LinearGradient
        colors={['#8BD1A5', '#91E2AF', '#A5EFC0']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}>
        <HeaderFoodDecor />
        <SafeAreaView edges={['top']}>
          <View style={styles.headerRow}>
            <View style={styles.brandRow}>
              <Image source={require('@/assets/images/logo.png')} style={styles.logo} />
              <View>
                <Text style={styles.appName}>Fresh Ahead</Text>
                <Text style={styles.tagline}>Track it. Use it. Waste less.</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/add-item')}
              style={styles.addButton}
              hitSlop={8}>
              <View style={styles.addButtonInner}>
                <IconSymbol name="plus.circle.fill" size={22} color={Brand.green} />
              </View>
            </TouchableOpacity>
          </View>

          {/* Search bar inside gradient */}
          <View style={styles.searchBar}>
            <IconSymbol name="magnifyingglass" size={16} color="#6B7280" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search items…"
              placeholderTextColor="#9CA3AF"
              value={localSearch}
              onChangeText={setLocalSearch}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Recall safety alerts — shown above everything else when present */}
      <RecallAlertBanner
        alerts={state.recallAlerts}
        onDismiss={dismissRecallAlert}
        onDismissAll={() => state.recallAlerts.forEach((a) => dismissRecallAlert(a.pairId))}
      />

      {/* Expired banner */}
      {expiredCount > 0 && (
        <View style={styles.expiredBanner}>
          <Text style={styles.expiredText}>
            ⚠️  {expiredCount} expired item{expiredCount !== 1 ? 's' : ''} in your pantry
          </Text>
        </View>
      )}

      {/* Filter tabs */}
      <CategoryFilterBar
        active={state.activeFilter}
        counts={counts}
        onSelect={(f) => setFilter(f as StorageLocation | 'all')}
      />

      {/* Item list */}
      <View style={styles.listContainer}>
        {filteredItems.length === 0 ? (
          <EmptyState />
        ) : (
          <Animated.FlatList
            itemLayoutAnimation={LinearTransition}
            data={filteredItems}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Animated.View entering={FadeIn}>
                <FoodItemCard item={item} />
              </Animated.View>
            )}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            style={styles.flatList}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerGradient: {
    paddingBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logo: {
    width: 56,
    height: 56,
    resizeMode: 'contain',
  },
  appName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#166534',
  },
  tagline: {
    fontSize: 11,
    color: 'rgba(22, 101, 52, 0.75)',
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  addButton: {
    padding: 2,
  },
  addButtonInner: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#fff',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
  },
  expiredBanner: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 2,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
  },
  expiredText: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.red,
    textAlign: 'center',
  },
  listContainer: {
    flex: 1,
  },
  flatList: {
    flex: 1,
  },
  list: {
    paddingTop: 8,
    paddingBottom: 100,
  },
});

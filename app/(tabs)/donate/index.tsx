import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BgFoodDecor, HeaderFoodDecor } from '@/components/ui/food-decor';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';

const HUBBUB_URL = 'https://hubbub.org.uk/community-fridge-network';

// ── Types ──────────────────────────────────────────────────────────────────

interface CommunityFridge {
  id: string;
  name: string;
  lat: number;
  lon: number;
  distanceKm: number;
  address?: string;
  openingHours?: string;
  phone?: string;
  website?: string;
}

interface OverpassElement {
  id: number;
  type: string;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

// ── Utilities ──────────────────────────────────────────────────────────────

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

async function geocodePostcode(postcode: string): Promise<{ lat: number; lon: number }> {
  const clean = postcode.replace(/\s+/g, '');
  const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(clean)}`);
  const json = (await res.json()) as { status: number; result: { latitude: number; longitude: number } };
  if (json.status !== 200) throw new Error('Postcode not found. Please check and try again.');
  return { lat: json.result.latitude, lon: json.result.longitude };
}

async function overpassFetch(query: string): Promise<OverpassElement[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  let res: Response;
  try {
    res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: controller.signal,
    });
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('The search timed out. Please try again in a moment.');
    }
    throw new Error('Could not reach the search service. Check your connection and try again.');
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error('Search failed. Please try again.');
  const json = (await res.json()) as { elements: OverpassElement[] };
  return json.elements;
}

async function fetchNearbyFridges(lat: number, lon: number): Promise<CommunityFridge[]> {
  const radius = 25000; // 25 km — needed because OSM coverage is sparse

  // Broad tag set: food_sharing is the primary tag but rarely used in UK OSM.
  // food_bank, social_facility~food, and name-based regex catch the rest.
  // Name regex uses a smaller sub-radius so the full scan stays fast.
  const query = [
    '[out:json][timeout:30];',
    '(',
    `  nwr["amenity"="food_sharing"](around:${radius},${lat},${lon});`,
    `  nwr["amenity"="food_bank"](around:${radius},${lat},${lon});`,
    `  nwr["social_facility"~"food"](around:${radius},${lat},${lon});`,
    `  node[name~"community fridge",i](around:15000,${lat},${lon});`,
    `  node[name~"food shar",i](around:15000,${lat},${lon});`,
    `  node[name~"\\bfridge\\b",i](around:10000,${lat},${lon});`,
    ');',
    'out center;',
  ].join('');

  const elements = await overpassFetch(query);

  const seen = new Set<string>();
  const fridges: CommunityFridge[] = [];

  for (const el of elements) {
    const elLat = el.lat ?? el.center?.lat;
    const elLon = el.lon ?? el.center?.lon;
    if (!elLat || !elLon) continue;

    const tags = el.tags ?? {};
    const name = tags.name ?? tags['name:en'] ?? 'Community Fridge';

    // Deduplicate by rounded coords
    const key = `${elLat.toFixed(4)},${elLon.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const addrParts = [
      tags['addr:housenumber'],
      tags['addr:street'],
      tags['addr:city'] ?? tags['addr:town'],
      tags['addr:postcode'],
    ].filter(Boolean);

    fridges.push({
      id: String(el.id),
      name,
      lat: elLat,
      lon: elLon,
      distanceKm: haversineKm(lat, lon, elLat, elLon),
      address: addrParts.length > 0 ? addrParts.join(', ') : (tags['addr:full'] ?? undefined),
      openingHours: tags.opening_hours ?? undefined,
      phone: tags.phone ?? tags['contact:phone'] ?? undefined,
      website: tags.website ?? tags['contact:website'] ?? undefined,
    });
  }

  return fridges.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 3);
}

function openMapsDirections(lat: number, lon: number, name: string) {
  const label = encodeURIComponent(name);
  const url = Platform.OS === 'ios'
    ? `maps://?daddr=${lat},${lon}&dirflg=d`
    : `google.navigation:q=${lat},${lon}`;
  Linking.openURL(url).catch(() => {
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&destination_place_id=${label}`).catch(() => {});
  });
}

// ── Screen ─────────────────────────────────────────────────────────────────

const DONATE_YES = [
  { emoji: '🥦', text: 'Fresh fruit & vegetables' },
  { emoji: '🥫', text: 'Tinned & packaged foods in date' },
  { emoji: '🥛', text: 'Dairy products within date' },
  { emoji: '🍞', text: 'Bread & bakery items' },
  { emoji: '🧃', text: 'Juices & soft drinks (sealed)' },
  { emoji: '🌾', text: 'Dry goods — rice, pasta, lentils' },
];

const DONATE_NO = [
  { emoji: '🚫', text: 'Expired or mouldy food' },
  { emoji: '🚫', text: 'Opened or partially used items' },
  { emoji: '🚫', text: 'Homemade food (unlabelled)' },
  { emoji: '🚫', text: 'Raw meat or fish' },
];

export default function DonateScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const tabBarHeight = useBottomTabBarHeight();

  const [postcode, setPostcode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [fridges, setFridges] = useState<CommunityFridge[] | null>(null);
  const [searchedPostcode, setSearchedPostcode] = useState('');

  async function handleSearch() {
    const pc = postcode.trim();
    if (!pc) { setError('Please enter your postcode.'); return; }
    setError('');
    Keyboard.dismiss();
    setLoading(true);
    setFridges(null);
    try {
      const { lat, lon } = await geocodePostcode(pc);
      const results = await fetchNearbyFridges(lat, lon);
      setFridges(results);
      setSearchedPostcode(pc.toUpperCase());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <BgFoodDecor />

      <LinearGradient
        colors={['#6EE7B7', '#34D399', '#10B981']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}>
        <HeaderFoodDecor />
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>🫶  Donate Food</Text>
            <Text style={styles.headerSub}>Share surplus food with your community</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: tabBarHeight + 24 }]}>

        {/* Postcode search */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>🔍  Find nearby community fridges</Text>
          <Text style={[styles.cardBody, { color: colors.subtext }]}>
            Enter your postcode to see the 3 closest community fridges where you can drop off surplus food.
          </Text>

          <View style={styles.inputRow}>
            <TextInput
              style={[
                styles.postcodeInput,
                { color: colors.text, borderColor: error ? '#EF4444' : '#10B981', backgroundColor: colors.background },
              ]}
              placeholder="e.g. SW1A 1AA"
              placeholderTextColor={colors.subtext}
              value={postcode}
              onChangeText={(v) => { setPostcode(v); setError(''); }}
              autoCapitalize="characters"
              returnKeyType="search"
              onSubmitEditing={handleSearch}
              maxLength={8}
            />
            <TouchableOpacity
              style={[styles.searchBtn, loading && { opacity: 0.6 }]}
              onPress={handleSearch}
              disabled={loading}
              activeOpacity={0.85}>
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.searchBtnText}>Search</Text>
              }
            </TouchableOpacity>
          </View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>

        {/* Results */}
        {fridges !== null && (
          <View style={styles.resultsSection}>
            {fridges.length > 0 ? (
              <>
                <Text style={[styles.resultsHeading, { color: colors.text }]}>
                  {fridges.length} fridge{fridges.length !== 1 ? 's' : ''} near {searchedPostcode}
                </Text>
                {fridges.map((fridge, idx) => (
                  <View
                    key={fridge.id}
                    style={[styles.fridgeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    {/* Rank badge */}
                    <View style={styles.fridgeRankBadge}>
                      <Text style={styles.fridgeRankText}>{idx + 1}</Text>
                    </View>

                    <View style={styles.fridgeBody}>
                      <Text style={[styles.fridgeName, { color: colors.text }]} numberOfLines={2}>
                        {fridge.name}
                      </Text>
                      <View style={styles.distancePill}>
                        <Text style={styles.distanceText}>{fmtDistance(fridge.distanceKm)} away</Text>
                      </View>

                      {fridge.address && (
                        <View style={styles.fridgeMeta}>
                          <Text style={styles.fridgeMetaIcon}>📍</Text>
                          <Text style={[styles.fridgeMetaText, { color: colors.subtext }]} numberOfLines={2}>
                            {fridge.address}
                          </Text>
                        </View>
                      )}
                      {fridge.openingHours && (
                        <View style={styles.fridgeMeta}>
                          <Text style={styles.fridgeMetaIcon}>🕐</Text>
                          <Text style={[styles.fridgeMetaText, { color: colors.subtext }]} numberOfLines={2}>
                            {fridge.openingHours}
                          </Text>
                        </View>
                      )}
                      {fridge.phone && (
                        <View style={styles.fridgeMeta}>
                          <Text style={styles.fridgeMetaIcon}>📞</Text>
                          <TouchableOpacity onPress={() => Linking.openURL(`tel:${fridge.phone}`)}>
                            <Text style={[styles.fridgeMetaText, { color: '#10B981' }]}>{fridge.phone}</Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      <View style={styles.fridgeActions}>
                        <TouchableOpacity
                          style={styles.directionsBtn}
                          onPress={() => openMapsDirections(fridge.lat, fridge.lon, fridge.name)}
                          activeOpacity={0.85}>
                          <Text style={styles.directionsBtnText}>🗺  Get directions</Text>
                        </TouchableOpacity>
                        {fridge.website && (
                          <TouchableOpacity
                            style={styles.websiteBtn}
                            onPress={() => Linking.openURL(fridge.website!).catch(() => {})}
                            activeOpacity={0.85}>
                            <Text style={styles.websiteBtnText}>↗ Website</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </View>
                ))}
                <TouchableOpacity
                  style={styles.hubbubFallback}
                  onPress={() => Linking.openURL(HUBBUB_URL).catch(() => {})}>
                  <Text style={styles.hubbubFallbackText}>
                    See more on Hubbub ↗
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={[styles.noResultsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={styles.noResultsEmoji}>🔭</Text>
                <Text style={[styles.noResultsTitle, { color: colors.text }]}>
                  No fridges mapped near {searchedPostcode}
                </Text>
                <Text style={[styles.noResultsBody, { color: colors.subtext }]}>
                  Community fridges near you may not yet be on OpenStreetMap. Hubbub's full network of 700+ fridges is on their website — tap below to find the nearest one.
                </Text>
                <TouchableOpacity
                  style={styles.directionsBtn}
                  onPress={() => Linking.openURL(HUBBUB_URL).catch(() => {})}>
                  <Text style={styles.directionsBtnText}>🌍  Open Hubbub</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* What to donate */}
        <View style={[styles.card, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
          <Text style={[styles.cardTitle, { color: '#166534' }]}>✅  What to donate</Text>
          {DONATE_YES.map((item) => (
            <View key={item.text} style={styles.listRow}>
              <Text style={styles.listEmoji}>{item.emoji}</Text>
              <Text style={[styles.listText, { color: '#15803D' }]}>{item.text}</Text>
            </View>
          ))}
        </View>

        {/* What not to donate */}
        <View style={[styles.card, { backgroundColor: '#FFF5F5', borderColor: '#FECACA' }]}>
          <Text style={[styles.cardTitle, { color: '#991B1B' }]}>❌  Please don't donate</Text>
          {DONATE_NO.map((item) => (
            <View key={item.text} style={styles.listRow}>
              <Text style={styles.listEmoji}>{item.emoji}</Text>
              <Text style={[styles.listText, { color: '#DC2626' }]}>{item.text}</Text>
            </View>
          ))}
        </View>

        {/* Footer link */}
        <TouchableOpacity
          style={styles.footer}
          onPress={() => Linking.openURL(HUBBUB_URL).catch(() => {})}>
          <Text style={styles.footerText}>Powered by Hubbub Community Fridge Network ↗</Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerGradient: { paddingBottom: 16 },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 3, fontWeight: '500' },
  scroll: { paddingHorizontal: 16, paddingTop: 14, gap: 14 },

  card: { borderRadius: 18, borderWidth: 1, padding: 18, gap: 10 },
  cardTitle: { fontSize: 16, fontWeight: '800' },
  cardBody: { fontSize: 14, lineHeight: 21 },

  // Postcode input
  inputRow: { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  postcodeInput: {
    flex: 1, height: 52, borderWidth: 2, borderRadius: 14,
    paddingHorizontal: 16, fontSize: 18, fontWeight: '700',
    letterSpacing: 2, textTransform: 'uppercase',
  },
  searchBtn: {
    backgroundColor: '#10B981', borderRadius: 14,
    paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center',
    minWidth: 80,
  },
  searchBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  errorText: { fontSize: 13, color: '#EF4444' },

  // Results
  resultsSection: { gap: 10 },
  resultsHeading: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  fridgeCard: {
    borderRadius: 16, borderWidth: 1,
    padding: 14, flexDirection: 'row', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  fridgeRankBadge: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#10B981',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, marginTop: 2,
  },
  fridgeRankText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  fridgeBody: { flex: 1, gap: 6 },
  fridgeName: { fontSize: 15, fontWeight: '700', lineHeight: 20 },
  distancePill: {
    alignSelf: 'flex-start',
    backgroundColor: '#D1FAE5', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  distanceText: { fontSize: 12, fontWeight: '700', color: '#065F46' },
  fridgeMeta: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  fridgeMetaIcon: { fontSize: 13, marginTop: 1 },
  fridgeMetaText: { fontSize: 13, lineHeight: 18, flex: 1 },
  fridgeActions: { flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  directionsBtn: {
    backgroundColor: '#10B981', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 9,
    alignSelf: 'flex-start',
  },
  directionsBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  websiteBtn: {
    borderWidth: 1.5, borderColor: '#10B981', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 9,
    alignSelf: 'flex-start',
  },
  websiteBtnText: { color: '#10B981', fontSize: 13, fontWeight: '700' },
  hubbubFallback: { alignSelf: 'center', paddingVertical: 4 },
  hubbubFallbackText: { fontSize: 13, fontWeight: '600', color: '#10B981' },

  // No results
  noResultsCard: {
    borderRadius: 16, borderWidth: 1, padding: 20,
    alignItems: 'center', gap: 10,
  },
  noResultsEmoji: { fontSize: 40 },
  noResultsTitle: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
  noResultsBody: { fontSize: 13, lineHeight: 20, textAlign: 'center' },

  // Donate lists
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  listEmoji: { fontSize: 18, width: 26 },
  listText: { fontSize: 14, fontWeight: '500', flexShrink: 1 },

  footer: { alignSelf: 'center', paddingVertical: 4 },
  footerText: { fontSize: 12, color: '#10B981', fontWeight: '600' },
});

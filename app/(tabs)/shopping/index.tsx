import {
  Alert, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import SiriShortcuts from '@freshahead/siri-shortcuts';
import { BgFoodDecor, HeaderFoodDecor } from '@/components/ui/food-decor';
import { Brand, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { computeScore, scoreColor } from '@/utils/food-score';
import {
  getShoppingLists, saveShoppingLists, getFavorites, saveFavorites,
  toggleFavorite, migrateStarredOnDelete,
  type ShoppingList, type ShoppingItem, type FavoriteItem,
} from '@/utils/shopping-store';

const NUTRI_COLOR: Record<string, string> = {
  a: '#1EA54C', b: '#85BB2F', c: '#F5C900', d: '#EF8714', e: '#E63E11',
};

// ── Helpers ────────────────────────────────────────────────────────────────

function uid() { return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

// ── Sub-components ─────────────────────────────────────────────────────────

function NutriBadge({ grade }: { grade: string }) {
  return (
    <View style={[badge.pill, { backgroundColor: NUTRI_COLOR[grade] ?? '#9CA3AF' }]}>
      <Text style={badge.letter}>{grade.toUpperCase()}</Text>
    </View>
  );
}

const badge = StyleSheet.create({
  pill: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  letter: { color: '#fff', fontSize: 10, fontWeight: '900' },
});

// ── Main screen ────────────────────────────────────────────────────────────

export default function ShoppingScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const tabBarHeight = useBottomTabBarHeight();
  const { name: siriName, from } = useLocalSearchParams<{ name?: string; from?: string }>();

  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [favsCollapsed, setFavsCollapsed] = useState(false);

  // New list creation
  const [newListMode, setNewListMode] = useState(false);
  const [newListName, setNewListName] = useState('');
  const newListRef = useRef<TextInput>(null);

  // Per-list add input
  const [addingToListId, setAddingToListId] = useState<string | null>(null);
  const [addInput, setAddInput] = useState('');
  const addInputRef = useRef<TextInput>(null);

  // Inline item editing
  const [editingItem, setEditingItem] = useState<{ listId: string; itemId: string } | null>(null);
  const [editingItemName, setEditingItemName] = useState('');
  const suppressBlur = useRef(false);

  // Inline list name editing
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editingListName, setEditingListName] = useState('');
  const listNameRef = useRef<TextInput>(null);

  useFocusEffect(
    useCallback(() => {
      getShoppingLists().then(setLists).catch(() => {});
      getFavorites().then(setFavorites).catch(() => {});
    }, [])
  );

  // ── Siri deep link: open from "Add to shopping list" shortcut ────────────
  useEffect(() => {
    if (from !== 'siri' || !siriName) return;
    // Wait for lists to load, then activate the add-input on the first list
    // with the item name pre-filled so the user just taps Add.
    const timer = setTimeout(() => {
      setLists((current) => {
        if (current.length === 0) return current;
        setAddInput(siriName);
        setAddingToListId(current[0].id);
        setTimeout(() => addInputRef.current?.focus(), 100);
        return current;
      });
    }, 300);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, siriName]);

  // ── Persist helpers ──────────────────────────────────────────────────────

  async function persistLists(next: ShoppingList[]) {
    setLists(next);
    await saveShoppingLists(next);
  }

  async function persistFavs(next: FavoriteItem[]) {
    setFavorites(next);
    await saveFavorites(next);
  }

  // ── List-level actions ───────────────────────────────────────────────────

  function createList() {
    const name = newListName.trim();
    if (!name) { setNewListMode(false); return; }
    const newList: ShoppingList = {
      id: uid(), name, collapsed: false, items: [], createdAt: new Date().toISOString(),
    };
    persistLists([...lists, newList]);
    setNewListName('');
    setNewListMode(false);
  }

  function toggleCollapse(listId: string) {
    persistLists(lists.map((l) => l.id === listId ? { ...l, collapsed: !l.collapsed } : l));
  }

  function startRenameList(list: ShoppingList) {
    setEditingListId(list.id);
    setEditingListName(list.name);
    setTimeout(() => listNameRef.current?.focus(), 50);
  }

  function commitRenameList() {
    const name = editingListName.trim();
    if (name) persistLists(lists.map((l) => l.id === editingListId ? { ...l, name } : l));
    setEditingListId(null);
  }

  function deleteList(list: ShoppingList) {
    Alert.alert(
      `Delete "${list.name}"?`,
      list.items.some((i) => i.isFavorite)
        ? 'Starred items will be kept in your Favourites.'
        : 'All items in this list will be removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            await migrateStarredOnDelete(list);
            const next = lists.filter((l) => l.id !== list.id);
            await persistLists(next);
            getFavorites().then(setFavorites).catch(() => {});
          },
        },
      ]
    );
  }

  // ── Item-level actions ───────────────────────────────────────────────────

  function updateList(listId: string, updater: (items: ShoppingItem[]) => ShoppingItem[]) {
    persistLists(lists.map((l) => l.id === listId ? { ...l, items: updater(l.items) } : l));
  }

  function addItemToList(listId: string) {
    const name = addInput.trim();
    if (!name) { setAddingToListId(null); return; }
    const newItem: ShoppingItem = {
      id: uid(), name, checked: false, fromPantry: false,
    };
    updateList(listId, (items) => [...items, newItem]);
    setAddInput('');
    SiriShortcuts.donateShortcut('shopping', name).catch(() => {});
  }

  function toggleItem(listId: string, itemId: string) {
    updateList(listId, (items) =>
      items.map((i) => i.id === itemId ? { ...i, checked: !i.checked } : i)
    );
  }

  function startEditItem(listId: string, item: ShoppingItem) {
    suppressBlur.current = false;
    setEditingItem({ listId, itemId: item.id });
    setEditingItemName(item.name);
  }

  function commitEditItem() {
    suppressBlur.current = false;
    const name = editingItemName.trim();
    if (name && editingItem) {
      updateList(editingItem.listId, (items) =>
        items.map((i) => i.id === editingItem.itemId ? { ...i, name } : i)
      );
    }
    setEditingItem(null);
  }

  function cancelEditItem() {
    suppressBlur.current = false;
    setEditingItem(null);
  }

  function removeItem(listId: string, item: ShoppingItem) {
    Alert.alert('Remove item?', `Remove "${item.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: () => updateList(listId, (items) => items.filter((i) => i.id !== item.id)),
      },
    ]);
  }

  async function starItem(listId: string, item: ShoppingItem) {
    const { favs, nowFavorite } = await toggleFavorite(item);
    setFavorites(favs);
    updateList(listId, (items) =>
      items.map((i) => i.id === item.id ? { ...i, isFavorite: nowFavorite } : i)
    );
  }

  function clearChecked(listId: string) {
    Alert.alert('Clear checked items?', '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => updateList(listId, (items) => items.filter((i) => !i.checked)) },
    ]);
  }

  // ── Favourites actions ───────────────────────────────────────────────────

  function removeFavorite(fav: FavoriteItem) {
    Alert.alert(
      'Remove from Favourites?',
      `"${fav.name}" will be removed from your Favourites.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: () => {
            persistFavs(favorites.filter((f) => f.id !== fav.id));
            persistLists(lists.map((l) => ({
              ...l,
              items: l.items.map((i) => i.id === fav.id ? { ...i, isFavorite: false } : i),
            })));
          },
        },
      ]
    );
  }

  function addFavoriteToList(fav: FavoriteItem) {
    if (lists.length === 0) {
      Alert.alert('No lists', 'Create a shopping list first using "New List".');
      return;
    }
    function doAdd(listId: string) {
      const newItem: ShoppingItem = {
        id: uid(),
        name: fav.name,
        quantity: fav.quantity,
        checked: false,
        fromPantry: false,
        isFavorite: true,
        nutriScore: fav.nutriScore,
        novaGroup: fav.novaGroup,
        barcode: fav.barcode,
      };
      persistLists(lists.map((l) => {
        if (l.id !== listId) return l;
        if (l.items.some((i) => i.name.toLowerCase() === fav.name.toLowerCase() && !i.checked)) return l;
        return { ...l, collapsed: false, items: [...l.items, newItem] };
      }));
    }
    Alert.alert(
      `Add "${fav.name}" to…`,
      undefined,
      [
        ...lists.map((l) => ({ text: l.name, onPress: () => doAdd(l.id) })),
        { text: 'Cancel', style: 'cancel' as const },
      ]
    );
  }

  // ── Renderers ────────────────────────────────────────────────────────────

  function renderItem(list: ShoppingList, item: ShoppingItem) {
    const isEditing = editingItem?.listId === list.id && editingItem?.itemId === item.id;

    return (
      <View key={item.id} style={[row.container, { backgroundColor: colors.card }]}>
        <TouchableOpacity onPress={() => toggleItem(list.id, item.id)} style={row.checkbox}>
          <View style={[row.checkboxInner, { borderColor: item.checked ? Brand.green : colors.border }]}>
            {item.checked && <View style={row.checkboxFill} />}
          </View>
        </TouchableOpacity>

        <View style={row.nameBlock}>
          {isEditing ? (
            <TextInput
              style={[row.editInput, { color: colors.text, borderColor: Brand.green }]}
              value={editingItemName}
              onChangeText={setEditingItemName}
              onSubmitEditing={commitEditItem}
              onBlur={() => { if (!suppressBlur.current) cancelEditItem(); }}
              returnKeyType="done"
              autoFocus
            />
          ) : (
            <>
              <View style={row.nameRow}>
                <Text
                  style={[row.name, { color: item.checked ? colors.subtext : colors.text }, item.checked && row.strikethrough]}
                  numberOfLines={1}>
                  {item.name}
                </Text>
                {(() => {
                  if (item.checked || !item.nutriScore) return null;
                  const score = computeScore(item.nutriScore, item.novaGroup, undefined);
                  return (
                    <View style={row.scoreChip}>
                      <NutriBadge grade={item.nutriScore} />
                      {score !== undefined && (
                        <Text style={[row.scoreNum, { color: scoreColor(score) }]}>{score}</Text>
                      )}
                    </View>
                  );
                })()}
              </View>
              {item.quantity && !item.checked && (
                <Text style={[row.qty, { color: colors.subtext }]}>{item.quantity}</Text>
              )}
              {item.fromPantry && !item.checked && (
                <View style={row.restockBadge}>
                  <Text style={row.restockText}>Restock</Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* Star / favourite */}
        {!isEditing && !item.checked && (
          <TouchableOpacity
            onPress={() => starItem(list.id, item)}
            style={row.actionBtn}
            hitSlop={6}>
            <Text style={[row.star, { color: item.isFavorite ? '#F59E0B' : colors.border }]}>
              {item.isFavorite ? '★' : '☆'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Edit / confirm */}
        {!item.checked && (
          <TouchableOpacity
            onPressIn={() => { if (isEditing) suppressBlur.current = true; }}
            onPress={isEditing ? commitEditItem : () => startEditItem(list.id, item)}
            style={row.actionBtn}
            hitSlop={6}>
            <IconSymbol
              name={isEditing ? 'checkmark.circle.fill' : 'pencil'}
              size={16}
              color={isEditing ? Brand.green : colors.subtext}
            />
          </TouchableOpacity>
        )}

        {/* Delete / cancel */}
        <TouchableOpacity
          onPressIn={() => { if (isEditing) suppressBlur.current = true; }}
          onPress={() => isEditing ? cancelEditItem() : removeItem(list.id, item)}
          style={row.actionBtn}
          hitSlop={6}>
          <IconSymbol name="xmark" size={16} color={colors.subtext} />
        </TouchableOpacity>
      </View>
    );
  }

  function renderListSection(list: ShoppingList) {
    const isRenamingThis = editingListId === list.id;
    const hasChecked = list.items.some((i) => i.checked);
    const hasItems = list.items.length > 0;
    const isAddingHere = addingToListId === list.id;

    function handleClear() {
      const buttons: Parameters<typeof Alert.alert>[2] = [];
      if (hasChecked) {
        buttons.push({ text: 'Clear checked', onPress: () => updateList(list.id, (items) => items.filter((i) => !i.checked)) });
      }
      buttons.push({ text: 'Clear all items', style: 'destructive', onPress: () => updateList(list.id, () => []) });
      buttons.push({ text: 'Cancel', style: 'cancel' });
      Alert.alert(`Clear "${list.name}"?`, undefined, buttons);
    }

    return (
      <View key={list.id} style={section.wrapper}>
        {/* List header */}
        <View style={[section.header, { borderColor: colors.border }]}>
          {/* Collapse / expand toggle */}
          <TouchableOpacity onPress={() => toggleCollapse(list.id)} style={section.collapseBtn} hitSlop={8}>
            <Text style={[section.collapseIcon, { color: Brand.green }]}>
              {list.collapsed ? '+' : '−'}
            </Text>
          </TouchableOpacity>

          {/* List name */}
          {isRenamingThis ? (
            <TextInput
              ref={listNameRef}
              style={[section.nameInput, { color: colors.text, borderColor: Brand.green }]}
              value={editingListName}
              onChangeText={setEditingListName}
              onSubmitEditing={commitRenameList}
              onBlur={commitRenameList}
              returnKeyType="done"
            />
          ) : (
            <View style={section.nameWrap}>
              <Text style={[section.name, { color: colors.text }]} numberOfLines={1}>{list.name}</Text>
              <Text style={[section.count, { color: colors.subtext }]}>
                {list.items.filter((i) => !i.checked).length}
              </Text>
            </View>
          )}

          {/* Rename */}
          {!isRenamingThis && (
            <TouchableOpacity onPress={() => startRenameList(list)} style={section.iconBtn} hitSlop={8}>
              <IconSymbol name="pencil" size={15} color={colors.subtext} />
            </TouchableOpacity>
          )}

          {/* Clear */}
          {hasItems && !isRenamingThis && (
            <TouchableOpacity onPress={handleClear} style={section.iconBtn} hitSlop={8}>
              <Text style={[section.clearBtn, { color: colors.subtext }]}>Clear</Text>
            </TouchableOpacity>
          )}

          {/* Delete list */}
          <TouchableOpacity onPress={() => deleteList(list)} style={section.iconBtn} hitSlop={8}>
            <IconSymbol name="trash" size={15} color="#EF4444" />
          </TouchableOpacity>
        </View>

        {/* Items + add input (only when expanded) */}
        {!list.collapsed && (
          <View style={section.body}>
            {list.items.map((item) => renderItem(list, item))}

            {/* Inline add input */}
            {isAddingHere ? (
              <View style={[addRow.container, { backgroundColor: colors.card }]}>
                <TextInput
                  ref={addInputRef}
                  style={[addRow.input, { color: colors.text }]}
                  placeholder="Item name…"
                  placeholderTextColor={colors.subtext}
                  value={addInput}
                  onChangeText={setAddInput}
                  onSubmitEditing={() => addItemToList(list.id)}
                  onBlur={() => { if (!addInput.trim()) setAddingToListId(null); }}
                  returnKeyType="done"
                  autoFocus
                />
                <TouchableOpacity
                  onPress={() => addItemToList(list.id)}
                  style={addRow.btn}
                  hitSlop={8}>
                  <IconSymbol name="plus.circle.fill" size={20} color={Brand.green} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { setAddInput(''); setAddingToListId(null); }}
                  style={addRow.btn}
                  hitSlop={8}>
                  <IconSymbol name="xmark" size={16} color={colors.subtext} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[addRow.trigger, { borderColor: colors.border }]}
                onPress={() => {
                  setAddInput('');
                  setAddingToListId(list.id);
                  setTimeout(() => addInputRef.current?.focus(), 50);
                }}
                activeOpacity={0.6}>
                <IconSymbol name="plus" size={14} color={colors.subtext} />
                <Text style={[addRow.triggerText, { color: colors.subtext }]}>Add item</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  }

  function renderFavourites() {
    if (favorites.length === 0) return null;
    return (
      <View style={section.wrapper}>
        <View style={[section.header, { borderColor: '#FDE68A' }]}>
          <TouchableOpacity onPress={() => setFavsCollapsed((v) => !v)} style={section.collapseBtn} hitSlop={8}>
            <Text style={[section.collapseIcon, { color: '#D97706' }]}>
              {favsCollapsed ? '+' : '−'}
            </Text>
          </TouchableOpacity>
          <View style={section.nameWrap}>
            <Text style={[section.name, { color: '#92400E' }]}>⭐ Favourites</Text>
            <Text style={[section.count, { color: '#D97706' }]}>{favorites.length}</Text>
          </View>
        </View>

        {!favsCollapsed && (
          <View style={section.body}>
            {favorites.map((fav) => (
              <View key={fav.id} style={[row.container, { backgroundColor: '#FFFBEB', borderWidth: StyleSheet.hairlineWidth, borderColor: '#FDE68A' }]}>
                <View style={row.nameBlock}>
                  <View style={row.nameRow}>
                    <Text style={[row.name, { color: '#78350F' }]} numberOfLines={1}>{fav.name}</Text>
                    {(() => {
                      if (!fav.nutriScore) return null;
                      const score = computeScore(fav.nutriScore, fav.novaGroup, undefined);
                      return (
                        <View style={row.scoreChip}>
                          <NutriBadge grade={fav.nutriScore} />
                          {score !== undefined && (
                            <Text style={[row.scoreNum, { color: scoreColor(score) }]}>{score}</Text>
                          )}
                        </View>
                      );
                    })()}
                  </View>
                  {fav.quantity && <Text style={[row.qty, { color: '#92400E' }]}>{fav.quantity}</Text>}
                </View>
                <TouchableOpacity onPress={() => addFavoriteToList(fav)} style={row.actionBtn} hitSlop={8}>
                  <IconSymbol name="plus.circle.fill" size={20} color="#16A34A" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => removeFavorite(fav)} style={row.actionBtn} hitSlop={8}>
                  <Text style={[row.star, { color: '#F59E0B' }]}>★</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  }

  const totalPantryItems = lists.reduce(
    (sum, l) => sum + l.items.filter((i) => i.fromPantry && !i.checked).length, 0
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? tabBarHeight : 0}>
      <BgFoodDecor />

      <LinearGradient
        colors={['#8BD1A5', '#91E2AF', '#A5EFC0']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}>
        <HeaderFoodDecor />
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>🛒  Shopping Lists</Text>
              {totalPantryItems > 0 && (
                <Text style={styles.autoAddedNote}>
                  {totalPantryItems} item{totalPantryItems !== 1 ? 's' : ''} to restock
                </Text>
              )}
            </View>
            <TouchableOpacity
              style={styles.newListBtn}
              onPress={() => {
                setNewListMode(true);
                setNewListName('');
                setTimeout(() => newListRef.current?.focus(), 50);
              }}>
              <IconSymbol name="plus" size={14} color="#fff" />
              <Text style={styles.newListBtnText}>New List</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scroll, { paddingBottom: tabBarHeight + 20 }]}
        showsVerticalScrollIndicator={false}>

        {renderFavourites()}

        {lists.map((list) => renderListSection(list))}

        {/* New list creation input */}
        {newListMode && (
          <View style={[newList.container, { backgroundColor: colors.card, borderColor: Brand.green }]}>
            <TextInput
              ref={newListRef}
              style={[newList.input, { color: colors.text }]}
              placeholder="List name…"
              placeholderTextColor={colors.subtext}
              value={newListName}
              onChangeText={setNewListName}
              onSubmitEditing={createList}
              onBlur={() => { if (!newListName.trim()) setNewListMode(false); }}
              returnKeyType="done"
              autoFocus
            />
            <TouchableOpacity onPress={createList} style={newList.btn} hitSlop={8}>
              <IconSymbol name="checkmark.circle.fill" size={22} color={Brand.green} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setNewListMode(false)} style={newList.btn} hitSlop={8}>
              <IconSymbol name="xmark" size={18} color={colors.subtext} />
            </TouchableOpacity>
          </View>
        )}

        {lists.length === 0 && favorites.length === 0 && (
          <Text style={[styles.empty, { color: colors.subtext }]}>
            No shopping lists yet.{'\n'}Tap "New List" to create one.
          </Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerGradient: { paddingBottom: 12 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  title: { fontSize: 28, fontWeight: '800', color: '#166534' },
  autoAddedNote: { color: 'rgba(22,101,52,0.75)', fontSize: 12, fontWeight: '500', marginTop: 2 },
  newListBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#16A34A', paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 20,
  },
  newListBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  scroll: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  empty: { textAlign: 'center', marginTop: 60, fontSize: 15, lineHeight: 24 },
});

const section = StyleSheet.create({
  wrapper: { gap: 6 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  collapseBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  collapseIcon: { fontSize: 20, fontWeight: '700', lineHeight: 24 },
  nameWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  count: { fontSize: 12, fontWeight: '600' },
  nameInput: {
    flex: 1, fontSize: 16, fontWeight: '700',
    borderBottomWidth: 1.5, paddingVertical: 2,
  },
  clearBtn: { fontSize: 12, fontWeight: '600' },
  iconBtn: { padding: 4 },
  body: { gap: 6, paddingLeft: 4 },
});

const row = StyleSheet.create({
  container: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 11,
    borderRadius: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  checkbox: { marginRight: 10 },
  checkboxInner: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkboxFill: { width: 12, height: 12, borderRadius: 6, backgroundColor: Brand.green },
  nameBlock: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  name: { fontSize: 15, flexShrink: 1 },
  strikethrough: { textDecorationLine: 'line-through' },
  qty: { fontSize: 12 },
  restockBadge: { alignSelf: 'flex-start', backgroundColor: '#F0FDF4', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 1 },
  restockText: { fontSize: 11, fontWeight: '600', color: Brand.green },
  star: { fontSize: 18 },
  actionBtn: { padding: 6 },
  editInput: { fontSize: 15, borderBottomWidth: 1.5, paddingVertical: 2 },
  scoreChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  scoreNum: { fontSize: 12, fontWeight: '800' },
});

const addRow = StyleSheet.create({
  trigger: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderStyle: 'dashed',
  },
  triggerText: { fontSize: 14 },
  container: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  input: { flex: 1, fontSize: 15, paddingVertical: 4 },
  btn: { padding: 6 },
});

const newList = StyleSheet.create({
  container: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 14, borderWidth: 1.5,
  },
  input: { flex: 1, fontSize: 16, fontWeight: '600', paddingVertical: 4 },
  btn: { padding: 6 },
});

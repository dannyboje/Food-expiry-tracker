import { useCallback, useRef, useState } from 'react';
import {
  Alert, FlatList, KeyboardAvoidingView, Platform,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { BgFoodDecor, HeaderFoodDecor } from '@/components/ui/food-decor';
import { Brand, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import {
  getShoppingList, saveShoppingList,
  type ShoppingItem,
} from '@/utils/shopping-store';

export default function ShoppingScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [input, setInput] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const editRef = useRef<TextInput>(null);
  const flatListRef = useRef<FlatList<ShoppingItem>>(null);
  // Set to true in onPressIn so onBlur doesn't cancel before onPress fires
  const suppressBlurRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      getShoppingList().then(setItems).catch(() => {});
    }, [])
  );

  const persist = useCallback(async (next: ShoppingItem[]) => {
    setItems(next);
    await saveShoppingList(next);
  }, []);

  function addItem() {
    const name = input.trim();
    if (!name) return;
    persist([
      ...items,
      { id: Date.now().toString(), name, checked: false, fromPantry: false },
    ]);
    setInput('');
  }

  function toggleItem(id: string) {
    persist(items.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)));
  }

  function startEdit(item: ShoppingItem) {
    suppressBlurRef.current = false;
    setEditingId(item.id);
    setEditingName(item.name);
    setTimeout(() => editRef.current?.focus(), 50);
    const index = items.findIndex((i) => i.id === item.id);
    if (index !== -1) {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0, viewOffset: 16 });
      }, 350);
    }
  }

  function commitEdit() {
    suppressBlurRef.current = false;
    const name = editingName.trim();
    if (!name) {
      setEditingId(null);
      return;
    }
    persist(items.map((i) => (i.id === editingId ? { ...i, name } : i)));
    setEditingId(null);
  }

  function cancelEdit() {
    suppressBlurRef.current = false;
    setEditingId(null);
  }

  function removeItem(id: string) {
    const item = items.find((i) => i.id === id);
    Alert.alert('Remove item?', `Remove "${item?.name}" from your list?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => persist(items.filter((i) => i.id !== id)) },
    ]);
  }

  function clearChecked() {
    Alert.alert('Clear checked items?', '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => persist(items.filter((i) => !i.checked)) },
    ]);
  }

  function clearAll() {
    Alert.alert('Clear shopping list?', 'This will remove all items.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear all', style: 'destructive', onPress: () => persist([]) },
    ]);
  }

  const pantryCount = items.filter((i) => i.fromPantry && !i.checked).length;
  const tabBarHeight = useBottomTabBarHeight();

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? tabBarHeight : 0}
    >
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
              <Text style={styles.title}>🛒  Shopping List</Text>
              {pantryCount > 0 && (
                <Text style={styles.autoAddedNote}>
                  {pantryCount} expired item{pantryCount !== 1 ? 's' : ''} auto-added
                </Text>
              )}
            </View>
            <View style={styles.headerActions}>
              {items.some((i) => i.checked) && (
                <TouchableOpacity onPress={clearChecked}>
                  <Text style={styles.clearBtn}>Clear checked</Text>
                </TouchableOpacity>
              )}
              {items.length > 0 && (
                <TouchableOpacity onPress={clearAll}>
                  <Text style={styles.clearBtn}>Clear all</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, { color: '#111827' }]}
              placeholder="Add item…"
              placeholderTextColor="#9CA3AF"
              value={input}
              onChangeText={setInput}
              onSubmitEditing={addItem}
              returnKeyType="done"
            />
            <TouchableOpacity onPress={addItem} style={styles.addBtn}>
              <IconSymbol name="plus.circle.fill" size={20} color={Brand.green} />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <FlatList
        ref={flatListRef}
        data={items}
        keyExtractor={(i) => i.id}
        keyboardShouldPersistTaps="handled"
        onScrollToIndexFailed={() => {}}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.subtext }]}>
            Your shopping list is empty.
          </Text>
        }
        renderItem={({ item }) => {
          const isEditing = editingId === item.id;
          return (
            <View style={[styles.row, { backgroundColor: colors.card }]}>
              {/* Checkbox */}
              <TouchableOpacity onPress={() => toggleItem(item.id)} style={styles.checkbox}>
                <View style={[styles.checkboxInner, { borderColor: item.checked ? Brand.green : colors.border }]}>
                  {item.checked && <View style={styles.checkboxFill} />}
                </View>
              </TouchableOpacity>

              {/* Name / edit field */}
              <View style={styles.nameBlock}>
                {isEditing ? (
                  <TextInput
                    ref={editRef}
                    style={[styles.editInput, { color: colors.text, borderColor: Brand.green }]}
                    value={editingName}
                    onChangeText={setEditingName}
                    onSubmitEditing={commitEdit}
                    onBlur={() => { if (!suppressBlurRef.current) cancelEdit(); }}
                    returnKeyType="done"
                    autoFocus
                  />
                ) : (
                  <>
                    <Text
                      style={[
                        styles.itemName,
                        { color: item.checked ? colors.subtext : colors.text },
                        item.checked && styles.strikethrough,
                      ]}>
                      {item.name}
                    </Text>
                    {item.quantity && !item.checked && (
                      <Text style={[styles.qty, { color: colors.subtext }]}>{item.quantity}</Text>
                    )}
                    {item.fromPantry && !item.checked && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>Restock</Text>
                      </View>
                    )}
                  </>
                )}
              </View>

              {/* Edit / confirm button */}
              {!item.checked && (
                <TouchableOpacity
                  onPressIn={() => { if (isEditing) suppressBlurRef.current = true; }}
                  onPress={isEditing ? commitEdit : () => startEdit(item)}
                  style={styles.actionBtn}
                  hitSlop={6}>
                  <IconSymbol
                    name={isEditing ? 'checkmark.circle.fill' : 'pencil'}
                    size={16}
                    color={isEditing ? Brand.green : colors.subtext}
                  />
                </TouchableOpacity>
              )}

              {/* Delete / cancel-edit button */}
              <TouchableOpacity
                onPressIn={() => { if (isEditing) suppressBlurRef.current = true; }}
                onPress={() => isEditing ? cancelEdit() : removeItem(item.id)}
                style={styles.actionBtn}
                hitSlop={6}>
                <IconSymbol name="xmark" size={16} color={colors.subtext} />
              </TouchableOpacity>
            </View>
          );
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerGradient: { paddingBottom: 12 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#166534',
  },
  autoAddedNote: {
    color: 'rgba(22, 101, 52, 0.75)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  headerActions: { alignItems: 'flex-end', gap: 4 },
  clearBtn: { color: 'rgba(22, 101, 52, 0.85)', fontSize: 14, fontWeight: '600' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 4,
    borderRadius: 12,
    backgroundColor: '#fff',
    paddingLeft: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  input: { flex: 1, height: 46, fontSize: 15 },
  addBtn: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 100, gap: 8 },
  empty: { textAlign: 'center', marginTop: 60, fontSize: 15 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  checkbox: { marginRight: 12 },
  checkboxInner: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkboxFill: { width: 12, height: 12, borderRadius: 6, backgroundColor: Brand.green },
  nameBlock: { flex: 1, gap: 3 },
  itemName: { fontSize: 15 },
  strikethrough: { textDecorationLine: 'line-through' },
  qty: { fontSize: 12 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F0FDF4',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 11, fontWeight: '600', color: Brand.green },
  editInput: {
    fontSize: 15,
    borderBottomWidth: 1.5,
    paddingVertical: 2,
    paddingHorizontal: 0,
  },
  actionBtn: { padding: 8 },
});

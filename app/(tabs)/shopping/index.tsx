import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, FlatList, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
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

  useEffect(() => {
    getShoppingList()
      .then(setItems)
      .catch(() => {});
  }, []);

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
    setEditingId(item.id);
    setEditingName(item.name);
    setTimeout(() => editRef.current?.focus(), 50);
  }

  function commitEdit() {
    const name = editingName.trim();
    if (!name) {
      setEditingId(null);
      return;
    }
    persist(items.map((i) => (i.id === editingId ? { ...i, name } : i)));
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

  const pantryCount = items.filter((i) => i.fromPantry && !i.checked).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <BgFoodDecor />
      <LinearGradient
        colors={['#16A34A', '#22C55E', '#4ADE80']}
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
            {items.some((i) => i.checked) && (
              <TouchableOpacity onPress={clearChecked}>
                <Text style={styles.clearBtn}>Clear checked</Text>
              </TouchableOpacity>
            )}
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
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.subtext }]}>
            Your shopping list is empty.
          </Text>
        }
        renderItem={({ item }) => {
          const isEditing = editingId === item.id;
          return (
            <View style={[styles.row, { borderBottomColor: colors.border }]}>
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
                    onBlur={commitEdit}
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

              {/* Delete button */}
              <TouchableOpacity onPress={() => removeItem(item.id)} style={styles.actionBtn} hitSlop={6}>
                <IconSymbol name="xmark" size={16} color={colors.subtext} />
              </TouchableOpacity>
            </View>
          );
        }}
      />
    </View>
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
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.12)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  autoAddedNote: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  clearBtn: { color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '600', marginTop: 8 },
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
  list: { paddingBottom: 100 },
  empty: { textAlign: 'center', marginTop: 60, fontSize: 15 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
    backgroundColor: '#FEF2F2',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 11, fontWeight: '600', color: Brand.red },
  editInput: {
    fontSize: 15,
    borderBottomWidth: 1.5,
    paddingVertical: 2,
    paddingHorizontal: 0,
  },
  actionBtn: { padding: 8 },
});

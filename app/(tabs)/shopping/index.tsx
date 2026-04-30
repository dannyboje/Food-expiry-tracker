import { useEffect, useState } from 'react';
import {
  Alert, FlatList, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import KVStore from 'expo-sqlite/kv-store';
import { Brand, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';

interface ShoppingItem {
  id: string;
  name: string;
  checked: boolean;
}

const STORAGE_KEY = '@shopping_list';

export default function ShoppingScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [input, setInput] = useState('');

  useEffect(() => {
    KVStore.getItem(STORAGE_KEY)
      .then((val: string | null) => { if (val) setItems(JSON.parse(val)); })
      .catch(() => {});
  }, []);

  async function persist(next: ShoppingItem[]) {
    setItems(next);
    await KVStore.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function addItem() {
    const name = input.trim();
    if (!name) return;
    persist([...items, { id: Date.now().toString(), name, checked: false }]);
    setInput('');
  }

  function toggleItem(id: string) {
    persist(items.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)));
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>🛒  Shopping</Text>
        {items.some((i) => i.checked) && (
          <TouchableOpacity onPress={clearChecked}>
            <Text style={{ color: Brand.red, fontSize: 14, fontWeight: '600' }}>Clear checked</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <TextInput
          style={[styles.input, { color: colors.text }]}
          placeholder="Add item…"
          placeholderTextColor={colors.subtext}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={addItem}
          returnKeyType="done"
        />
        <TouchableOpacity onPress={addItem} style={[styles.addBtn, { backgroundColor: Brand.green }]}>
          <IconSymbol name="plus.circle.fill" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.subtext }]}>
            Your shopping list is empty.
          </Text>
        }
        renderItem={({ item }) => (
          <View style={[styles.row, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => toggleItem(item.id)} style={styles.checkbox}>
              <View style={[styles.checkboxInner, { borderColor: item.checked ? Brand.green : colors.border }]}>
                {item.checked && <View style={styles.checkboxFill} />}
              </View>
            </TouchableOpacity>
            <Text style={[styles.itemName, { color: item.checked ? colors.subtext : colors.text }, item.checked && styles.strikethrough]}>
              {item.name}
            </Text>
            <TouchableOpacity onPress={() => removeItem(item.id)} style={styles.deleteBtn}>
              <IconSymbol name="xmark" size={16} color={colors.subtext} />
            </TouchableOpacity>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 32, fontWeight: '800' },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 8, borderRadius: 12, borderWidth: 1, paddingLeft: 14, overflow: 'hidden' },
  input: { flex: 1, height: 46, fontSize: 15 },
  addBtn: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  list: { paddingBottom: 100 },
  empty: { textAlign: 'center', marginTop: 60, fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  checkbox: { marginRight: 12 },
  checkboxInner: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkboxFill: { width: 12, height: 12, borderRadius: 6, backgroundColor: Brand.green },
  itemName: { flex: 1, fontSize: 15 },
  strikethrough: { textDecorationLine: 'line-through' },
  deleteBtn: { padding: 8 },
});

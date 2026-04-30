import React, { createContext, useCallback, useContext, useEffect, useReducer } from 'react';
import type { FoodItem, StorageLocation } from '@/types/food-item';
import { getAllItems, insertItem, updateItem as dbUpdateItem, deleteItem as dbDeleteItem } from '@/utils/storage';
import { scheduleItemNotification, cancelItemNotifications } from '@/utils/notification-scheduler';
import { recordConsumption, type ConsumptionType } from '@/utils/consumption-store';
import { enrichItem } from '@/utils/food-item-utils';
import { syncWidgetData, scheduleDailyDigest, cancelDailyDigest, DIGEST_ENABLED_KEY } from '@/utils/widget-data-sync';
import KVStore from 'expo-sqlite/kv-store';

interface PantryState {
  items: FoodItem[];
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  activeFilter: StorageLocation | 'all';
}

type PantryAction =
  | { type: 'LOAD_ITEMS'; payload: FoodItem[] }
  | { type: 'ADD_ITEM'; payload: FoodItem }
  | { type: 'UPDATE_ITEM'; payload: FoodItem }
  | { type: 'DELETE_ITEM'; payload: string }
  | { type: 'SET_SEARCH'; payload: string }
  | { type: 'SET_FILTER'; payload: StorageLocation | 'all' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null };

function reducer(state: PantryState, action: PantryAction): PantryState {
  switch (action.type) {
    case 'LOAD_ITEMS':
      return { ...state, items: action.payload, isLoading: false };
    case 'ADD_ITEM':
      return { ...state, items: [...state.items, action.payload] };
    case 'UPDATE_ITEM':
      return {
        ...state,
        items: state.items.map((i) => (i.id === action.payload.id ? action.payload : i)),
      };
    case 'DELETE_ITEM':
      return { ...state, items: state.items.filter((i) => i.id !== action.payload) };
    case 'SET_SEARCH':
      return { ...state, searchQuery: action.payload };
    case 'SET_FILTER':
      return { ...state, activeFilter: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    default:
      return state;
  }
}

interface PantryContextValue {
  state: PantryState;
  addItem: (item: FoodItem) => Promise<void>;
  updateItem: (item: FoodItem) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  markAsUsed: (id: string, type: ConsumptionType) => Promise<void>;
  setSearch: (q: string) => void;
  setFilter: (f: StorageLocation | 'all') => void;
}

const PantryContext = createContext<PantryContextValue | null>(null);

export function PantryProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    items: [],
    isLoading: true,
    error: null,
    searchQuery: '',
    activeFilter: 'all',
  });

  async function syncAll(items: FoodItem[]) {
    const enriched = items.map(enrichItem);
    await syncWidgetData(enriched);
    const digestEnabled = await KVStore.getItem(DIGEST_ENABLED_KEY);
    if (digestEnabled === 'true') {
      await scheduleDailyDigest(enriched);
    } else if (digestEnabled === 'false') {
      await cancelDailyDigest();
    }
  }

  useEffect(() => {
    getAllItems()
      .then((items) => {
        dispatch({ type: 'LOAD_ITEMS', payload: items });
        syncAll(items).catch(() => {});
      })
      .catch((e) => dispatch({ type: 'SET_ERROR', payload: String(e) }));
  }, []);

  const addItem = useCallback(async (item: FoodItem) => {
    const ids = await scheduleItemNotification(item);
    const itemWithIds: FoodItem = { ...item, notificationIds: ids, updatedAt: new Date().toISOString() };
    await insertItem(itemWithIds);
    dispatch({ type: 'ADD_ITEM', payload: itemWithIds });
    syncAll([...state.items, itemWithIds]).catch(() => {});
  }, [state.items]);

  const updateItem = useCallback(async (item: FoodItem) => {
    const ids = await scheduleItemNotification(item);
    const updated: FoodItem = { ...item, notificationIds: ids, updatedAt: new Date().toISOString() };
    await dbUpdateItem(updated);
    dispatch({ type: 'UPDATE_ITEM', payload: updated });
    syncAll(state.items.map((i) => (i.id === updated.id ? updated : i))).catch(() => {});
  }, [state.items]);

  const deleteItem = useCallback(async (id: string) => {
    const item = state.items.find((i) => i.id === id);
    if (item) await cancelItemNotifications(item.notificationIds);
    await dbDeleteItem(id);
    dispatch({ type: 'DELETE_ITEM', payload: id });
    syncAll(state.items.filter((i) => i.id !== id)).catch(() => {});
  }, [state.items]);

  const markAsUsed = useCallback(async (id: string, type: ConsumptionType) => {
    const item = state.items.find((i) => i.id === id);
    if (!item) return;
    await recordConsumption(item.id, item.name, item.category, type, item.quantity, item.quantityUnit);
    await cancelItemNotifications(item.notificationIds);
    await dbDeleteItem(id);
    dispatch({ type: 'DELETE_ITEM', payload: id });
    syncAll(state.items.filter((i) => i.id !== id)).catch(() => {});
  }, [state.items]);

  const setSearch = useCallback((q: string) => dispatch({ type: 'SET_SEARCH', payload: q }), []);
  const setFilter = useCallback((f: StorageLocation | 'all') => dispatch({ type: 'SET_FILTER', payload: f }), []);

  return (
    <PantryContext.Provider value={{ state, addItem, updateItem, deleteItem, markAsUsed, setSearch, setFilter }}>
      {children}
    </PantryContext.Provider>
  );
}

export function usePantryContext(): PantryContextValue {
  const ctx = useContext(PantryContext);
  if (!ctx) throw new Error('usePantryContext must be used within PantryProvider');
  return ctx;
}

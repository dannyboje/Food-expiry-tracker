import React, { createContext, useCallback, useContext, useEffect, useReducer, useRef } from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { FoodItem, StorageLocation } from '@/types/food-item';
import { getAllItems, insertItem, updateItem as dbUpdateItem, deleteItem as dbDeleteItem, cleanupExpiredItems, deleteAllItems, deleteItemsCreatedAfter } from '@/utils/storage';
import { scheduleItemNotification, cancelItemNotifications } from '@/utils/notification-scheduler';
import { recordConsumption, type ConsumptionType } from '@/utils/consumption-store';
import { enrichItem } from '@/utils/food-item-utils';
import { syncWidgetData, scheduleDailyDigest, cancelDailyDigest, DIGEST_ENABLED_KEY } from '@/utils/widget-data-sync';
import { syncExpiredToShoppingList, addRemovedToShoppingList } from '@/utils/shopping-store';
import { runRecallCheck, runMatchOnCachedRecalls, shouldRunCheck, getStoredAlerts, dismissAlert, type RecallMatch } from '@/utils/recall-checker';
import KVStore from 'expo-sqlite/kv-store';

interface PantryState {
  items: FoodItem[];
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  activeFilter: StorageLocation | 'all';
  recallAlerts: RecallMatch[];
}

type PantryAction =
  | { type: 'LOAD_ITEMS'; payload: FoodItem[] }
  | { type: 'ADD_ITEM'; payload: FoodItem }
  | { type: 'UPDATE_ITEM'; payload: FoodItem }
  | { type: 'DELETE_ITEM'; payload: string }
  | { type: 'SET_SEARCH'; payload: string }
  | { type: 'SET_FILTER'; payload: StorageLocation | 'all' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_RECALL_ALERTS'; payload: RecallMatch[] }
  | { type: 'DISMISS_RECALL_ALERT'; payload: string };

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
    case 'SET_RECALL_ALERTS':
      return { ...state, recallAlerts: action.payload };
    case 'DISMISS_RECALL_ALERT':
      return { ...state, recallAlerts: state.recallAlerts.filter((a) => a.pairId !== action.payload) };
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
  dismissRecallAlert: (pairId: string) => Promise<void>;
  clearAllPantryItems: () => Promise<void>;
  clearRecentPantryItems: () => Promise<void>;
}

const PantryContext = createContext<PantryContextValue | null>(null);

async function fireRecallNotification(count: number): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '⚠️ Food Safety Alert',
      body: `${count} recalled product${count !== 1 ? 's' : ''} found in your pantry — tap to review`,
      data: { type: 'recall_alert' },
    },
    trigger: null,
  });
}

export function PantryProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    items: [],
    isLoading: true,
    error: null,
    searchQuery: '',
    activeFilter: 'all',
    recallAlerts: [],
  });

  // Stable ref so AppState listener always sees latest items without re-subscribing.
  const itemsRef = useRef<FoodItem[]>([]);
  useEffect(() => { itemsRef.current = state.items; }, [state.items]);

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

  async function checkRecalls(items: FoodItem[]) {
    const should = await shouldRunCheck();
    if (!should) return;
    const alerts = await runRecallCheck(items);
    dispatch({ type: 'SET_RECALL_ALERTS', payload: alerts });
    if (alerts.length > 0) fireRecallNotification(alerts.length).catch(() => {});
  }

  // ── Initial load ─────────────────────────────────────────────────────────

  useEffect(() => {
    cleanupExpiredItems(20)
      .then((removed) => {
        removed.forEach((item) => {
          cancelItemNotifications(item.notificationIds).catch(() => {});
          addRemovedToShoppingList(item).catch(() => {});
        });
        return getAllItems();
      })
      .then((items) => {
        dispatch({ type: 'LOAD_ITEMS', payload: items });
        syncAll(items).catch(() => {});

        const expired = items.map(enrichItem).filter((i) => i.status === 'expired');
        syncExpiredToShoppingList(expired).catch(() => {});

        // Load any stored alerts from a previous check, then run today's check if needed.
        getStoredAlerts()
          .then((stored) => dispatch({ type: 'SET_RECALL_ALERTS', payload: stored }))
          .catch(() => {});
        checkRecalls(items).catch(() => {});
      })
      .catch((e) => dispatch({ type: 'SET_ERROR', payload: String(e) }));
  }, []);

  // ── Foreground recall check (runs when app comes back from background) ───

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') return;
      checkRecalls(itemsRef.current).catch(() => {});
    });
    return () => sub.remove();
  }, []);

  // ── CRUD ─────────────────────────────────────────────────────────────────

  const addItem = useCallback(async (item: FoodItem) => {
    const ids = await scheduleItemNotification(item);
    const itemWithIds: FoodItem = { ...item, notificationIds: ids, updatedAt: new Date().toISOString() };
    await insertItem(itemWithIds);
    dispatch({ type: 'ADD_ITEM', payload: itemWithIds });
    const newList = [...state.items, itemWithIds];
    syncAll(newList).catch(() => {});
    // Immediately check the new item against cached recalls (no network call needed).
    runMatchOnCachedRecalls(newList)
      .then((alerts) => {
        const existingIds = new Set(state.recallAlerts.map((a) => a.pairId));
        const newAlerts = alerts.filter((a) => !existingIds.has(a.pairId));
        if (alerts.length > 0) dispatch({ type: 'SET_RECALL_ALERTS', payload: alerts });
        if (newAlerts.length > 0) fireRecallNotification(newAlerts.length).catch(() => {});
      })
      .catch(() => {});
  }, [state.items, state.recallAlerts]);

  const updateItem = useCallback(async (item: FoodItem) => {
    const ids = await scheduleItemNotification(item);
    const updated: FoodItem = { ...item, notificationIds: ids, updatedAt: new Date().toISOString() };
    await dbUpdateItem(updated);
    dispatch({ type: 'UPDATE_ITEM', payload: updated });
    const newList = state.items.map((i) => (i.id === updated.id ? updated : i));
    syncAll(newList).catch(() => {});
    // Re-check immediately in case the item name was changed to match a recall.
    runMatchOnCachedRecalls(newList)
      .then((alerts) => {
        const existingIds = new Set(state.recallAlerts.map((a) => a.pairId));
        const newAlerts = alerts.filter((a) => !existingIds.has(a.pairId));
        if (alerts.length > 0) dispatch({ type: 'SET_RECALL_ALERTS', payload: alerts });
        if (newAlerts.length > 0) fireRecallNotification(newAlerts.length).catch(() => {});
      })
      .catch(() => {});
  }, [state.items, state.recallAlerts]);

  const deleteItem = useCallback(async (id: string) => {
    const item = state.items.find((i) => i.id === id);
    if (item) {
      await cancelItemNotifications(item.notificationIds);
      addRemovedToShoppingList(item).catch(() => {});
    }
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
    addRemovedToShoppingList(item).catch(() => {});
  }, [state.items]);

  const setSearch = useCallback((q: string) => dispatch({ type: 'SET_SEARCH', payload: q }), []);
  const setFilter = useCallback((f: StorageLocation | 'all') => dispatch({ type: 'SET_FILTER', payload: f }), []);

  const dismissRecallAlert = useCallback(async (pairId: string) => {
    dispatch({ type: 'DISMISS_RECALL_ALERT', payload: pairId });
    await dismissAlert(pairId);
  }, []);

  const clearAllPantryItems = useCallback(async () => {
    const deleted = await deleteAllItems();
    for (const item of deleted) {
      cancelItemNotifications(item.notificationIds).catch(() => {});
    }
    dispatch({ type: 'LOAD_ITEMS', payload: [] });
    syncAll([]).catch(() => {});
  }, []);

  const clearRecentPantryItems = useCallback(async () => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const deleted = await deleteItemsCreatedAfter(since);
    const deletedIds = new Set(deleted.map((i) => i.id));
    for (const item of deleted) {
      cancelItemNotifications(item.notificationIds).catch(() => {});
    }
    const remaining = state.items.filter((i) => !deletedIds.has(i.id));
    dispatch({ type: 'LOAD_ITEMS', payload: remaining });
    syncAll(remaining).catch(() => {});
  }, [state.items]);

  return (
    <PantryContext.Provider value={{
      state, addItem, updateItem, deleteItem, markAsUsed,
      setSearch, setFilter, dismissRecallAlert,
      clearAllPantryItems, clearRecentPantryItems,
    }}>
      {children}
    </PantryContext.Provider>
  );
}

export function usePantryContext(): PantryContextValue {
  const ctx = useContext(PantryContext);
  if (!ctx) throw new Error('usePantryContext must be used within PantryProvider');
  return ctx;
}

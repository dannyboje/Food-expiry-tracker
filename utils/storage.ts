import * as SQLite from 'expo-sqlite';
import type { FoodItem } from '@/types/food-item';

let db: SQLite.SQLiteDatabase | null = null;
// Cache the open promise so concurrent callers before the DB is ready all
// await the same openDatabaseAsync call instead of opening multiple connections.
let dbOpenPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  if (!dbOpenPromise) {
    dbOpenPromise = SQLite.openDatabaseAsync('pantry.db').then((database) => {
      db = database;
      return database;
    });
  }
  return dbOpenPromise;
}

// Serialize all writes so concurrent fire-and-forget updates (e.g. notification ID
// backfill) don't race with user-triggered saves and cause "database is locked" on Android.
let writeQueue: Promise<unknown> = Promise.resolve();
function queueWrite<T>(fn: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(() => fn(), () => fn());
  writeQueue = next.then(() => {}, () => {});
  return next;
}

export async function initDatabase(): Promise<void> {
  const database = await getDb();
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS food_items (
      id                  TEXT PRIMARY KEY,
      name                TEXT NOT NULL,
      category            TEXT NOT NULL,
      storage_location    TEXT NOT NULL,
      quantity            REAL NOT NULL,
      quantity_unit       TEXT NOT NULL,
      purchase_date       TEXT NOT NULL,
      expiry_date         TEXT NOT NULL,
      barcode             TEXT,
      nutri_score         TEXT,
      nova_group          INTEGER,
      raw_score           INTEGER,
      added_by            TEXT,
      expiry_photo_uri    TEXT,
      nutrition_photo_uri TEXT,
      notification_ids    TEXT NOT NULL DEFAULT '[]',
      created_at          TEXT NOT NULL,
      updated_at          TEXT NOT NULL
    );
  `);
  // Migration: add columns to existing installs that predate this schema
  try { await database.execAsync('ALTER TABLE food_items ADD COLUMN nutri_score TEXT'); } catch {}
  try { await database.execAsync('ALTER TABLE food_items ADD COLUMN nova_group INTEGER'); } catch {}
  try { await database.execAsync('ALTER TABLE food_items ADD COLUMN raw_score INTEGER'); } catch {}
  try { await database.execAsync('ALTER TABLE food_items ADD COLUMN added_by TEXT'); } catch {}
}

function rowToItem(row: Record<string, unknown>): FoodItem {
  return {
    id: row.id as string,
    name: row.name as string,
    category: row.category as FoodItem['category'],
    storageLocation: row.storage_location as FoodItem['storageLocation'],
    quantity: row.quantity as number,
    quantityUnit: row.quantity_unit as FoodItem['quantityUnit'],
    purchaseDate: row.purchase_date as string,
    expiryDate: row.expiry_date as string,
    barcode: row.barcode as string | undefined,
    nutriScore: row.nutri_score as string | undefined,
    novaGroup: row.nova_group != null ? (row.nova_group as number) : undefined,
    rawScore: row.raw_score != null ? (row.raw_score as number) : undefined,
    addedBy: row.added_by as string | undefined,
    expiryPhotoUri: row.expiry_photo_uri as string | undefined,
    nutritionPhotoUri: row.nutrition_photo_uri as string | undefined,
    notificationIds: (() => { try { return JSON.parse((row.notification_ids as string) || '[]'); } catch { return []; } })(),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function getAllItems(): Promise<FoodItem[]> {
  const database = await getDb();
  const rows = await database.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM food_items ORDER BY expiry_date ASC'
  );
  return rows.map(rowToItem);
}

export async function getItemById(id: string): Promise<FoodItem | null> {
  const database = await getDb();
  const row = await database.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM food_items WHERE id = ?',
    [id]
  );
  return row ? rowToItem(row) : null;
}

export function insertItem(item: FoodItem): Promise<void> {
  return queueWrite(async () => {
    const database = await getDb();
    await database.runAsync(
      `INSERT INTO food_items (
        id, name, category, storage_location, quantity, quantity_unit,
        purchase_date, expiry_date, barcode, nutri_score, nova_group, raw_score,
        added_by, expiry_photo_uri, nutrition_photo_uri, notification_ids, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id, item.name, item.category, item.storageLocation,
        item.quantity, item.quantityUnit, item.purchaseDate, item.expiryDate,
        item.barcode ?? null, item.nutriScore ?? null, item.novaGroup ?? null,
        item.rawScore ?? null, item.addedBy ?? null,
        item.expiryPhotoUri ?? null, item.nutritionPhotoUri ?? null,
        JSON.stringify(item.notificationIds), item.createdAt, item.updatedAt,
      ]
    );
  });
}

export function updateItem(item: FoodItem): Promise<void> {
  return queueWrite(async () => {
    const database = await getDb();
    await database.runAsync(
      `UPDATE food_items SET
        name = ?, category = ?, storage_location = ?, quantity = ?,
        quantity_unit = ?, purchase_date = ?, expiry_date = ?,
        barcode = ?, nutri_score = ?, nova_group = ?, raw_score = ?,
        added_by = ?, expiry_photo_uri = ?, nutrition_photo_uri = ?,
        notification_ids = ?, updated_at = ?
      WHERE id = ?`,
      [
        item.name, item.category, item.storageLocation, item.quantity,
        item.quantityUnit, item.purchaseDate, item.expiryDate,
        item.barcode ?? null, item.nutriScore ?? null, item.novaGroup ?? null,
        item.rawScore ?? null, item.addedBy ?? null,
        item.expiryPhotoUri ?? null, item.nutritionPhotoUri ?? null,
        JSON.stringify(item.notificationIds), item.updatedAt, item.id,
      ]
    );
  });
}

export function deleteItem(id: string): Promise<void> {
  return queueWrite(async () => {
    const database = await getDb();
    await database.runAsync('DELETE FROM food_items WHERE id = ?', [id]);
  });
}

export function deleteAllItems(): Promise<FoodItem[]> {
  return queueWrite(async () => {
    const database = await getDb();
    const rows = await database.getAllAsync<Record<string, unknown>>('SELECT * FROM food_items');
    const items = rows.map(rowToItem);
    if (items.length > 0) {
      await database.runAsync('DELETE FROM food_items');
    }
    return items;
  });
}

export function deleteItemsCreatedAfter(since: string): Promise<FoodItem[]> {
  return queueWrite(async () => {
    const database = await getDb();
    const rows = await database.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM food_items WHERE created_at >= ?',
      [since]
    );
    const items = rows.map(rowToItem);
    if (items.length > 0) {
      await database.runAsync('DELETE FROM food_items WHERE created_at >= ?', [since]);
    }
    return items;
  });
}

// Returns items that were deleted so callers can cancel their notifications.
export function cleanupExpiredItems(daysPastExpiry: number): Promise<FoodItem[]> {
  return queueWrite(async () => {
    const database = await getDb();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysPastExpiry);
    const cutoffDate = cutoff.toISOString().split('T')[0];
    const rows = await database.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM food_items WHERE expiry_date < ?',
      [cutoffDate]
    );
    const items = rows.map(rowToItem);
    if (items.length > 0) {
      await database.runAsync('DELETE FROM food_items WHERE expiry_date < ?', [cutoffDate]);
    }
    return items;
  });
}

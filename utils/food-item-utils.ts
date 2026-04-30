import type { ExpiryStatus, FoodItem, FoodItemWithStatus } from '@/types/food-item';

export function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA);
  const b = new Date(dateB);
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export function daysUntilExpiry(expiryDate: string): number {
  return daysBetween(todayISO(), expiryDate);
}

export function daysInPantry(purchaseDate: string): number {
  return daysBetween(purchaseDate, todayISO());
}

export function shelfLifeDays(purchaseDate: string, expiryDate: string): number {
  return daysBetween(purchaseDate, expiryDate);
}

export function getExpiryStatus(daysLeft: number): ExpiryStatus {
  if (daysLeft < 0) return 'expired';
  if (daysLeft <= 3) return 'expiring_soon';
  return 'fresh';
}

export function enrichItem(item: FoodItem): FoodItemWithStatus {
  const days = daysUntilExpiry(item.expiryDate);
  return {
    ...item,
    daysUntilExpiry: days,
    daysInPantry: daysInPantry(item.purchaseDate),
    shelfLifeDays: shelfLifeDays(item.purchaseDate, item.expiryDate),
    status: getExpiryStatus(days),
  };
}

export function formatExpiryLabel(daysLeft: number): string {
  if (daysLeft < 0) return `Expired ${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? 's' : ''} ago!`;
  if (daysLeft === 0) return 'Expires today!';
  if (daysLeft === 1) return 'Expires tomorrow!';
  if (daysLeft <= 7) return `Expiring in ${daysLeft} days!`;
  return `${daysLeft} days left`;
}

export function formatDaysInPantry(days: number): string {
  if (days === 0) return 'Added today';
  if (days === 1) return '1 day in';
  return `${days} days in`;
}

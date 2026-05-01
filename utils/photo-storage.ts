import { documentDirectory, copyAsync, makeDirectoryAsync } from 'expo-file-system/legacy';

const PHOTOS_DIR = 'photos/';

/**
 * Copy a temporary camera/picker URI to permanent app storage.
 * Returns a RELATIVE path (e.g. "photos/1234_expiry.jpg") so it stays valid
 * across iOS container UUID rotations (which invalidate absolute paths).
 */
export async function persistPhoto(tempUri: string, suffix: string): Promise<string> {
  const dir = (documentDirectory ?? '') + PHOTOS_DIR;
  await makeDirectoryAsync(dir, { intermediates: true });
  const filename = `${Date.now()}_${suffix}.jpg`;
  await copyAsync({ from: tempUri, to: dir + filename });
  return PHOTOS_DIR + filename;
}

/**
 * Convert a stored photo path to a displayable absolute URI.
 * Handles both new relative paths and legacy absolute paths (best-effort).
 */
export function resolvePhotoUri(stored: string | undefined): string | undefined {
  if (!stored) return undefined;
  // Legacy absolute paths — pass through unchanged
  if (stored.startsWith('file://') || stored.startsWith('/')) return stored;
  // Relative path — prepend current documentDirectory
  return (documentDirectory ?? '') + stored;
}

import KVStore from 'expo-sqlite/kv-store';

const KEY_SHOWN  = 'email_capture_shown';
const KEY_EMAIL  = 'email_capture_email';

export async function hasShownEmailPrompt(): Promise<boolean> {
  return (await KVStore.getItem(KEY_SHOWN)) === 'true';
}

export async function markEmailPromptShown(): Promise<void> {
  await KVStore.setItem(KEY_SHOWN, 'true');
}

export async function saveEmail(email: string): Promise<void> {
  await KVStore.setItem(KEY_EMAIL, email.trim().toLowerCase());
}

export async function getStoredEmail(): Promise<string | null> {
  return KVStore.getItem(KEY_EMAIL);
}

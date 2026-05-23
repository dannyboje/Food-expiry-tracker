import { NativeModulesProxy, EventEmitter } from 'expo-modules-core';

// Graceful no-op on Android or when module is unavailable (dev without native build).
const SiriShortcutsNative = NativeModulesProxy.SiriShortcuts as {
  suggestShortcuts(): Promise<void>;
  donateShortcut(type: 'pantry' | 'shopping', itemName: string): Promise<void>;
} | undefined;

const noop = () => Promise.resolve();

export const SiriShortcuts = {
  /**
   * Register the generic "Add to pantry" and "Add to shopping list" shortcuts
   * with Siri so they appear in Settings › Siri & Search and in Suggestions.
   * Safe to call on every app launch — idempotent.
   */
  suggestShortcuts: SiriShortcutsNative?.suggestShortcuts.bind(SiriShortcutsNative) ?? noop,

  /**
   * Donate a shortcut for a specific item so Siri learns the user's habits.
   * Call this immediately after an item is successfully saved.
   *
   * @param type  'pantry' or 'shopping'
   * @param itemName  The name of the item (e.g. "Organic Whole Milk")
   */
  donateShortcut: SiriShortcutsNative?.donateShortcut.bind(SiriShortcutsNative) ?? noop,
};

export default SiriShortcuts;

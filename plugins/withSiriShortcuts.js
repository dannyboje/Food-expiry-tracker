const { withEntitlementsPlist, withInfoPlist } = require('@expo/config-plugins');

const ACTIVITY_TYPES = [
  'com.freshahead.app.addToPantry',
  'com.freshahead.app.addToShopping',
];

/** @type {import('@expo/config-plugins').ConfigPlugin} */
const withSiriShortcuts = (config) => {
  // 1. Add the Siri entitlement (required for INVoiceShortcutCenter)
  config = withEntitlementsPlist(config, (cfg) => {
    cfg.modResults['com.apple.developer.siri'] = true;
    return cfg;
  });

  // 2. Register NSUserActivityTypes so iOS lets our activities be continued
  config = withInfoPlist(config, (cfg) => {
    const existing = cfg.modResults.NSUserActivityTypes ?? [];
    const merged = Array.from(new Set([...existing, ...ACTIVITY_TYPES]));
    cfg.modResults.NSUserActivityTypes = merged;
    return cfg;
  });

  return config;
};

module.exports = withSiriShortcuts;

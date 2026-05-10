# Fresh Ahead — Track it. Use it. Waste less.

Fresh Ahead helps you take control of your food and medications, reduce waste, and keep your household safe. Scan barcodes, track expiry dates, get smart alerts, and always know what's in your fridge, freezer, pantry, and medicine cabinet.

**Available on iOS and Android.**
- App Store: `https://apps.apple.com/app/id6766026185`
- Google Play: `https://play.google.com/store/apps/details?id=com.freshahead.app`
- Website: `https://yoganjaliconsultancy.co.uk`

---

## What you can do

### Track your food
- **Add items manually** — enter the name, storage location, quantity, and expiry date in seconds.
- **Scan a barcode** — the app looks up the product on Open Food Facts and pre-fills the details automatically, including the Nutri-Score and NOVA processing group.
- **Duplicate detection** — if you scan a barcode that's already in your pantry the app warns you and lets you cancel, add anyway, or jump straight to the existing item to edit it.
- **Photograph the expiry date** — point your camera at any "Best Before" or "Use By" label and the app reads the date using on-device OCR — no internet needed.
- **Product image** — optionally take a photo of the product when adding it. The photo is stored on your device and used as the item's icon in the pantry and detail views.
- **Four storage locations** — Pantry, Fridge, Freezer, and Meds (medicine cabinet). Switch between them with one tap when adding or editing an item.

### Know what's expiring
- **Color-coded status** — every item shows how many days remain: green (fresh), orange (expiring soon), red (expired). A matching colored stripe on the left edge of each card makes status scannable at a glance.
- **Sorted by urgency** — items closest to expiry appear at the top of the list automatically.
- **Smart notifications** — get a push notification before something expires. The alert window adapts to shelf life: 1 day ahead for very short-lived items, up to 60 days ahead for long-shelf-life products. All thresholds are adjustable in Settings.
- **Expired item grace period** — expired items stay visible for 20 days so you can decide what to do with them before they are automatically removed.

### Food safety recalls
- **Daily recall check** — every morning at 9:30 AM the app checks three food safety databases: FDA (US), USDA FSIS (US), and the UK Food Standards Agency (FSA).
- **Pantry matching** — if any recalled product name matches something in your pantry, a red safety alert appears immediately on the pantry screen.
- **Immediate new-item check** — when you add or edit a pantry item, it's matched against the cached recall data right away, without waiting for the next daily check.
- **Dismiss per item** — review each recall alert and dismiss them one by one, or clear them all at once.

### Shopping list
- **Auto-restock** — items are automatically added to your shopping list when they:
  - Are auto-removed after the 20-day expired grace period
  - Are manually deleted from the pantry
  - Are marked as **used** (finished)
  - Are marked as **wasted** (thrown away or expired)
- **Manual additions** — type anything into the list, add it with one tap, and check it off as you shop.
- **Edit on the fly** — tap the pencil icon to rename any item inline.
- **Clear checked** — remove everything you've already bought with one tap.
- **Clear all** — remove the entire list at once with a single confirmation tap.
- **Restock badge** — items auto-added from your pantry are labelled so you always know why they're there.

### Food waste tracker
- **Monthly stats** — see how many items you used vs. wasted this month and your waste rate, calculated from this month's data only.
- **Long-press to log** — long-press any pantry item and tap "I used it" or "It expired / wasted" to record it.
- **Live updates** — figures refresh every time you open the Household tab.
- **Reset** — tap "Reset tracker" to clear all history. A confirmation step prevents accidental resets.

### Household
- **Multiple members** — add everyone in your household so each pantry item shows who added it.
- **Profile photo** — tap your avatar to set a photo from your library.
- **Custom emoji** — each member can pick their own avatar emoji.
- **Data management** — clear items added in the last 24 hours, or wipe the entire pantry to start fresh. Both options are disabled when the pantry is empty.
- **Coming soon: shared household** — real-time pantry sharing across multiple devices is on the roadmap. For now, all data lives on your device, so household members are tracked locally for attribution purposes.

### Health & Nutrition
- **Nutri-Score display** — items scanned from Open Food Facts show their A–E nutritional grade at a glance.
- **NOVA group** — see the food processing level (1 = unprocessed, 4 = ultra-processed) for every scanned product.
- **Health score** — a composite score (0–100) is calculated from Nutri-Score and NOVA group and shown on each item card and detail view.
- **Health tab grades** — the Health tab shows grade breakdowns (A–E) counted from your current pantry items, giving an accurate picture of what you have in stock right now.
- **Full nutrition panel** — the item detail view pulls the complete Open Food Facts nutrition panel for scanned products.

### Settings & customisation
- **Alert thresholds** — adjust how many days before expiry you want to be notified, independently configurable for four shelf-life bands (under 5 days, 5–14 days, 15–29 days, 30+ days).
- **Daily digest** — opt in to a daily summary notification of items needing attention. Choose the delivery time anywhere from 6 AM to 10 PM; defaults to 9 AM.

---

## Privacy

All data — pantry items, photos, recall alerts — stays on your device. The app only makes outbound requests to:

- **Open Food Facts** (barcode lookups and nutrition data)
- **openFDA / USDA FSIS** (food safety recall checks)
- **UK Food Standards Agency** (food safety recall checks)

No account required. No data is ever sent to any server we operate.

---

## Requirements

- **iOS** — iOS 16 or later (iPhone / iPad)
- **Android** — Android 10 (API 29) or later
- Barcode scanning and expiry-date OCR require a device camera
- Push notifications must be enabled for expiry and recall alerts

---

## App details

| Field | Value |
|---|---|
| App name | Fresh Ahead |
| Version | 1.0.0 |
| iOS bundle ID | `com.freshahead.app` |
| Android package | `com.freshahead.app` |
| App Store ID | 6766026185 |
| Developer | Yoganjali Consultancy Services Ltd |
| Contact | contact_us@yoganjaliconsultancy.co.uk |

---

## Development setup

```bash
npm install
npx expo start
```

Barcode scanning and on-device OCR (`@react-native-ml-kit/text-recognition`) require a [development build](https://docs.expo.dev/develop/development-builds/introduction/) via EAS — they are not available in Expo Go.

### Building with EAS

```bash
# Install EAS CLI
npm install -g eas-cli
eas login

# iOS production build
npx eas-cli@latest build -p ios --profile production

# Android production build
npx eas-cli@latest build -p android --profile production

# Submit to App Store
npx eas-cli@latest submit -p ios --profile production

# Submit to Google Play
npx eas-cli@latest submit -p android --profile production
```

EAS is configured with `appVersionSource: "remote"` — build numbers are managed automatically by Expo, not in `app.json`.

# Fresh Track — Track it. Use it. Waste less.

Fresh Track helps you take control of your food, reduce waste, and keep your household safe. Scan barcodes, track expiry dates, get smart alerts, and always know what's in your fridge, freezer, and pantry.

---

## What you can do

### Track your food
- **Add items manually** — enter the name, category, storage location, quantity, and expiry date in seconds.
- **Scan a barcode** — the app looks up the product on Open Food Facts and pre-fills the details automatically, including the Nutri-Score and NOVA processing group.
- **Duplicate detection** — if you scan a barcode that's already in your pantry the app warns you and lets you cancel, add anyway, or jump straight to the existing item.
- **Photograph the expiry date** — point your camera at any "Best Before" or "Use By" label and the app reads the date using on-device OCR — no internet needed.
- **Product photos** — photos captured at scan time are stored permanently on your device and displayed on item cards throughout the app.

### Know what's expiring
- **Color-coded status** — every item shows how many days remain: green (fresh), orange (expiring soon), red (expired). A matching colored stripe on the left edge of each card makes status scannable at a glance.
- **Sorted by urgency** — items closest to expiry appear at the top of the list automatically.
- **Smart notifications** — get a push notification before something expires. The alert window adapts to shelf life: 1 day for very short-lived items, up to 30 days for long-shelf-life products.
- **Expired item grace period** — expired items stay visible for 20 days so you can decide what to do with them before they're automatically removed.

### Food safety recalls
- **Daily recall check** — every morning at 9:30 AM the app checks three food safety databases: FDA (US), USDA FSIS (US), and the UK Food Standards Agency (FSA).
- **Pantry matching** — if any recalled product name matches something in your pantry, a red safety alert appears immediately on the pantry screen.
- **Immediate new-item check** — when you add or edit a pantry item, it's matched against the cached recall data right away, without waiting for the next daily check.
- **Dismiss per item** — review each recall and dismiss alerts one by one, or clear them all at once.

### Shopping list
- **Auto-restock** — items are automatically added to your shopping list when they:
  - Expire and are still in your pantry at app launch
  - Are auto-removed after the 20-day expired grace period
  - Are manually deleted (discarded) from the pantry
  - Are marked as **used** (finished)
  - Are marked as **wasted** (thrown away / expired)
- **Manual additions** — type anything into the list, add it with one tap, and check it off as you shop.
- **Edit on the fly** — tap the pencil icon to rename any item inline.
- **Clear checked** — remove everything you've already bought with one tap.
- **Restock badge** — items auto-added from your pantry are labelled so you always know why they're there.

### Food waste tracker
- **Monthly stats** — see how many items you used vs. wasted this month and your waste rate, calculated from this month's data only.
- **Live updates** — figures refresh every time you open the Household tab, so they always reflect your latest pantry activity.
- **Reset** — tap "Reset tracker" at the bottom of the stats card to clear all history. A confirmation step prevents accidental resets.

### Household
- **Multiple members** — add everyone in your household and see who added each pantry item.
- **Shared pantry** — all household members appear on item cards so there's no confusion about ownership.
- **Profile photo** — tap your avatar to set a photo from your library.
- **Household code** — share a six-character code so family members can link their devices.

### Health & Nutrition
- **Nutri-Score display** — items scanned from Open Food Facts show their A–E nutritional grade at a glance.
- **NOVA group** — see the food processing level (1 = unprocessed, 4 = ultra-processed) for every scanned product.
- **Product photos in health view** — scanned product images appear alongside each item in the Health tab.
- **Consumption tracking** — mark items as "used" or "wasted" to build a picture of your household's food habits over time.

### Settings & customisation
- **Alert thresholds** — adjust how many days before expiry you want to be notified for each shelf-life tier.
- **Daily digest** — opt in to a single daily summary notification instead of individual item alerts.

---

## Privacy

All data — pantry items, photos, recall alerts — stays on your device. The app only makes outbound requests to:

- **Open Food Facts** (barcode lookups)
- **USDA FoodData Central** (nutrition data)
- **openFDA / USDA FSIS** (food safety recall checks)
- **UK Food Standards Agency** (food safety recall checks)

No account required. No data is ever sent to any server we operate.

---

## Requirements

- iOS 16 or later (iPhone / iPad)
- Barcode scanning and expiry-date OCR require a device camera
- Push notifications must be enabled for expiry and recall alerts

---

## Development setup

```bash
npm install
npx expo start
```

Barcode scanning and on-device OCR (`@react-native-ml-kit/text-recognition`) require a [development build](https://docs.expo.dev/develop/development-builds/introduction/) via EAS — they are not available in Expo Go.

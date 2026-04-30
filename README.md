# FreshAhead — Track it. Use it. Waste less.

FreshAhead helps you take control of your food, reduce waste, and keep your household safe. Scan barcodes, track expiry dates, get smart alerts, and always know what's in your fridge, freezer, and pantry.

---

## What you can do

### Track your food
- **Add items manually** — enter the name, category, storage location, quantity, and expiry date in seconds.
- **Scan a barcode** — the app looks up the product on Open Food Facts and pre-fills the details automatically, including the Nutri-Score and NOVA processing group.
- **Photograph the expiry date** — point your camera at any "Best Before" or "Use By" label and the app reads the date using on-device OCR — no internet needed.

### Know what's expiring
- **Color-coded status** — every item shows how many days remain: green (fresh), orange (expiring soon), red (expired).
- **Smart notifications** — get a push notification before something expires. The alert window adapts to shelf life: 1 day for very short-lived items, up to 30 days for long-shelf-life products.
- **Expired item grace period** — expired items stay visible for 20 days so you can decide what to do with them before they're automatically removed.

### Food safety recalls
- **Daily recall check** — every morning at 8 AM the app quietly checks the FDA and USDA FSIS food recall databases.
- **Pantry matching** — if any recalled product matches something in your pantry, a red safety alert appears immediately on the pantry screen.
- **Dismiss per item** — review each recall and dismiss alerts one by one, or clear them all at once.

### Shopping list
- **Auto-restock expired items** — when something expires it's automatically added to your shopping list so you never forget to replace it.
- **Manual additions** — type anything into the list, add it with one tap, and check it off as you shop.
- **Edit on the fly** — tap the pencil icon to rename any item inline.
- **Clear checked** — remove everything you've already bought with one tap.
- **Restock badge** — items auto-added from your pantry are labelled so you always know why they're there.

### Household
- **Multiple members** — add everyone in your household and see who added each pantry item.
- **Shared pantry** — all household members appear on item cards so there's no confusion about ownership.

### Health & Nutrition
- **Nutri-Score display** — items scanned from Open Food Facts show their A–E nutritional grade at a glance.
- **NOVA group** — see the food processing level (1 = unprocessed, 4 = ultra-processed) for every scanned product.
- **Consumption tracking** — mark items as "used" or "wasted" to build a picture of your household's food habits over time.

### Settings & customisation
- **Alert thresholds** — adjust how many days before expiry you want to be notified for each shelf-life tier.
- **Daily digest** — opt in to a single daily summary notification instead of individual item alerts.
- **Dark mode** — the app follows your system appearance automatically.

---

## Privacy

All data — pantry items, photos, recall alerts — stays on your device. The app only makes outbound requests to:

- **Open Food Facts** (barcode lookups)
- **USDA FoodData Central** (nutrition data)
- **openFDA / USDA FSIS** (daily food safety recall checks)

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

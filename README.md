# Fresh Ahead — Track it. Use it. Waste less.

Fresh Ahead helps you take control of your food and medications, reduce waste, and keep your household safe. Scan barcodes, track expiry dates, get smart alerts, and always know what's in your fridge, freezer, pantry, and medicine cabinet.

**Available on iOS and Android.**
- App Store: `https://apps.apple.com/app/id6766026185`
- Google Play: `https://play.google.com/store/apps/details?id=com.freshahead.app`
- Website: `https://yoganjaliconsultancy.co.uk`
- How-to video: `https://youtu.be/0lq54AIQ5io`

---

## What you can do

### Track your food
- **Add items manually** — enter the name, storage location, quantity, and expiry date in seconds. The app validates that the expiry date is not before the purchase date.
- **Voice input** — tap the microphone button on the product name field and speak the product name. The audio is transcribed instantly using Groq Whisper and placed directly into the name field — no typing needed.
- **Pantry history autocomplete** — as you type a product name, the app instantly suggests matching items from your existing pantry history. Selecting a suggestion also pre-fills the category, Nutri-Score, NOVA group, and barcode from the previous entry.
- **Scan a barcode** — the app looks up the product on Open Food Facts and pre-fills the details automatically, including the Nutri-Score and NOVA processing group.
- **Non-food detection** — if a scanned barcode belongs to a non-food item (bags, packaging, cleaning products, etc.), the app shows "Fresh Ahead doesn't rate these types of products" and skips the nutrition panel and healthier alternatives — keeping results meaningful.
- **Duplicate detection** — if you scan a barcode that's already in your pantry the app warns you and lets you cancel, add anyway, or jump straight to the existing item to edit it.
- **Photograph the expiry date** — point your camera at any "Best Before" or "Use By" label and the app reads the date using on-device OCR — no internet needed.
- **Product image** — optionally take a photo of the product when adding it. The photo is stored on your device and used as the item's icon in the pantry and detail views.
- **Four storage locations** — Pantry, Fridge, Freezer, and Meds (medicine cabinet). Switch between them with one tap when adding or editing an item.

### Know what's expiring
- **Color-coded status** — every item shows how many days remain: green (fresh), orange (expiring soon within 3 days), red (expired). A matching colored stripe on the left edge of each card makes status scannable at a glance. The item detail view shows "Expiring" when an item is approaching its date and "Expired" once it has passed.
- **Sorted by urgency** — items closest to expiry appear at the top of the list automatically.
- **Smart notifications** — get a push notification before something expires. The alert window adapts to shelf life: 1 day ahead for very short-lived items, up to 60 days ahead for long-shelf-life products. All thresholds are adjustable in Settings.
- **Expired item grace period** — expired items stay visible for 20 days so you can decide what to do with them before they are automatically removed.

### Food safety recalls
- **Daily recall check** — every morning at 9:30 AM the app checks the food safety databases relevant to your country: FDA + USDA FSIS (US), UK Food Standards Agency (GB), or FSSAI (India). Users in other regions receive checks from all four databases so imported products are covered.
- **Location-aware filtering** — recall sources are selected automatically from the device's locale using the Intl API — no GPS or permissions required.
- **Pantry matching** — if any recalled product name matches something in your pantry, a red safety alert banner appears at the top of the pantry screen, collapsed by default. Tap to expand and see full recall details.
- **Immediate new-item check** — when you add or edit a pantry item, it's matched against the cached recall data right away, without waiting for the next daily check.
- **Dismiss per item** — expand the alert banner, review each item's recall details individually, and dismiss them one by one. A full-width "Dismiss all alerts" button at the bottom of the expanded panel clears all at once.

### Shopping list
- **Multiple lists** — create as many named shopping lists as you like. Tap the pencil icon to rename any list inline. Delete a list with a confirmation step.
- **Collapse / expand** — tap the +/− button beside a list name to fold it away when you don't need it.
- **Favourites** — star any item (☆/★) to add it to a persistent Favourites section that survives list deletion. Tap + on a favourite to add it to whichever list you choose. Un-favouriting asks for confirmation so you don't lose items by accident.
- **Auto-restock** — items are automatically added to the default list when they are auto-removed after the expired grace period, manually deleted from the pantry, or marked as used or wasted.
- **Nutritional info preserved** — pantry items added to the shopping list carry their Nutri-Score, NOVA group, and composite health score so you can see at a glance how healthy the restock is.
- **Manual additions** — type anything into any list, add it with one tap, and check it off as you shop.
- **Edit on the fly** — tap the pencil icon to rename any item inline. Tap the tick to save or the X to cancel; the keyboard is automatically scrolled clear of the item being edited.
- **Clear** — a "Clear" button on each list lets you remove only checked items or wipe the whole list, with a confirmation step for the latter.
- **Restock badge** — items auto-added from your pantry are labelled so you always know why they're there.

### Food waste tracker
- **Monthly stats** — see how many items you used vs. wasted this month and your waste rate, calculated from this month's data only.
- **Long-press to log** — long-press any pantry item and tap "I used it" or "It expired / wasted" to record it.
- **Live updates** — figures refresh every time you open the Household tab.
- **Reset** — tap "Reset tracker" to clear all history. A confirmation step prevents accidental resets.

### Household & settings
- **Multiple members** — add everyone in your household so each pantry item shows who added it.
- **Profile photo** — tap your avatar to set a photo from your library.
- **Custom emoji** — each member can pick their own avatar emoji.
- **Alert thresholds** — adjust how many days before expiry you want to be notified, independently configurable for four shelf-life bands (under 5 days, 5–14 days, 15–29 days, 30+ days).
- **Daily digest** — opt in to a daily summary notification of items needing attention. Choose the delivery time anywhere from 6 AM to 10 PM; defaults to 9 AM.
- **Data management** — clear items added in the last 24 hours, or wipe the entire pantry to start fresh. Both options are disabled when the pantry is empty. A "Load Demo Data" button lets you populate the app with realistic sample data for screenshots or walkthroughs.
- **Coming soon: shared household** — real-time pantry sharing across multiple devices is on the roadmap. For now, all data lives on your device, so household members are tracked locally for attribution purposes.

### Health & Nutrition
- **Nutri-Score display** — items scanned from Open Food Facts show their A–E nutritional grade at a glance, with colour-coded emoji labels on each nutrient row (⚡ Energy, 🧈 Fat, 🌾 Carbs, 💪 Protein, 🧂 Salt, and more).
- **NOVA group** — see the food processing level (1 = unprocessed, 4 = ultra-processed) for every scanned product.
- **Health score** — a composite score (0–100) is calculated from Nutri-Score and NOVA group and shown on each item card, detail view, and alongside each healthier alternative so you can compare at a glance.
- **Additive breakdown** — additives are classified into three groups with colour-coded labels: ☠️ Harmful (red), 🧪 Preservatives (blue), and 🌱 Generally safe (orange).
- **Healthier alternatives** — when you scan a product rated Fair, Poor, or Bad (score below 60), the app instantly suggests up to 3 healthier alternatives (Nutri-Score A or B) in the same food category. Alternatives are prioritised by your GPS location so they're products available to buy locally. Tap the cart icon next to any alternative to search for it on Google Shopping. The alternatives are saved with the pantry item and displayed on the item detail page, just above the full nutrition panel.
- **Scan history detail** — tap any recently scanned product in the Health tab to open a full detail view showing its health score, healthier alternatives, and complete nutrition and additive panel — identical to what you see straight after scanning.
- **Health tab grades** — the Health tab shows grade breakdowns (A–E) counted from your current pantry items, giving an accurate picture of what you have in stock right now.
- **Full nutrition panel** — the item detail view pulls the complete Open Food Facts nutrition panel for scanned products.

### Siri voice commands (iOS)
- **"Add [item] to pantry"** — say it to Siri and Fresh Ahead opens directly on the Add Item screen with the product name pre-filled.
- **"Add [item] to shopping list"** — say it to Siri and the app opens the Shopping tab with the item ready to add.
- **Shortcut suggestions** — Fresh Ahead donates a Siri shortcut each time you add a pantry or shopping item, so Siri learns your habits and surfaces relevant suggestions proactively.
- **Setup** — go to Settings › Siri & Search on your iPhone and enable Fresh Ahead shortcuts, or add them via the Household screen.

### First-launch
- **Newsletter opt-in** — on first launch the app offers to keep you updated on new features. Your email address is stored only on your device and is never transmitted to any server.

---

## Privacy

All data — pantry items, photos, recall alerts — stays on your device. The app only makes outbound requests to:

- **Open Food Facts** (barcode lookups and nutrition data)
- **openFDA / USDA FSIS** (US food safety recall checks — only fetched for US-locale devices)
- **UK Food Standards Agency** (UK food safety recall checks — only fetched for GB-locale devices)
- **FSSAI** (India food safety recall checks — only fetched for IN-locale devices; RSS feed, best-effort)
- **Groq API** (voice input only — short audio clips are sent for transcription when you tap the mic button; audio is not stored by Groq beyond the transcription request)

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

**Voice input** requires a free [Groq API key](https://console.groq.com). Add it to `.env.local`:
```
EXPO_PUBLIC_GROQ_API_KEY=gsk_...
```
For EAS builds, add it as a secret (only needed once):
```bash
eas secret:create --scope project --name EXPO_PUBLIC_GROQ_API_KEY --value gsk_...
```

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

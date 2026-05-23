import ExpoModulesCore
import Intents

// ── Activity type constants (must match Info.plist NSUserActivityTypes) ─────
private let kAddPantryType   = "com.freshahead.app.addToPantry"
private let kAddShoppingType = "com.freshahead.app.addToShopping"

public class SiriShortcutsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SiriShortcuts")

    // ── suggestShortcuts ──────────────────────────────────────────────────
    // Registers the two generic shortcuts with INVoiceShortcutCenter so they
    // appear in Settings › Siri & Search. Call once on app launch.
    AsyncFunction("suggestShortcuts") { (promise: Promise) in
      guard #available(iOS 12, *) else { promise.resolve(nil); return }

      let pantry   = Self.makeActivity(type: kAddPantryType,
                                       title: "Add item to pantry",
                                       phrase: "Add to my pantry",
                                       urlPath: "add-item",
                                       name: nil)
      let shopping = Self.makeActivity(type: kAddShoppingType,
                                       title: "Add item to shopping list",
                                       phrase: "Add to my shopping list",
                                       urlPath: "shopping",
                                       name: nil)

      var suggestions: [INShortcut] = []
      if let s = INShortcut(userActivity: pantry)   { suggestions.append(s) }
      if let s = INShortcut(userActivity: shopping)  { suggestions.append(s) }

      INVoiceShortcutCenter.shared.setShortcutSuggestions(suggestions)
      promise.resolve(nil)
    }

    // ── donateShortcut ────────────────────────────────────────────────────
    // Donates a shortcut for a specific item after the user adds it.
    // Siri learns from repeated donations and surfaces the shortcut proactively.
    AsyncFunction("donateShortcut") { (type: String, itemName: String, promise: Promise) in
      guard #available(iOS 12, *) else { promise.resolve(nil); return }

      let isPantry    = type == "pantry"
      let activityType = isPantry ? kAddPantryType : kAddShoppingType
      let urlPath      = isPantry ? "add-item" : "shopping"
      let title        = isPantry
        ? "Add \(itemName) to pantry"
        : "Add \(itemName) to shopping list"
      let phrase = isPantry
        ? "Add \(itemName) to pantry"
        : "Add \(itemName) to shopping"

      let activity = Self.makeActivity(type: activityType, title: title,
                                       phrase: phrase, urlPath: urlPath, name: itemName)

      // Donating an INInteraction is the right signal for Siri intelligence.
      // We pair it with a shortcut suggestion so it also appears in Siri & Search.
      if let shortcut = INShortcut(userActivity: activity) {
        INVoiceShortcutCenter.shared.setShortcutSuggestions([shortcut])
      }

      promise.resolve(nil)
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private static func makeActivity(type: String,
                                   title: String,
                                   phrase: String,
                                   urlPath: String,
                                   name: String?) -> NSUserActivity {
    let activity = NSUserActivity(activityType: type)
    activity.title = title
    activity.isEligibleForSearch = true
    activity.isEligibleForPrediction = true
    activity.suggestedInvocationPhrase = phrase

    // Build the URL scheme deep link that expo-router will handle.
    var components = URLComponents()
    components.scheme = "freshahead"
    components.host   = urlPath   // e.g. "add-item" or "shopping"
    var queryItems: [URLQueryItem] = [URLQueryItem(name: "from", value: "siri")]
    if let n = name, !n.isEmpty {
      queryItems.append(URLQueryItem(name: "name", value: n))
    }
    components.queryItems = queryItems

    let urlString = components.url?.absoluteString ?? "freshahead://\(urlPath)?from=siri"
    activity.userInfo = ["url": urlString]
    return activity
  }
}

/**
 * SiriShortcutsAppDelegate.mm
 *
 * Hooks into the iOS application lifecycle to intercept NSUserActivity
 * continuation (fired when Siri triggers a donated shortcut) and forwards
 * the stored URL to React Native's Linking module so expo-router can
 * navigate to the correct screen.
 *
 * Registered automatically via EXAppDelegateWrapper at load time.
 */

#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

#ifdef __cplusplus
extern "C" {
#endif
  // React Native Linking manager — handles openURL events on the JS side.
  BOOL RCTLinkingManager_openURL(UIApplication *app, NSURL *url);
#ifdef __cplusplus
}
#endif

#import <React/RCTLinkingManager.h>

// ── EXAppDelegateWrapper subscription ────────────────────────────────────────
// expo-modules-core exposes EXAppDelegateWrapper so native modules can
// subscribe to AppDelegate lifecycle callbacks without modifying AppDelegate.mm.

#if __has_include(<EXAppDelegateWrapper/EXAppDelegateWrapper.h>)
#import <EXAppDelegateWrapper/EXAppDelegateWrapper.h>

@interface SiriShortcutsAppDelegate : NSObject <EXAppDelegateWrapper>
@end

@implementation SiriShortcutsAppDelegate

// Register as a subscriber before main() runs.
+ (void)load {
  // EXAppDelegateWrapper discovers implementors automatically; no manual
  // registration needed in Expo SDK 50+.
}

- (BOOL)application:(UIApplication *)application
continueUserActivity:(NSUserActivity *)userActivity
 restorationHandler:(void (^)(NSArray<id<UIUserActivityRestoring>> * _Nullable))restorationHandler
{
  NSString *urlString = userActivity.userInfo[@"url"];
  if (!urlString) return NO;

  NSURL *url = [NSURL URLWithString:urlString];
  if (!url) return NO;

  // Dispatch on next run-loop tick so the RN bridge is ready.
  dispatch_async(dispatch_get_main_queue(), ^{
    [RCTLinkingManager application:application openURL:url options:@{}];
  });
  return YES;
}

@end

#else
// Fallback when EXAppDelegateWrapper header is not found (should not happen
// with a standard Expo managed build, but avoids compile errors).
#warning "EXAppDelegateWrapper not found — Siri shortcut continuation will not work."
#endif

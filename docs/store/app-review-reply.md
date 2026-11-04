# App Review reply (Guideline 2.1 Information Needed, 2026-11-03)

Pasted into App Store Connect: App Review Information > Notes, with the screen recording as the App Review
attachment. Resubmitted 2026-11-05: the rejected submission was cancelled and 1.0.1 (202611041456) went in one
submission with the Remove Ads in-app purchase. Recording: `~/.breaker3d-release/review/BREAKER3D-1.0.1-review*.mp4`
(iOS 26.5 Simulator, iPhone 17 Pro; the user played with the mouse while `xcrun simctl io <udid> recordVideo` ran).

```
1. Screen recording: attached (file in App Review Information). It was captured in the iOS 26.5 Simulator
   (iPhone 17 Pro) from the same source as build 1.0.1 (202611041456), because our only physical test device
   cannot update to the latest OS. It starts at app launch and shows the typical flow: ad consent > title >
   Start > placing the paddle > aiming and serving > catching fruit (balls multiply) > boss > stage clear >
   the "Remove Ads" in-app purchase ($1.99, store sign-in sheet) and "Restore Purchases". No account, login or
   user-generated content.

2. Purpose and audience: BREAKER 3D is a casual 3D brick-breaker game for a general audience. Players serve
   balls into a steel box through small holes, break brick murals of world landmarks, catch falling fruit to
   multiply their balls and defeat a boss. It is entertainment: a quick, one-handed portrait game that plays
   offline. There is no account, chat or user-generated content.

3. How to use it (no login or sample files needed):
   - Launch > tap "Start" (시작하기) to play stage 1.
   - Serve in two steps: drag anywhere to place the paddle and release (nothing is fired); then press, drag
     sideways to aim (the dotted guide shows the path) and release to fire. "Move paddle" returns to step 1.
   - Bounce the balls into the box through its holes; caught fruit multiplies the balls. Pause is top right.
   - From stage 10 some stages have a steel pipe from an extra floor hole; balls may reach the fruit vault at its
     far end or come back out.
   - Optional rewarded ads: after a game over (revive) and after a clear (double gold).
   - In-app purchase "Remove Ads" (non-consumable, product id remove_ads): on the title screen below the stage
     grid, with "Restore Purchases". It gives the same rewards without watching ads.

4. External services: Google AdMob (rewarded ads) with Google's User Messaging Platform consent form; Apple App
   Tracking Transparency; Apple StoreKit (in-app purchase). No backend server of our own, no login service,
   no analytics, no AI services.

5. Regional differences: none in features or content. The UI is available in 14 languages; Google's consent form
   is shown only in regions that require it (e.g. EEA/UK).

6. Not a regulated industry. Landmark photos are used under their Creative Commons licenses with attribution
   (shown under each stage and on the Credits screen).
```

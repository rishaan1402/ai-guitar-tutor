# Open Strings for iOS

The iOS app is the same static web build as Android, wrapped by Capacitor
(Swift Package Manager, no CocoaPods). Bundle id: `app.openstrings`.
It is landscape-only and talks to the production API.

## Run it on your iPhone (Mac)

1. Install **Xcode** from the App Store and open it once (accept the licence).
2. On the iPhone: **Settings → Privacy & Security → Developer Mode → on** (it restarts).
3. In this repo:
   ```sh
   cd frontend
   npm ci
   npm run build:mobile      # static build + lesson videos
   npx cap sync ios          # copies the build into the Xcode project
   npx cap open ios          # opens Xcode
   ```
4. In Xcode: select the **App** target → **Signing & Capabilities** → tick
   *Automatically manage signing* → **Team**: your Apple ID (add it under
   Xcode → Settings → Accounts). If the bundle id is taken, change it to e.g.
   `app.openstrings.yourname` for testing.
5. Plug in the iPhone, pick it as the run destination at the top, press **Run (▶)**.
6. First launch with a free Apple ID: on the iPhone, **Settings → General →
   VPN & Device Management → trust your developer certificate**.

With a free Apple ID the app expires after 7 days (just press Run again).
TestFlight needs the paid Apple Developer Program.

After changing web code: `npm run build:mobile && npx cap sync ios`, then Run again.

## What to test first
- Mic permission prompt, then a Groove: the band should play through the
  **loudspeaker** while the mic listens (AppDelegate sets the audio session).
- Chord check, play-the-notes and rhythm steps in a lesson.
- Lesson videos play inline.
- Landscape lock on iPhone and iPad.

Google / Facebook sign-in are hidden on iOS until iOS client IDs are set up;
email sign-in works. The App Store will also require Sign in with Apple.

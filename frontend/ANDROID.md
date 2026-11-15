# Open Strings for Android

The app is the same Next.js frontend, built as static files and wrapped with
[Capacitor](https://capacitorjs.com). Lessons (84 videos + reference recordings)
ship inside the APK; grading, accounts and songs use the production API.

## Build

Requirements: Node 20+, JDK 21, Android SDK (platform 36, build-tools 36) with
`ANDROID_HOME` set (or `android/local.properties` with `sdk.dir=...`).

```bash
npm install
npm run android:debug      # -> android/app/build/outputs/apk/debug/app-debug.apk
npm run android:release    # -> android/app/build/outputs/bundle/release/app-release.aab (for Play)
```

`build:mobile` sets `MOBILE_BUILD=1` (static export into `out-build/`) and points
the app at the production API; override with `NEXT_PUBLIC_API_URL=...`.

Before every Play upload, bump `versionCode` (and `versionName`) in
`android/app/build.gradle`.

## Release signing

Create an upload key once and keep it safe (losing it means asking Google to reset it):

```bash
keytool -genkeypair -v -keystore android/upload-key.jks -alias upload \
  -keyalg RSA -keysize 2048 -validity 10000
```

Then `android/keystore.properties` (git-ignored):

```
storeFile=upload-key.jks
storePassword=...
keyAlias=upload
keyPassword=...
```

Enrol in Play App Signing when creating the app in the Play Console.

## Sign in with Google / Facebook

The buttons appear only when the API has the provider configured.

**Google** (Google Cloud console → APIs & Services → Credentials, OAuth consent screen first):
1. Create a **Web application** client. Add the website origin(s) under
   "Authorised JavaScript origins".
2. Create an **Android** client for package `app.openstrings` with the SHA-1 of
   your upload key *and* of the Play App Signing key (Play Console → App integrity).
3. Set `GOOGLE_CLIENT_IDS=<web client id>` on the API (the app signs in with the
   web client ID as its server client ID, so ID tokens are issued for it).

**Facebook** (developers.facebook.com → create a Consumer app → Facebook Login):
1. Add the website domain and an Android platform with package `app.openstrings`,
   class `app.openstrings.MainActivity` and your key hashes.
2. On the API: `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` (Secret Manager) and
   `FACEBOOK_CLIENT_TOKEN`.
3. Build the app with `-PfacebookAppId=... -PfacebookClientToken=...` (or put them
   in `android/gradle.properties`).

## Forcing an update

The app reads `/api/app/config` at launch. Set `APP_MIN_ANDROID_BUILD` on the API
to a `versionCode` and older builds show "Update needed" with a Play Store link.

## How the shell works

- `src/components/native/NativeShell.tsx`: back button, deep links, status bar,
  forced updates, and routing after a full reload (Capacitor serves `index.html`
  for every path; a tiny boot script in the root layout remembers the real one).
- `src/lib/native.ts`: `isNativeApp()` and the bundled-lesson paths.
- `scripts/bundle-lessons.mjs`: copies `data/lessons/*` into the build.
- The manifest removes advertising-ID / ad-services permissions pulled in by the
  Facebook and Play services libraries: the app has no ads or tracking, and the
  Play Data safety form should say so.

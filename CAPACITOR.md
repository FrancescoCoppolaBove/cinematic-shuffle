# Cineteca — Native app (Capacitor)

The PWA is wrapped with [Capacitor](https://capacitorjs.com) so the same web
code can ship to the App Store / Play Store. The web app stays fully working.

## Prerequisites
- Node 18+
- iOS: a Mac with **Xcode**
- Android: **Android Studio**
- Apple Developer Program ($99/yr) to publish on the App Store
- Google Play Console ($25 one-time)

## One-time: create the native projects
```bash
npm run cap:add:ios       # creates the ios/ project
npm run cap:add:android   # creates the android/ project
```

## Build & run
```bash
npm run cap:ios       # build web + sync + open Xcode
npm run cap:android   # build web + sync + open Android Studio
# or just sync after a web change:
npm run cap:sync
```

## Installed plugins
- `@capacitor/share` — native share sheet (and "Share to Instagram Stories")
- `@capacitor/status-bar`, `@capacitor/splash-screen`, `@capacitor/haptics`

## Authentication on native (IMPORTANT)
Google sign-in uses `signInWithPopup` on the web, which does **not** work inside
a native WebView. `src/hooks/useAuth.ts` is now platform-aware: on native it uses
`signInWithRedirect` + `getRedirectResult` (works without extra native config).

For the most reliable native Google sign-in, switch the native branch to the
dedicated plugin once the native projects exist (needs a Capacitor-8-compatible
release):
```bash
npm install @capacitor-firebase/authentication
```
Then in the native branch of `signInWithGoogle()`:
```ts
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
const { credential } = await FirebaseAuthentication.signInWithGoogle();
await signInWithCredential(auth, GoogleAuthProvider.credential(credential?.idToken));
```
Console config still required:
- iOS: add `GoogleService-Info.plist` + the reversed-client-id URL scheme in Xcode.
- Android: add `google-services.json` + register the release **SHA-1/SHA-256** in
  the Firebase console.
- Add the iOS/Android bundle IDs as authorized in Firebase Auth.

## Notes
- `capacitor.config.ts` holds appId (`app.cineteca.mobile`), name, dark theme.
- App icons / splash: generate from `public/brand/cineteca-logo.svg`
  (e.g. with `@capacitor/assets`).
- Apple "minimum functionality" (4.2): use real native capabilities
  (push notifications, share-to-Stories, haptics) to pass review.
- TMDB API is free for non-commercial use; revisit licensing before monetizing.
- A global React `ErrorBoundary` (`src/components/ErrorBoundary.tsx`) prevents
  white-screen crashes — wire it to Sentry when ready.
- CI runs lint + typecheck + tests + build on every push/PR (`.github/workflows/ci.yml`).
  Critical pure logic is unit-tested under `src/utils/*.test.ts` (run `npm test`).

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

## Notes
- `capacitor.config.ts` holds appId (`app.cineteca.mobile`), name, dark theme.
- App icons / splash: generate from `public/brand/cineteca-logo.svg`
  (e.g. with `@capacitor/assets`).
- Apple "minimum functionality" (4.2): use real native capabilities
  (push notifications, share-to-Stories, haptics) to pass review.
- TMDB API is free for non-commercial use; revisit licensing before monetizing.

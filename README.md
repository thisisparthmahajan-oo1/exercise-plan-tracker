# Exercise Logger

Personal workout tracker: routines, live workout logging, history, analytics
and body metrics. Built with Expo (SDK 54), expo-router and SQLite (drizzle).

The app is **offline-first**: each device keeps its full data in a local SQLite
database and works without internet. When online it syncs with a small cloud
server (last-write-wins per row), so every device ends up with the same data.

## Where it runs

| Piece            | Hosted at                                                          | Source                 | Deploys                          |
| ---------------- | ------------------------------------------------------------------ | ---------------------- | -------------------------------- |
| iPhone app       | Installed directly on the phone (Xcode / `devicectl`, no App Store) | repo root              | Manual build + install           |
| Web app          | https://fitness-app-pm.vercel.app (Vercel project `fitness-app-pm`) | repo root (`vercel.json`) | Auto on push to `master`     |
| Sync server (API) | https://fitness-pm.vercel.app (Vercel project `exercise-plan-tracker`) | [`server/`](server/README.md) | Auto on push to `master`  |
| Database         | MongoDB Atlas, database `fitness`                                  | —                      | —                                |

- The sync server is API only: `/` returns "Cannot GET /"; check
  `https://fitness-pm.vercel.app/health` instead.
- The app finds the server through `EXPO_PUBLIC_SYNC_URL` in `.env` (public URL,
  safe to commit).
- Access is a single secret `APP_TOKEN` (set in the server's Vercel env vars).
  Enter it once per device under Settings → Account & Sync. Never commit it.
- The web app is for **desktop browsers** (Chrome, Safari). iPhone browsers
  can't run its in-browser database; on the phone, use the installed app.
  Private/incognito windows don't work either (no persistent storage).

```
 iPhone app ─┐                        ┌──────────────────────┐
 (SQLite)    ├── push / pull (HTTPS) ─▶│ fitness-pm.vercel.app │──▶ MongoDB Atlas
 Web app ────┘                        │ (Express, server/)    │    db: fitness
 (SQLite in browser)                  └──────────────────────┘
```

## Develop

```bash
npm install
npx expo start          # dev server (iOS dev build / web)
npx tsc --noEmit && npx expo lint
```

Server: see [`server/README.md`](server/README.md) (`npm run dev`, `npm test`).

## Install on the iPhone

```bash
cd ios
xcodebuild -workspace Fitness.xcworkspace -scheme Fitness -configuration Release \
  -destination "id=<device-udid>" -derivedDataPath build -allowProvisioningUpdates build
xcrun devicectl device install app --device <device-udid> \
  build/Build/Products/Release-iphoneos/ExerciseLogger.app
```

Local data is never wiped by an install; a backup of the database is written
before any data migration.

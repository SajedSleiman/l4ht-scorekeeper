# l4ht

A phone-first scorekeeper for Leekha, Hand, 400, and Tarneb. Players enter scores round by round, with running totals saved on the device.

## Run & Operate

- `pnpm --filter @workspace/l4ht run dev` — start the Angular development server
- `pnpm --filter @workspace/l4ht run build` — create the production web build
- `pnpm --filter @workspace/l4ht run typecheck` — compile the Angular app and templates
- `pnpm --filter @workspace/l4ht run ios:prepare` — build the web app and sync it into the Capacitor iOS project
- Open `artifacts/l4ht/ios/App/App.xcodeproj` on macOS to run the app from Xcode on an iPhone

## Stack

- Angular standalone components, TypeScript, and Angular Service Worker
- Capacitor iOS wrapper for running the same app as a native iPhone app
- pnpm workspace
- Angular 20 is used because the managed Node.js runtime is 24.13.0; update the runtime before moving to a newer Angular major

## Product & Data

- Games: Leekha, Hand, 400, and Tarneb
- Add, rename, and remove players; create, edit, and remove rounds; enter signed numeric scores; calculate running totals
- Scores and match history are stored only in browser local storage. The iOS app uses its local web view storage; data does not sync to another device or server.
- Clearing the app's site data or removing the iOS app can erase saved matches.
- No backend or database is used for score data.

## Where Things Live

- `artifacts/l4ht/src/app.component.*` — score sheet UI and local match behavior
- `artifacts/l4ht/src/main.ts` — Angular bootstrap and service-worker registration
- `artifacts/l4ht/angular.json` — Angular build and development-server configuration
- `artifacts/l4ht/capacitor.config.ts` and `artifacts/l4ht/ios/` — iPhone wrapper and Xcode project
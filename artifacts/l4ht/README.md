# l4ht

A phone-first score sheet for Leekha, Hand, 400, and Tarneb. Add players, enter each round's scores under their names, and see the running totals. Scores are saved only on the device.

## Run in the browser

From the project root:

```sh
pnpm install
pnpm --filter @workspace/l4ht run dev
```

## Run on an iPhone with Xcode

Xcode runs on macOS. Open this project on a Mac, then from the project root run:

```sh
pnpm install
pnpm --filter @workspace/l4ht run ios:prepare
```

Then open `artifacts/l4ht/ios/App/App.xcodeproj` in Xcode, choose your iPhone as the run destination, set your signing team under the app target's Signing & Capabilities, and press **Run**.

Run `ios:prepare` again after changing the Angular app so the iOS project receives the latest build.

## Local data

Match records are stored in local storage on the current browser or iPhone. They are not uploaded or synced. Clearing app/site data or deleting the iOS app may erase saved matches.
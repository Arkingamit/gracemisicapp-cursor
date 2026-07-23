# Grace Music — iOS (Capacitor)

| Setting | Value |
|--------|--------|
| Bundle ID (iOS only) | `org.graceahmedabad.music.ios` |
| Android package (unchanged) | `org.graceahmedabad.music` |
| Display name | Grace Music |
| Version | `1.0.4` (build `5`) |
| Server URL | `https://music.graceahmedabad.org` |
| Apple Team | `2B633NXZ52` (arkin gamit) |

> Capacitor `appId` stays `org.graceahmedabad.music` for Android.  
> After every `cap sync ios`, `scripts/set-ios-bundle-id.mjs` restores the iOS Bundle ID.

## Setup on a Mac

```bash
cd "gracemisicapp-cursor"
npm install
npm run ios:prod
npx cap open ios
```

In Xcode:
1. Team: **arkin gamit** (`2B633NXZ52`)
2. Confirm Bundle ID `org.graceahmedabad.music.ios`
3. Signing & Capabilities → **Sign In with Apple**
4. Product → Run (or Archive for App Store)

## Sign in with Apple

### Apple Developer
1. Identifiers → **+** → App IDs → App
2. Bundle ID (Explicit): `org.graceahmedabad.music.ios`
3. Enable **Sign In with Apple** → Register

### Server / env
```bash
APPLE_CLIENT_IDS=org.graceahmedabad.music.ios
APPLE_TEAM_ID=2B633NXZ52
APPLE_IOS_BUNDLE_ID=org.graceahmedabad.music.ios
```

## Google Sign-In (iOS)

1. Google Cloud → Credentials → Create OAuth client → **iOS**
2. Bundle ID: `org.graceahmedabad.music.ios`
3. Put the new client ID in `Info.plist` as `GIDClientID`
4. URL scheme = reversed client ID (`com.googleusercontent.apps.XXXX`)
5. Firebase → add/update iOS app with Bundle ID `org.graceahmedabad.music.ios` → download new `GoogleService-Info.plist`

Keep the **Web** client ID for `GoogleSignIn.initialize({ clientId })` / `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.

## npm scripts

```bash
npm run ios:prod   # sync Capacitor to production URL + fix iOS Bundle ID
npm run ios:sync   # sync iOS + fix Bundle ID
npm run ios:open   # open Xcode
```

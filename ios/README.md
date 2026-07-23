# Grace Music — iOS (Capacitor)

Matches Android configuration:

| Setting | Value |
|--------|--------|
| Bundle ID | `org.graceahmedabad.music` |
| Display name | Grace Music |
| Version | `1.0.4` (build `5`) |
| Server URL | `https://music.graceahmedabad.org` |
| Google Sign-In (web client) | Capawesome + `GIDClientID` in Info.plist |

## Important: build machine

**You cannot produce an `.ipa` / App Store build on Windows.**  
Use a **Mac with Xcode** (or a cloud Mac CI).

## Setup on a Mac

```bash
cd "gracemisicapp-cursor"
npm install
npm run ios:prod
npx cap open ios
```

In Xcode:
1. Select team / signing for `org.graceahmedabad.music`
2. Product → Archive → Distribute App → App Store Connect

## Sign in with Apple (required if you offer Google login)

### Apple Developer (developer.apple.com)
1. Certificates, Identifiers & Profiles → **Identifiers**
2. Select App ID `org.graceahmedabad.music` → enable **Sign In with Apple** → Save
3. (Optional for web login) Create a **Services ID** e.g. `org.graceahmedabad.music.web`
   - Enable Sign In with Apple
   - Domains: `music.graceahmedabad.org`
   - Return URLs: `https://music.graceahmedabad.org/login`

### Xcode
1. Open the iOS project → Signing & Capabilities
2. Confirm **Sign In with Apple** capability (entitlements file is already added)
3. Team must match App ID

### Env (server / web)
```bash
# Native audience (bundle ID) — required
APPLE_CLIENT_IDS=org.graceahmedabad.music

# Optional: also allow web Services ID
# APPLE_CLIENT_IDS=org.graceahmedabad.music,org.graceahmedabad.music.web
# NEXT_PUBLIC_APPLE_CLIENT_ID=org.graceahmedabad.music.web
```

### App Store Connect
Users & Access / App → enable Sign in with Apple if prompted during submission.

## Universal Links / App Links (invite opens in app)

Invite URLs look like: `https://music.graceahmedabad.org/invite/ABC123`

### Website (required)
Deploy these endpoints (already in the repo):
- `https://music.graceahmedabad.org/.well-known/assetlinks.json`
- `https://music.graceahmedabad.org/.well-known/apple-app-site-association`

Set production env:
```bash
# Play Console → App integrity → App signing key certificate → SHA-256
# (comma-separate upload key + Play signing key if both are used)
ANDROID_APP_LINK_SHA256=AA:BB:CC:...

# Optional override (defaults to Xcode team 7C99V6842Q)
APPLE_TEAM_ID=7C99V6842Q
```

### Android
- Manifest includes verified App Links for `/invite`
- Rebuild/upload a new AAB after changes
- Verify: `adb shell pm get-app-links org.graceahmedabad.music`

### iOS (Xcode on Mac)
1. Signing & Capabilities → **Associated Domains**
2. Confirm `applinks:music.graceahmedabad.org` (entitlements file already includes it)
3. Archive and upload a new build

### npm scripts

```bash
npm run ios:prod   # sync Capacitor to production URL
npm run ios:sync   # sync iOS
npm run ios:open   # open Xcode (Mac only)
```

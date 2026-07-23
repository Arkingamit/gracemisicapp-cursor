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

## npm scripts

```bash
npm run ios:prod   # sync Capacitor to production URL
npm run ios:sync   # sync iOS
npm run ios:open   # open Xcode (Mac only)
```

/**
 * Capacitor `cap sync ios` resets PRODUCT_BUNDLE_IDENTIFIER from capacitor.config appId
 * (shared with Android). Restore the iOS-only Bundle ID after every sync.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const IOS_BUNDLE_ID = 'org.graceahmedabad.music.ios';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pbx = path.join(root, 'ios/App/App.xcodeproj/project.pbxproj');

if (!fs.existsSync(pbx)) {
  console.warn('[set-ios-bundle-id] project.pbxproj not found, skip');
  process.exit(0);
}

const before = fs.readFileSync(pbx, 'utf8');
const after = before.replace(
  /PRODUCT_BUNDLE_IDENTIFIER = [^;]+;/g,
  `PRODUCT_BUNDLE_IDENTIFIER = ${IOS_BUNDLE_ID};`,
);

if (after !== before) {
  fs.writeFileSync(pbx, after);
  console.log(`[set-ios-bundle-id] Set iOS Bundle ID to ${IOS_BUNDLE_ID}`);
} else {
  console.log(`[set-ios-bundle-id] Already ${IOS_BUNDLE_ID}`);
}

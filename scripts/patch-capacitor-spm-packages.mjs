/**
 * Fix Capacitor plugin Package.swift files for Xcode 26+ / SwiftPM.
 * - publicHeadersPath must precede swiftSettings
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const targets = [
  'node_modules/@capacitor/keyboard/Package.swift',
];

for (const rel of targets) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) continue;

  let src = fs.readFileSync(file, 'utf8');
  const fixed = src.replace(
    /(path:\s*"[^"]+",)\s*swiftSettings:\s*\[[\s\S]*?\],\s*publicHeadersPath:\s*("include")/,
    '$1\n            publicHeadersPath: $2,\n            swiftSettings: [\n                .enableExperimentalFeature("NonescapableTypes")\n            ]',
  );

  if (fixed !== src) {
    fs.writeFileSync(file, fixed);
    console.log(`[capacitor-spm-patches] Fixed argument order in ${rel}`);
  }
}

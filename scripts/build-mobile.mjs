/**
 * Legacy static-export mobile build.
 * Prefer: npm run android:sync  (Capacitor loads the live website URL)
 *
 * Always restores API routes even if the Next build fails.
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(root, '..');

function run(command, args, env = {}) {
  console.log(`\n> ${command} ${args.join(' ')}\n`);
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, ...env },
  });
  return result.status ?? 1;
}

let exitCode = 0;

try {
  exitCode = run('node', ['scripts/mobileify.mjs']);
  if (exitCode !== 0) throw new Error('mobileify failed');

  exitCode = run(
    'npx',
    ['cross-env', 'MOBILE_BUILD=true', 'NEXT_PUBLIC_BASE_URL=https://music.graceahmedabad.org', 'next', 'build']
  );
  if (exitCode !== 0) throw new Error('next build failed');

  exitCode = run('npx', ['cap', 'sync']);
} catch (err) {
  console.error('\n[build:mobile] Failed:', err.message);
  exitCode = 1;
} finally {
  // Critical: restore renamed API routes even on failure
  run('node', ['scripts/unmobileify.mjs']);
}

process.exit(exitCode);

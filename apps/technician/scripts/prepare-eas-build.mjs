#!/usr/bin/env node

/**
 * EAS Build Preparation Script
 *
 * Compiles @wisper/shared package before Metro bundler runs.
 * This script is executed from apps/technician during EAS Build.
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Determine monorepo root (2 levels up from apps/technician/scripts/)
const monorepoRoot = resolve(__dirname, '../../..');
const sharedPackagePath = resolve(monorepoRoot, 'packages/shared');
const sharedDistPath = resolve(sharedPackagePath, 'dist/index.js');

console.log('[EAS] 🔧 Preparing @wisper/shared for build...');
console.log(`[EAS] Monorepo root: ${monorepoRoot}`);
console.log(`[EAS] Shared package: ${sharedPackagePath}`);

// Verify shared package exists
if (!existsSync(sharedPackagePath)) {
  console.error('[EAS] ❌ ERROR: packages/shared not found!');
  console.error(`[EAS] Expected at: ${sharedPackagePath}`);
  process.exit(1);
}

try {
  // Build shared package from monorepo root
  console.log('[EAS] 📦 Building @wisper/shared...');

  execSync('npm run build --workspace=packages/shared', {
    cwd: monorepoRoot,
    stdio: 'inherit',
  });

  console.log('[EAS] ✅ Build completed');

  // Verify dist was generated
  if (!existsSync(sharedDistPath)) {
    console.error('[EAS] ❌ ERROR: dist/index.js was not generated!');
    console.error(`[EAS] Expected at: ${sharedDistPath}`);
    process.exit(1);
  }

  console.log('[EAS] ✅ Verified: packages/shared/dist/index.js exists');
  console.log('[EAS] 🎉 @wisper/shared is ready for Metro bundler');

} catch (error) {
  console.error('[EAS] ❌ ERROR: Failed to build @wisper/shared');
  console.error(error.message);
  process.exit(1);
}

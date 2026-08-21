#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = join(__dirname, '..');
const sourceDir = join(projectRoot, '../../node_modules/maplibre-gl/dist');
const targetDir = join(projectRoot, 'public/maplibre');

// Files to copy (MapLibre v6+ uses ESM)
const files = ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs'];

try {
  // Create target directory if it doesn't exist
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
    console.log('✓ Created directory:', targetDir);
  }

  // Copy each file
  for (const file of files) {
    const sourcePath = join(sourceDir, file);
    const targetPath = join(targetDir, file);

    if (!existsSync(sourcePath)) {
      console.error(`✗ Source file not found: ${sourcePath}`);
      process.exit(1);
    }

    const content = readFileSync(sourcePath);
    writeFileSync(targetPath, content);
    console.log(`✓ Copied ${file}`);
  }

  console.log('✓ MapLibre worker assets copied successfully');
} catch (error) {
  console.error('✗ Failed to copy MapLibre worker:', error.message);
  process.exit(1);
}

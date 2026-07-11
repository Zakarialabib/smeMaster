import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.join(__dirname, '../src');
const localesDir = path.join(__dirname, '../src/locales');

const languages = ['en', 'fr', 'ar', 'ja', 'it'];
const extractedKeys = new Set();

// Helper to recursively extract keys from src
function scanDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      scanDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const matches = content.matchAll(/\bt\(['"]([^'"]+)['"](?:,\s*['"]([^'"]+)['"])?\)/g);
      for (const match of matches) {
        extractedKeys.add(match[1]);
      }
    }
  }
}

console.log('Scanning source files for translation keys...');
scanDirectory(srcDir);

// Known dynamic key prefixes that shouldn't be deleted even if they aren't explicitly matched
const dynamicPrefixes = [
  'videoGeneration.loading',
  'view_names.',
  'fontPicker.readability.',
  'shortcut_categories.',
  'media_library.',
  'common.',
  'editor.',
  'showcaseStartupModal.',
  'fontPicker.',
  'app.',
  'onboarding.',
  'licensing.',
  'settings_nav.',
  'business_profile.',
  'display_tab.',
  'player_tab.',
  'content_design_tab.',
  'security_tab.',
  'imageGeneration.',
  'videoGeneration.',
  'scheduler.',
  'system_status.',
  'hardware_tab.',
  'hardware.',
  'camera.',
  'settings.'
];

function isKeyUsed(keyPath) {
  // If explicitly found in source
  if (extractedKeys.has(keyPath)) return true;
  // If it's a known dynamic/wildcard prefix
  for (const prefix of dynamicPrefixes) {
    if (keyPath.startsWith(prefix)) return true;
  }
  return false;
}

// Recursively clean object
function cleanObject(obj, prefix = '') {
  let keysDeleted = 0;
  for (const key in obj) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      keysDeleted += cleanObject(obj[key], fullPath);
      // Delete empty objects
      if (Object.keys(obj[key]).length === 0) {
        delete obj[key];
      }
    } else {
      if (!isKeyUsed(fullPath)) {
        delete obj[key];
        keysDeleted++;
      }
    }
  }
  return keysDeleted;
}

let totalCleaned = 0;

for (const lang of languages) {
  const filePath = path.join(localesDir, lang, 'translation.json');
  if (!fs.existsSync(filePath)) continue;

  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const cleanedCount = cleanObject(data);

  if (cleanedCount > 0) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`🧹 [${lang.toUpperCase()}] Removed ${cleanedCount} unused keys.`);
    totalCleaned += cleanedCount;
  } else {
    console.log(`✓ [${lang.toUpperCase()}] No unused keys found.`);
  }
}

console.log(`\nCleanup complete. Removed ${totalCleaned} unused keys total.`);

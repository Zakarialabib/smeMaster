import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.join(__dirname, '../src');
const localesDir = path.join(__dirname, '../src/locales');

const languages = ['en', 'fr', 'ar', 'ja', 'it'];
const extractedKeys = new Map();

// Recursively find keys
function scanDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      scanDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      // Match t('key') or t("key") or t('key', 'default')
      const matches = content.matchAll(/\bt\(['"]([^'"]+)['"](?:,\s*['"]([^'"]+)['"])?\)/g);
      for (const match of matches) {
        const key = match[1];
        const defaultVal = match[2] || match[1];
        if (!extractedKeys.has(key)) {
          extractedKeys.set(key, defaultVal);
        }
      }
    }
  }
}

// Deep set object value based on dot-notation path
function setDeep(obj, key, valToSet) {
    const pathArr = key.split('.');
    let current = obj;
    let valid = true;
    
    for (let i = 0; i < pathArr.length - 1; i++) {
        const p = pathArr[i];
        if (typeof current[p] === 'string') {
            valid = false;
            break;
        }
        if (typeof current[p] !== 'object' || current[p] === null) {
            current[p] = {};
        }
        current = current[p];
    }
    
    if (valid) {
        const lastKey = pathArr[pathArr.length - 1];
        // Only set if key doesn't exist, or if its value is exactly the key (meaning it was auto-generated incorrectly before)
        if (current[lastKey] === undefined || current[lastKey] === lastKey || current[lastKey] === '') {
            current[lastKey] = valToSet;
            return true;
        }
    }
    return false;
}

console.log('Scanning source files for translation keys...');
scanDirectory(srcDir);
console.log(`Found ${extractedKeys.size} unique translation keys in source code.\n`);

let totalAdded = 0;

for (const lang of languages) {
  const filePath = path.join(localesDir, lang, 'translation.json');
  if (!fs.existsSync(filePath)) {
    console.warn(`File not found: ${filePath}, skipping...`);
    continue;
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  let addedCount = 0;

  for (const [key, defaultVal] of extractedKeys.entries()) {
    // If language is not english, prefix with [TODO] to flag for manual translation
    const valToSet = lang === 'en' ? defaultVal : `[TODO] ${defaultVal}`;
    
    if (setDeep(data, key, valToSet)) {
      addedCount++;
    }
  }

  if (addedCount > 0) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`✅ [${lang.toUpperCase()}] Added ${addedCount} missing keys.`);
    totalAdded += addedCount;
  } else {
    console.log(`✓ [${lang.toUpperCase()}] Up to date.`);
  }
}

console.log(`\nSync complete. Added ${totalAdded} keys total.`);
if (totalAdded > 0) {
  console.log('Search for "[TODO]" in your JSON files to find keys that need manual translation.');
}

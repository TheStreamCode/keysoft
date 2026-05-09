import fs from 'fs';
import path from 'path';
import { getAdaptiveCategories, getCategoryName } from '../../constants/categories';

const srcRoot = path.resolve(__dirname, '../..');

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(srcRoot, relativePath), 'utf8');
}

function findObjectBlock(source: string, objectName: 'it' | 'en'): string {
  // Translations are now extracted into src/locales/{it,en}.ts as
  // `export const it = { ... };` / `export const en = { ... };`
  const exportMarker = `export const ${objectName} =`;
  const start = source.indexOf(exportMarker);
  if (start === -1) {
    throw new Error(`Missing ${objectName} translations block`);
  }

  const firstBrace = source.indexOf('{', start);
  let depth = 0;
  let isInString = false;
  let quote = '';
  let isEscaped = false;

  for (let index = firstBrace; index < source.length; index += 1) {
    const char = source[index];

    if (isInString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (char === '\\') {
        isEscaped = true;
      } else if (char === quote) {
        isInString = false;
      }
      continue;
    }

    if (char === "'" || char === '"' || char === '`') {
      isInString = true;
      quote = char;
      continue;
    }

    if (char === '{') {
      depth += 1;
    }

    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(firstBrace, index + 1);
      }
    }
  }

  throw new Error(`Unclosed ${objectName} translations block`);
}

function extractTranslationEntries(block: string): Map<string, string> {
  const entries = new Map<string, string>();
  const entryPattern = /^\s*(?:'([^']+)'|([A-Za-z0-9_]+))\s*:/gm;
  let match: RegExpExecArray | null;

  while ((match = entryPattern.exec(block)) !== null) {
    const key = match[1] ?? match[2];
    let valueStart = entryPattern.lastIndex;

    while (/\s/.test(block[valueStart] ?? '')) {
      valueStart += 1;
    }

    const quote = block[valueStart];
    if (quote !== "'" && quote !== '"') {
      entries.set(key, '');
      continue;
    }

    let value = '';
    let isEscaped = false;

    for (let index = valueStart + 1; index < block.length; index += 1) {
      const char = block[index];

      if (isEscaped) {
        value += char;
        isEscaped = false;
        continue;
      }

      if (char === '\\') {
        isEscaped = true;
        continue;
      }

      if (char === quote) {
        break;
      }

      value += char;
    }

    entries.set(key, value);
  }

  return entries;
}

function getDuplicateKeys(block: string): string[] {
  const keys: string[] = [];
  const keyPattern = /^\s*(?:'([^']+)'|([A-Za-z0-9_]+))\s*:/gm;
  let match: RegExpExecArray | null;

  while ((match = keyPattern.exec(block)) !== null) {
    keys.push(match[1] ?? match[2]);
  }

  return [...new Set(keys.filter((key, index) => keys.indexOf(key) !== index))];
}

function extractPlaceholders(value: string): string[] {
  const placeholders: string[] = [];
  const placeholderPattern = /\{([A-Za-z0-9_]+)\}/g;
  let match: RegExpExecArray | null;

  while ((match = placeholderPattern.exec(value)) !== null) {
    placeholders.push(match[1]);
  }

  return placeholders.sort();
}

function walkSourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === '__tests__') {
        return [];
      }
      return walkSourceFiles(fullPath);
    }

    if (!/\.(ts|tsx)$/.test(entry.name)) {
      return [];
    }

    return [fullPath];
  });
}

function extractUsedTranslationKeys(): string[] {
  const keys = new Set<string>();
  const usagePattern = /\b(?:t|this\.t)\(\s*['"]([^'"]+)['"]/g;

  for (const file of walkSourceFiles(srcRoot)) {
    const source = fs.readFileSync(file, 'utf8');
    let match: RegExpExecArray | null;

    while ((match = usagePattern.exec(source)) !== null) {
      keys.add(match[1]);
    }
  }

  return [...keys].sort();
}

describe('translations', () => {
  const italianSource = readSource('locales/it.ts');
  const englishSource = readSource('locales/en.ts');
  const italianBlock = findObjectBlock(italianSource, 'it');
  const englishBlock = findObjectBlock(englishSource, 'en');
  const italianEntries = extractTranslationEntries(italianBlock);
  const englishEntries = extractTranslationEntries(englishBlock);
  const italianKeys = [...italianEntries.keys()].sort();
  const englishKeys = [...englishEntries.keys()].sort();

  it('keeps Italian and English dictionaries aligned', () => {
    expect(getDuplicateKeys(italianBlock)).toEqual([]);
    expect(getDuplicateKeys(englishBlock)).toEqual([]);
    expect(italianKeys).toEqual(englishKeys);
  });

  it('defines every statically referenced translation key in both languages', () => {
    const usedKeys = extractUsedTranslationKeys();

    expect(usedKeys.filter((key) => !italianEntries.has(key))).toEqual([]);
    expect(usedKeys.filter((key) => !englishEntries.has(key))).toEqual([]);
  });

  it('keeps interpolation placeholders aligned for every key', () => {
    const mismatchedKeys = italianKeys.filter((key) => {
      const italianPlaceholders = extractPlaceholders(italianEntries.get(key) ?? '');
      const englishPlaceholders = extractPlaceholders(englishEntries.get(key) ?? '');

      return italianPlaceholders.join('|') !== englishPlaceholders.join('|');
    });

    expect(mismatchedKeys).toEqual([]);
  });

  it('does not keep legacy hardcoded user-facing fallbacks', () => {
    const forbiddenPatterns = [
      {
        file: 'components/CustomAlert.tsx',
        pattern: /buttons\s*=\s*\[\{\s*text:\s*['"]OK['"]/,
      },
      {
        file: 'screens/SettingsScreen.tsx',
        pattern: /username:\s*['"]Utente['"]/,
      },
      {
        file: 'constants/categories.ts',
        pattern: /name:\s*['"](Preferiti|Lavoro|Banca|Giochi|Musica)['"]/,
      },
    ];

    const violations = forbiddenPatterns
      .filter(({ file, pattern }) => pattern.test(readSource(file)))
      .map(({ file }) => file);

    expect(violations).toEqual([]);
  });
});

describe('translated categories', () => {
  it('uses translated names for default categories', () => {
    const categories = getAdaptiveCategories(false, (key) => `translated:${key}`);

    expect(categories.map((category) => category.name)).toEqual([
      'translated:category_favorites',
      'translated:category_email',
      'translated:category_social',
      'translated:category_business',
      'translated:category_banking',
      'translated:category_shopping',
      'translated:category_gaming',
      'translated:category_music',
    ]);
  });

  it('falls back to category id when a translation is missing', () => {
    expect(getCategoryName('favorites', () => '')).toBe('favorites');
    expect(getCategoryName('custom')).toBe('custom');
  });
});

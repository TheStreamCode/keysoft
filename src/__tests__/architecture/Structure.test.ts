import fs from 'fs';
import path from 'path';

const srcRoot = path.resolve(__dirname, '../..');
const repoRoot = path.resolve(srcRoot, '..');

function walkDirectories(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);

    if (!entry.isDirectory()) {
      return [];
    }

    return [fullPath, ...walkDirectories(fullPath)];
  });
}

describe('source structure', () => {
  it('keeps source directories lowercase', () => {
    const allowedDirectoryNames = new Set(['__tests__']);
    const invalidDirectories = walkDirectories(srcRoot)
      .map((directory) => path.relative(repoRoot, directory).replace(/\\/g, '/'))
      .filter((directory) => {
        const name = path.basename(directory);
        return !allowedDirectoryNames.has(name) && name !== name.toLowerCase();
      });

    expect(invalidDirectories).toEqual([]);
  });

  it('keeps settings hooks in the shared hooks tree', () => {
    expect(fs.existsSync(path.join(srcRoot, 'hooks/settings/useExportImport.ts'))).toBe(true);
    expect(fs.existsSync(path.join(srcRoot, 'hooks/settings/useNotificationSettings.ts'))).toBe(
      true,
    );
    expect(fs.existsSync(path.join(srcRoot, 'hooks/settings/usePinManagement.ts'))).toBe(true);
    expect(fs.existsSync(path.join(srcRoot, 'hooks/settings/useProfileForm.ts'))).toBe(true);
    expect(fs.existsSync(path.join(srcRoot, 'screens/Settings/hooks'))).toBe(false);
  });

  it('keeps SettingsScreen imports pointed at shared settings hooks', () => {
    const settingsScreen = fs.readFileSync(
      path.join(srcRoot, 'screens/SettingsScreen.tsx'),
      'utf8',
    );

    expect(settingsScreen).toContain("from '../hooks/settings/usePinManagement'");
    expect(settingsScreen).toContain("from '../hooks/settings/useNotificationSettings'");
    expect(settingsScreen).toContain("from '../hooks/settings/useProfileForm'");
    expect(settingsScreen).toContain("from '../hooks/settings/useExportImport'");
    expect(settingsScreen).not.toContain("from './Settings/hooks/");
  });
});

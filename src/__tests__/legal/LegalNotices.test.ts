import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../../..');

function readRepositoryFile(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('Apache legal notices', () => {
  it('keeps the complete Apache 2.0 text bundled into the app', () => {
    const license = readRepositoryFile('LICENSE');
    const bundledLicense = readRepositoryFile('assets/apache-2.0.txt');
    const legalScreen = readRepositoryFile('src/screens/OpenSourceScreen.tsx');
    const metroConfig = readRepositoryFile('metro.config.js');

    expect(license).toContain(
      'Apache License\n                           Version 2.0, January 2004',
    );
    expect(license).toContain('9. Accepting Warranty or Additional Liability.');
    expect(license).toContain('END OF TERMS AND CONDITIONS');
    expect(bundledLicense).toBe(license);
    expect(legalScreen).toContain("Asset.fromModule(require('../../assets/apache-2.0.txt'))");
    expect(metroConfig).toContain("ext !== 'ksx' && ext !== 'txt'");
  });

  it('keeps the official source and trademark policy reachable from settings', () => {
    const settingsScreen = readRepositoryFile('src/screens/SettingsScreen.tsx');
    const legalScreen = readRepositoryFile('src/screens/OpenSourceScreen.tsx');
    const navigation = readRepositoryFile('src/navigation/index.tsx');

    expect(settingsScreen).toContain("navigation.navigate('OpenSource')");
    expect(navigation).toContain('name="OpenSource"');
    expect(legalScreen).toContain("'https://github.com/TheStreamCode/keysoft'");
    expect(legalScreen).toContain('/blob/main/TRADEMARKS.md');
  });
});

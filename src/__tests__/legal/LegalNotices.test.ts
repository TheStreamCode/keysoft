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

  it('keeps GitHub Sponsors reachable from the visible settings layout', () => {
    const settingsScreen = readRepositoryFile('src/screens/SettingsScreen.tsx');
    const visibleSettings = settingsScreen.split('style={styles.legacyScrollView}')[0];

    expect(visibleSettings).toContain("title={t('sponsor_github')}");
    expect(visibleSettings).toContain('https://github.com/sponsors/TheStreamCode');
  });

  it('keeps the in-app privacy notice aligned with current app behavior', () => {
    const privacyScreen = readRepositoryFile('src/screens/PrivacyPolicyScreen.tsx');
    const italian = readRepositoryFile('src/locales/it.ts');
    const english = readRepositoryFile('src/locales/en.ts');

    expect(privacyScreen).toContain('keysoft@mikesoft.it');
    expect(privacyScreen).not.toContain("const email = 'info@mikesoft.it'");
    expect(privacyScreen).not.toContain('new Date()');
    expect(privacyScreen).toContain("t('privacy_section12_5_title')");
    expect(privacyScreen).toContain("t('privacy_section12_6_title')");

    for (const translations of [italian, english]) {
      expect(translations).toContain('Expo Updates');
      expect(translations).toContain('Argon2id');
      expect(translations).toContain('PBKDF2');
      expect(translations).toContain('3.0.1');
    }

    expect(italian).toContain('token casuali');
    expect(italian).toContain('metriche di prestazione');
    expect(italian).toContain('22 luglio 2026');
    expect(english).toContain('randomized tokens');
    expect(english).toContain('performance metrics');
    expect(english).toContain('July 22, 2026');
  });
});

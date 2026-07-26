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
    const settingsScreen = readRepositoryFile('src/screens/SettingsScreen.tsx');
    const contactConstants = readRepositoryFile('src/constants/contact.ts');
    const italian = readRepositoryFile('src/locales/it.ts');
    const english = readRepositoryFile('src/locales/en.ts');

    // The contact details are defined once. Asserting that a screen merely mentions the
    // address would keep passing with a stale copy of it hardcoded in the markup, so the
    // constants are checked instead and every other file must go through them.
    expect(contactConstants).toContain("SUPPORT_EMAIL = 'keysoft@mikesoft.it'");
    expect(contactConstants).toContain("WEBSITE_HOST = 'www.mikesoft.it'");
    expect(privacyScreen).toContain("from '../constants/contact'");
    expect(settingsScreen).toContain("import { SUPPORT_EMAIL } from '../constants/contact'");
    for (const source of [privacyScreen, settingsScreen, italian, english]) {
      expect(source).not.toMatch(/mikesoft\.it/);
    }

    expect(privacyScreen).not.toContain('new Date()');
    expect(privacyScreen).toContain("t('privacy_section13_5_title')");
    expect(privacyScreen).toContain("t('privacy_section13_6_title')");

    // Section 9 covers data deletion and must stay present: the policy published on
    // mikesoft.it carries it. Google Play only mandates a deletion path for apps that
    // create accounts, which Keysoft does not, so this disclosure is voluntary and easy
    // to drop by accident.
    expect(privacyScreen).toContain("t('privacy_section9_title')");
    expect(privacyScreen).toContain("t('privacy_section9_method3_text')");

    for (const translations of [italian, english]) {
      expect(translations).toContain('Expo Updates');
      expect(translations).toContain('Argon2id');
      expect(translations).toContain('PBKDF2');

      // The document revision is deliberately decoupled from the app build, so that
      // shipping a release does not require editing the policy. Keep it that way.
      const documentVersion = /privacy_version_text:\s*'([^']*)'/.exec(translations)?.[1];
      expect(documentVersion).toBeTruthy();
      expect(documentVersion).not.toMatch(/\d+\.\d+\.\d+/);

      // Section numbering is rendered by PrivacyPolicyScreen from the order of its
      // heading list, which is what keeps inserting a section from renumbering both
      // locales; a number written back into a title would be printed twice.
      expect(translations).not.toMatch(/privacy_section[0-9_]*_title:\s*['"]\d/);
    }

    expect(italian).toContain('token casuali');
    expect(italian).toContain('metriche di prestazione');
    expect(italian).toContain('25 luglio 2026');
    expect(english).toContain('randomized tokens');
    expect(english).toContain('performance metrics');
    expect(english).toContain('July 25, 2026');
  });
});

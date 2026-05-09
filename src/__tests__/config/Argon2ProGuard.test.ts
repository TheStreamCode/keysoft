import fs from 'fs';
import path from 'path';

describe('Argon2 ProGuard config plugin', () => {
  it('keeps the Android package used by react-native-argon2 v4', () => {
    const pluginPath = path.join(__dirname, '..', '..', '..', 'plugins', 'withArgon2ProGuard.js');
    const pluginSource = fs.readFileSync(pluginPath, 'utf8');

    expect(pluginSource).toContain('-keep class com.poowf.argon2.** { *; }');
  });
});

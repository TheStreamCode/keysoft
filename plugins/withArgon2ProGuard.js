// Plugin: fix Argon2 ProGuard + replace deprecated jcenter() with mavenCentral()
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withArgon2ProGuard = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;

      // 1. Patch react-native-argon2 build.gradle: replace jcenter() with mavenCentral()
      const argon2BuildGradle = path.join(
        projectRoot,
        'node_modules',
        'react-native-argon2',
        'android',
        'build.gradle',
      );
      if (fs.existsSync(argon2BuildGradle)) {
        let content = fs.readFileSync(argon2BuildGradle, 'utf8');
        if (content.includes('jcenter()')) {
          content = content.replace(/jcenter\(\)/g, 'mavenCentral()');
          fs.writeFileSync(argon2BuildGradle, content, 'utf8');
        }
      }

      // 2. Add ProGuard rules for Argon2
      const androidAppDir = path.join(projectRoot, 'android', 'app');
      const proGuardFile = path.join(androidAppDir, 'proguard-rules.pro');

      if (fs.existsSync(androidAppDir)) {
        const rules = [
          '# Keep react-native-argon2 bridge and native Argon2 implementations',
          '-keep class com.poowf.argon2.** { *; }',
          '-keep class com.reactlibrary.** { *; }',
          '-keep class com.reactlibrary.argon2.** { *; }',
          '-keep class com.reactnativeargon2.** { *; }',
          '-keep class com.lambdapioneer.argon2kt.** { *; }',
          '-keep class de.mkammerer.argon2.** { *; }',
        ];
        const content = fs.existsSync(proGuardFile) ? fs.readFileSync(proGuardFile, 'utf8') : '';
        const missingRules = rules.filter((rule) => !content.includes(rule));

        if (missingRules.length > 0) {
          const prefix = content.endsWith('\n') || content.length === 0 ? '' : '\n';
          fs.appendFileSync(proGuardFile, `${prefix}\n${missingRules.join('\n')}\n`);
        }
      }

      return config;
    },
  ]);
};

module.exports = withArgon2ProGuard;

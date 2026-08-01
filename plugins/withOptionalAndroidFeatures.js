const { withAndroidManifest } = require('expo/config-plugins');

const OPTIONAL_ANDROID_FEATURES = [
  'android.hardware.camera',
  'android.hardware.camera.any',
  'android.hardware.camera.front',
  'android.hardware.camera.autofocus',
  'android.hardware.camera.flash',
  'android.hardware.fingerprint',
  'android.hardware.biometrics',
  'android.hardware.biometrics.face',
  'android.hardware.biometrics.iris',
];

function setOptionalAndroidFeatures(androidManifest) {
  const manifest = androidManifest.manifest;
  const features = manifest['uses-feature'] || [];

  for (const name of OPTIONAL_ANDROID_FEATURES) {
    const existing = features.find((feature) => feature.$?.['android:name'] === name);

    if (existing) {
      existing.$['android:required'] = 'false';
    } else {
      features.push({
        $: {
          'android:name': name,
          'android:required': 'false',
        },
      });
    }
  }

  manifest['uses-feature'] = features;
  return androidManifest;
}

const withOptionalAndroidFeatures = (config) =>
  withAndroidManifest(config, (config) => {
    config.modResults = setOptionalAndroidFeatures(config.modResults);
    return config;
  });

module.exports = withOptionalAndroidFeatures;
module.exports.OPTIONAL_ANDROID_FEATURES = OPTIONAL_ANDROID_FEATURES;
module.exports.setOptionalAndroidFeatures = setOptionalAndroidFeatures;

import appConfig from '../../../app.config.js';
import optionalAndroidFeaturesPlugin from '../../../plugins/withOptionalAndroidFeatures.js';

interface AndroidManifest {
  manifest: {
    'uses-feature'?: {
      $: Record<string, string>;
    }[];
  };
}

describe('Expo Android native configuration', () => {
  it('uses supported Expo build-properties fields', () => {
    const buildProperties = appConfig.plugins.find(
      (plugin: unknown) => Array.isArray(plugin) && plugin[0] === 'expo-build-properties',
    ) as
      | [
          string,
          {
            android: Record<string, boolean | number>;
          },
        ]
      | undefined;

    expect(buildProperties?.[1].android).toEqual({
      compileSdkVersion: 36,
      targetSdkVersion: 36,
      enableMinifyInReleaseBuilds: true,
      useLegacyPackaging: false,
    });
    expect(appConfig.android).not.toHaveProperty('compileSdkVersion');
    expect(appConfig.android).not.toHaveProperty('targetSdkVersion');
    expect(appConfig.android).not.toHaveProperty('usesFeature');
  });

  it('adds optional Android hardware features through a manifest plugin', () => {
    const { OPTIONAL_ANDROID_FEATURES, setOptionalAndroidFeatures } =
      optionalAndroidFeaturesPlugin as typeof optionalAndroidFeaturesPlugin & {
        OPTIONAL_ANDROID_FEATURES: string[];
        setOptionalAndroidFeatures: (manifest: AndroidManifest) => AndroidManifest;
      };
    const manifest: AndroidManifest = {
      manifest: {
        'uses-feature': [
          {
            $: {
              'android:name': 'android.hardware.camera',
              'android:required': 'true',
            },
          },
          {
            $: {
              'android:name': 'android.hardware.bluetooth',
              'android:required': 'true',
            },
          },
        ],
      },
    };

    const result = setOptionalAndroidFeatures(manifest);
    const features = result.manifest['uses-feature'] || [];

    for (const name of OPTIONAL_ANDROID_FEATURES) {
      expect(features).toContainEqual({
        $: {
          'android:name': name,
          'android:required': 'false',
        },
      });
    }
    expect(features).toContainEqual({
      $: {
        'android:name': 'android.hardware.bluetooth',
        'android:required': 'true',
      },
    });
  });
});

import androidReleaseOptimizationPlugin from '../../../plugins/withAndroidReleaseOptimization.js';

interface GradleProperty {
  type: 'comment' | 'empty' | 'property';
  key?: string;
  value?: string;
}

const plugin = androidReleaseOptimizationPlugin as typeof androidReleaseOptimizationPlugin & {
  OPTIMIZED_RESOURCE_SHRINKING_KEY: string;
  setGradleProperty: (properties: GradleProperty[], key: string, value: string) => GradleProperty[];
  useOptimizedProguardConfig: (contents: string) => string;
};

describe('Android release optimization config plugin', () => {
  it('uses the optimized default ProGuard configuration', () => {
    const source =
      'proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"';

    expect(plugin.useOptimizedProguardConfig(source)).toBe(
      'proguardFiles getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro"',
    );
  });

  it('is idempotent when the optimized configuration is already present', () => {
    const source =
      "proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'";

    expect(plugin.useOptimizedProguardConfig(source)).toBe(source);
  });

  it('fails loudly when the generated Gradle template is unexpected', () => {
    expect(() => plugin.useOptimizedProguardConfig('minifyEnabled true')).toThrow(
      'Unable to configure R8',
    );
  });

  it('sets optimized resource shrinking once and preserves other properties', () => {
    const properties: GradleProperty[] = [
      { type: 'comment', value: 'Build settings' },
      {
        type: 'property',
        key: plugin.OPTIMIZED_RESOURCE_SHRINKING_KEY,
        value: 'false',
      },
      { type: 'property', key: 'expo.useLegacyPackaging', value: 'false' },
      {
        type: 'property',
        key: plugin.OPTIMIZED_RESOURCE_SHRINKING_KEY,
        value: 'false',
      },
    ];

    const result = plugin.setGradleProperty(
      properties,
      plugin.OPTIMIZED_RESOURCE_SHRINKING_KEY,
      'true',
    );

    expect(result).toContainEqual({
      type: 'property',
      key: plugin.OPTIMIZED_RESOURCE_SHRINKING_KEY,
      value: 'true',
    });
    expect(result).toContainEqual({
      type: 'property',
      key: 'expo.useLegacyPackaging',
      value: 'false',
    });
    expect(
      result.filter((property) => property.key === plugin.OPTIMIZED_RESOURCE_SHRINKING_KEY),
    ).toHaveLength(1);
  });
});

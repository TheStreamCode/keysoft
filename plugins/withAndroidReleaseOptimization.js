const { withAppBuildGradle, withGradleProperties } = require('@expo/config-plugins');

const OPTIMIZED_RESOURCE_SHRINKING_KEY = 'android.r8.optimizedResourceShrinking';
const DEFAULT_PROGUARD_PATTERN = /getDefaultProguardFile\((['"])proguard-android\.txt\1\)/g;
const OPTIMIZED_PROGUARD_PATTERN =
  /getDefaultProguardFile\((['"])proguard-android-optimize\.txt\1\)/g;

function useOptimizedProguardConfig(contents) {
  const defaultMatches = contents.match(DEFAULT_PROGUARD_PATTERN) || [];
  const optimizedMatches = contents.match(OPTIMIZED_PROGUARD_PATTERN) || [];

  if (defaultMatches.length === 0 && optimizedMatches.length === 1) return contents;

  if (defaultMatches.length !== 1 || optimizedMatches.length !== 0) {
    throw new Error(
      'Unable to configure R8: expected exactly one default Android ProGuard configuration.',
    );
  }

  return contents.replace(
    DEFAULT_PROGUARD_PATTERN,
    (_match, quote) => `getDefaultProguardFile(${quote}proguard-android-optimize.txt${quote})`,
  );
}

function setGradleProperty(properties, key, value) {
  const result = [];
  let hasProperty = false;

  for (const property of properties) {
    if (property.type === 'property' && property.key === key) {
      if (!hasProperty) {
        result.push({ ...property, value });
        hasProperty = true;
      }
      continue;
    }

    result.push(property);
  }

  if (!hasProperty) result.push({ type: 'property', key, value });
  return result;
}

function withAndroidReleaseOptimization(config) {
  config = withAppBuildGradle(config, (gradleConfig) => {
    gradleConfig.modResults.contents = useOptimizedProguardConfig(gradleConfig.modResults.contents);
    return gradleConfig;
  });

  return withGradleProperties(config, (propertiesConfig) => {
    propertiesConfig.modResults = setGradleProperty(
      propertiesConfig.modResults,
      OPTIMIZED_RESOURCE_SHRINKING_KEY,
      'true',
    );
    return propertiesConfig;
  });
}

module.exports = withAndroidReleaseOptimization;
module.exports.OPTIMIZED_RESOURCE_SHRINKING_KEY = OPTIMIZED_RESOURCE_SHRINKING_KEY;
module.exports.setGradleProperty = setGradleProperty;
module.exports.useOptimizedProguardConfig = useOptimizedProguardConfig;

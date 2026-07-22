module.exports = {
  name: 'Keysoft',
  slug: 'keysoft',
  version: '3.0.1',
  scheme: 'keysoft',
  orientation: 'default', // Supports both portrait and landscape
  userInterfaceStyle: 'automatic',
  updates: {
    url: 'https://u.expo.dev/9d2d2679-63b2-47d7-bd9d-e620a2231f60',
  },
  runtimeVersion: {
    policy: 'appVersion',
  },
  icon: './assets/icon.png', // Original Keysoft shield icon
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#FFFFFF',
    dark: {
      image: './assets/splash-icon.png',
      backgroundColor: '#161826',
    },
  },
  assetBundlePatterns: ['**/*'],
  // ios: {
  //   supportsTablet: true,
  //   bundleIdentifier: "it.mikesoft.keysoft",
  //   buildNumber: "1",
  //   infoPlist: {
  //     NSFaceIDUsageDescription: "This app uses Face ID to protect access to your passwords",
  //   },
  // },
  ios: {
    supportsTablet: true, // Explicit iPad support
    bundleIdentifier: 'it.mikesoft.keysoft',
    buildNumber: '1',
    infoPlist: {
      NSFaceIDUsageDescription: 'This app uses Face ID to protect access to your passwords',
      UIRequiresFullScreen: false, // Allows Split View and Slide Over on iPad
    },
    privacyManifests: {
      NSPrivacyTracking: false,
      NSPrivacyCollectedDataTypes: [],
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
          NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
        },
      ],
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#FFFFFF',
    },
    package: 'it.mikesoft.keysoft',
    versionCode: 125,
    permissions: [
      'INTERNET',
      'USE_BIOMETRIC',
      'USE_FINGERPRINT',
      'CAMERA',
      'POST_NOTIFICATIONS',
      'VIBRATE',
    ],
    // Block unnecessary permissions that may be added automatically
    blockedPermissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.READ_MEDIA_VIDEO',
    ],
    allowBackup: false,
    // Support multiple screen sizes
    resizeableActivity: true, // Supporta multi-window mode su Android
    // Explicit tablet and TV support
    supportsTablet: true,
    // Android TV configuration
    isTVExperiment: false, // Not a TV-first app, but compatible
    // Intent filters per deep linking
    intentFilters: [
      {
        action: 'VIEW',
        data: {
          scheme: 'keysoft',
        },
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
    // Android 15: Edge-to-edge configuration
    // Use expo-system-ui to manage StatusBar and NavigationBar
    // and avoid deprecated Android APIs
    softwareKeyboardLayoutMode: 'pan',
    // 16 KB page size support (Android 15)
    // Required for compatibility with newer devices
    // enableNativePageSize16KB: true,
  },
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
    eas: {
      projectId: '9d2d2679-63b2-47d7-bd9d-e620a2231f60',
    },
  },
  plugins: [
    'expo-asset',
    'expo-status-bar',
    'expo-font',
    [
      'expo-build-properties',
      {
        android: {
          // Target Android 16 (API 36) stable.
          compileSdkVersion: 36,
          targetSdkVersion: 36,
          enableMinifyInReleaseBuilds: true,
          useLegacyPackaging: false,
        },
      },
    ],
    [
      'expo-local-authentication',
      {
        faceIDPermission:
          "Consenti a Keysoft di utilizzare Face ID per proteggere l'accesso alle tue password.",
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission:
          "L'app accede alle foto solo per permetterti di scegliere un'immagine del profilo personale.",
      },
    ],
    'expo-localization',
    'expo-system-ui',
    [
      'expo-navigation-bar',
      {
        enforceContrast: false,
      },
    ],
    'expo-secure-store',
    'expo-sharing',
    './plugins/withOptionalAndroidFeatures.js',
    './plugins/withArgon2ProGuard.js',
  ],
  extra: {
    eas: {
      projectId: '9d2d2679-63b2-47d7-bd9d-e620a2231f60',
    },
  },
  platforms: ['ios', 'android', 'web'],
  // scheme: "keysoft"
};

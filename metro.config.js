// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

let config = getDefaultConfig(__dirname);

// Custom asset extensions; ensure 'ksx' and 'txt' are present
// and remove duplicates if getDefaultConfig already includes them.
const defaultAssetExts = config.resolver.assetExts;
config.resolver.assetExts = [
  ...defaultAssetExts.filter((ext) => ext !== 'ksx' && ext !== 'txt'),
  'ksx',
  'txt',
];

// Transformer configuration
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
});

// Alias configuration
const nanoidMockPath = path.resolve(__dirname, 'src/utils/nanoidMock.js');

config.resolver = config.resolver || {};
config.resolver.alias = {
  ...(config.resolver.alias || {}),
  'nanoid/non-secure': nanoidMockPath,
};

module.exports = config;

module.exports = function (api) {
  api.cache(true);

  // Base plugins required in every environment
  const plugins = [
    [
      'module-resolver',
      {
        root: ['./'],
        alias: {
          '@': './src',
          '@components': './src/components',
          '@contexts': './src/contexts',
          '@constants': './src/constants',
          '@hooks': './src/hooks',
          '@models': './src/models',
          '@navigation': './src/navigation',
          '@screens': './src/screens',
          '@services': './src/services',
          '@utils': './src/utils',
        },
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
      },
    ],
    '@babel/plugin-transform-export-namespace-from',
    'react-native-reanimated/plugin', // Necessario per Reanimated (DEVE essere ultimo)
  ];

  return {
    presets: ['babel-preset-expo'],
    plugins,
  };
};

// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // Apostrophes in React Native <Text> are not HTML entities.
    rules: { 'react/no-unescaped-entities': 'off' },
  },
]);

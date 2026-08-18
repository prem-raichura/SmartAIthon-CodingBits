// Explicit config so debug and release builds transform identically. Relying on
// Metro's implicit babel-preset-expo fallback is where release-only breakage
// hides.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Must stay last.
    plugins: ['react-native-worklets/plugin'],
  };
};

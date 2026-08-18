// Explicit Metro config so bundling behaviour is pinned rather than inherited
// from Expo's defaults, which can shift between SDK versions.
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);

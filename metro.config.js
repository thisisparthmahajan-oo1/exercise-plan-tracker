// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// server/ is the sync backend (its own package and node_modules) — never
// part of the app bundle.
config.resolver.blockList = [
  ...[].concat(config.resolver.blockList ?? []),
  new RegExp(`^${__dirname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/server/.*`),
];

module.exports = config;

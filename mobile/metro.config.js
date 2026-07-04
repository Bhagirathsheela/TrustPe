// Canonical Expo monorepo Metro config (from https://docs.expo.dev/guides/monorepos/).
//
// Why each line matters:
// 1. watchFolders includes the whole repo so changes anywhere in the
//    workspace (e.g. shared/) hot-reload into the RN app.
// 2. nodeModulesPaths lists the EXACT two locations Metro is allowed to
//    resolve from: mobile/node_modules first, then root node_modules
//    (where Bun hoists shared dependencies).
// 3. disableHierarchicalLookup = true prevents Metro from walking up the
//    file tree. Without this, the same package (e.g. react) can be found
//    twice through different paths, producing the dreaded
//    "Invalid hook call ... more than one copy of React" runtime error.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

config.resolver.disableHierarchicalLookup = true;

module.exports = config;

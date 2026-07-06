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
// 4. unstable_enablePackageExports + unstable_conditionNames make Metro
//    respect the `react-native` condition in shared/package.json so it
//    picks the raw `.ts` source (while backend picks compiled `.js`).
// 5. resolveRequest rewrites relative `.js` imports to `.ts` — required
//    because shared/ source uses TypeScript's "NodeNext convention"
//    (source is `foo.ts`, imports say `./foo.js`, which compiles cleanly
//    but Metro's default resolver only looks for the literal `.js`).
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

config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = ['react-native', 'require', 'default'];

// Rewrite relative `.js` → `.ts` for TypeScript sources (Node's NodeNext
// convention). Only applies to relative imports; package imports are
// untouched.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('.') && moduleName.endsWith('.js')) {
    const tsName = moduleName.slice(0, -3) + '.ts';
    try {
      return context.resolveRequest(context, tsName, platform);
    } catch {
      // Fall through to try the literal .js — genuine compiled JS may
      // exist somewhere (e.g. inside node_modules dependencies).
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

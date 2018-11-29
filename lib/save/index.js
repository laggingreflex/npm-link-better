const utils = require('../utils');

module.exports = (argv) => {
  const deps = argv._;
  if (!deps.length) throw new Error(`'save' needs at least 1 dependency`);
  const dependencyTypes = ['dependencies', 'devDependencies', 'optionalDependencies', 'bundleDependencies', 'peerDependencies'];
  utils.linkDependency(deps, argv);
  const packageJson = utils.cwdPackageJson();
  const dependencyType =
    argv.saveDev ? 'devDependencies'
    : argv.saveOptional ? 'optionalDependencies'
    : argv.saveBundle ? 'bundleDependencies'
    : argv.savePeer ? 'peerDependencies'
    : 'dependencies';
  const rangeOperator = argv.saveExact ? '' : '^';
  packageJson[dependencyType] = packageJson[dependencyType] || {};
  const changes = [];
  for (const dep of deps) {
    const [{ name, version }] = utils.getDependencyPackageJson(dep);
    const override = { dependencyType, rangeOperator };
    let oldVersion = packageJson[override.dependencyType][name] || null;
    for (const dependencyType_ of dependencyTypes) {
      if (!packageJson[dependencyType_]) continue;
      if (packageJson[dependencyType_][name]) {
        oldVersion = packageJson[dependencyType_][name];
        delete packageJson[dependencyType_][name];
        if (dependencyType === 'dependencies') {
          override.dependencyType = dependencyType_;
        }
      }
    }
    const newVersion = packageJson[override.dependencyType][name] = override.rangeOperator + version;
    const versionChanged = oldVersion !== newVersion;
    const dependencyTypeChanged = override.dependencyType !== dependencyType;
    if (versionChanged || dependencyTypeChanged) {
      changes.push({ ...override, name, versionChanged, oldVersion, newVersion, dependencyTypeChanged });
    }
    packageJson[override.dependencyType] = utils.sortKeys(packageJson[override.dependencyType]);
  }
  utils.modifyJson('package.json', packageJson, { backup: false });
};

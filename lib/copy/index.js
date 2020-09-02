const Path = require('path')
const fs = require('fs-extra');
const watch = require('node-watch');
const utils = require('../utils');

module.exports = (argv) => {
  const deps = argv._;
  if (!deps.length) throw new Error(`'copy' needs at least 1 dependency`);
  return Promise.all(deps.map(dep => copy(dep, argv)));
}

async function copy(dep, argv) {
  let sourceDir, destinationDir;
  if (utils.isDependencyRelative(dep)) {
    sourceDir = Path.join(utils.cwd, dep);
    const [{ name }] = utils.getDependencyPackageJson(dep);
    utils.createBin(dep, argv);
    destinationDir = Path.join('node_modules', name);
  } else {
    const prefixPath = utils.exec('npm config get prefix').replace(/[\n\r]+/, '').trim();
    const globalModulesPath = Path.join(prefixPath, 'node_modules');
    sourceDir = Path.join(globalModulesPath, dep);
    destinationDir = Path.join('node_modules', dep);
  }

  await fs.remove(destinationDir);
  await fs.ensureDir(destinationDir);
  await fs.copy(sourceDir, destinationDir, { dereference: true, filter });
  console.log(`Copied ${sourceDir} -> ${destinationDir}`);
  const filterChanges = c => c.filter((f0, index, self) => self.findIndex(f1 => f1[1] === f0[1]) === index);
  const adjustWatchChanges = fn => changes => filterChanges(changes).filter(Boolean).map(([, f]) => fn(f));

  if (!argv.watch) return;
  watch(sourceDir, { recursive: true }, utils.debounce(adjustWatchChanges(async source => {
    let filename;
    try {
      filename = Path.relative(sourceDir, source);
      const destination = Path.join(destinationDir, filename);
      if (filter(source)) {
        if (await fs.pathExists(source)) {
          await fs.copy(source, destination, { filter });
          console.log(`Updated ${source} -> ${destination}`);
        } else {
          await fs.remove(destination);
          console.log(`Removed ${destination}`);
        }
      }
    } catch (error) {
      console.error(error, { sourceDir, filename, destinationDir });
    }
  }), 100));


  function filter(file) {
    const relative = Path.relative(sourceDir, file);
    if (relative.includes('node_modules') || relative.includes('.git')) {
      if (argv.verbose) console.log('Skipped', relative);
      return false;
    } else {
      return true;
    }
  }
}

const Path = require('path')
const fs = require('fs-extra');
const utils = require('../utils')

module.exports = (argv) => {
  const deps = argv._;
  if (!deps.length) throw new Error(`'copy' needs at least 1 dependency`);
  return Promise.all(deps.map(dep => copy(dep, argv)));
}

async function copy(dep, argv) {
  let sourceDir;
  if (utils.isDependencyRelative(dep)) {
    console.log('TBD');
  } else {
    sourceDir = Path.join(utils.getPrefix(), 'node_modules', dep);
    const destinationDir = Path.join('node_modules', dep);
    await fs.remove(destinationDir);
    await fs.ensureDir(destinationDir);
    await fs.copy(sourceDir, destinationDir, { dereference: true, filter });
    console.log(`Copied ${sourceDir} -> ${destinationDir}`);
    const filterChanges = c => c.filter((f0, index, self) => self.findIndex(f1 => f1[1] === f0[1]) === index);
    const adjustWatchChanges = fn => changes => filterChanges(changes).map(([, f]) => fn(f));
    fs.watch(sourceDir, { recursive: true }, utils.debounce(adjustWatchChanges(async filename => {
      try {
        const source = Path.join(sourceDir, filename);
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
        console.log(error);
      }
    }), 100));
  }

  function filter(file) {
    const relative = Path.relative(sourceDir, file);
    if (relative.includes('node_modules') || relative.includes('.git')) {
      console.log('Skipped', relative);
      return false;
    } else {
      return true;
    }
  }
}
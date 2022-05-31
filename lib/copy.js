const Path = require('path')
const fs = require('fs-extra');
const watch = require('node-watch');
const utils = require('./utils');
const debug = require('debug')('npm-link-better:copy');

module.exports = (argv) => {
  const deps = argv._;
  if (!deps.length) throw new Error(`'copy' needs at least 1 dependency`);
  if (!Array.isArray(argv.exclude)) argv.exclude = [argv.exclude];
  argv.exclude = argv.exclude.map(e => {
    if (typeof e === typeof 'string') e = new RegExp(e, 'i');
    return e;
  });
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
  console.log(`Copied ${destinationDir} <- ${sourceDir}`);
  const filterChanges = c => c.filter((f0, index, self) => self.findIndex(f1 => f1[1] === f0[1]) === index);
  const adjustWatchChanges = fn => changes => filterChanges(changes).filter(Boolean).map(([, f]) => fn(f));

  if (!argv.watch) return;
  watch(sourceDir, { recursive: true }, utils.debounce(adjustWatchChanges(async source => {
    let filename;
    try {
      filename = Path.relative(sourceDir, source);
      if (!filename) return // throw new Error(`Empty file: '${source}'`);
      const destination = Path.join(destinationDir, filename);
      if (filter(source)) {
        if (await fs.pathExists(source)) {
          await fs.copy(source, destination, { filter });
          console.log(`Updated ${destination} <- ${source}`);
        } else {
          await fs.remove(destination);
          console.log(`Removed ${destination}`);
        }
      }
    } catch (error) {
      debug({ source, sourceDir, filename, destinationDir });
      console.error(error.message);
    }
  }), 100));


  function filter(file) {
    const relative = Path.relative(sourceDir, file);
    if (!file || !relative) {
      debug(`Excluded '${file}' because its falsey`);
      return false;
    }
    for (const exclude of argv.exclude) {
      const match = exclude.test(relative);
      if (match) {
        debug(`Excluded '${relative}' because it matched '${exclude}'`);
        return false;
      }
    }
    return true;
  }
}

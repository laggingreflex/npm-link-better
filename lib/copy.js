const Path = require('path');
const fs = require('fs-extra');
const watch = require('node-watch');
const utils = require('./utils');
const debug = require('debug')('npm-link-better:copy');

module.exports = (argv) => {
  const deps = argv._;
  if (!deps.length) throw new Error(`'copy' needs at least 1 dependency`);
  if (!Array.isArray(argv.exclude)) argv.exclude = [argv.exclude];
  argv.exclude = argv.exclude.map((e) => {
    if (typeof e === typeof 'string') e = new RegExp(e, 'i');
    return e;
  });
  return Promise.all(deps.map((dep) => copy(dep, argv)));
};

async function copy(dep, argv) {
  let sourceDir, destinationDir;
  if (utils.isDependencyRelative(dep)) {
    sourceDir = Path.join(utils.cwd, dep);
    const [{ name }] = utils.getDependencyPackageJson(dep);
    try {
      utils.createBin(dep, argv);
    } catch (error) {
      console.warn(`WARN: Couldn't create bin link`, error.message);
    }
    destinationDir = Path.join('node_modules', name);
  } else {
    const prefixPath = utils
      .exec('npm config get prefix')
      .replace(/[\n\r]+/, '')
      .trim();
    const globalModulesPath = Path.join(prefixPath, 'node_modules');
    sourceDir = Path.join(globalModulesPath, dep);
    destinationDir = Path.join('node_modules', dep);
  }

  if (!(await fs.exists(sourceDir))) {
    throw new Error(`Source doesn't exist: '${sourceDir}'`);
  }

  // const { push, restore, discard } = utils.multiRestorer();
  if (await fs.exists(destinationDir)) {
    // push(await utils.backup(destinationDir));
    await fs.remove(destinationDir);
  }

  await fs.ensureDir(destinationDir);

  try {
    await fs.copy(sourceDir, destinationDir, { dereference: true, filter });
  } catch (error) {
    // await restore();
    throw error;
  }

  console.log(
    `[${utils.getTime()}] Copied ${logRelPath(destinationDir, sourceDir)}`
  );
  const filterChanges = (c) =>
    c.filter(
      (f0, index, self) => self.findIndex((f1) => f1[1] === f0[1]) === index
    );
  const adjustWatchChanges = (fn) => (changes) =>
    filterChanges(changes)
      .filter(Boolean)
      .map(([, f]) => fn(f));

  if (!argv.watch) return;
  const retries = argv.retries || 3;
  watch(
    sourceDir,
    { recursive: true },
    utils.debounce(
      adjustWatchChanges((s) => onChange(s, { retries })),
      100
    )
  );

  function filter(file) {
    const relative = Path.relative(sourceDir, file);
    if (!relative) return true; // it's probably a folder at root
    for (const exclude of argv.exclude) {
      const match = exclude.test(relative);
      if (match) {
        debug(`Excluded '${relative}' because it matched '${exclude}'`);
        return false;
      }
    }
    return true;
  }

  async function onChange(source, { retries = 3 } = {}) {
    // console.debug('onChange', { rest, this: this });
    let filename;
    const now = Date.now();
    try {
      filename = Path.relative(sourceDir, source);
      // if (!filename) return // throw new Error(`Empty file: '${source}'`);
      const destination = Path.join(destinationDir, filename);
      if (filter(source)) {
        if (await fs.pathExists(source)) {
          // const [conte]
          if (await utils.compareFiles(source, destination)) {
            console.log(
              `[${utils.getTime()}] Skipped ${logRelPath(
                destination,
                source
              )} (same content)`
            );
          } else {
            await fs.copy(source, destination, { filter });
            // log(`Updated ${destination} <- ${source}`);
            console.log(
              `[${utils.getTime()}] Updated ${logRelPath(destination, source)}`
            );
          }
        } else {
          await fs.remove(destination);
          console.log(`[${utils.getTime()}] Removed ${destination}`);
        }
      }
    } catch (error) {
      debug({ source, sourceDir, filename, destinationDir });
      console.error(error);
      if (retries && retries > 0) {
        setTimeout(() => {
          onChange(source, { retries: retries - 1 });
        }, 100);
      } else {
        console.error(
          `Couldn't copy file: '${utils.shortString(source)}'. ${error.message}`
        );
      }
    }
  }
}

function logRelPath(a, b) {
  return utils.pathDiff(a, b, { dir: '<-', short: utils.screenWidth / 2 });
}

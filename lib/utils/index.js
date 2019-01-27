const os = require('os');
const Path = require('path');
const { spawnSync, execSync } = require('child_process');
const fs = require('fs-extra');
const yargs = require('yargs');

const utils = exports;

utils.debounce = require('debounce-queue');

/** @type {Boolean} */
utils.isWin = os.platform() === 'win32';

/** @type {string} */
utils.npmExecutable = utils.isWin ? 'npm.cmd' : 'npm';

/** @type {string} */
utils.cwd = process.cwd();

/** @type {function} Does nothing */
const noop = utils.noop = () => {};

/** @returns {object} */
utils.cwdPackageJson = () => fs.readJsonSync('package.json');

/** @extends {Error} */
class utilsError extends Error {};
utils.Error = utilsError;

/**
 * Logs the Error and sets an exitCode
 * @param {Error|utilsError} error
 */
utils.catch = error => {
  console.error(error instanceof utils.Error ? error.message : error.stack);
  process.exitCode = process.exitCode || error.exitCode || 1;
};


/**
 * Returns yargs.(…).argv
 * @param {object} [opts] Merged with argv
 */
utils.argv = (opts) => {
  const argv = yargs.options({
    cwd: { default: process.cwd() },
    copy: { type: 'boolean', alias: ['c'] },
    quick: { type: 'boolean', alias: ['q'] },
    save: { type: 'boolean', alias: ['s', 'production', 'prod', 'P'] },
    saveDev: { type: 'boolean', alias: ['development', 'dev', 'D'] },
    saveOptional: { type: 'boolean', alias: ['optional', 'O'] },
    saveBundle: { type: 'boolean', alias: ['bundle', 'B'] },
    savePeer: { type: 'boolean', alias: ['peer'] },
    saveExact: { type: 'boolean', alias: ['exact', 'E'] },
    direct: { type: 'boolean' },
    zelda: { type: 'boolean', alias: ['z'] },
  }).argv;
  return Object.assign(argv, opts);
}


/**
 * Function to restore backed up file
 * @callback restorer
 * @param {boolean} [halt=false]
 * @returns {boolean} Returns `true` if successful or if `original` didn't exist. Throws if it fails and `halt=true` was provided, or logs the error to console and returns `false`
 */
/**
 * Backs up a file/dir
 * @param {string} original File or folder to backup
 * @returns {restorer}
 */
utils.backup = (original) => {
  let stats, backup;
  if (fs.existsSync(original)) {
    stats = fs.statSync(original);
    backup = original + '-backup';
    fs.renameSync(original, backup);
    console.log(`Backed up '${original}' -> ${backup}`);
  } else {
    console.log(`Doesn't exist: '${original}'`);
  }
  /** @type restore */
  return (halt) => {
    if (!backup) return true;
    try {
      if (fs.existsSync(original)) {
        if (stats.isDirectory()) {
          fs.rmdirSync(original);
        } else {
          fs.unlinkSync(original);
        }
        console.log(`Removed ${original}`);
      }
      fs.renameSync(backup, original);
      console.log(`Restored '${backup}' -> ${original}`);
      return true;
    } catch (error) {
      if (halt) throw error;
      console.error(`Couldn't restore '${backup}' -> ${original}. ${error.message}`);
      return false;
    }
  }
};


/**
 * Creates a {push, restore} tuple to facilitate multiple backups/restore ops easily
 */
utils.multiRestorer = () => {
  const restorers = [];
  /**
   * Stores {restorer} created by {backup}
   * @example push(backup('file.js'))
   * @param {restorer|noop} r
   */
  const push = r => { restorers.push(r) };
  /** @type {restorer} */
  const restore = (...args) => !restorers.map(r => r(...args)).includes(false);
  return { push, restore };
};

/**
 * Modifies a file
 * @param {string} filename
 * @param {string|function} data
 * @param {object} [modifyOpts]
 * @param {function} [modifyOpts.write=fs.writeFileSync]
 * @param {boolean} [modifyOpts.backup=true] Doesn't restore
 * @param {boolean} [modifyOpts.silent=false] Log
 * @return {restorer|noop}
 */
utils.modifyFile = (filename, data, { silent, write = fs.writeFileSync, backup = true } = {}) => {
  let _data;
  try {
    _data = fs.readFileSync(filename, 'utf8');
  } catch (error) {}
  const restore = backup ? utils.backup(filename) : utils.noop;
  try {
    if (typeof data === 'function') {
      data = data(_data);
    }
    write(filename, data);
    if (!silent) console.log(`Modified '${filename}'`);
    return restore;
  } catch (error) {
    restore();
    throw error;
  }
};

/**
 * Modifies a JSON file
 * @param {string} filename
 * @param {string|object|function} data
 * @param {object} [modifyOpts]
 * @return {restorer|noop}
 */
utils.modifyJson = (filename, data, modifyOpts) => {
  if (typeof data === 'function') {
    const _ = data;
    data = (str) => _(JSON.parse(str));
  }
  if (typeof data === 'object') {
    data = JSON.stringify(data, null, 2);
  }
  return utils.modifyFile(filename, data, {
    write: (filename, data) => fs.writeFileSync(filename, JSON.stringify(data, null, 2) + '\n'),
    ...modifyOpts,
  });
};

/**
 * @param {object} json
 * @param {Array<string>} keys
 * @return {object} json
 */
utils.removeKeys = (json, keys) => {
  const sansKeys = {}
  for (const key in json) {
    if (keys.includes(key)) continue;
    sansKeys[key] = json[key];
  }
  return sansKeys;
}


/**
 * Sort object by keys
 * @param {object} org
 * @param {(a: string, b: string) => number} [sorter]
 */
utils.sortKeys = (org, sorter) => {
  const modified = {};
  const keys = Object.keys(org).sort(...[sorter].filter(Boolean));
  for (const key of keys) {
    modified[key] = org[key];
  }
  return modified;
}



/**
 * Runs a command with `spawnSync`
 * @param {string} cmd
 * @param {Array<string>} [args]
 * @param {object} [opts]
 * @return {boolean} True = success, False = fail
 */
utils.runCmd = (cmd, args, opts) => {
  const logMeta = [cmd, ...args, opts.cwd && `(in '${opts.cwd}')`].filter(Boolean);
  console.log('Running:', ...logMeta);
  const { status } = spawnSync(cmd, args, { shell: true, stdio: 'inherit', ...opts });
  if (status) {
    console.error('Failed..', cmd, ...args);
    process.exitCode = status;
    return false;
  } else {
    console.log('Success!', ...logMeta);
    return true;
  }
}

/**
 * Runs `npm ...args`
 * @param {string} cmd
 * @param {object} [opts]
 */
utils.npm = (cmd, opts) => {
  return utils.runCmd(utils.npmExecutable, cmd.split(' '), opts);
}

/**
 * Runs `npm link ...deps`
 * @param {Array} deps
 */
utils.linkDependency = (deps, argv) => {
  const depsToLinkViaNpm = [];
  for (const dep of deps) {
    if (argv.direct !== false && dep.match(/[/\\.]/) && !dep.startsWith('@')) {
      const [target] = utils.getDependencyPath(dep);
      let [{ name, bin }] = utils.getDependencyPackageJson(dep);
      const path = Path.join('node_modules', name);
      fs.ensureDirSync(Path.dirname(path));
      if (argv.remove !== false) {
        fs.removeSync(path);
      }
      fs.symlinkSync(target, path, 'junction');
      console.log(path, '->', target);
      if (bin) {
        fs.ensureDirSync(Path.join('node_modules', '.bin'));
        if (typeof bin === 'string') bin = { ...{}, [name]: bin };
        for (const key in bin) {
          const binFile = bin[key];
          const link = Path.join('node_modules', '.bin', key);
          const target = Path.join('node_modules', name, binFile);
          if (argv.remove !== false) {
            fs.removeSync(link);
            fs.removeSync(link + '.cmd');
          }
          fs.symlinkSync(Path.join(utils.cwd, target), link);
          if (utils.isWin) {
            fs.writeFileSync(link + '.cmd', `@node %~dp0\\..\\..\\${target} %*`);
          }
          console.log(link, '->', target);
        }
      }
    } else {
      depsToLinkViaNpm.push(dep);
    }
  }
  if (depsToLinkViaNpm.length) {
    utils.npm('link', ...deps);
  }
};

/**
 * Get dependency's package.json
 * @param {...string} deps
 * @returns {Array<object>} paths
 */
utils.getDependencyPackageJson = (...deps) => deps.map(dep => {
  const [path] = utils.getDependencyPath(dep);
  return require(Path.join(path, 'package.json'));
});

/**
 * Get ./node_modules/{dependency} path
 * @param {...string} deps
 * @returns {Array<string>} paths
 */
utils.getDependencyNodeModulePath = (...deps) => deps.map(dep => Path.join(utils.cwd, 'node_modules', dep));


/**
 * Get Real Path of a dependency
 * @param {...string} deps
 * @returns {Array<string>} paths
 */
utils.getDependencyPath = (...deps) => deps.map(dep => {
  if (dep.match(/[/\\.]/) && !dep.startsWith('@')) {
    if (Path.isAbsolute(dep)) {
      return dep;
    } else {
      return Path.resolve(utils.cwd, dep);
    }
  } else {
    return Path.resolve(utils.cwd, 'node_modules', dep);
  }
});

/**
 * Get path/package.json etc. of a dependency
 * @param {...string} deps
 * @returns {Array<object>} paths
 */
utils.getDependencyData = (...deps) => deps.map(dep => ({
  dep,
  path: utils.getDependencyPath(dep)[0],
  packageJson: utils.getDependencyPackageJson(dep)[0],
}));

let __prefix;
utils.getPrefix = () => {
  return __prefix || (__prefix = execSync('npm config get prefix', { shell: true, encoding: 'utf8' }).replace(/[\n\r]+/g, '').trim());
}

utils.isDependencyRelative = dep => dep.match(/[/\\.]/) && !dep.startsWith('@');

// utils.unique = array => array.filter
utils.readDirs = dir => fs.readdirSync(dir).filter(dir => {
  if (dir === '.') return false;
  if (dir === '..') return false;
  const stat = fs.statSync(dir);
  if (!stat.isDirectory()) return false;
  return true;
});

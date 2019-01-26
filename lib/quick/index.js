const Path = require('path')
const utils = require('../utils');

const deps = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies', 'scripts'];

module.exports = (argv) => {
  if (argv._.length) {
    return Promise.all(argv._.map(quick));
  } else if (argv.zelda) {
    const dirs = utils.readDirs(argv.cwd);
    return Promise.all(dirs.map(quick));
  } else {
    return quick(argv.cwd);
  }
};

function quick(dir = '', { silent }) {
  const file = p => Path.join(dir, p);
  const { push, restore } = utils.multiRestorer();
  const logMeta = ['npm-link-quick', dir];
  try {
    if (!silent) console.log('Running:', ...logMeta);
    push(utils.backup(file('node_modules')));
    push(utils.backup(file('package-lock.json')));
    push(utils.modifyJson(file('package.json'), packageJson => utils.removeKeys(packageJson, deps)));
    utils.npm('link', { cwd: dir });
    restore();
    if (!silent) console.log('Success!', ...logMeta);
  } catch (error) {
    if (!silent) console.error('Failed..', ...logMeta);
    restore();
    throw error;
  }
}

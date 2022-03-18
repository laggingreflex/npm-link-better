const Path = require('path')
const utils = require('./utils');

const deps = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies', 'scripts'];

module.exports = async argv => {
  let dirs;
  if (argv._.length) {
    dirs = argv._;
  } else if (argv.zelda) {
    dirs = utils.readDirs(argv.cwd);
  } else {
    dirs = [argv.cwd];
  }
  if (!dirs?.length) {
    console.error({ dirs });
    throw new Error('Need at least 1 dir(s)');
  }
  const isMulti = dirs.length > 1;
  const errors = [];
  if (isMulti) console.log(`Linking ${dirs.length} dirs...`);
  for (let i = 0; i < dirs.length; i++) {
    const dir = dirs[i];
    if (isMulti) console.log(`[${i+1}/${dirs.length}] ${dir}`)
    try {
      await quick(dir, argv)
    } catch (error) {
      if (!isMulti || (argv.halt !== false)) {
        if (isMulti) console.warn('Use --no-halt to continue on errors');
        throw error;
      } else errors.push({ i, dir, error });
    }
    if (isMulti) console.log('---');
  }
  if (errors.length) {
    for (let i = 0; i < errors.length; i++) {
      const { i: j, dir, error } = errors[i];
      console.error(`[${j+1}/${dirs.length}] Failed: "${dir}"`);
      console.error(error.message);
      console.log('---');
    }
    console.error(`Failed ${errors.length}/${dirs.length} dirs`);
  }
};

function quick(dir = '', { silent, force } = {}) {
  const file = p => Path.join(dir, p);
  const { push, restore } = utils.multiRestorer();
  const logMeta = ['npm-link-quick', dir];
  try {
    if (!silent) console.log('Running:', ...logMeta);
    push(utils.backup(file('node_modules')));
    push(utils.backup(file('package-lock.json')));
    push(utils.modifyJson(file('package.json'), packageJson => utils.removeKeys(packageJson, deps)));
    utils.npm('link', { cwd: dir, force });
    if (!silent) console.log('Success!', ...logMeta);
  } catch (error) {
    if (!silent) console.error('Failed:', ...logMeta);
    throw error;
  } finally {
    restore();
  }
}

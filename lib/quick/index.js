const utils = require('../utils');

module.exports = (argv) => {
  if (argv._.length) throw new Error(`'quick' doesn't take extra parameters: ${argv._.join(' ')}`);
  const { push, restore } = utils.multiRestorer();
  try {
    push(utils.backup('node_modules'));
    push(utils.backup('package-lock.json'));
    push(utils.modifyJson('package.json', utils.removeKeys(utils.cwdPackageJson(), ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies', 'scripts'])));
    utils.npm('link');
  } finally {
    restore();
  }
};

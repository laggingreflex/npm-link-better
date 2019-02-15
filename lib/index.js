const utils = require('./utils');
const copy = require('./copy');
const quick = require('./quick');
const save = require('./save');

module.exports = main;

async function main(opts) {
  const argv = utils.argv(opts);
  if (argv.copy) return copy(argv);
  else if (argv.quick) return quick(argv);
  else if (argv.save
    || argv.saveDev
    || argv.saveOptional
    || argv.saveBundle
    || argv.savePeer
    || argv.saveExact) return save(argv);
  else plain(argv);
}


function plain(argv) {
  /* todo: implement an env-like file (./npm-better-link.env) that links the listed dependencies */
  console.log('Please use --copy, --quick, or --save flag');
}

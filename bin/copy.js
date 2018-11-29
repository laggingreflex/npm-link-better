#!/usr/bin/env node

const Path = require('path');
const main = require('..');
const utils = require('../lib/utils');
try { main({ [Path.basename(__filename, Path.extname(__filename))]: true }).catch(utils.catch); } catch (error) { utils.catch(error); }

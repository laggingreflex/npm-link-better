#!/usr/bin/env node

const main = require('..');
const utils = require('../lib/utils');
try { main().catch(utils.catch); } catch (error) { utils.catch(error); }
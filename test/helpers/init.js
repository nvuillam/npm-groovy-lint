#! /usr/bin/env node
"use strict";

console.log('npm run test initialized');
// Activate debug log if we are in debug mode
const debug = typeof v8debug === 'object' || /--debug|--inspect|--inspect-brk/.test(process.execArgv.join(' '));
if (debug) {
    require('debug').enable('npm-groovy-lint')
}

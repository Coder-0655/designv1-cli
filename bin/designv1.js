#!/usr/bin/env node
'use strict';

require('../src/cli/index.js').main(process.argv).catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err?.stack || String(err));
  process.exitCode = 1;
});


#!/usr/bin/env node

const fs = require('fs');
const { join } = require('path');

/**
 *
 * @param {string} src
 * @param {string} dst
 */
function copyFiles(src, dst) {
  for (const entry of fs.readdirSync(src)) {
    if (fs.lstatSync(join(src, entry)).isDirectory()) {
      if (!fs.existsSync(join(dst, entry))) {
        fs.mkdirSync(join(dst, entry));
      }
      copyFiles(join(src, entry), join(dst, entry));
    }
    else {
      fs.copyFileSync(join(src, entry), join(dst, entry));
    }
  }
}

copyFiles(
  join(__dirname, '..', 'static'),
  join(__dirname, '..', 'dist', 'template')
);

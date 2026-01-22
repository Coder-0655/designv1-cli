'use strict';

const supportsColor = process.stdout.isTTY;

function wrap(code, text) {
  if (!supportsColor) return text;
  return `\u001b[${code}m${text}\u001b[0m`;
}

const color = {
  bold: (s) => wrap('1', s),
  dim: (s) => wrap('2', s),
  red: (s) => wrap('31', s),
  yellow: (s) => wrap('33', s),
  green: (s) => wrap('32', s),
  cyan: (s) => wrap('36', s),
};

module.exports = { color };


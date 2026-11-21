/** Clears prior evidence once per Jest run (separate process from tests). */
const fs = require('fs');
const path = require('path');

module.exports = async () => {
  const dir = path.resolve(__dirname, '../results');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, '.evidence.json'), '[]');
  fs.writeFileSync(path.join(dir, '.benchmarks.json'), '[]');
};

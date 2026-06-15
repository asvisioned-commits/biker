const fs = require('fs');
const path = require('path');

const patterns = [
  /TODO/i,
  /placeholder/i,
  /coming soon/i,
  /coming_soon/i
];

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.next') {
        results = results.concat(walk(fullPath));
      }
    } else {
      if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.json')) {
        results.push(fullPath);
      }
    }
  });
  return results;
}

const files = walk(path.join(__dirname, 'src'));
files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    patterns.forEach(pat => {
      if (pat.test(line)) {
        console.log(`${path.relative(__dirname, file)}:${idx + 1}: ${line.trim()}`);
      }
    });
  });
});

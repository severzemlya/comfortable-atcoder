const fs = require('node:fs');
const path = require('node:path');
const archiver = require('archiver');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const outputPath = path.join(rootDir, 'Release.zip');

const output = fs.createWriteStream(outputPath);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  console.log(`Created Release.zip (${archive.pointer()} bytes)`);
});

archive.on('error', error => {
  throw error;
});

archive.pipe(output);
archive.directory(distDir, 'dist');
archive.finalize();

const fs = require('node:fs/promises');
const path = require('node:path');
const esbuild = require('esbuild');
const less = require('less');

const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');
const distDir = path.join(rootDir, 'dist');
const watchMode = process.argv.includes('--watch');

async function walk(dir, fn) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(filePath, fn);
    } else {
      await fn(filePath);
    }
  }
}

function replaceExtension(filePath, extension) {
  return filePath.slice(0, -path.extname(filePath).length) + extension;
}

async function copyStaticFiles() {
  await walk(srcDir, async sourcePath => {
    if (['.ts', '.less', '.map'].includes(path.extname(sourcePath))) {
      return;
    }
    const outputPath = path.join(distDir, path.relative(srcDir, sourcePath));
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.copyFile(sourcePath, outputPath);
  });
}

async function compileLess() {
  await walk(srcDir, async sourcePath => {
    if (path.extname(sourcePath) !== '.less') {
      return;
    }
    const source = await fs.readFile(sourcePath, 'utf8');
    const result = await less.render(source, { filename: sourcePath });
    const relativeOutputPath = replaceExtension(path.relative(srcDir, sourcePath), '.css');
    const outputPath = path.join(distDir, relativeOutputPath);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, result.css);
  });
}

async function compileTypeScript() {
  const entryPoints = [];
  await walk(srcDir, async sourcePath => {
    if (path.extname(sourcePath) === '.ts') {
      entryPoints.push(sourcePath);
    }
  });
  await esbuild.build({
    entryPoints,
    outbase: srcDir,
    outdir: distDir,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2017',
    sourcemap: false,
    logLevel: 'info',
  });
}

async function build() {
  await fs.rm(distDir, { recursive: true, force: true });
  await fs.mkdir(distDir, { recursive: true });
  await copyStaticFiles();
  await compileLess();
  await compileTypeScript();
}

async function main() {
  await build();
  if (!watchMode) {
    return;
  }
  const { watch } = await import('chokidar');
  let pending = Promise.resolve();
  watch(srcDir, { ignoreInitial: true }).on('all', () => {
    pending = pending
      .then(build)
      .catch(error => {
        console.error(error);
        process.exitCode = 1;
      });
  });
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});

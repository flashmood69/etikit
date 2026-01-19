import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const buildDir = path.join(rootDir, 'build');
const srcDir = path.join(rootDir, 'src');

const isWindows = process.platform === 'win32';

function run(command, args, options = {}) {
  let actualCommand = command;
  let actualArgs = args;

  if (isWindows && (command === 'npm' || command === 'npx')) {
    actualCommand = 'cmd.exe';
    actualArgs = ['/c', command, ...args];
  }
    
  console.log(`> ${command} ${args.join(' ')}`);
  const result = spawnSync(actualCommand, actualArgs, { 
    stdio: 'inherit', 
    cwd: rootDir,
    ...options 
  });
  if (result.status !== 0) {
    console.error(`Command failed with exit code ${result.status}`);
    process.exit(1);
  }
  return result;
}

// 1. Ensure build directory exists
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir);
}

// 2. Build the React application
console.log('Building React application...');
run('npm', ['run', 'build']);

// 3. Prepare resources folder
const resourcesBuildDir = path.join(buildDir, 'resources');
if (fs.existsSync(resourcesBuildDir)) {
  fs.rmSync(resourcesBuildDir, { recursive: true, force: true });
}
fs.mkdirSync(resourcesBuildDir);

console.log('Copying static assets to resources...');
const distDir = path.join(rootDir, 'dist');
if (fs.existsSync(distDir)) {
  fs.cpSync(distDir, resourcesBuildDir, { recursive: true });
}

const rootResourcesDir = path.join(rootDir, 'resources');
if (fs.existsSync(rootResourcesDir)) {
  console.log('Copying root resources to build resources...');
  fs.cpSync(rootResourcesDir, resourcesBuildDir, { recursive: true });
}

// 4. Validate sea-config.json exists
const configPath = path.join(rootDir, 'sea-config.json');
if (!fs.existsSync(configPath)) {
  console.error('sea-config.json not found!');
  process.exit(1);
}
console.log('✓ SEA configuration validated');

// 5. Bundle the application source code
console.log('Bundling application...');
run('npx', [
  'esbuild',
  path.join(srcDir, 'index.js'),
  '--bundle',
  '--platform=node',
  '--format=cjs',
  '--outfile=' + path.join(buildDir, 'index.js'),
  '--external:node:*'
]);

// 6. Generate the SEA blob
console.log('Generating SEA blob...');
run('node', ['--experimental-sea-config', 'sea-config.json']);

// 7. Copy the Node.js executable
const exePath = path.join(buildDir, 'etikit.exe');
console.log(`Copying Node.exe to ${exePath}...`);
fs.copyFileSync(process.execPath, exePath);

// 8. Inject the blob into the executable
console.log('Injecting blob into executable...');
run('npx', [
  'postject',
  exePath,
  'NODE_SEA_BLOB',
  path.join(buildDir, 'sea-prep.blob'),
  '--sentinel-fuse',
  'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2',
  '--overwrite'
]);

// 9. Post-build verification
console.log('Verifying build...');
if (fs.existsSync(exePath)) {
  const stats = fs.statSync(exePath);
  console.log(`✓ Executable generated successfully: ${exePath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`✓ Resources folder prepared: ${resourcesBuildDir}`);
} else {
  console.error('× Executable generation failed!');
  process.exit(1);
}

console.log('\nBuild complete! You can run your application with: .\\build\\etikit.exe');

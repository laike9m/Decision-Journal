const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const APP_NAME = 'Decision Journal';
const distDir = path.join(__dirname, '..', 'node_modules', 'electron', 'dist');
const oldApp = path.join(distDir, 'Electron.app');
const newApp = path.join(distDir, `${APP_NAME}.app`);
const pathFile = path.join(__dirname, '..', 'node_modules', 'electron', 'path.txt');

// Only run on macOS
if (process.platform !== 'darwin') {
  console.log('Skipping Electron patch (not macOS)');
  process.exit(0);
}

// Determine the current .app path
let appPath;
if (fs.existsSync(newApp)) {
  console.log('Electron.app already renamed, patching Info.plist only...');
  appPath = newApp;
} else if (fs.existsSync(oldApp)) {
  // Rename the .app bundle
  fs.renameSync(oldApp, newApp);
  console.log(`Renamed Electron.app → ${APP_NAME}.app`);
  appPath = newApp;
} else {
  console.error('Could not find Electron.app or Decision Journal.app in dist/');
  process.exit(1);
}

// Rename the executable inside the .app
const oldExec = path.join(appPath, 'Contents', 'MacOS', 'Electron');
const newExec = path.join(appPath, 'Contents', 'MacOS', APP_NAME);

if (fs.existsSync(oldExec)) {
  fs.renameSync(oldExec, newExec);
  console.log(`Renamed executable: Electron → ${APP_NAME}`);
}

// Patch Info.plist
const plistPath = path.join(appPath, 'Contents', 'Info.plist');
execSync(`plutil -replace CFBundleDisplayName -string '${APP_NAME}' '${plistPath}'`);
execSync(`plutil -replace CFBundleName -string '${APP_NAME}' '${plistPath}'`);
execSync(`plutil -replace CFBundleExecutable -string '${APP_NAME}' '${plistPath}'`);
console.log('Patched Info.plist');

// Update path.txt so the electron module can find the renamed executable
fs.writeFileSync(pathFile, `${APP_NAME}.app/Contents/MacOS/${APP_NAME}`);
console.log('Updated path.txt');

console.log('✅ Electron patched for "Decision Journal"');

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const rootDir = __dirname;
const androidDir = path.join(rootDir, 'android');
const artifactDir = 'C:\\Users\\Seven Studio PC\\.gemini\\antigravity\\brain\\af05d85b-f68a-4b3c-9e33-43ff5a670734';
const javaHome = 'C:\\Users\\Seven Studio PC\\AppData\\Local\\Programs\\jdk-17\\jdk-17.0.12+7';
const androidSdk = 'C:\\Users\\Seven Studio PC\\AppData\\Local\\Android\\Sdk';

console.log('=== Step 1: Configuring Environment ===');
const env = {
  ...process.env,
  JAVA_HOME: javaHome,
  ANDROID_HOME: androidSdk,
  ANDROID_SDK_ROOT: androidSdk,
  BUILD_ANDROID: 'true',
  PATH: `${path.join(javaHome, 'bin')};${path.join(androidSdk, 'platform-tools')};${process.env.PATH}`
};

console.log('JAVA_HOME:', env.JAVA_HOME);
console.log('ANDROID_HOME:', env.ANDROID_HOME);

console.log('\n=== Step 2: Building Web App for Android (relative paths) ===');
execSync('cmd.exe /c "npx vite build"', { cwd: rootDir, env, stdio: 'inherit' });

if (!fs.existsSync(path.join(rootDir, 'dist', 'index.html'))) {
  throw new Error('dist/index.html not found after build!');
}
console.log('dist built successfully.');

console.log('\n=== Step 3: Capacitor Sync Android ===');
execSync('cmd.exe /c "npx cap sync android"', { cwd: rootDir, env, stdio: 'inherit' });

console.log('\n=== Step 4: Compiling Android Release APK with Gradle ===');
// Run gradlew.bat from the android directory
execSync('cmd.exe /c "gradlew.bat assembleRelease --stacktrace"', { cwd: androidDir, env, stdio: 'inherit' });

const generatedApkPath = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
if (!fs.existsSync(generatedApkPath)) {
  throw new Error(`Generated APK not found at ${generatedApkPath}`);
}

const stats = fs.statSync(generatedApkPath);
console.log(`\nGenerated APK found! Size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);

console.log('\n=== Step 5: Copying APK to Delivery Destinations ===');
const destWorkspace = path.join(rootDir, 'GaleriFotoQR-v1.0-release.apk');
fs.copyFileSync(generatedApkPath, destWorkspace);
console.log(`Copied to workspace: ${destWorkspace}`);

if (fs.existsSync(artifactDir)) {
  const destArtifact = path.join(artifactDir, 'GaleriFotoQR-v1.0-release.apk');
  fs.copyFileSync(generatedApkPath, destArtifact);
  console.log(`Copied to artifact directory: ${destArtifact}`);
}

const fileBuffer = fs.readFileSync(destWorkspace);
const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
console.log(`SHA-256: ${hash}`);
console.log('\n=== BUILD ANDROID RELEASE APK SUCCESSFUL! ===');

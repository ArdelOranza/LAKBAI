# LakbAI for Android

A Capacitor shell around the same web app. The APK ships the built bundle and
talks to the live API, so the UI is identical to `https://lakbai-app.onrender.com`.

- Package: `com.lakbai.app`
- Name: **LakbAI**
- Min Android: 7.0 (API 24), target: API 36

## Build prerequisites

- JDK 21 (`JAVA_HOME`)
- Android SDK with `platforms;android-36` and `build-tools;36.0.0` (`ANDROID_HOME`)
- Node 22+

## Build an APK

```powershell
# 1. Web bundle for the native shell (absolute API origin, no service worker)
cd client
$env:VITE_API_URL='https://lakbai-api.onrender.com'
$env:MOBILE_BUILD='1'
npm run build

# 2. Copy it into the Android project
cd ../mobile
npx cap sync android

# 3. Build
cd android
.\gradlew.bat assembleRelease   # signed if keystore.properties exists
.\gradlew.bat assembleDebug
```

Outputs land in `mobile/out/` when copied from
`android/app/build/outputs/apk/{release,debug}/`.

## Signing

`mobile/android/keystore.properties` and the `.jks` it points at are
**gitignored and must never be committed**. Without them the release build is
unsigned and cannot be installed.

```properties
storeFile=keystore/lakbai-release.jks
storePassword=…
keyAlias=lakbai
keyPassword=…
```

Keep this keystore safe: Android only accepts updates signed with the same key.

## App icon and splash

Generated from `client/public/pwa-512.png`:

```powershell
cd mobile
node scripts/make-assets.mjs
npx capacitor-assets generate --android
```

## Known limits of the native shell

- Google sign-in and Supabase email links build their redirect from
  `window.location.origin`, which is `https://localhost` inside the WebView.
  Email + password works; OAuth needs `https://localhost` added to the Supabase
  redirect allowlist (or a custom `com.lakbai.app://` scheme).
- The service worker is disabled for `MOBILE_BUILD=1`; assets are bundled in the
  APK, so the shell itself opens offline. API calls still need a connection.
- Rebuild and ship a new APK to update the bundled UI; the web deploy alone does
  not update installed apps.

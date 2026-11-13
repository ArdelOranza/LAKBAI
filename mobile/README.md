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

## Google sign-in (required one-time Supabase step)

Inside the APK, Google sign-in never leaves the app: the app asks Supabase for the
authorize URL, opens it in a **Chrome Custom Tab**, and Android hands the answer
back through the app's own scheme `com.lakbai.app://auth-callback`
(`android:scheme="com.lakbai.app"` / `android:host="auth-callback"` in
`AndroidManifest.xml`).

The same scheme is the `emailRedirectTo` for **sign-up confirmation, resend and
password-reset** links. The APK's WebView origin is `https://localhost`, which no
mail app can open; pointing those links at it signs the traveler into a browser
tab and leaves the app signed out.

That URL must be allowlisted, or Google's return lands on
"redirect_uri is not allowed" and email links go to the website instead:

1. Supabase dashboard → **Authentication → URL Configuration → Redirect URLs**.
2. Add `com.lakbai.app://auth-callback` and save.
3. Keep the web origins there too (`https://lakbai-app.onrender.com`,
   `http://localhost:5173/**`) — the website uses a normal same-origin redirect.
4. Set **Site URL** to `https://lakbai-app.onrender.com`.

A callback that fails after the Custom Tab closes now shows the reason as a toast
instead of dropping the traveler on the signed-out screens without a word.

## Version

Bump both `versionCode` / `versionName` in
`android/app/build.gradle` and the label next to the download row in
`client/src/screens/Profile.jsx` (a test asserts they agree).

## Shipped build

| | |
|---|---|
| Version | 1.2.0 (versionCode 3) |
| Size | 4,997,872 bytes |
| SHA-256 | `A7B235A3B63A527E54686C2CE86F334162FE729C19684B84DA21B7DBFB9DC386` |
| Signer | `CN=LakbAI, O=LakbAI, L=Lingayen, ST=Pangasinan, C=PH` |

The same file is served at `client/public/LakbAI.apk` and downloaded from the
Profile screen. Rebuild the mobile bundle from the shipping `client/dist` (step 1
above) before bumping this table, or installed apps keep the old UI.

## Known limits of the native shell

- Google sign-in and Supabase email links come back through
  `com.lakbai.app://auth-callback` (Custom Tab + deep link), so the website is
  never part of the flow. Allowlist that URL in Supabase (see above) or the tab
  shows "redirect not allowed".
- The service worker is disabled for `MOBILE_BUILD=1`; assets are bundled in the
  APK, so the shell itself opens offline. API calls still need a connection.
- Rebuild and ship a new APK to update the bundled UI; the web deploy alone does
  not update installed apps.

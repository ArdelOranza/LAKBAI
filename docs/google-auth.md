# Google sign-in setup

The app already has the Google buttons and calls
`supabase.auth.signInWithOAuth({ provider: 'google' })`. Two dashboard settings
still have to be switched on before the button can leave the app.

## 1. Google Cloud Console

1. Create (or reuse) a project at <https://console.cloud.google.com/>.
2. **APIs & Services → OAuth consent screen** — finish the basic form.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**.
   - Application type: **Web application**
   - Authorized JavaScript origins:
     - `http://localhost:5180`
     - your deployed origin, when there is one
   - Authorized redirect URI:
     - `https://khtqzqewnogjwoyshyiq.supabase.co/auth/v1/callback`
4. Copy the **Client ID** and **Client secret**.

## 2. Supabase Dashboard

1. **Authentication → Providers → Google** → enable it.
2. Paste the Client ID and Client secret, save.
3. **Authentication → URL Configuration**
   - Site URL: `http://localhost:5180`
   - Redirect URLs: `http://localhost:5180/**` (add the deployed URL later)

## 3. Test

Open <http://localhost:5180>, tap **Continue with Google** on the intro, Log In
or Sign Up screen. After choosing an account you come back to the app already
signed in.

If the provider is still off, Supabase answers
`Unsupported provider: provider is not enabled`; the app turns that into
“Google sign-in isn’t available right now — use your email” instead of showing
the raw error.

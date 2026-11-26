# Expense Manager

A monthly family budget app (React Native + Expo, one codebase for iOS and Android) with a Supabase backend.

- Month tabs (Jan to Dec), with a Money out list and a Money in list
- Tap the round check on a Money out item to strike it off once it's paid
- Totals update automatically: Money in, Money out, paid so far, and what's left over (shown as a gentle message, never a red number)
- Separate pie chart screen for the month
- Sign in, family households with a shared code, and an animal avatar for every member
- Live sync between family phones

## 1. Set up Supabase (free plan is enough)

1. Open your project: https://supabase.com/dashboard/project/hfzufkllhkvhlxnkrjoo
2. SQL Editor > New query > paste all of `supabase/schema.sql` > Run.
3. (Newer projects only) the schema file already includes the grants; if the app shows a permission error, run `supabase/fix-grants.sql` too.
4. Authentication > Sign In / Providers > Email. For the easiest family setup, turn off "Confirm email". If you leave it on, new users confirm by email before their first sign-in; the app handles both.
5. Project Settings > API Keys. Copy the Project URL and the anon / publishable key. Never put the service_role key in the app.

## 2. Run the app

```bash
npm install
cp .env.example .env      # then paste your anon key into .env
npx expo start
```

Scan the QR code with Expo Go (iOS or Android).

## 3. Build installable apps

```bash
npx eas-cli@latest login
npx eas-cli@latest build:configure
npx eas-cli@latest build -p android --profile preview   # APK you can share with family
npx eas-cli@latest build -p ios --profile production    # needs a paid Apple Developer account
```

Set the two `EXPO_PUBLIC_SUPABASE_*` values as EAS environment variables so the cloud build can see them (`.env` isn't committed).

## Project layout

- `src/app` screens (Expo Router): `auth`, `setup`, `index` (budget), `chart`, `household`
- `src/components` UI pieces, animals, motion
- `src/context/AuthContext.tsx` sign in, household and profile loading
- `src/lib/useItems.ts` list data, live updates, copy from last month
- `supabase/schema.sql` tables, security rules, and helper functions

## Swap in your logo

Replace the body of `src/components/Logo.tsx` with an `<Image>` of your logo. It's used on sign in and sign up.

## Update 2: bills, shopping list, actual vs planned, month summary

1. Install the reminders package (and add it to `plugins` in `app.json`):
   `npx expo install expo-notifications`
   If npm complains about peer dependencies, use `npm install expo-notifications --legacy-peer-deps`.
2. Run `supabase/migration-002-features.sql` once in the Supabase SQL Editor.
3. Restart `npx expo start`.

What's new
- **Bills** (bell icon): monthly bills with a due day and reminders. They create themselves in the budget every month. Phone reminders need the installed app or a development build; on web the screen works but reminders don't fire.
- **Shopping list** (cart icon): shared list by category, "Buy again" suggestions, and "Done shopping" adds what you spent to a budget line as actual spent.
- **Actual vs planned**: Money out items have an optional "Actual spent". The difference shows on the row.
- **Month summary and last-month comparison**: at the bottom of the chart screen.

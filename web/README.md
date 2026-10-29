# EASpaze Web

The community-first Next.js + TypeScript web app for building, testing, sharing, and exploring trading strategies.

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the landing page.

## Checks

```bash
npm run lint
npm run build
```

The landing page introduces the four-step Strategy Builder (Entry, Manage, Exit, Protection), community strategy discovery, the Build / Test / Run / Share flow, verified performance context, and creator profiles. Strategy and creator cards currently use clearly labeled illustrative content; they are not connected to live trading data.

## Accounts and private strategies

1. Create a Supabase project and apply `supabase/migrations/20261029000000_strategies.sql` to that project using the Supabase migration workflow. The migration enables row-level security for private strategies.
2. Copy `.env.example` to `.env.local` and set the project URL and **publishable** key. Never expose a secret or service-role key to the browser. Set the same public variables for the desired Vercel environments.
3. In Supabase Auth URL configuration, allow the intended `/account` redirect for each local or hosted origin used for email confirmation. Keep email confirmation enabled as appropriate.
4. Restart or redeploy the app after changing environment variables.

Account sign-in and private strategy storage use Supabase from client components. Until configured, the account pages show a setup message and local draft storage remains available. A browser draft is one local copy; account strategies are separate records. The EA Engine must independently validate strategy configuration before using it.

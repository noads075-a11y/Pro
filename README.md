# CaptionPro

A production-ready, static Vercel site for generating Instagram captions, Reel hooks, and hashtags with OpenAI. Users can create a Supabase account to keep a private cloud history of their generations.

## Project layout

- `index.html` — accessible application shell, landing page, dialogs, and dashboard markup.
- `styles.css` — responsive design system and layouts for mobile through desktop.
- `app.js` — client-side UI components, Supabase Auth, history, copy/download/share controls, and form state.
- `api/generate.js` — server-only OpenAI generation endpoint.
- `api/config.js` — supplies the browser with only the Supabase URL and public/anon key.
- `supabase.sql` — table, constraints, row-level security policies, and index.

## Local development

```bash
npm install
npm run check
npm start
```

`npm start` uses the Vercel CLI through `npx`; add the environment variables below to your local Vercel environment or deployment settings. Never commit a real `.env` file.

## Required environment variables

Configure these in Vercel for each environment (Production, Preview, and Development):

- `OPENAI_API_KEY` — OpenAI server secret. **Do not put this in frontend code.**
- `OPENAI_MODEL` — a model that is available to your OpenAI API project.
- `SUPABASE_URL` — Supabase project URL.
- `SUPABASE_ANON_KEY` — Supabase public/anon key.

For compatibility, the app also recognizes `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` as fallbacks on the server. The public Supabase key may be sent to the browser only because the database uses Row Level Security. Never expose a Supabase service-role/secret key.

## Supabase setup

1. In Supabase, enable Email Auth and configure the site URL / redirect URL for your deployed domain.
2. Run `supabase.sql` in **Dashboard → SQL Editor**. The script can be safely rerun; it refreshes the application policies and constraints.
3. Verify the `captions` table has Row Level Security enabled before deploying.

## Deployment

Deploy to Vercel after setting the environment variables. `/api/config` should return JSON with `url` and `anonKey`; it must never return the OpenAI key. Test sign-up, email confirmation, generation, and history deletion against the deployed URL.

## Operational notes

The generator is intentionally available before sign-in, while signed-in users receive saved history. Before opening a public high-traffic service, configure Vercel-level rate limiting/bot protection and monitor OpenAI usage to protect against automated cost abuse.

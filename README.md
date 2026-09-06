# AI Instagram Caption Generator Pro

Features:
- Real OpenAI caption generation via `/api/generate`
- Email/password Login & Signup with Supabase Auth
- User dashboard
- Cloud caption history per user
- Delete history items
- Favorites/save, copy, share
- Responsive professional UI

## Vercel setup

Add these Environment Variables for **Production**:

- `OPENAI_API_KEY` = your OpenAI secret key
- `OPENAI_MODEL` = a model available to your OpenAI API project
- `SUPABASE_URL` = your Supabase project URL
- `SUPABASE_ANON_KEY` = your Supabase anon/public key

The app also supports Supabase's current public names as a fallback:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

The public Supabase publishable key is safe for browser use when Row Level Security is configured correctly. Never expose an OpenAI API key or a Supabase service-role/secret key in browser code.

## Supabase database

Run `supabase.sql` in Supabase Dashboard → SQL Editor.

## Deploy

After changing Environment Variables, create a new Vercel deployment. Then open `/api/config` on the deployed site; it should return JSON containing `url` and `anonKey`.


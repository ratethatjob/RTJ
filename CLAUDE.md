@AGENTS.md

# RateThatJob.com

Product & technical spec: @SPEC.md
Project background (Hungarian): docs/osszefoglalo.md · Brand sheet: docs/brand-sheet.webp

## Stack
Next.js (App Router, `cacheComponents`) + TypeScript, Tailwind CSS v4, next-intl, Supabase, Vercel.

- Routing: all pages live under `app/[locale]/`. English at the root, Hungarian under `/hu` (`localePrefix: "as-needed"`, see `i18n/routing.ts`). `proxy.ts` handles locale negotiation.
- UI copy: never hard-code strings – add them to `messages/en.json` and `messages/hu.json`.
- Brand tokens: `app/globals.css` (`signal`, `ink`, `paper`, `slate`, `mist`, `tracking-brand`, `tracking-tagline`). Never use `signal` green as text on a light background.
- Brand files: `public/brand/` (logo on light/dark, icon, app icon).
- Supabase clients: `lib/supabase/server.ts`, `lib/supabase/client.ts`. Env vars: `.env.example`.

## Working with the founder
- Communicates in Hungarian, short and direct. Product and UI copy are in English (and Hungarian translations), mobile first.
- Do only what is asked; don't add extras or offer unrequested work.
- No unsolicited legal/regulatory warnings.

## Commands
- `npm run dev` · `npm run build` · `npm run lint`

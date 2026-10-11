# Teendők (később)

## Beállítások, amiket neked kell elvégezni
- [x] Admin jog: automatikus, az első belépéskor a dev@ratethatjob.com admin lesz (trigger)
- [ ] Vercel → rtj-k9pn → Settings → Environment Variables, utána Redeploy:
  - `ANTHROPIC_API_KEY` (gépi fordítás)
  - `SUPABASE_SECRET_KEY` (Supabase → RTJ → Project Settings → API Keys → secret)
  - `CRON_SECRET` (tetszőleges hosszú véletlen szöveg)
- [ ] Google Places: Google Cloud Console → új projekt → „Places API (New)” bekapcsolása → API kulcs (API restrictions: csak Places API (New)) → Vercelen `GOOGLE_PLACES_API_KEY`, utána Redeploy. A `SUPABASE_SECRET_KEY` is kell hozzá. A kód kész, a kulccsal azonnal működik.
- [ ] Vercel: `POSTGRES_URL_NON_POOLING` (RTJ adatbázis kapcsolat), hogy a migrációk minden buildnél automatikusan lefussanak
- [x] Supabase Auth: Site URL = https://ratethatjob.com, Redirect URL-ek beállítva (rtj-k9pn.vercel.app, ratethatjob.com, www, preview, localhost); saját SMTP a Resenden (no-reply@ratethatjob.com), a Magic link és a Confirm sign up sablonban benne a {{ .Token }} kód (EN+HU)
- [ ] Belépési szolgáltatók: Apple, Google, Facebook
- [x] Domain: ratethatjob.com él a Vercelen, a www 308-cal a fő címre visz (GoDaddy @ A rekord → 216.198.79.1)
- [ ] Régi Vercel projekt („rtj”) és a supabase-cyan-kettle Supabase projekt törlése

- [x] Üzemeltető: ABOVO JOBS MENA L.L.C-FZ beírva (`lib/site-config.ts`). (TRN: 105494925800001, irányadó jog: DIFC).
- [x] Álláscsomag árak: `JOB_PRICING` (`lib/site-config.ts`) – jóváhagyva: 4 990 / 14 990 / 29 990 Ft, 19 / 49 / 99 EUR
- [x] `RESEND_API_KEY` a Vercelen, újraépítve (`EMAIL_FROM` nem kötelező, alapból no-reply@ratethatjob.com)
- [ ] Jogi szövegek átnézése: `content/legal/` (ÁSZF, adatvédelem, sütik, impresszum – HU és EN). Az adatfeldolgozók (Stripe, Resend, Anthropic jelentkezés-összefoglaló) felvéve

- [ ] Élesítés előtt: demó adatok törlése (admin → Demó adatok → „Minden demó adat törlése”, vagy `select private.purge_demo();`)

## Fejlesztés
- [x] E-mailes meghívók (Resend): beillesztés / CSV, EN/HU sablon, egy emlékeztető 5 nap után (napi cron), titkosított címek, leiratkozás
- [ ] Stripe: Pro előfizetés (helyszínenként, havi/éves; most 30 nap próba, utána `plan_orders` + kézi számla, admin „Előfizetések” fül) és álláscsomagok fizetése (most `job_orders` + kézi számla) – kulcsok kellenek

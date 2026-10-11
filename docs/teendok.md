# Teendők (később)

## Beállítások, amiket neked kell elvégezni
- [x] Admin jog: automatikus, az első belépéskor a dev@ratethatjob.com admin lesz (trigger)
- [x] Vercel (production): `ANTHROPIC_API_KEY`, `SUPABASE_SECRET_KEY`, `CRON_SECRET` beállítva
- [ ] Google Places (nem kötelező: kulcs nélkül OpenStreetMap-alapú keresés fut): Google Cloud Console → új projekt → „Places API (New)” bekapcsolása → API kulcs (API restrictions: csak Places API (New)) → Vercelen `GOOGLE_PLACES_API_KEY`, utána Redeploy. A `SUPABASE_SECRET_KEY` is kell hozzá. A kód kész, a kulccsal azonnal működik.
- [ ] Vercel: `POSTGRES_URL_NON_POOLING` (RTJ adatbázis kapcsolat), hogy a migrációk minden buildnél automatikusan lefussanak
- [x] Supabase Auth: Site URL = https://ratethatjob.com, Redirect URL-ek beállítva (rtj-k9pn.vercel.app, ratethatjob.com, www, preview, localhost); saját SMTP a Resenden (no-reply@ratethatjob.com), a Magic link és a Confirm sign up sablonban benne a {{ .Token }} kód (EN+HU)
- [ ] Később: külső belépési szolgáltatók (Google, Facebook, Apple) a Supabase-ben, majd visszakapcsolás az `AUTH_PROVIDERS` listával (`lib/site-config.ts`). Most mindenhol csak e-mailes kód.
- [x] Domain: ratethatjob.com él a Vercelen, a www 308-cal a fő címre visz (GoDaddy @ A rekord → 216.198.79.1)
- [ ] Régi Vercel projekt („rtj”) és a supabase-cyan-kettle Supabase projekt törlése

- [x] Üzemeltető: ABOVO JOBS MENA L.L.C-FZ beírva (`lib/site-config.ts`). (TRN: 105494925800001, irányadó jog: DIFC).
- [x] Álláscsomag árak: `JOB_PRICING` (`lib/site-config.ts`) – jóváhagyva: 4 990 / 14 990 / 29 990 Ft, 19 / 49 / 99 EUR
- [x] `RESEND_API_KEY` a Vercelen, újraépítve (`EMAIL_FROM` nem kötelező, alapból no-reply@ratethatjob.com)
- [ ] Jogi szövegek átnézése: `content/legal/` (ÁSZF, adatvédelem, sütik, impresszum – HU és EN). Az adatfeldolgozók (Stripe, Resend, Anthropic jelentkezés-összefoglaló) felvéve

- [ ] Élesítés előtt: demó adatok törlése (admin → Demó adatok → „Minden demó adat törlése”, vagy `select private.purge_demo();`)

## Fejlesztés
- [x] E-mailes meghívók (Resend): beillesztés / CSV, EN/HU sablon, egy emlékeztető 5 nap után (napi cron), titkosított címek, leiratkozás
- [x] Stripe: Pro előfizetés telephelyenként (Checkout, havi/éves, HUF/EUR, a próba végén első terhelés), Customer Portal, álláscsomagok egyszeri fizetése, webhook. Kulcsok a Vercelen (production)
- [x] Stripe webhook: a https://ratethatjob.com/api/stripe/webhook végponton bejelölve: checkout.session.completed, checkout.session.async_payment_succeeded, invoice.paid, invoice.payment_failed, customer.subscription.created, customer.subscription.updated, customer.subscription.deleted
- [ ] Stripe webhook (fordított ÁFA): ugyanitt még bejelölendő: customer.updated, customer.tax_id.created, customer.tax_id.updated, customer.tax_id.deleted
- [ ] Fordított ÁFA: első vásárlásnál (új vevő) a Checkout a számlát a fizetéskor véglegesíti, mielőtt a webhook beállítja a „reverse”/„exempt” státuszt – ilyenkor az első számlán nem lesz „Reverse charge” jelölés (a Dashboardban beállított lábléc rajta van). Visszatérő vevőnél és az előfizetés megújításainál már helyes. Könyvelővel egyeztetni, hogy ez így elég-e
- [ ] Stripe Tax (automatic_tax) szándékosan nincs bekapcsolva (fizetős)
- [ ] `20261012040000_payment_failed_notice.sql` lefuttatása (sikertelen fizetés értesítés az alkalmazásban; addig csak e-mail megy)
- [ ] ÁSZF 5a. pont (Fizetés) és a Pro megújítás/lemondás/visszatérítés szabályai átnézése (`content/legal/terms.*.md`)
- [ ] Stripe Dashboardon: cégadatok a számlán (név, cím, adószám), számlák e-mailben küldése (Settings → Customer emails), sikertelen fizetésnél újrapróbálás (Settings → Billing → Retries)
- [ ] Stripe Dashboard – előfizetések (lásd a lépéseket a chatben): Smart Retries és a végső lépés (lemondás), Stripe saját vevői e-mailjei közül a nálunk is meglévők kikapcsolása (sikertelen fizetés, közelgő megújulás), hogy ne menjen dupla e-mail
- [ ] Customer Portal: a kódunk saját portálkonfigurációt használ (metadata rtj=v2: lemondás az időszak végén, havi↔éves váltás, kártyacsere, számlák, adószám) – a Dashboard alapértelmezett portál-beállításai erre nem hatnak
- [ ] Telephely törlése vagy más szervezethez kerülése futó előfizetés mellett: az előfizetést a napi cron azonnal lemondja (visszatérítés nélkül) – ha visszatérítés kell, kézzel a Stripe Dashboardon


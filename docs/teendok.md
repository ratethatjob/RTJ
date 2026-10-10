# Teendők (később)

## Beállítások, amiket neked kell elvégezni
- [ ] Admin jog: belépés után az RTJ Supabase projektben (SQL Editor):
      `insert into public.admins (user_id) select id from auth.users where email = 'dev@ratethatjob.com';`
- [ ] Vercel → rtj-k9pn → Settings → Environment Variables, utána Redeploy:
  - `ANTHROPIC_API_KEY` (gépi fordítás)
  - `SUPABASE_SECRET_KEY` (Supabase → RTJ → Project Settings → API Keys → secret)
  - `CRON_SECRET` (tetszőleges hosszú véletlen szöveg)
- [ ] Vercel: `POSTGRES_URL_NON_POOLING` (RTJ adatbázis kapcsolat), hogy a migrációk minden buildnél automatikusan lefussanak
- [ ] Supabase Auth: Site URL és Redirect URL-ek (rtj-k9pn.vercel.app, később ratethatjob.com), e-mail sablonban `{{ .Token }}` a belépőkódhoz
- [ ] Belépési szolgáltatók: Apple, Google, Facebook, SMS (Twilio), TikTok
- [ ] Domain: ratethatjob.com bekötése a Vercelre, `NEXT_PUBLIC_SITE_URL`
- [ ] Régi Vercel projekt („rtj”) és a supabase-cyan-kettle Supabase projekt törlése

## Fejlesztés
- [ ] E-mail/SMS meghívók (Resend, Twilio) – kulcsok kellenek
- [ ] Stripe előfizetés (Pro helyszínenként, havi/éves) – kulcsok kellenek
- [ ] Google Places: helyszínek betöltése, címkiegészítés – kulcs kell
- [ ] ÁSZF és adatvédelmi oldal (szöveg kell)

# Google Search Console és Bing Webmaster Tools – beállítás

A domain: `ratethatjob.com` (DNS a GoDaddynál). A sitemap: `https://ratethatjob.com/sitemap.xml`
(ez egy index: alatta van a statikus oldalak, állások, cégek, városok listája és a munkahelyek listája,
magyar és angol párokkal).

## 1. Google Search Console (domain szintű tulajdon)

1. Nyisd meg: https://search.google.com/search-console → bejelentkezés a céges Google-fiókkal.
2. Bal felső legördülő → **Tulajdon hozzáadása** → a bal oldali **Domain** dobozba írd:
   `ratethatjob.com` (https:// és www nélkül) → **Folytatás**.
3. A Google kiír egy TXT rekordot, pl. `google-site-verification=AbC123…` → **Másold ki**.
   Hagyd nyitva ezt az ablakot.
4. Új fülön: https://dcc.godaddy.com/control/portfolio → a `ratethatjob.com` mellett **DNS**.
5. **Új rekord hozzáadása**:
   - Típus: **TXT**
   - Név (Host): `@`
   - Érték: a kimásolt `google-site-verification=…` szöveg
   - TTL: alapértelmezett (1 óra) → **Mentés**.
   A meglévő rekordokat (A, CNAME, MX, más TXT) ne töröld, ne módosítsd.
6. Vissza a Search Console fülre → **Ellenőrzés**. Ha „nem található”, várj 10–30 percet és nyomd
   újra (ritkán pár óra).
7. Sitemap beküldése: bal menü **Webhelytérképek** → „Új webhelytérkép hozzáadása” mezőbe:
   `sitemap.xml` → **Küldés**. Pár perc múlva „Sikeres” állapotot és a felfedezett oldalak számát mutatja.
8. Ellenőrzés egy oldalra: felül a keresőmezőbe illessz be egy URL-t (pl. egy munkahely oldalát) →
   **URL-ellenőrzés** → **Élő URL tesztelése**, majd ha kell: **Indexelés kérése**.
9. Hasznos menük később: **Oldalak** (mi van indexelve, mi nincs és miért), **Teljesítmény**
   (kattintások, keresőszavak), **Fejlesztések / Állásajánlatok, Morzsamenük** (a strukturált adatok).

Strukturált adatok külön is tesztelhetők: https://search.google.com/test/rich-results (URL beillesztése).

## 2. Bing Webmaster Tools

A legegyszerűbb: importálás a Google Search Console-ból (az 1. pont után).

1. https://www.bing.com/webmasters → bejelentkezés (Microsoft-, Google- vagy Facebook-fiók).
2. **Import your sites from GSC** → **Import** → engedélyezd a Google-fiók hozzáférését → jelöld be a
   `ratethatjob.com`-ot → **Import**. Ilyenkor nem kell külön DNS rekord, és a sitemap is átjön.

Ha inkább DNS-sel:

1. **Add your site manually** → `https://ratethatjob.com` → **Add**.
2. Válaszd a **DNS** (CNAME) módszert. A Bing egy CNAME rekordot ad, pl.:
   - Név (Host): egy hosszú kód, pl. `1a2b3c4d5e…`
   - Érték (Points to): `verify.bing.com`
3. GoDaddy → `ratethatjob.com` → **DNS** → **Új rekord**: Típus **CNAME**, Név = a Bing kódja,
   Érték = `verify.bing.com`, TTL alapértelmezett → **Mentés**.
4. Vissza a Binghez → **Verify** (ha nem megy, 10–30 perc múlva újra).
5. Bal menü **Sitemaps** → **Submit sitemap** → `https://ratethatjob.com/sitemap.xml` → **Submit**.
6. (Opcionális) **URL Submission** / **IndexNow**: egyes URL-ek azonnali beküldése.

## 3. Megosztási előnézet ellenőrzése

- Facebook / LinkedIn: https://developers.facebook.com/tools/debug/ és
  https://www.linkedin.com/post-inspector/ → URL beillesztése → **Debug / Inspect**. Ha régi képet
  mutat: **Scrape Again**.
- X (Twitter): a Card Validator megszűnt; egy piszkozat bejegyzésbe illesztett link mutatja az
  előnézetet.

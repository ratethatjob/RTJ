# RateThatJob.com – projekt-összefoglaló (átadáshoz)

> Ez a dokumentum egy korábbi Claude-beszélgetés összefoglalója, a munkáltató-értékelő ötlet felmerülésétől a mai állapotig (2026. október 9–10.). Célja, hogy egy új beszélgetés onnan folytathassa, ahol tartunk. A technikai specifikáció külön fájlban van: **RateThatJob-SPEC.md**.

---

## 1. Az ötlet

Munkáltató-értékelő weboldal, ahol a felhasználó beírja, hova menne dolgozni (pl. „Joe's Pizzeria, 46th Street”), és látja, mit lehet róla tudni. A lényeg:

- **Telephelyszintű** értékelés, nem csak cégszintű (a konkrét bolt, a konkrét műszakvezető számít).
- Elsősorban **kékgalléros / órabéres / frontline** munka (vendéglátás, kiskereskedelem, raktár, gyár), de irodai munkahelyek és startupok is beférnek.
- A cégek **claimelhetik** a profiljukat (a Spotify for Artists mintájára).
- Hosszabb távon **állásfeltöltés és könnyű, CV-mentes jelentkezés** is ugyanezen az oldalon (ABOVO-szerű logika).
- Az alapító (Gábor) **egyedül** akarja építeni, Claude Code-dal / Lovable-lel, és csak PMF után fejlesztene „rendesen”, akkor vonna be tőkét.

## 2. Piac és pozicionálás

- Meglévő szereplők: Glassdoor (claimelhető céges profil már van benne), Indeed céges értékelések (a Glassdoor működését tudomásunk szerint 2025-ben az Indeedbe olvasztották), Kununu (DACH), Comparably, Blind. Ezek nagyvállalat- és irodai fókuszúak; egy kis helyi üzletről alig van adat, és nem telephelyszintűek. A Google Maps-értékelés telephelyszintű, de a vásárlóké.
- Magyarországon nem találtunk erős helyi dolgozói értékelő platformot, csak munkáltatói rangsorokat.
- Gábor személyes megfigyelése: startupvezetőként soha nem nézte meg a Glassdoort → a rés a startupoknál is szélesebb lehet, mint feltételeztük. Fontos különbség: az számít, hogy a **jelöltek** használják-e.
- Döntés: **Magyarország a tesztpiac** (nincs erős helyi szereplő, nyilvános cégjegyzék, kicsi piac), szűk szelettel indítva (javaslat: budapesti vendéglátás). A nagy bevétel az USA-ban vagy egy nagy uniós piacon dől el.

## 3. Megkülönböztetők („ne Glassdoor 2.0 legyen, hanem pain killer”)

A Glassdoor gyengéi (képernyőképek alapján): hosszú esszék, évekre visszanyúló átlag, elhomályosított tartalom „give-to-get” fallal, kékgallérosnak értelmetlen mezők (CEO approval, business outlook).

A jelöltnek:
- **Ghosting-mutató:** hány jelentkező kapott választ, mennyi idő alatt, hány kör (a jelentkezési funkcióval később automatikusan mérhető).
- **Bérvalóság:** annyit fizettek-e, amennyit ígértek; időben jött-e; kifizették-e a túlórát.
- **Beosztásvalóság:** megkapta-e az ígért órákat, mennyire előre derült ki a beosztás.
- **Telephely- és vezetőszint.**
- **Egyperces értékelés** (kattintós kérdések, a szöveg opcionális).
- **Friss pontszám** (utolsó 12 hónap), nem örök átlag.
- **Nincs fizetőfal** az olvasáshoz.

A munkáltatónak (aki fizet):
- **Korai figyelmeztetés** telephelyenként/vezetőnként, ha romlik a hangulat.
- **Javítható pontszám:** ha a friss értékelések javulnak, a pontszám helyreáll.
- **Versenytárs-összevetés.**
- Hangulatmérés különösen a **20–200 fős, több telephelyes** cégeknél értékes (nincs HR-osztály, a tulajdonos nem lát bele minden üzletbe).

## 4. Értékelők, fiók, névtelenség

- **Minden értékelőnek legyen fiókja**, de egy kattintással: Apple, Google, Facebook, TikTok, e-mail (jelszó nélkül, kóddal) vagy telefonszám.
- Megjelenő név: **generált névtelen név** (pl. „Quiet Oak 42”, újragenerálható) vagy saját felhasználónév.
- A fiók a dolgozóé, nem a cégé: munkahelyváltáskor viszi magával.
- Közzététel időzítése: azonnal / késleltetve / **csak a kilépés után**.
- Névtelenség: a cég soha nem látja, ki írt és ki válaszolt egy meghívóra; összesített szám csak **5 válasz felett**; kis telephelyen késleltetett, csoportos megjelenítés.

## 5. Igazolás és visszaélés elleni védelem

- Többszintű: nem igazolt / dokumentummal igazolt / céges meghívóval igazolt / (később) jelentkezésből igazolt. Az igazolatlan értékelés is megjelenik, de kisebb súllyal.
- **Elvetett irányok (Gábor döntése):** helyszíni QR-bejelentkezés („senki nem fogja kitenni”), saját rendszeres igazolás az elején, hivatalos állami lekérdezés („engedélyköteles és bonyolult”).
- **Elfogadott:** dokumentumfeltöltés (bérjegyzék, szerződés, munkáltatói igazolás, kitakarható), ellenőrzés kézzel, később AI-val.
- **Hely ↔ jogi entitás probléma:** „Joe's Pizzeria” valójában „Valami Trade LLC”. Megoldás: külön kezelt hely és jogi entitás, kapcsolótábla; az összerendelés dokumentumokból (2–3 független megerősítés), nyilvános nyilvántartásokból (DBA, alkoholengedély, cégjegyzék, nyugtán a cégnév) és a claimből jön.
- Csalásfigyelés: új fiókokból jövő hullám, azonos eszköz/IP; a cég vitathatja az igazolatlan értékelést, de nem törölheti.

## 6. Céges meghívó (dolgozók értékelésre hívása)

- A cég CSV-t tölt fel vagy egyenként ad hozzá dolgozókat (név opcionális, **bármilyen e-mail**, magáncím is jó), plusz megosztható link. SMS-es meghívó nincs.
- A meghívásos értékelés automatikusan igazolt, de „cég által meghívott” jelölést kap, és a profilon látszik a meghívó/értékelés arány (szelekciós torzítás ellen).
- A pozitív értékeléseket aktívan kell kérni (a negatívak maguktól jönnek) – erre való a meghívó.

## 7. Üzleti modell és árazás

- **Claim ingyenes** (bizalom: ne tűnjön úgy, hogy a cég megveszi az értékeléseit; plusz terjedés). Ingyen: profil átvétele, alapadatok, válasz az értékelésekre.
- **Előfizetés telephelyenként** (a létszámról hazudnának, a telephely nyilvános és nem eltitkolható; a nem fizetett telephely alap profillal marad). Céges fiókon belül telephelyek, szerepkörök: Owner, HR, Location manager.
- Pro funkciók: korai figyelmeztetés, dolgozói meghívók, statisztikák, testreszabott profil, konkurens ajánlók eltávolítása, **RateThatJob Index** widget.
- **Lánc csomag 10+ telephelytől**, egyedi ár; egyszeri bevezetési díj csak itt.
- Kiinduló árak (tesztelendő): HU kb. **9 900–14 900 Ft/telephely/hó**, USA kb. **39–69 USD/telephely/hó**; havi díj, éves fizetésnél 2 hónap ingyen; aktiválási díj nincs.
- Realitás: a 10 fős kis cég többnyire nem fizet évi ~100 ezer Ft-ot hírnévkezelésért → nekik olcsó belépő szint (pl. 2 990–4 990 Ft/hó) vagy funkciónkénti díj; a fő bevétel a **20–200 fős cégek és láncok**.
- A kis cég viszont **hirdetésért** fizet → ezért fontos az állás + könnyű jelentkezés fázis: az értékelések hozzák a forgalmat és bizalmat, az állások a pénzt.
- **Sorrend:** először az értékelő oldal (tartalom + keresőforgalom), utána az állások (különben tyúk–tojás probléma).
- **Divattá tétel:** „Top Rated Employer” jelvény (4,0+ és legalább 10 igazolt értékelés az elmúlt 12 hónapban, évente megújítva) – a GPTW olcsó, demokratikus alternatívája; ha az első 50–100 helyi cég kiteszi, a többi követi. Kommunikáció: „a jó munkahely ma a legolcsóbb toborzási előny”.
- **Piacméret-számolás:** 10 M USD éves bevételhez ~50 USD/telephely/hó mellett kb. **17 000 fizető telephely** kell. Magyarország ehhez kicsi (gyakorlatilag az egész piacot meg kellene nyerni) → tesztpiac; USA-ban 1–2% penetráció, nehéz de elérhető. Plusz az állásfunkció második bevételi láb.

## 8. Név és domain

- Elvetett névjelöltek (Gábor visszajelzése alapján): Melo („proli”), Jobba („parasztos”), beallok („drogos áthallás”), Felveszunk/Kezdhetsz („szarok”), Workgo/Workandgo („go” utazós áthallás), RateYourShift/ShiftRated („shift” túl gig/műszak jellegű, állandó dolgozóknak nem jó), RateMyJobs (foglalt).
- Foglalt .com-ok (ellenőrizve): RateMyShift, RateMyWork, RateMyEmployer, RateMyWorkplace (eladó), RateMyManager, RateMyCrew, JobsRated, RateYourBoss, RateYourManager, RateYourWorkplace, RateYourEmployer, JobRated, ReviewMyJob, BossRated, RateYourJobs, WorkRated, RateYourJob, ShiftScore, WorkedThere, iWorkedThere, WorkerTruth, CrewRated.
- Szabadnak tűnt a lekérdezéskor (vásárlás előtt ellenőrizni!): RateYourWork, **RateThatJob**, EmployerRated, WorkplaceRated, **WorkReviewed**, HonestWorkplace, TheJobTruth.
- **Döntés: RateThatJob.com** (fő márka), **WorkReviewed.com** tartaléknak/átirányításnak javasolt.
- Magyar névjelölt korábbról: munkaba.com (a gyári/alkalmi munka irányhoz merült fel).

## 9. Arculat

- Szómárka: **RateThatJob.com** – a „.com” a márka része, vékonyabb, visszafogott színnel.
- Szlogen: **Know before you go**.
- Ikon: zöld szóbuborék sötét pipával (C változat). Elvetve: helyjelölő tű csillaggal („GTA copy”), csillag a szóban („gagyi”).
- Betű: **Archivo** (Google Fonts) – Black 900 a névhez (betűköz −3%), Medium 500 a .com-hoz és szöveghez, szlogen csupa nagybetű +16% betűközzel.
- Színek: Signal Green `#3DDC97`, Ink `#14161A`, Paper `#F4F2EE`, Slate `#4A4F57`, Mist `#B5BAC1`. Zöld szöveg világos háttéren nem (kontraszt).

## 10. Funkciótérkép (értékelési rendszer) – röviden

1. Fiók és belépés (egy kattintás, generált név, privát munkahely-történet, törlés/export)
2. Belépési pontok (keresés, céges meghívó link, „Értékeld” gomb, hiányzó hely felvétele)
3. Értékelés 1 perc alatt, 3 lépésben (kapcsolat típusa és időszak, pozíció, állandó/alkalmi; 5 pontszám; tények igen/nem; jelentkezői kérdések; opcionális szöveg bármilyen nyelven; közzététel időzítése)
4. Igazolás (szintek, dokumentum, hely–entitás összerendelés, súlyozás)
5. Névtelenség védelme (5-ös küszöb, késleltetés)
6. Céges meghívó (CSV/kézi/link, e-mail, emlékeztető, arány a profilon)
7. Moderálás (automatikus szűrés, csalásfigyelés, vitatás, jelentés)
8. Megjelenítés (friss pontszám, tények %, ghosting-mutató, szűrők, céges válasz)
9. Visszatérés (értesítés, frissítés, „hasznos”)

**Nyelvesítés az első perctől:** EN és HU induláskor; az értékelések és a céges válaszok automatikus fordítása „Show original” opcióval – fontos funkció.

## 11. Technikai irány

- Első verzió vibe-codinggal (Lovable vagy Claude Code), rendes fejlesztés PMF után.
- **Figyelmeztetés:** az értékelő oldal a Google-keresésből él; a Lovable alapból kliensoldali React SPA-t készít, ami rosszul indexelődik → SSR/előrenderelés kell már az MVP-ben. A specben ezért Next.js (SSR/ISR) + Supabase + Vercel szerepel.
- URL-ek: `ratethatjob.com/{ceg}` és `ratethatjob.com/{ceg}/{telephely}`, foglalt szavak listája, 301-es átirányítás, `/hu/` nyelvi előtag hreflanggal, EmployerAggregateRating strukturált adat.
- **PMF-jelek:** igazolt értékelések/hó fizetett hirdetés nélkül a kiválasztott szegmensben; organikusan claimelt telephelyek aránya; organikus keresőforgalom; meghívó → értékelés konverzió.

## 12. RateThatJob Index (beágyazható widget)

- Változatok: kompakt jelvény (világos/sötét), széles kártya (karrieroldal), sorközi csík (álláshirdetés), Top Rated pecsét, „Rate us on RateThatJob” 5 értékelés alatt.
- Beágyazás: (1) képes SVG-jelvény linkkel – bárhol működik; (2) script widget (`widget.js`, Shadow DOM, belső link tartaléknak a SEO miatt); (3) nyilvános JSON API.
- Minden beágyazás visszamutató link → SEO és ismertség. A nagy állásportálok általában nem engednek HTML-t → oda szöveges csík + link.

## 13. Elkészült anyagok (az előző beszélgetésben)

- **RateThatJob-SPEC.md** – teljes termék- és technikai specifikáció Claude Code-nak (stack, URL-ek, SEO, adatmodell, folyamatok, igazolás, céges oldal, Index widget kódmintákkal, lokalizáció, adatvédelem, fázisok, repo-struktúra, első feladatok).
- Logó PNG-k háttér nélkül: `RateThatJob-logo-vilagos-hatterre.png`, `RateThatJob-logo-sotet-hatterre.png`, `RateThatJob-ikon.png`, `RateThatJob-app-ikon.png`.
- Arculati lap: `RateThatJob-arculat.pdf` / `.png` (logók, ikonok, színkódok, betűtípus).
- Dizájnvászon „RateThatJob mobil képernyők” (Claude artifact, privát): 10 mobilképernyő (kezdőlap, telephelyprofil, értékelések fordítással, céges meghívó landing, regisztráció, megjelenő név, 3 lépéses értékelés, igazolás és közzététel), 2 asztali álláskeresői oldal, 4 céges irányítópult-oldal (áttekintés, meghívás, értékelések és válaszok, telephelyek/csapat/csomag), 2 Index-tábla (jelvényváltozatok, beágyazás egy karrieroldalon). A képernyők számai szemléltető adatok; árak helyén [PRICE] helyőrző.
- Logóvászon „RateThatJob logó” (A/B/C irány; a C a választott).

## 14. Nyitott kérdések / következő lépések

- Domainek megvásárlása (RateThatJob.com, WorkReviewed.com) – a szabad állapotot közvetlenül vásárlás előtt ellenőrizni.
- Végleges árazás és csomaghatárok.
- Indulási szegmens véglegesítése (javaslat: budapesti vendéglátás) és a helyek előtöltése nyilvános adatokból.
- Első verzió építése a SPEC alapján, SEO-képes rendereléssel.
- Stratégiai döntés: startup/irodai szegmens mellett vagy után a kékgalléros fókusz (a márkaüzenet ne hígüljon).

## 15. Hogyan dolgozz Gáborral

- Magyarul kommunikál, tömören, direkt; a terméket és a szöveget angolul akarja (mobile-first).
- Csak azt csináld, amit kér – ha többet teszel hozzá, mint amit kért, az rossz. Ne ajánlj fel kéretlenül további munkát.
- Listát vagy másolandó szöveget sima szövegként kér a chatben, ne kódblokkban és ne külön dokumentumban.
- Kemény, egyenes visszajelzést ad („szar”, „gagyi”) – ilyenkor a kért irányba igazíts, ne magyarázkodj.
- Nyomtatott felületre (pl. totem) ne tervezz interaktív/változó elemet.
- Ne adj kéretlen jogi/szabályozási figyelmeztetéseket, hacsak nem kérdez rá.

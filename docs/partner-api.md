# RateThatJob Partner API – munkahelyek felvétele térképes helyekből

Megbízható importálóknak (például egy botnak), amelyek a Google/OpenStreetMap térképről vesznek fel
munkahelyeket a RateThatJob-ra. Két végpont van: **keresés** (helyazonosítót ad) és **felvétel**
(a helyazonosítóból munkahely lesz). Ugyanaz a logika fut, mint amikor egy látogató a weboldalon
kiválaszt egy helyet, csak a látogatói korlátok nélkül.

Alap-URL: `https://ratethatjob.com`

## Kulcs

- Az adminban: **Admin → Partnerkulcsok** → név + óránkénti korlát → *Kulcs létrehozása*.
  A kulcs (`rtjp_…`) csak egyszer jelenik meg; nálunk csak a lenyomata tárolódik.
- Minden kérésnél küldd fejlécben:

  ```
  X-RTJ-Partner-Key: rtjp_…
  ```

- A kulcs nem kerülhet URL-be, naplóba, kódtárba. Ha kiszivárgott: Admin → Partnerkulcsok →
  *Visszavonás*, majd új kulcs.
- Kulcs nélkül vagy visszavont kulccsal minden végpont `401 {"error":"unauthorized"}`-t ad.

## 1. Keresés

```
GET /api/partner/places/search?q=<keresett szöveg>&where=<város>&locale=hu
X-RTJ-Partner-Key: rtjp_…
```

| Paraméter | Kötelező | Leírás |
|---|---|---|
| `q` | igen | Név, cím vagy mindkettő, legalább 3 karakter (pl. `Lidl Üllői út`) |
| `where` | nem | Város. Ismert városnál (Budapest, Debrecen, Szeged, Pécs, Győr, Miskolc, Dubai, Abu Dhabi, Sharjah, Bécs, London, New York) az ottani találatok jönnek; más helynevet a keresőszöveghez fűzünk |
| `locale` | nem | `hu` (alapértelmezett) vagy `en` – a találatok és a visszaadott URL nyelve |

Válasz `200`:

```json
{
  "provider": "google",
  "sessionToken": "6f1c…",
  "results": [
    {
      "placeId": "ChIJ107pShfAQUcRbYWbwl5LBII",
      "name": "Lidl",
      "address": "XVIII, XVIII. kerület, Üllői út, Magyarország",
      "placeType": "supermarket",
      "locationId": null,
      "url": null
    }
  ]
}
```

- `locationId` / `url`: ha a hely már fent van a RateThatJob-on, itt a munkahely azonosítója és
  oldala – ilyenkor felvenni nem kell.
- `sessionToken`: add tovább a felvételnél (a Google ugyanabban a keresési munkamenetben számláz).
- `provider`: `google`, vagy `osm`, ha nincs Google-kulcs beállítva (ekkor a `placeId` `osm:node/123`
  alakú).

## 2. Felvétel

```
POST /api/partner/places
X-RTJ-Partner-Key: rtjp_…
Content-Type: application/json

{ "placeId": "ChIJ107pShfAQUcRbYWbwl5LBII", "sessionToken": "6f1c…", "locale": "hu" }
```

| Mező | Kötelező | Leírás |
|---|---|---|
| `placeId` | igen | A keresés `placeId`-ja (Google place id vagy `osm:node/…`) |
| `sessionToken` | nem | A keresés `sessionToken`-je |
| `locale` | nem | `hu` vagy `en` – a visszaadott URL nyelve |
| `confirm` | nem | Egy jelölt `id`-ja „Erre gondoltál?” után: a hely ehhez a meglévő munkahelyhez kapcsolódik |
| `force` | nem | `true`: „nem ugyanaz” – akkor is új munkahely lesz, ha van hasonló a közelben |

A cím és a település a térkép adataiból jön; ha a Google nem ad várost vagy utcát, a koordinátából
pótoljuk (OpenStreetMap). A kategóriát mi döntjük el.

### Válaszok

| HTTP | Törzs | Jelentés / teendő |
|---|---|---|
| `201` | `{"status":"created","locationId":"…","url":"https://ratethatjob.com/hu/lidl/ulloi-ut-379-381"}` | Új munkahely jött létre |
| `200` | `{"status":"existing","locationId":"…","url":"…"}` | Már megvolt (ugyanaz a hely, vagy 75 m-en belül egyező nevű munkahely – ehhez kapcsoltuk) |
| `200` | `{"status":"candidates","candidates":[{"id":"…","name":"…","address":"…","city":"…"}]}` | Van hasonló a közelben, de nem biztos, hogy ugyanaz. Küldd újra `confirm: <id>`-vel, ha ugyanaz, vagy `force: true`-val, ha nem. Ha nem tudod eldönteni, hagyd ki |
| `422` | `{"error":"no_address","name":"…"}` | A térkép ehhez a helyhez semmilyen címet nem ad – nem vehető fel automatikusan |
| `422` | `{"error":"no_name"}` / `{"error":"not_found"}` | Név nélküli hely / ismeretlen vagy hibás `placeId` |
| `400` | `{"error":"invalid_request"}` | Hiányzó `placeId` vagy hibás JSON |
| `401` | `{"error":"unauthorized"}` | Hiányzó, hibás vagy visszavont kulcs |
| `429` | `{"error":"limit"}` | Elérted a kulcs óránkénti korlátját – várj a következő óráig |
| `502` | `{"error":"generic"}` | Átmeneti hiba (térkép-szolgáltatás, adatbázis) – próbáld újra később, legfeljebb néhányszor |

## Korlátok

- Felvétel: a kulcs saját óránkénti korlátja (az adminban állítható, alapértelmezés 1000/óra).
  Óra = naptári óra (UTC), a számláló az óra elején nullázódik.
- Keresés: 1000 kérés/óra kulcsonként.
- A látogatói korlátok (IP-nként 30/óra, összesen 300/óra) a kulcsra nem vonatkoznak.
- Kérlek, párhuzamosan legfeljebb 2 kérést küldj; a felvétel egy-egy helynél pár másodperc is lehet.

## Mi látszik nálunk

- A kulccsal felvett munkahelyek jelölése `created_via = 'partner'`, és a kulcshoz vannak kötve.
- Admin → Partnerkulcsok: utolsó használat, használatok száma, felvett munkahelyek száma,
  visszavonás.
- Az új munkahely oldala „Még nincs értékelés” állapotban jelenik meg; értékelés nélkül nem kerül a
  keresők indexébe.

## Példa (curl)

```bash
KEY="rtjp_…"   # környezeti változóból, ne a kódból

curl -s -H "X-RTJ-Partner-Key: $KEY" \
  "https://ratethatjob.com/api/partner/places/search?q=Lidl%20%C3%9Cll%C5%91i%20%C3%BAt&where=Budapest"

curl -s -X POST -H "X-RTJ-Partner-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"placeId":"ChIJ107pShfAQUcRbYWbwl5LBII","sessionToken":"<a keresés sessionToken-je>"}' \
  https://ratethatjob.com/api/partner/places
```

## Példa (Node.js)

```js
const BASE = "https://ratethatjob.com";
const headers = { "X-RTJ-Partner-Key": process.env.RTJ_PARTNER_KEY, "Content-Type": "application/json" };

async function addWorkplace(query, city) {
  const search = await fetch(`${BASE}/api/partner/places/search?` + new URLSearchParams({ q: query, where: city }), { headers });
  if (!search.ok) throw new Error(`search ${search.status}`);
  const { sessionToken, results } = await search.json();
  const place = results.find((r) => !r.locationId) ?? results[0];
  if (!place) return null;
  if (place.locationId) return { status: "existing", url: place.url };

  const res = await fetch(`${BASE}/api/partner/places`, {
    method: "POST",
    headers,
    body: JSON.stringify({ placeId: place.placeId, sessionToken }),
  });
  if (res.status === 429) throw new Error("hourly limit reached");
  return res.json(); // created / existing / candidates / { error }
}
```

## Ha eddig böngészővel ment a bot

A weboldal felülete (`/app/rate`) nem API: a kattintások mögötti belső hívások minden kiadással
változhatnak. A bot ezentúl a fenti két végpontot használja. A felületen át a kulcs ugyan működik
(`X-RTJ-Partner-Key` extra HTTP-fejlécként minden kérésen), de erre nem adunk garanciát.

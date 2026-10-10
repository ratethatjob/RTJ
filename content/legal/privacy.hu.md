# Adatvédelmi tájékoztató

Hatályos: 2026. október 10.

## 1. Adatkezelő

{{name}} ({{address}}, cégengedély száma: {{registry}}). Adatvédelmi kérdésekben: [{{privacyEmail}}](mailto:{{privacyEmail}}).

## 2. A legfontosabb szabály: névtelenség

A munkáltatók soha nem tudják meg, ki írt egy értékelést, és ki válaszolt a meghívójukra. A nyilvános oldalakon csak a választott megjelenő neved látszik. A munkáltatók csak összesített számokat látnak, legalább 5 értékelés felett.

## 3. Milyen adatokat kezelünk és miért

- **Fiók:** e-mail-cím, megjelenő név, nyelv. Cél: belépés és a szolgáltatás nyújtása. Jogalap: a szolgáltatás nyújtása (szerződés).
- **Értékelések:** a munkahely, a kapcsolatod (dolgozó, volt dolgozó, jelentkező), időszak, munkakör, pontszámok, tények és a szöveg. Cél: közzététel, pontszámok számítása, moderálás. Jogalap: szerződés és jogos érdek (a megbízható értékelések biztosítása).
- **Igazoló dokumentum (opcionális):** bérjegyzék, szerződés stb. Csak ellenőrzésre használjuk, a döntés után töröljük, legkésőbb 30 napon belül.
- **Jelentkezések:** név, e-mail vagy telefon, a válaszaid. Ezeket megkapja az a munkáltató, ahová jelentkeztél. Jogalap: a te kérésed (szerződés).
- **Munkáltatói fiókok:** a munkatársak neve, e-mail-címe, szerepköre.
- **Követések, értesítések, „Hasznos” szavazatok, jelentések:** a szolgáltatás működéséhez.
- **Technikai adatok:** a biztonsághoz és a csalások kiszűréséhez szükséges naplók (pl. fiók létrehozásának ideje, értékelések időzítése).

## 4. Automatizált ellenőrzés és fordítás

Az értékelések és cégválaszok szövegét egy MI-modell (Anthropic Claude) ellenőrzi személyes adatok, fenyegetés és hasonló tartalom szempontjából, és lefordítja más nyelvekre. A modell csak a szöveget kapja meg, a fiókod adatait nem. Ha egy értékelés fennakad, ember dönt róla.

Ha a munkáltató Basic vagy Pro álláscsomagot használ, ugyanez az MI-modell összefoglalja neki a jelentkezésedet (a válaszaidat és, ha feltöltöttél, az önéletrajzodat), Pro csomagnál pedig 2–3 kiegészítő kérdést tesz fel neked. Az összefoglaló csak segíti a munkáltatót, a döntést ember hozza meg.

## 5. Adatfeldolgozók

- Supabase (adatbázis, belépés, fájltárolás)
- Vercel (tárhely, a weboldal kiszolgálása)
- Anthropic (gépi fordítás, tartalomellenőrzés, jelentkezések összefoglalása)
- Google (Google Térkép-alapú munkahelykeresés, ha használod)
- Resend (e-mailek küldése, pl. a munkáltatók üzenetei)
- Stripe (a munkáltatók fizetései; a teljes kártyaadatokat mi nem látjuk)

Új szolgáltató bevonása előtt frissítjük ezt a listát.

## 6. Meddig őrizzük

- A fiókadatokat a fiók törléséig.
- Az értékeléseket a fiók törléséig, vagy ha úgy döntesz, „Volt tag” névvel tovább, a fiókodhoz kapcsolás nélkül.
- Az igazoló dokumentumokat a döntésig, legfeljebb 30 napig.
- A jelentkezéseket a fiók törléséig. A munkáltatónak átadott adatokért onnantól a munkáltató is felel.

## 7. Jogaid

- Hozzáférés és adathordozhatóság: a Fiókom oldalon letöltheted az adataidat (JSON).
- Törlés: a Fiókom oldalon törölheted a fiókod.
- Helyesbítés, korlátozás, tiltakozás: írj a [{{privacyEmail}}](mailto:{{privacyEmail}}) címre.
- Panasz: a Dubai International Financial Centre (DIFC) adatvédelmi biztosánál (Commissioner of Data Protection), vagy a lakóhelyed szerinti adatvédelmi hatóságnál (Magyarországon: NAIH, naih.hu).

## 8. Sütik

A használt sütikről a [Sütik](/cookies) oldalon olvashatsz.

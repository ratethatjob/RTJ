# Kategóriák – kétszintű besorolás

Fő kategória (~30, `lib/categories.ts`): szűrés, városoldalak. Pontos típus (`lib/place-types.ts`): a Google Places (New) típusa, vagy amire az OSM-címke / a név utal, magyar és angol felirattal – elöl látszik („Borbély · Fodrászat és borbély”).

Döntési sorrend (`classifyPlace`): Google `primaryType` → a többi Google-típus → név-kulcsszavak (HU/EN, ékezet nélkül, egész szó, összetett szó vége pl. „szalámigyár”) → általános típus (store, food) → AI (Haiku). Csak a fő típusból jövő döntés biztos; minden más mellett „Javaslat – módosítsd, ha nem stimmel”.

Valós példák (Budapest/Szeged, a Google által adott típussal; unit teszt: `lib/place-types.test.ts`, adatok: `lib/place-types.fixtures.ts`):

| # | Név (város) | Google típus | Régi kategória | Új kategória | Pontos típus | Forrás |
|---|---|---|---|---|---|---|
| 1 | Barber Shop Budapest Agora (Budapest) | barber_shop | Szépség és wellness | Fodrászat és borbély | Borbély | Google fő típus |
| 2 | Mr. Barber (Szeged) | barber_shop | Szépség és wellness | Fodrászat és borbély | Borbély | Google fő típus |
| 3 | Hajvarázs Fodrászat (Szeged) | hair_salon | Szépség és wellness | Fodrászat és borbély | Fodrászat | Google fő típus |
| 4 | Nailbar Budapest (Budapest) | nail_salon | Szépség és wellness | Kozmetika, köröm és spa | Körömszalon | Google fő típus |
| 5 | Thai Masszázs Szeged (Szeged) | massage | Szépség és wellness | Kozmetika, köröm és spa | Masszázs | Google fő típus |
| 6 | Szamos Cukrászda (Budapest) | confectionery | Étterem és kávézó | Kávézó és pékség | Cukrászda | Google fő típus |
| 7 | Lipóti Pékség (Szeged) | bakery | Étterem és kávézó | Kávézó és pékség | Pékség | Google fő típus |
| 8 | Starbucks Oktogon (Budapest) | coffee_shop | Étterem és kávézó | Kávézó és pékség | Kávézó | Google fő típus |
| 9 | Espresso Embassy (Budapest) | coffee_shop | Étterem és kávézó | Kávézó és pékség | Kávézó | Google fő típus |
| 10 | Gelarto Rosa (Budapest) | ice_cream_shop | Étterem és kávézó | Kávézó és pékség | Fagylaltozó | Google fő típus |
| 11 | McDonald's Nyugati (Budapest) | fast_food_restaurant | Gyorsétterem | Gyorsétterem | Gyorsétterem | Google fő típus |
| 12 | Burger King Árkád (Szeged) | hamburger_restaurant | Gyorsétterem | Gyorsétterem | Hamburgerező | Google fő típus |
| 13 | Costes (Budapest) | fine_dining_restaurant | Étterem és kávézó | Étterem | Fine dining étterem | Google fő típus |
| 14 | Halászcsárda (Szeged) | hungarian_restaurant | Étterem és kávézó | Étterem | Magyar étterem | Google fő típus |
| 15 | Pizza Me (Budapest) | pizza_restaurant | Étterem és kávézó | Étterem | Pizzéria | Google fő típus |
| 16 | Szimpla Kert (Budapest) | bar | Bár és szórakozóhely | Bár és szórakozóhely | Bár | Google fő típus |
| 17 | Instant-Fogas (Budapest) | night_club | Bár és szórakozóhely | Bár és szórakozóhely | Szórakozóhely | Google fő típus |
| 18 | Hilton Budapest (Budapest) | hotel | Szálloda és szállás | Szálloda és szállás | Szálloda | Google fő típus |
| 19 | Hotel Forrás (Szeged) | resort_hotel | Szálloda és szállás | Szálloda és szállás | Üdülőszálló | Google fő típus |
| 20 | Tesco Hipermarket (Szeged) | hypermarket | Szupermarket és élelmiszerbolt | Szupermarket és élelmiszerbolt | Hipermarket | Google fő típus |
| 21 | SPAR Market (Budapest) | supermarket | Szupermarket és élelmiszerbolt | Szupermarket és élelmiszerbolt | Szupermarket | Google fő típus |
| 22 | dm drogerie markt (Szeged) | drugstore | Gyógyszertár | Kiskereskedelem | Drogéria | Google fő típus |
| 23 | Rossmann (Budapest) | drugstore | Gyógyszertár | Kiskereskedelem | Drogéria | Google fő típus |
| 24 | Szent Margit Gyógyszertár (Budapest) | pharmacy | Gyógyszertár | Gyógyszertár | Gyógyszertár | Google fő típus |
| 25 | IKEA Budaörs (Budaörs) | furniture_store | Kiskereskedelem | Kiskereskedelem | Bútorbolt | Google fő típus |
| 26 | Decathlon Szeged (Szeged) | sporting_goods_store | Kiskereskedelem | Kiskereskedelem | Sportbolt | Google fő típus |
| 27 | Telekom Shop (Szeged) | cell_phone_store | Kiskereskedelem | Kiskereskedelem | Mobiltelefon-bolt | Google fő típus |
| 28 | MOL töltőállomás (Szeged) | gas_station | Kiskereskedelem | Autószerviz és benzinkút | Benzinkút | Google fő típus |
| 29 | Shell (Budapest) | gas_station | Kiskereskedelem | Autószerviz és benzinkút | Benzinkút | Google fő típus |
| 30 | BUDget Parking - Reptéri parkolás (Vecsés) | parking | – (AI) | Autószerviz és benzinkút | Parkoló | Google fő típus |
| 31 | Wash & Go Autómosó (Budapest) | car_wash | Autóipar és autószerviz | Autószerviz és benzinkút | Autómosó | Google fő típus |
| 32 | Kézi Autómosó (Szeged) | – | – (AI) | Autószerviz és benzinkút | Autómosó | név |
| 33 | GLS Depó (Szeged) | courier_service | Futárszolgálat és szállítás | Futárszolgálat és szállítás | Futárszolgálat | Google fő típus |
| 34 | Szegedi Raktárbázis (Szeged) | storage | Raktár és logisztika | Raktár és logisztika | Raktár | Google fő típus |
| 35 | Pick szalámigyár (Szeged) | – | – (AI) | Gyár és termelés | Gyár | név |
| 36 | Semmelweis Egyetem Fogászati Klinika (Budapest) | dental_clinic | Fogászat | Fogászat | Fogászat | Google fő típus |
| 37 | Szent János Kórház (Budapest) | hospital | Egészségügy | Egészségügy | Kórház | Google fő típus |
| 38 | Tisza Állatorvosi Rendelő (Szeged) | veterinary_care | – (AI) | Állatorvos és állatgondozás | Állatorvos | Google fő típus |
| 39 | Cinema City Aréna (Budapest) | movie_theater | Rendezvény és szórakoztatás | Rendezvény és szórakoztatás | Mozi | Google fő típus |
| 40 | Las Vegas Casino (Budapest) | casino | Rendezvény és szórakoztatás | Rendezvény és szórakoztatás | Kaszinó | Google fő típus |
| 41 | Szegedi Tudományegyetem (Szeged) | university | Oktatás | Oktatás | Egyetem | Google fő típus |
| 42 | Napsugár Óvoda (Szeged) | preschool | Gyermekfelügyelet | Gyermekfelügyelet | Óvoda | Google fő típus |
| 43 | OTP Bank fiók (Szeged) | bank | Bank és pénzügy | Bank és pénzügy | Bank | Google fő típus |
| 44 | Szeged 1 posta (Szeged) | post_office | Közszféra | Közszféra | Posta | Google fő típus |
| 45 | Life1 Fitness (Budapest) | gym | Fitnesz és sport | Fitnesz és sport | Edzőterem | Google fő típus |
| 46 | Idősek Otthona (Szeged) | nursing_home | Idősgondozás és szociális ellátás | Idősgondozás és szociális ellátás | Idősek otthona | Google fő típus |
| 47 | Borbély Szalon (Szeged) | store | Kiskereskedelem | Fodrászat és borbély | Borbély | név |
| 48 | Teszt munkahely (Budapest) | – | – (AI) | – (AI) | – | AI (haiku) |

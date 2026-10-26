# Demonstracioni premium katalog

Pripremljeno i uneseno 26. oktobra 2026. kroz postojeći API Gateway i važeću OWNER sesiju.
Katalog ima 16 vozila, 47 fotografija i 47 umanjenih prikaza. Nema nove baze, migracije šeme ili promene backend autorizacije.

| Dodat model | Godište | Snaga (KS/PS) | Demo cena (EUR) | Fotografije |
| --- | --- | --- | --- | --- |
| Porsche 911 Turbo S, 992.1 Coupé | 2023 | 650 | 229.900 | 4 |
| Mercedes-Benz S 580 4MATIC Long, V223 | 2022 | 503 | 119.900 | 4 |
| BMW M8 Competition Coupé, F92 | 2020 | 625 | 109.900 | 3 |
| Audi RS7 Sportback Performance, C8 | 2024 | 630 | 149.900 | 0 — čeka fotografije |
| Lamborghini Huracán EVO AWD Coupé | 2021 | 640 | 249.900 | 3 |
| Ferrari Roma Coupé | 2021 | 620 | 209.900 | 4 |
| Bentley Continental GT Speed, III W12 | 2022 | 659 | 239.900 | 3 |
| Rolls-Royce Ghost, II | 2021 | 571 | 289.900 | 4 |
| Aston Martin DB12 Coupé | 2024 | 680 | 239.900 | 3 |
| Range Rover SV P615 LWB, L460 | 2024 | 615 | 224.900 | 4 |
| Ferrari 488 Spider | 2017 | 670 | 239.900 | 3 |
| McLaren Senna, drumska konfiguracija | 2019 | 800 | 1.199.900 | 3 |
| Porsche Panamera 4S, 971.1 | 2017 | 440 | 59.900 | 2 |

Cene i kilometraže novih vozila su ilustrativni primeri za studentsku aplikaciju, ne procene tržišne vrednosti ili stvarni oglasi. Fabrički podaci i linkovi ka tehničkim izvorima nalaze se u [vehicles.json](vehicles.json). Snaga je izražena u metričkim KS/PS, kako je prikazuje frontend, iako se postojeće API polje zove `enginePowerHp`. Blagi hibridi sa benzinskim motorom zadržavaju oznaku goriva `PETROL`; Toyota full hybrid je `HYBRID`.

## Postojeća vozila i zaštita podataka

- Toyota Corolla, ID 3: dopunjena konfiguracija 1.8 Hybrid od 140 KS, e-CVT, boja i opis; dodata fotografija odgovarajućeg E210 hatchback modela iz 2023.
- Audi A4, ID 2: dopunjena konfiguracija 40 TDI quattro od 190 KS sa S tronic menjačem, boja i opis; dodata tri kadra osveženog B9 modela.
- BMW 320d, ID 1: dodata tri kadra modela G20. Ostaje `SOLD`. Specifikacije nisu izmenjene jer postojeći API dozvoljava njihovu izmenu samo za `AVAILABLE` vozila. Fotografije imaju zaseban OWNER API koji dozvoljava njihovo uređivanje.
- Postojeće cene, kilometraže, godišta, ID-jevi, statusi i vidljivost ostali su očuvani. Postojećih fotografija pre unosa nije bilo.
- Poređenjem privatnih SQL kopija potvrđeno je da su baze naloga, porudžbina i plaćanja neizmenjene.
- Ne postoje VIN-ovi, registracije ili tvrdnje o servisiranju za izmišljene oglase. Izabrane fotografije imaju sajamske/modelske oznake ili već zaklonjene tablice.

## Fotografije i licence

Sve objavljene slike dolaze sa Wikimedia Commons. Svaka od 47 fotografija ima pojedinačno proverenu licencu **CC BY-SA 4.0** ili **CC BY 2.0**. Potpuni podaci su u [photos.json](photos.json): naslov, autor, originalna stranica, direktni izvor, licenca, datum provere, redosled, opis promena i SHA-256 preuzetog fajla.

Autori: Ethan Llamas, Damian B Oh, Tokumeigakarinoaoshima, Charles, Vauxford, MrWalkr, Alexander Migl, Neil, Y.Leclercq, Epensock, Arnaud 25, Alexander-93, Llann Wé² i Thesupermat. Tačna atribucija za svaku sliku prikazuje se ispod galerije, kroz „Izvor i licenca fotografije“. Izvedene fotografije ostaju pod izvornom licencom; licence slika ne menjaju licencu aplikacionog koda.

Javni manifest atribucija prepoznaje sadržaj prikazane fotografije preko SHA-256. Ne sadrži lokalne ID-jeve baze, UUID putanje ili podatke sesije. Kada OWNER zameni fotografiju, novi sadržaj ne nasleđuje tuđu atribuciju.

Fotografije su ilustracije konkretnog modela i generacije. Različiti kadrovi mogu prikazivati različite boje, tržišne konfiguracije i primerke; nisu dokumentacija jednog stvarnog vozila. To je naznačeno u galeriji. Za Porsche, Lamborghini, Bentley i Range Rover još nisu odabrani pouzdano identifikovani enterijeri sa dozvolom; imaju spoljašnje kadrove. Ferrari nema izdvojen zadnji kadar. Ne koriste se fotografije druge generacije ili drugog modela kao zamena. Za RS7 čekaju se fotografije baš **C8 Performance** uz potvrdu prava korišćenja; osnovni C8 RS7 i stariji C7 Performance nisu prihvaćeni kao zamene.

Naknadno dodati 488 Spider i Senna imaju prednji, zadnji i unutrašnji kadar. Panamera 4S ima dva spoljašnja kadra istog modela 971.1; enterijer nije zamenjen fotografijom druge varijante. Primljeno je i pet korisnikovih RS7 fotografija sa Google Images. Za njih nisu dostavljeni originalni izvori ili potvrđena dozvola za ponovno objavljivanje, pa su sačuvane isključivo za privatni pregled u `.local/catalog/rs7-pending/` i nisu unete u javni katalog. Google preporučuje proveru uslova na originalnoj stranici i kod davaoca licence: [Find images you can use & share](https://support.google.com/websearch/answer/29508?hl=en).

Slike su poslate kao multipart `files` na `/api/vehicles/{id}/photos`. Postojeći servis pravi JPEG do 1800 px i umanjeni JPEG do 640 px, sa kvalitetom 85%, i uklanja metapodatke. Ukupno 94 fajla zauzima oko 17 MB u postojećem `vehicle-media` volumenu. Frontend koristi isključivo lokalne `/api/vehicles/media/...` URL-ove.

## Ponovno pokretanje

Potrebni su pokrenuti postojeći Docker servisi, Node.js 24 i Python 3. Sačuvati važeći OWNER access token u `.catalog-owner-token` u korenu projekta. Fajl je isključen iz Gita i Docker build konteksta. Ne slati token kao argument komandne linije.

```powershell
node scripts/catalog-download.mjs
node scripts/catalog-import.mjs
node --test scripts/catalog-import.test.mjs
node scripts/catalog-import.mjs --apply
```

Prva komanda proverava ili preuzima samo prethodno odabrane licencirane fajlove u privatni cache. Izmenjen izvor sa drugom kontrolnom sumom zahteva novu proveru. Druga komanda samo proverava plan. `--apply` automatski prvo pravi i proverava rezervne kopije sve četiri baze i media arhive, pa upisuje preko OWNER API-ja.

Za drugu lokalnu adresu Gateway-a postaviti `TRIVIO_CATALOG_API` na lokalni HTTP URL sa `/api` prefiksom. Token se ne šalje na udaljene hostove niti kroz preusmeravanja. Putanja do Python-a po potrebi se zadaje kroz `TRIVIO_PYTHON`.

Privatne kopije, fotografije, dnevnik unosa i izveštaji nalaze se u `.local/catalog/`, koji je isključen iz Gita i Docker build konteksta. Backup sadrži SQL za postojeće baze, `vehicle-media.tar.gz` i manifest kontrolnih suma. Te fajlove čuvati privatno. Za povratak podataka potrebno je upariti SQL kopiju vozila sa media arhivom iz istog backupa; ne vraćati ostale baze koje nisu menjane.

Ponovljeni unos prepoznaje modele i ID-jeve i koristi privatni dnevnik plus postojeće atribucije slika. Ne menja statuse, ne arhivira vozila, ne briše fotografije i ne vraća slike koje je OWNER namerno uklonio. Posle prekida sa nepoznatim ishodom upload-a postupak se zaustavlja: pregledati `pendingPhoto` i listu slika preko API-ja pre nastavka. Ne brisati dnevnik ili lock naslepo i ne pokretati više unosa istovremeno. Sačuvati privatni dnevnik uz instalaciju.

`scripts/catalog-commons.py` služi samo za dodatno istraživanje Commons izvora. Rezultati pretrage nisu automatski odobrene fotografije i zahtevaju vizuelnu proveru pre dodavanja u manifest.

## Izmene interfejsa i provere

Kartice imaju poravnate naslove i cene. Detaljna galerija prikazuje celu fotografiju, uz strelice, ciklično listanje i tastere levo/desno. Postojeći dizajn, responzivni raspored i light/dark teme su sačuvani. Dodati su prikaz atribucije i jasno obeležje demonstracione ponude.

Provereno: frontend build/typecheck, 26 postojećih frontend testova, 5 testova bezbednog unosa, ponovljen unos bez duplikata, svih 16 detaljnih stranica i 47 fotografija u pregledaču, redosled galerija, navigacija tastaturom, pretraga, filteri marke/statusa, sortiranje po ceni i prikaz na 390/768/1440 px u obe teme. OWNER listanje i čuvanje dostupnog vozila vraćaju HTTP 200; pokušaj izmene prodatog vozila vraća 409, a izmena bez prijave 401. Nisu rađeni git commit ili push.

Servis vozila je zatim restartovan bez uklanjanja volumena. Pre i posle restarta preuzeta su sva 94 JPEG fajla: sve kontrolne sume, svih 16 zapisa i podaci galerija ostali su identični. Privatni snimci ekrana i izveštaji provera nalaze se u `.local/catalog/`.

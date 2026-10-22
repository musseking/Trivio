# Aktivacija upravljanja vozilima i fotografijama

Implementacija je pripremljena u kodu. Migracija nije izvršena i postojeće baze nisu menjane. Za izvršavanje SQL-a i aktivaciju nove verzije uz postojeći MySQL potrebno je posebno, izričito odobrenje korisnika. Ovaj dokument nije to odobrenje.

## Ručna migracija

`migrations/V002__vehicle_management_and_photos.sql` namenjen je postojećoj MySQL 8 šemi **isključivo Vehicle Service-a**. Nije Spring startup skripta i ne postoji automatski Flyway/Liquibase korak koji je izvršava. MySQL profil koristi `ddl-auto=validate`: nova verzija neće automatski menjati šemu i neće moći da radi nad starom šemom dok migracija ne bude odobrena i primenjena.

Pre primene, nakon dobijanja odobrenja:

1. Napraviti i proveriti rezervnu kopiju postojeće Vehicle Service šeme i medijskog volumena, ako već postoji. Ne koristiti reset, brisanje ili ponovno pravljenje volumena.
2. Potvrditi ciljnu šemu preko `SELECT DATABASE()` i pregledati postojeću strukturu `vehicles` preko `SHOW CREATE TABLE vehicles`. Proveriti da kolone `archived`, `transmission`, `engine_power_hp`, `color`, `description` i tabela `vehicle_photos` još ne postoje. Ako bilo šta već postoji, prvo uskladiti stanje i skriptu; ne izvršavati je naslepo.
3. Primeniti navedenu SQL datoteku jednom, samo na potvrđenu Vehicle Service šemu. Skripta ne bira bazu naredbom `USE`, ne sadrži pristupne podatke i ne menja druge servisne baze. MySQL DDL implicitno potvrđuje izmene; kod delimičnog neuspeha prvo proveriti šta je već primenjeno, bez automatskog ponavljanja cele skripte.
4. Proveriti da su broj postojećih redova, ID-jevi i `status` vrednosti očuvani. Novi `archived` je `FALSE` za postojeće redove; dodatni detalji su `NULL`, a nova tabela fotografija je prazna. Proveriti kolone, indekse i strani ključ u novoj šemi.
5. Tek zatim aktivirati novu verziju Vehicle Service-a i njegov trajan medijski volumen. Proveriti Hibernate validaciju šeme i bezbedne GET zahteve. Provera kupovine, rezervacije i plaćanja nije deo aktivacije ove faze.

Ne predlaže se automatska povratna migracija: eventualna stara verzija može ignorisati dodate kolone i tabelu, dok brisanje nove tabele/kolona uništava novo sačuvane podatke.

## Promene modela i pristupa

- `archived` je zaseban boolean. Postojeći životni ciklus ostaje `AVAILABLE`, `RESERVED`, `SOLD`.
- Javni `GET /api/vehicles` izostavlja arhivirana vozila. `GET /api/vehicles/{id}` ostaje dostupan i za arhivirana vozila radi postojećih porudžbina i istorije.
- `GET /api/vehicles/manage`, `POST /api/vehicles/{id}/archive` i `POST /api/vehicles/{id}/restore` zahtevaju aktivan OWNER identitet proveren kroz Auth Service `/auth/me` pri svakom zahtevu.
- Postojeći create, update i DELETE zadržavaju ADMIN/OWNER autorizaciju. DELETE sada samo povlači `AVAILABLE` vozilo iz javne ponude; ne briše red, fotografije niti povezane porudžbine.
- Arhiviranje i vraćanje su dozvoljeni za `AVAILABLE` i `SOLD`, ali ne za `RESERVED`. Vraćanje ne menja životni ciklus: prodato vozilo ostaje prodato. Arhivirano vozilo ne može biti rezervisano.
- Update i dalje zahteva `AVAILABLE`, uključujući arhivirano `AVAILABLE` vozilo. Status i arhiviranost nisu polja request forme. Opcioni `version` sprečava čuvanje preko novije izmene i daje HTTP 409; stariji klijenti bez tog polja ostaju podržani.
- `transmission`, `enginePowerHp`, `color`, `description` su opciona polja. Novi response uključuje i `version`, `archived` i uređenu listu `photos`.

## Fotografije i trajnost

`vehicle_photos` čuva samo nasumične nazive obrađenih slika, redosled i oznaku naslovne fotografije. Bajtovi fotografija pripadaju zasebnom trajnom medijskom volumenu koji se aktivira uz Vehicle Service. Baza i medijski volumen zajedno čine skup podataka za rezervnu kopiju; sama MySQL kopija ne sadrži slike.

Strani ključ nema `ON DELETE CASCADE`. Vehicle entitet nema kaskadno brisanje niti `orphanRemoval`, a povlačenje vozila ne briše fotografije. Brisanje fotografije je zasebna, eksplicitna OWNER operacija. Za upload, preuređivanje, izbor naslovne i brisanje koriste se OWNER photo endpoint-i, dok su obrađene slike javno dostupne preko API Gateway-a.

Nove kolone ne zahtevaju popunjavanje starih redova niti menjanje porudžbina. Skripta ne sadrži `DELETE`, `DROP`, `TRUNCATE` niti reset `AUTO_INCREMENT` vrednosti.

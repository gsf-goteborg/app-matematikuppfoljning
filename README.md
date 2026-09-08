# Matematikuppföljning FK→Åk9 (demo)

> **DEMO – syntetisk data. Inga riktiga elever.**
> En proof-of-concept för hur kontinuerlig matematikuppföljning *borde* se ut:
> mät **var i kunskapskedjan varje elev är**, kontinuerligt, så att ingen elev
> tyst halkar efter och ingen blir chockad av många F i åk 9.

Dagens uppföljning mäter resultatet i slutet (betyg i åk 9) – ett kvitto som
kommer för sent. Den här appen vänder på logiken och gör den
**kunskapslucka som uppstår flera år tidigare** (oftast vid proportionalitet i åk 6
eller övergången till algebra i åk 7) synlig i realtid, kopplad till vad som ska
undervisas härnäst.

Och – viktigast – den **sluter loopen**. Att se en lucka och föreslå en åtgärd är
ingen uppföljning. Varje lucka är ett eget objekt med livscykel: *upptäckt →
insats påbörjad (datum, ansvarig) → ommätt (datum) → utfall (bemästrad eller ej)*.
Först då kan huvudmannen se det som faktiskt betyder något: **hur stor andel av
upptäckta luckor som stängs inom en termin, per skola**.

Komplexiteten ligger i motorn, inte i gränssnittet. Kunskapsgrafen, kaskaden och
riskmodellen är avancerade – men ingen användare rör dem. Det som faktiskt begärs
av en lärare är **två fält per lucka**, cirka femton sekunder.

## Kom igång

Krav: Python 3.11+, Node 18+.

```bash
make install   # installerar backend- (venv) och frontend-beroenden
make demo      # seedar syntetisk data och startar backend (8000) + frontend (5173)
```

Öppna sedan http://localhost:5173.

Vill du bara seeda om datan:

```bash
make seed                       # 2000 elever, seed 42 (default, reproducerbart)
make seed STUDENTS=1500 SEED=7  # annan storlek/seed
```

Backend och frontend kan också köras var för sig: `make dev-backend`,
`make dev-frontend`.

### Utan `make` (t.ex. Windows utan make installerat)

Samma steg manuellt. På Windows ligger venv-binärerna i `Scripts/` (på
macOS/Linux i `bin/`):

```powershell
# Backend (PowerShell)
cd backend
python -m venv .venv
.venv\Scripts\pip install -e .
.venv\Scripts\python seed.py --students 2000 --seed 42
.venv\Scripts\uvicorn app.main:app --reload --port 8000

# Frontend (nytt terminalfönster)
cd frontend
npm install
npm run dev
```

## Arkitektur

| Lager | Teknik |
|---|---|
| Backend | Python, FastAPI, Pydantic v2, SQLModel |
| Databas | SQLite (default) – **portabel** mot Postgres/Supabase genom att byta `DATABASE_URL` |
| Simulering | NumPy (pedagogisk kaskad genom kunskaps-DAG:en) |
| Frontend | React 18 + TypeScript + Vite + Tailwind |
| Diagram | Recharts (trajektorier/staplar), React Flow (progressionsgraf) |

Hela DB-access går via SQLModel – ingen SQLite-specifik SQL. Byt
`DATABASE_URL` (miljövariabel) så pekar appen mot Postgres utan kodändring.

### Vakter inbyggda från start
- **Riskmodellen använder enbart färdighetssignal.** Socioekonomisk bakgrund
  (`ses_kontext`) och skolans socioekonomiska index (`socioekonomiskt_index`,
  syntetiskt men på stadens skala: 0–100 lågindex, 101–200 mellanindex, över 200
  högindex, där lågindex är mer gynnsam elevsammansättning) finns *endast* för
  likvärdighetsanalys på aggregerad nivå – aldrig som input till en elevs risk.
- Varje röd siffra leder till **nästa steg** (vilken förkunskap att repetera),
  inte till en stämpel.
- Allt är tydligt märkt **syntetisk data**.
- Pseudonymiserade id:n och konceptuell rollseparation (Huvudman/Rektor/Lärare).
- **En registrerad insats sänker aldrig risken. Bara en ommätning gör det.**
  Ommätningen skrivs som en vanlig `Assessment` och räknas om genom `risk.py`
  precis som ett nationellt prov. Utan den vakten hade "andel stängda luckor"
  gått att stänga med papper.
- **Stängningsgrad redovisas alltid bredvid upptäcktsgrad** (luckor per 100
  elever). Ensam belönar den första siffran en skola som tittar bort.
- **Ansvarig registreras för överlämning, aldrig för ranking.** Loop-KPI:er
  aggregeras på klass, skola och kommun – aldrig per lärare.

## Loopen: från upptäckt lucka till ommätt utfall

En lucka (`Kunskapslucka`) **upptäcks maskinellt** ur mätningarna – den skrivs
aldrig in för hand. En episod öppnas vid första mätningen under tröskeln (0,5)
och stängs vid första senare mätningen över den. Faller noden igen öppnas en ny
episod: ett återfall är en ny lucka, inte den gamla.

Det enda som fylls i är två fält. Utfallet skrivs aldrig in – det följer av
ommätningen:

| Fält | Vad | Var |
|---|---|---|
| **Insats påbörjad** | datum + ansvarig | `POST /api/gaps/{id}/insats` |
| **Ommätt** | datum + vad ommätningen visade | `POST /api/gaps/{id}/ommatning` |
| *Utfall* | *härleds (≥ 0,5 → stängd)* | – |

Fyra statusar, för att fyra är vad någon kan agera på: `väntar på insats` ·
`insats pågår` · `kvarstår efter ommätning` · `stängd`. Om en pågående insats
passerat sin planerade ommätning är det en *flagga* ovanpå statusen, inte ett
femte läge.

En enda frist finns i systemet: **ommätning tio veckor efter insats**. Den går
att agera på. Någon frist för när insatsen ska ha startat finns medvetet inte –
det hade blivit ett efterlevnadsmått som inbjuder till bockande. Att en lucka
*saknar* insats är signalen som betyder något.

**Stängd inom en termin** har en ärlig nämnare: bara luckor vars terminsfönster
hunnit löpa ut räknas. En lucka som hittades i veckan hålls inte till en
stängning den aldrig haft tid för.

Enheten är luckan, inte eleven – men antalet elever skrivs alltid ut bredvid, så
att "3 560 luckor" inte läses som 3 560 elever. (Ett elevbaserat mått testades
och förkastades: "alla luckor stängda" domineras av hur *många* luckor en elev
har, vilket vänder på jämförelsen mellan skolor.)

## Vyer (drill-down Huvudman ▸ Skola ▸ Klass ▸ Elev)

Varje nivå har **ett** loop-mått och en bild – inte ett instrumentbräde.

- **Huvudman** (`/`): andel stängda inom en termin i KPI-bandet, och en trend
  per upptäcktstermin. Skoljämförelsen visar stängningsgrad och upptäcktsgrad
  bredvid varandra. Plus trösklar (N6/N12/N17), systemvarningar och
  likvärdighetspanel.
- **Skola** (`/skola/:id`): tre tal (stängningsgrad, upptäcktsgrad, luckor som
  väntar) och luckflödet upptäckta → insats → ommätta → stängda. Sedan "luckor
  som står still", kohorttrend, tröskelstatus, klasser som driver risk.
- **Klass** (`/klass/:id`): ingen styrpanel alls. Tröskelstatus, "fokus denna
  vecka" (med hur många i varje grupp som har påbörjad insats) och "att följa
  upp" – en lista med en knapp per rad.
- **Elev** (`/elev/:id`): progressionsgraf (DAG), risktrajektoria och
  **"Åtgärd och uppföljning"**: varje lucka med sin tidslinje och de två
  registreringarna som stänger den.
- **Jämförelse** (`/elev/:id/jamforelse`): **demons höjdpunkt** – "Dagens
  uppföljning" (ett F utan förvarning i åk 9) vs "Modern uppföljning" (risken
  syntes redan i åk 6).

## Demo-elever

Seedade med default (`make seed`, dvs `STUDENTS=2000 SEED=42`). Navbar länkar
direkt till dem; id:na hämtas också från `GET /api/demo/scenarios`.

| Scenario | Elev-id | Vad som visas |
|---|---|---|
| **Den tysta eleven** | `elev-00987` | Godkänd t.o.m. åk 5, tappar proportionalitet (N12) i åk 6, F i åk 9. Risk röd redan från åk 6 – men ingen insats påbörjas någonsin, och luckorna kaskaderar. Perfekt för jämförelsevyn. |
| **Återhämtaren** | `elev-01327` | *Samma* N12-lucka, upptäckt samma dag som hos den tysta eleven – men här sätts en insats in i tid (HT åk 7), ommätning tio veckor senare visar 71 %, luckan stängs inom en termin. Risken faller från åk 7, betyg A. Kontrasten mellan de två eleverna *är* poängen. |
| **Tröskelskolan** | Skola 1 (*Centrumskolan*) | Skola där N12 systematiskt missas i åk 6 → kraftigt förhöjd F-andel i åk 9 (oberoende av socioekonomiskt index). Driver huvudmannavyn. |

> Kör du med en annan `SEED`/`STUDENTS` får eleverna andra id:n – kolla
> `GET /api/demo/scenarios` eller utskriften från `make seed`.

## API (urval)

| Metod | Path |
|---|---|
| GET | `/api/health` |
| GET | `/api/progression/graph` |
| GET | `/api/huvudman/overview` |
| GET | `/api/schools/{id}` |
| GET | `/api/classes/{id}/heatmap`, `/api/classes/{id}/focus` |
| GET | `/api/students/{id}`, `/api/students/{id}/comparison` |
| GET | `/api/students?risk_level=3` |
| GET | `/api/gaps?student_id=&klass_id=&school_id=&status=&oppna=` |
| POST | `/api/gaps/{id}/insats` – `{ansvarig_namn, datum?}` |
| POST | `/api/gaps/{id}/ommatning` – `{mastery, datum?}` |
| POST | `/api/seed?students=2000&seed=42` |

`POST /api/gaps/{id}/ommatning` skriver en `Assessment` och räknar om elevens
hela risktrajektoria. `POST /api/gaps/{id}/insats` skriver ingen mätning alls –
det är vakten, i kod.

## Publicera demon till GitHub Pages

Eftersom det är **syntetisk data** kan hela appen köras statiskt – ingen server
behövs. Ett bygg-steg kör simulatorn och skriver alla API-svar till statiska
JSON-filer (`backend/snapshot.py`), och frontenden läser dem direkt
(`VITE_STATIC=1`).

I statiskt läge finns ingen server att skriva till. Registreringar sparas därför
i webbläsarens `localStorage` och läggs ovanpå snapshotten – KPI:erna räknas om
lokalt (samma regler som `app/loop.py`, speglade i `api/client.ts`) så att demon
faktiskt svarar när man registrerar en insats. Risktrajektorian räknas dock om
först när appen kör mot backend; elevvyn säger det rakt ut.

Workflowen [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml)
gör allt vid push till `main`. Aktivera en gång:

1. GitHub → repo **Settings ▸ Pages ▸ Build and deployment ▸ Source = GitHub Actions**.
2. Pusha till `main` (eller kör workflowen manuellt).

Sidan hamnar på `https://<org>.github.io/app-matematikuppfoljning/`.

Bygg snapshot + statisk sajt lokalt:

```bash
cd backend && ../$(VENV_BIN)/pip install -e ".[snapshot]" && ../$(VENV_BIN)/python snapshot.py
cd ../frontend && VITE_STATIC=1 VITE_BASE=/app-matematikuppfoljning/ npm run build && npm run preview
```

> Bas-sökvägen (`VITE_BASE`) måste matcha repo-namnet eftersom project-Pages
> serveras under `/<repo>/`. SPA-routing klaras av en `404.html`-kopia.

## Produktionsväg (utanför demon)

SQLite → Supabase/Postgres (medallion: bronze rådata, silver mastery per nod,
gold rollvyer + risk); riktig inläsning av delprovs-/uppgiftsnivå från
provplattformen; auto-rättade checkpoint-diagnoser; rollbaserad åtkomst + GDPR;
schemalagd om-beräkning av riskscores.

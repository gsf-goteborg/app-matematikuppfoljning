# Matematikuppföljning FK→Åk9 (demo)

> **DEMO – syntetisk data. Inga riktiga elever.**
> En proof-of-concept för hur kontinuerlig matematikuppföljning *borde* se ut:
> mät **var i kunskapskedjan varje elev är**, kontinuerligt, så att ingen elev
> tyst halkar efter och ingen blir chockad av många F i åk 9.

Dagens uppföljning mäter resultatet i slutet (betyg i åk 9) – ett *lagging
indicator* som kommer för sent. Den här appen vänder på logiken och gör den
**kunskapslucka som uppstår flera år tidigare** (oftast vid proportionalitet i åk 6
eller övergången till algebra i åk 7) synlig i realtid, kopplad till vad som ska
undervisas härnäst.

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
  (`ses_kontext`) och skolans `intag_index` finns *endast* för
  likvärdighetsanalys på aggregerad nivå – aldrig som input till en elevs risk.
- Varje röd siffra leder till **nästa steg** (vilken förkunskap att repetera),
  inte till en stämpel.
- Allt är tydligt märkt **syntetisk data**.
- Pseudonymiserade id:n och konceptuell rollseparation (Huvudman/Rektor/Lärare).

## Vyer (drill-down Huvudman ▸ Skola ▸ Klass ▸ Elev)

- **Huvudman** (`/`): skoljämförelse på trösklar (N6/N12/N17), systemvarningar,
  likvärdighetspanel.
- **Skola** (`/skola/:id`): kohorttrend, tröskelstatus per årskurs, klasser som
  driver risk.
- **Klass** (`/klass/:id`): mastery-heatmap, tröskelstatus, "fokus denna vecka".
  Läraren *läser* – inga formulär.
- **Elev** (`/elev/:id`): progressionsgraf (DAG), risktrajektoria, nästa lucka +
  åtgärd.
- **Jämförelse** (`/elev/:id/jamforelse`): **demons höjdpunkt** – "Dagens
  uppföljning" (ett F utan förvarning i åk 9) vs "Modern uppföljning" (risken
  syntes redan i åk 6).

## Demo-elever

Seedade med default (`make seed`, dvs `STUDENTS=2000 SEED=42`). Navbar länkar
direkt till dem; id:na hämtas också från `GET /api/demo/scenarios`.

| Scenario | Elev-id | Vad som visas |
|---|---|---|
| **Den tysta eleven** | `elev-00987` | Godkänd t.o.m. åk 5, tappar proportionalitet (N12) i åk 6, F i åk 9. Risk röd redan från åk 6. Perfekt för jämförelsevyn. |
| **Återhämtaren** | `elev-01327` | Tidig lucka vid N12 som åtgärdas – risken faller från åk 7. Visar att systemet fångar förbättring, inte bara dömer. |
| **Tröskelskolan** | Skola 1 (*Centrumskolan*) | Skola där N12 systematiskt missas i åk 6 → kraftigt förhöjd F-andel i åk 9 (oberoende av intag). Driver huvudmannavyn. |

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
| POST | `/api/seed?students=2000&seed=42` |

## Publicera demon till GitHub Pages

Eftersom det är **syntetisk data** kan hela appen köras statiskt – ingen server
behövs. Ett bygg-steg kör simulatorn och skriver alla API-svar till statiska
JSON-filer (`backend/snapshot.py`), och frontenden läser dem direkt
(`VITE_STATIC=1`).

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

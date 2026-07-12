# Real Estate CRM

Mobile-first CRM for real estate sales and rentals.

## Stack

- **Frontend**: Next.js 16 (PWA), TypeScript, Tailwind CSS
- **Backend**: FastAPI, SQLAlchemy, PostgreSQL + PostGIS
- **Auth**: JWT (admin + user roles)

## Quick start

### 1. Start database & backend

```bash
docker compose up -d db
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python seed.py --admin-only   # admin account only (recommended)
# python seed.py --demo       # optional: admin + sample inventory
uvicorn app.main:app --reload --port 8000
```

### 2. Start frontend

```bash
cd frontend
cp .env.local.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Accounts

**Admin-only seed** (default): creates one admin from env (or defaults below). Create team users in **Admin → Users**.

| Variable | Default |
|----------|---------|
| `SEED_ADMIN_EMAIL` | `admin@example.com` |
| `SEED_ADMIN_PASSWORD` | `admin123` |
| `SEED_ADMIN_NAME` | `Admin User` |
| `SEED_ADMIN_PHONE` | _(empty)_ |

**Demo seed** (`python seed.py --demo`): also creates `user@example.com` / `user123` plus sample inventory.

### Oracle VM — wipe DB and seed admin only

```bash
cd ~/realestate_crm
git pull
# Put SEED_ADMIN_* in docker-compose.oracle.yml (see docker-compose.oracle.yml.example)
docker compose -f docker-compose.oracle.yml down -v   # DESTROYS all DB data
docker compose -f docker-compose.oracle.yml up -d --build
docker compose -f docker-compose.oracle.yml exec backend python seed.py --admin-only
```

Then log in with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`, open **Admin → Users**, and create real team accounts.

## Features

- **Home dashboard** — overdue follow-ups, site visits today, hot leads
- **Call Mode** — pick buyer/seller/renter/landlord → property drill-down
- **People** — lead scoring, urgency, follow-up & site visit scheduling
- **Listings gallery** — seller/landlord listings with photos and videos
- **Excel import** — fixed templates per contact type with preview/confirm
- **WhatsApp Phase 1** — tap-to-chat via `wa.me` with context templates
- **Data Entry** — inventory CRUD + seller/landlord listing media upload
- **Search** — global search across contacts, locations, projects, specs

## WhatsApp Business API (Phase 2)

Configure when ready for inbound message logging:

| Variable | Description |
|----------|-------------|
| `WHATSAPP_TOKEN` | Meta Cloud API access token |
| `WHATSAPP_PHONE_ID` | WhatsApp phone number ID |
| `WHATSAPP_VERIFY_TOKEN` | Webhook verification token |

Webhook endpoint: `POST /webhooks/whatsapp` (verify via `GET /webhooks/whatsapp`).
Messages are stored in `whatsapp_messages` and exposed at `GET /contacts/{id}/whatsapp-messages`.

## Environment

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend URL (default `http://localhost:8000`) |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps Places API key |
| `JWT_SECRET` | Backend JWT signing secret |
| `SMTP_*` | Optional SMTP for builder lead emails |

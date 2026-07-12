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
python seed.py
uvicorn app.main:app --reload --port 8000
```

### 2. Start frontend

```bash
cd frontend
cp .env.local.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Demo accounts

| Email | Password | Role |
|-------|----------|------|
| admin@example.com | admin123 | Admin — user management & full access |
| user@example.com | user123 | User — calls, people, properties, import, listings |

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

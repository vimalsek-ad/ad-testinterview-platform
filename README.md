# AD Interview Platform

Enterprise coding assessment and interview platform for Alter Domus.

## Quick Start

### 1. Start Infrastructure

```bash
docker compose up -d
```

This starts: PostgreSQL, Redis, Judge0 CE (code execution engine).

Verify Judge0 is running:
```bash
curl http://localhost:2358/languages | head -5
```

### 2. Run Backend

```bash
cd services/interview-api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn src.main:app --reload --port 8000
```

API docs at: http://localhost:8000/docs

### 3. Run Frontend (coming soon)

```bash
cd web
npm install
npm run dev
```

Frontend at: http://localhost:5173

## Project Structure

```
ad-interview-platform/
├── services/
│   └── interview-api/       # FastAPI backend
│       ├── src/
│       │   ├── main.py      # App entry point
│       │   ├── config/      # Settings, database
│       │   ├── auth/        # Register, login, JWT
│       │   ├── models/      # SQLAlchemy models (all tables)
│       │   └── execution/   # Judge0 integration
│       ├── requirements.txt
│       └── .env
├── web/                     # React frontend (TBD)
├── docker-compose.yml       # PostgreSQL + Redis + Judge0
├── .env.example
└── README.md
```

## Tech Stack

- **Backend:** Python, FastAPI, SQLAlchemy 2.0, asyncpg
- **Auth:** JWT (python-jose) + bcrypt password hashing
- **Database:** PostgreSQL 16
- **Code Execution:** Judge0 CE (sandboxed Docker containers)
- **Frontend:** React + TypeScript + Monaco Editor (coming soon)

## Team

| Member | Module |
|--------|--------|
| Vimal S | Foundation + Execution + Proctoring |
| Ashok Madhire | Questions + Assessments + AI Scoring |
| Rajasri Ravirala | Frontend (Candidate Experience) |
| Gatika Manaswini | Frontend (Admin Dashboard) + Proctoring SDK |

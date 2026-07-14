# AD Interview Platform

Enterprise coding assessment and interview platform for Alter Domus.

A unified platform where hiring teams can create coding challenges, conduct proctored assessments, record video interviews, auto-score submissions with AI, and make data-driven hiring decisions — all in one place.

**Repo:** https://github.com/vimalsek-ad/ad-testinterview-platform.git

---

## What's Built (15 of 16 Requirements Complete)

| # | Requirement | Status | Description |
|---|------------|--------|-------------|
| 1 | Team Management | ✅ | Create teams, add/remove members, team-level isolation |
| 2 | RBAC | ✅ | JWT auth, bcrypt passwords, role-based access (admin/lead/interviewer/candidate) |
| 3 | Question Bank | ✅ | Create coding questions with metadata, tags, difficulty, languages |
| 4 | Test Cases | ✅ | Visible + hidden test cases per question, input/output validation |
| 5 | Assessment Creation | ✅ | Select questions, set time limits, assign candidates with unique links |
| 6 | Code Editor | ✅ | Monaco Editor (VS Code-quality), syntax highlighting, 47 languages |
| 7 | Code Execution | ✅ | Judge0 CE via RapidAPI, sandboxed execution, pass/fail scoring |
| 8 | Proctoring | ✅ | MediaPipe face detection, gaze tracking, tab/paste monitoring, audio detection |
| 9 | Interview Q&A | ✅ | Video recording (webcam + mic), re-record support, upload to backend |
| 10 | AI Scoring | ✅ | LLM Gateway integration (Claude), rubric-based 4-dimension scoring |
| 11 | Review Dashboard | ✅ | View candidates, scores, flags, code — make select/reject/hold decisions |
| 12 | Audit Trail | ✅ | Auto-logs all mutations (actor, IP, path, duration), queryable API |
| 13 | Scalability | ⏭ | Skipped for prototype |
| 14 | Security | ✅ | JWT + bcrypt + audit logging + CORS |
| 15 | Notifications | ✅ | Assessment invitations + deadline reminders (logged for prototype) |
| 16 | Reporting | ✅ | Platform analytics, score distribution, proctoring stats |

---

## Quick Start

### Prerequisites

- **Docker Desktop** (running)
- **Python 3.12+**
- **Node.js 18+**
- **RapidAPI key** for Judge0 CE (free tier — sign up at https://rapidapi.com/judge0-official/api/judge0-ce)

### Step 1: Clone the repo

```bash
git clone https://github.com/vimalsek-ad/ad-testinterview-platform.git
cd ad-testinterview-platform
```

### Step 2: Start infrastructure

```bash
docker compose up -d
```

This starts PostgreSQL (port 5432) and Redis (port 6379).

### Step 3: Run the backend

```bash
cd services/interview-api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Create a `.env` file (copy from `.env.example` and fill in your RapidAPI key):

```env
DATABASE_URL=postgresql+asyncpg://admin:admin123@localhost:5432/interview_platform
JWT_SECRET_KEY=a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60
JUDGE0_URL=https://judge0-ce.p.rapidapi.com
RAPIDAPI_KEY=<your-rapidapi-key-here>
RAPIDAPI_HOST=judge0-ce.p.rapidapi.com
REDIS_URL=redis://localhost:6379
LLM_GATEWAY_URL=https://api.alterdomus.dev/llm-gateway/v1
LLM_GATEWAY_MODEL=eu.claude-4.5-sonnet
LLM_GATEWAY_TOKEN=
LLM_GATEWAY_ORG_ID=
FRONTEND_URL=http://localhost:5173
```

Start the API:

```bash
uvicorn src.main:app --reload --port 8000
```

- **API:** http://localhost:8000
- **Swagger Docs:** http://localhost:8000/docs

### Step 4: Run the frontend

```bash
cd web
npm install
npm run dev
```

- **Frontend:** http://localhost:5173

### Step 5: Use the platform

1. Open http://localhost:5173/login → **Register** a new account
2. Go to **Questions** → Create a coding question + add test cases
3. Go to **Assessments** → Create assessment → Assign a candidate email → Copy the link
4. Open the candidate link in a new browser tab (or incognito)
5. Write code → Click **Run** → Click **Submit** → See score
6. Go back to **Assessments** → Click **Review** → See candidate's code, score, proctoring flags → Make a decision

---

## Pages & URLs

| Page | URL | Who uses it |
|------|-----|------------|
| Login / Register | `/login` | Everyone |
| Dashboard | `/dashboard` | Interviewers, Admins |
| Teams | `/teams` | Admins, Team Leads |
| Question Bank | `/questions` | Interviewers |
| Assessments | `/assessments` | Interviewers |
| **Coding Assessment** | `/assessment/{token}` | Candidates |
| **Video Interview** | `/interview/{token}` | Candidates |
| **Review Dashboard** | `/review/{assessmentId}` | Interviewers, Team Leads |

---

## API Endpoints (33 total)

### Auth (3 endpoints)
```
POST /api/v1/auth/register          — Create account
POST /api/v1/auth/login             — Login → JWT token
GET  /api/v1/auth/me                — Get current user
```

### Teams (4 endpoints)
```
POST   /api/v1/teams/               — Create team
GET    /api/v1/teams/               — List teams
GET    /api/v1/teams/{id}           — Get team + members
POST   /api/v1/teams/{id}/members   — Add member by email
DELETE /api/v1/teams/{id}/members/{user_id} — Remove member
```

### Questions (3 endpoints)
```
POST /api/v1/questions                      — Create question
GET  /api/v1/questions                      — List questions
GET  /api/v1/questions/{id}                 — Get question + test cases
POST /api/v1/questions/{id}/test-cases      — Add test case
```

### Assessments & Sessions (5 endpoints)
```
POST /api/v1/assessments                    — Create assessment
POST /api/v1/assessments/{id}/assign        — Assign candidate → get unique link
GET  /api/v1/sessions/{token}               — Start session (candidate opens link)
POST /api/v1/sessions/{id}/execute          — Run code (visible tests only)
POST /api/v1/sessions/{id}/submit           — Final submit (all tests + score)
```

### Proctoring (2 endpoints)
```
POST /api/v1/sessions/{id}/proctoring/flags   — Receive flags from client SDK
GET  /api/v1/sessions/{id}/proctoring/report  — Get proctoring report
```

### Interview (2 endpoints)
```
POST /api/v1/interview/responses             — Upload video recording
GET  /api/v1/interview/responses/{session_id} — Get responses for session
```

### AI Scoring (4 endpoints)
```
POST /api/v1/scoring/interview/score          — Score response via LLM
POST /api/v1/scoring/text-score               — Score text (no auth, demo)
POST /api/v1/scoring/sessions/{id}/score-all  — Batch score all responses
GET  /api/v1/scoring/sessions/{id}            — Get scores
```

### Reviews (3 endpoints)
```
GET  /api/v1/reviews/assessments/{id}/candidates  — List candidates with scores/flags
GET  /api/v1/reviews/candidates/{session_id}      — Full candidate detail
POST /api/v1/reviews/candidates/{session_id}/decision — Record select/reject/hold
```

### Notifications (3 endpoints)
```
POST /api/v1/notifications/send-invite     — Send assessment invitation
POST /api/v1/notifications/send-reminder   — Send deadline reminder
GET  /api/v1/notifications/                — List sent notifications
```

### Admin & Reporting (4 endpoints)
```
GET /api/v1/admin/audit/                   — Query audit trail (filters: actor, method, path)
GET /api/v1/admin/analytics/overview       — Platform stats (users, questions, sessions, scores)
GET /api/v1/admin/analytics/scores         — Score distribution + stats
GET /api/v1/admin/analytics/proctoring-stats — Flag breakdown by type/severity
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Backend | Python 3.12 + FastAPI | REST API, 33 endpoints |
| Database | PostgreSQL 16 | Users, teams, questions, sessions, submissions |
| Cache | Redis 7 | Sessions, rate limiting (future) |
| Code Execution | Judge0 CE (RapidAPI) | Sandboxed code execution, 47 languages |
| Frontend | React 18 + TypeScript + Vite | Single-page application |
| Code Editor | Monaco Editor | VS Code-quality browser editor |
| Styling | TailwindCSS 4 | Utility-first CSS |
| Proctoring ML | MediaPipe Face Mesh | 468-point face landmarks + gaze tracking |
| Audio Detection | Web Audio API | Speech/voice activity detection |
| Video Recording | MediaRecorder API | Webcam + mic recording |
| AI Scoring | AD LLM Gateway (Claude) | Rubric-based interview response evaluation |
| Auth | python-jose (JWT) + bcrypt | Token-based authentication |
| ORM | SQLAlchemy 2.0 (async) | Database models and queries |
| HTTP Client | httpx | Async calls to Judge0 + LLM Gateway |
| Containers | Docker Compose | Local dev infrastructure |

---

## Project Structure

```
ad-testinterview-platform/
├── services/
│   └── interview-api/                 # FastAPI backend (33 endpoints)
│       ├── src/
│       │   ├── main.py                # App entry, middleware, routers
│       │   ├── config/
│       │   │   ├── settings.py        # All env vars (Pydantic)
│       │   │   └── database.py        # SQLAlchemy async engine
│       │   ├── auth/                  # Register, login, JWT, dependencies
│       │   ├── teams/                 # Team CRUD + member management
│       │   ├── questions/             # Question bank + test cases
│       │   ├── sessions/              # Assessments, sessions, code execution
│       │   ├── execution/             # Judge0 integration (RapidAPI + local fallback)
│       │   ├── proctoring/            # Flag ingestion + reports
│       │   ├── interviews/            # Video response upload
│       │   ├── scoring/               # LLM Gateway AI scoring
│       │   ├── reviews/               # Review dashboard + decisions
│       │   ├── audit/                 # Audit middleware + query API
│       │   ├── notifications/         # Email invitations + reminders
│       │   ├── reporting/             # Analytics + score distribution
│       │   └── models/                # SQLAlchemy models (all tables)
│       ├── requirements.txt
│       └── .env
├── web/                               # React frontend
│   ├── src/
│   │   ├── App.tsx                    # Router (8 pages)
│   │   ├── lib/api.ts                 # Axios + JWT interceptor
│   │   ├── pages/
│   │   │   ├── Login.tsx              # Register + Login
│   │   │   ├── Dashboard.tsx          # Overview + nav
│   │   │   ├── Teams.tsx              # Team management
│   │   │   ├── Questions.tsx          # Question bank + test cases
│   │   │   ├── Assessments.tsx        # Create + assign + review link
│   │   │   ├── Assessment.tsx         # Coding (Monaco + timer + proctoring)
│   │   │   ├── Interview.tsx          # Video recording
│   │   │   └── Review.tsx             # Candidate review + decisions
│   │   ├── components/
│   │   │   └── VideoRecorder.tsx      # Webcam recording
│   │   └── proctoring/
│   │       ├── ProctoringSDK.ts       # Orchestrator
│   │       ├── BrowserMonitor.ts      # Tab, paste, fullscreen
│   │       ├── FaceMonitor.ts         # MediaPipe face + gaze
│   │       └── AudioMonitor.ts        # Speech detection
│   └── package.json
├── docker-compose.yml                 # PostgreSQL + Redis
├── .env.example
└── README.md
```

---

## How Code Execution Works

```
Candidate writes code → clicks "Run"
  → Frontend sends code to backend
    → Backend sends to Judge0 CE (RapidAPI cloud)
      → Judge0 compiles + runs in Docker sandbox (10s limit, 256MB, no network)
        → Returns output
      → Backend compares output vs expected
    → Returns pass/fail + time + memory to frontend
```

**"Run" button:** Tests against visible test cases only (candidate sees results)
**"Submit" button:** Tests against ALL test cases (visible + hidden) → calculates final score

---

## How Proctoring Works

```
Assessment starts → Browser requests camera + microphone
  → ProctoringSDK initializes:
    ├── BrowserMonitor: listens for tab switch, blur, paste, rapid input
    ├── FaceMonitor: MediaPipe Face Mesh every 3 seconds
    │   ├── Face absent >5s → HIGH flag
    │   ├── Multiple faces → CRITICAL flag
    │   └── Gaze away >10s → MEDIUM flag
    └── AudioMonitor: Web Audio energy analysis every 500ms
        └── Speech >5s → MEDIUM flag

  → Flags batched and sent to backend every 10 seconds
  → Reviewer sees all flags with severity + timestamps in Review Dashboard
  → Integrity score calculated: 100 - (severity_weighted_sum × 2)
```

---

## How AI Scoring Works

```
Candidate submits interview response (text or transcribed video)
  → Backend sends to AD LLM Gateway:
    POST https://api.alterdomus.dev/llm-gateway/v1/chat/completions
    Model: eu.claude-4.5-sonnet
    Headers: Authorization: Bearer {token}, x-organization-id: {org}

  → LLM evaluates against rubric on 4 dimensions:
    - Relevance (0-100)
    - Completeness (0-100)
    - Accuracy (0-100)
    - Clarity (0-100)

  → Returns composite score + confidence level
  → If confidence < 0.6 → flagged for mandatory human review
```

---

## How the Review Dashboard Works

```
Interviewer opens Review Dashboard for an assessment
  → Sees all candidates ranked by score
  → Clicks a candidate → sees:
    ├── Code submission (syntax highlighted, test results)
    ├── Proctoring report (flags timeline, integrity score)
    └── Interview responses (video playback)

  → Makes decision:
    ✅ Select — Candidate moves forward
    ⏸ Hold — Needs more evaluation
    ❌ Reject — Not selected

  → Decision recorded with notes + reviewer identity + timestamp
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET_KEY` | Yes | 256-bit random hex for signing JWTs |
| `JUDGE0_URL` | Yes | Judge0 CE endpoint |
| `RAPIDAPI_KEY` | Yes | RapidAPI key for Judge0 |
| `RAPIDAPI_HOST` | Yes | `judge0-ce.p.rapidapi.com` |
| `LLM_GATEWAY_URL` | For AI scoring | AD LLM Gateway URL |
| `LLM_GATEWAY_MODEL` | For AI scoring | Model ID (e.g., `eu.claude-4.5-sonnet`) |
| `LLM_GATEWAY_TOKEN` | For AI scoring | Bearer token for M2M auth |
| `LLM_GATEWAY_ORG_ID` | For AI scoring | Organization ID for billing |
| `REDIS_URL` | Optional | Redis connection (sessions, caching) |
| `FRONTEND_URL` | Optional | Frontend origin for CORS |

---

## Team

| Member | Role | Module |
|--------|------|--------|
| Vimal S | Tech Lead | Foundation, Execution, Proctoring, Architecture |
| Ashok Madhire | Data Lead | Questions, Assessments, AI Scoring |
| Rajasri Ravirala | Developer | Frontend (Candidate Experience) |
| Gatika Manaswini | Developer | Frontend (Admin Dashboard), Proctoring SDK |

---

## What's Next (Future Enhancements)

- [ ] Whisper integration for video transcription → AI scoring pipeline
- [ ] Okta SSO (replace email/password auth)
- [ ] OpenFGA fine-grained authorization
- [ ] Email delivery (SES/SMTP) for real notifications
- [ ] Database-backed audit trail (replace in-memory)
- [ ] Docker deployment (Dockerfile + EKS Helm chart)
- [ ] Admin analytics frontend page (charts via Recharts)
- [ ] Code plagiarism detection (Dolos)
- [ ] Multi-question navigation in assessment UI

---

## License

Internal — Alter Domus

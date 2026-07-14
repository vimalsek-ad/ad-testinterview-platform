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
| 8 | Proctoring | ✅ | TensorFlow.js face detection, tab/paste/blur monitoring, speech detection, webcam stream |
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
| Proctoring — Face AI | TensorFlow.js + @tensorflow-models/face-detection | Face detection (absent, multiple, gaze) — runs in browser |
| Proctoring — Audio | Web Audio API (AudioContext + AnalyserNode) | Speech/voice activity detection |
| Proctoring — Browser | Native Browser APIs | Tab switch, paste, blur, rapid input detection |
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
│   │       ├── FaceMonitor.ts         # TensorFlow.js face detection
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

### Models & Technologies Used

| Layer | Technology | What it does |
|-------|-----------|-------------|
| **Face Detection** | TensorFlow.js + `@tensorflow-models/face-detection` | Detects faces in webcam (0, 1, 2+ faces) — runs in browser |
| **Face Model** | MediaPipe FaceDetector (Short Range) via TF.js runtime | ~1.7MB model, cached after first load |
| **Speech Detection** | Web Audio API (AudioContext + AnalyserNode) | Monitors microphone energy levels for human speech |
| **Browser Monitoring** | Native Browser APIs (Visibility, Blur, Clipboard, Input) | Detects tab switches, window focus loss, paste events |
| **Camera Stream** | getUserMedia API | Continuous webcam feed for visual deterrent + face detection |

### Proctoring Checks

| # | Check | Technology | Trigger | Severity |
|---|-------|-----------|---------|----------|
| 1 | Tab switch | `document.visibilitychange` | Candidate switches browser tab | 🟠 HIGH |
| 2 | Window blur | `window.blur` event | Candidate clicks outside browser | 🟡 MEDIUM |
| 3 | External paste | `document.paste` event | Paste from outside (counts chars) | 🟡 MEDIUM |
| 4 | Rapid input | Input vs keydown timing | >200 chars without keystrokes (AI injection) | 🟠 HIGH |
| 5 | Speech detected | Web Audio API energy > threshold | Someone talking for >5 seconds | 🟡 MEDIUM |
| 6 | Face absent | TensorFlow.js face-detection | 0 faces for >5 seconds | 🟠 HIGH |
| 7 | Multiple faces | TensorFlow.js face-detection | 2+ faces in frame | 🔴 CRITICAL |
| 8 | Gaze away | TensorFlow.js face position | Face in outer 20% of frame | 🟡 MEDIUM |

### Proctoring Flow

```
Candidate opens link → System Check page:
  ├── Camera access required (blocks if denied)
  ├── Microphone access required (blocks if denied)
  └── Must acknowledge proctoring rules (checkbox)

Candidate clicks "Start Assessment" → Proctoring begins:
  ├── BrowserMonitor.start()
  │   ├── Registers: visibilitychange, blur, paste, input events
  │   └── Detects tab switches, paste, rapid typing immediately
  │
  ├── FaceMonitor.start()
  │   ├── Opens webcam stream (640x480)
  │   ├── Loads TensorFlow.js face-detection model (~1.7MB, cached)
  │   └── Every 3 seconds: analyzes frame for faces
  │       ├── 0 faces >5s → HIGH flag (face_absent)
  │       ├── 2+ faces → CRITICAL flag (multiple_faces)
  │       └── Face off-center → MEDIUM flag (gaze_away)
  │
  └── AudioMonitor.start()
      ├── Opens microphone stream
      └── Every 500ms: checks audio energy level
          └── Energy > threshold for >5s → MEDIUM flag (speech_detected)

During assessment:
  → Flags stored locally + displayed in UI (🚨 counter)
  → Every 3 seconds: batch-sent to backend POST /proctoring/flags
  → Backend stores in PostgreSQL
  → Warning banner shown after 5+ flags

Assessment complete → Proctoring stops:
  → Camera + microphone released
  → Final flags flushed to backend
  → Integrity score calculated: 100 - (severity_weighted_sum × 2)
  → Reviewer sees full timeline in Review Dashboard
```

---

## End-to-End Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    COMPLETE HIRING WORKFLOW                       │
└─────────────────────────────────────────────────────────────────┘

ADMIN SETUP:
  1. Platform Admin registers → creates hiring teams
  2. Adds Team Leads + Interviewers to teams

QUESTION CREATION:
  3. Interviewer creates coding questions (+ test cases)
  4. Interviewer creates interview questions (video response)

ASSESSMENT:
  5. Interviewer creates assessment → selects questions → sets time limit
  6. Assigns candidates → generates unique links

CANDIDATE EXPERIENCE:
  7. Candidate opens link → System Check (camera + mic required)
  8. Passes check + acknowledges proctoring → assessment starts
  9. For coding questions:
     → Monaco Editor → writes code → Run (visible tests) → Submit (all tests)
     → Judge0 executes in sandbox → pass/fail + score
  10. For interview questions:
     → Video Recorder → records answer (webcam + mic) → Submit
     → Whisper transcribes audio → LLM scores against rubric
  11. Proctoring runs continuously (tab switch, face detection, speech)
  12. After all questions → "Assessment Complete" screen → camera stops

SCORING:
  13. Coding: automated (test cases passed / total × 100)
  14. Interview: AI-scored (relevance + completeness + accuracy + clarity)
  15. Composite: weighted average across all questions

REVIEW:
  16. Reviewer opens Review Dashboard → sees:
      - Candidate list (sorted by score)
      - Code submissions (syntax highlighted + test results)
      - Interview responses (transcription + AI score)
      - Proctoring report (86 flags, integrity score)
  17. Makes decision: ✅ Select | ⏸ Hold | ❌ Reject
  18. Decision stored in PostgreSQL with reviewer + timestamp

DATA:
  All data persists in PostgreSQL (14 tables):
  - user_account, team, team_membership
  - question, test_case
  - assessment, assessment_question, candidate_session
  - code_submission, interview_response
  - proctoring_flag, review_decision
  - audit_log, notification
```

---

## How AI Scoring Works

```
Candidate records video answer (webcam + audio)
  → Video saved to backend
    → Whisper (local, OpenAI model) transcribes audio → text
      → Text sent to AD LLM Gateway:
          POST https://api.alterdomus.dev/llm-gateway/v1/chat/completions
          Model: eu.claude-4.5-sonnet (or claude-opus-4-7)
          Auth: Bearer JWT + x-organization-id header

      → LLM evaluates against rubric on 4 dimensions:
          - Relevance (0-100): Does it answer the question?
          - Completeness (0-100): Are key points covered?
          - Accuracy (0-100): Are technical claims correct?
          - Clarity (0-100): Well-structured and clear?

      → Returns composite score + confidence level (0.0-1.0)
      → If confidence < 0.6 → flagged for mandatory human review
      → Score stored in PostgreSQL → visible in Review Dashboard
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

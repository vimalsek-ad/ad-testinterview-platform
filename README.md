# AD Hire — Enterprise Interview & Assessment Platform

Enterprise coding assessment and interview platform for Alter Domus.

A unified platform where hiring teams can create coding challenges, conduct proctored assessments, record video interviews, auto-score submissions with AI, and make data-driven hiring decisions — all in one place.

---

## What's Built (16 of 16 Requirements Complete)

| # | Requirement | Status | Description |
|---|------------|--------|-------------|
| 1 | Team Management | ✅ | Create teams, add/remove members, team-level data isolation |
| 2 | RBAC | ✅ | JWT auth, bcrypt passwords, role-based access (admin/lead/interviewer/candidate) |
| 3 | Question Bank | ✅ | Coding + interview questions with metadata, tags, difficulty, reference solutions |
| 4 | Test Cases | ✅ | Visible + hidden test cases per question, input/output validation |
| 5 | Assessment Creation | ✅ | Select questions, set time limits, assign candidates with unique links |
| 6 | Code Editor | ✅ | Monaco Editor (VS Code-quality), syntax highlighting, 47 languages |
| 7 | Code Execution | ✅ | Judge0 CE via RapidAPI, sandboxed execution, pass/fail scoring |
| 8 | Proctoring | ✅ | TensorFlow.js face detection, tab/paste/blur monitoring, speech detection (pauses for interview Qs) |
| 9 | Interview Q&A | ✅ | Video recording (webcam + mic), S3 upload, AWS Transcribe, AI scoring |
| 10 | AI Scoring | ✅ | LiteLLM Gateway (eu.claude-4.8-opus with fallback), 4-dimension rubric scoring |
| 11 | Review Dashboard | ✅ | Full candidate dashboard with charts, timing, code diff, PDF export |
| 12 | Audit Trail | ✅ | Auto-logs all mutations (actor, IP, path, duration), queryable API |
| 13 | Team Scoping | ✅ | Questions, assessments, candidates, stats all scoped to team |
| 14 | Security | ✅ | JWT + bcrypt + audit logging + CORS |
| 15 | Notifications | ✅ | Assessment invitations + deadline reminders (logged for prototype) |
| 16 | Reporting | ✅ | Team-scoped analytics, score distribution, candidate pipeline charts |

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

Create a `.env` file:

```env
DATABASE_URL=postgresql+asyncpg://admin:admin123@localhost:5432/interview_platform
JWT_SECRET_KEY=a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2
JUDGE0_URL=https://judge0-ce.p.rapidapi.com
RAPIDAPI_KEY=<your-rapidapi-key>
RAPIDAPI_HOST=judge0-ce.p.rapidapi.com
REDIS_URL=redis://localhost:6379
LLM_GATEWAY_URL=https://litellm.alterdomus.cloud/v1
LLM_GATEWAY_MODEL=eu.claude-4.8-opus
LLM_GATEWAY_FALLBACK_MODEL=eu.claude-5-sonnet
LLM_GATEWAY_TOKEN=<your-litellm-key>
AWS_REGION=eu-central-1
S3_RECORDINGS_BUCKET=ad-interview-recordings
TRANSCRIBE_LANGUAGE_CODE=en-US
FRONTEND_URL=http://localhost:5173
```

Start the API:

```bash
uvicorn src.main:app --reload --port 8000
```

### Step 4: Run the frontend

```bash
cd web
npm install
npm run dev
```

### Step 5: Use the platform

1. Open http://localhost:5173/login → Select your role → Register/Login
2. Create a team → Add members
3. Create questions (coding + interview) with reference solutions
4. Create an assessment → Assign candidates → Copy link
5. Candidate opens link → System check → Takes assessment
6. Review candidates → Full dashboard with charts, timing, AI scores → Decide

---

## Pages & Navigation

| Page | URL | Description |
|------|-----|------------|
| Login | `/login` | Role selection, sign in/register |
| Dashboard | `/dashboard` | Overview stats, charts, recent candidates |
| Teams | `/teams` | Team CRUD, member management |
| Questions | `/questions` | Question bank with search/filter |
| Assessments | `/assessments` | Create, assign, review links |
| Review | `/review/:assessmentId` | Candidate grid with filters |
| Candidate Dashboard | `/candidate/:sessionId` | Full review: charts, timing, code, AI, decision |
| Coding Assessment | `/assessment/:token` | Candidate-facing: Monaco editor + proctoring |
| Video Interview | `/interview/:token` | Candidate-facing: video recording |

---

## Key Features

### Candidate Dashboard (Reviewer Experience)
- Score vs Team Average bar chart
- Question-level timing (duration per question)
- Code tab with expandable source + reference solution comparison
- Interview tab with transcription + AI score
- Proctoring tab with all flags and timestamps
- Activity timeline (every event chronologically)
- PDF export (printable candidate report)
- Decision panel (Select / Hold / Reject with notes)

### Team Scoping
- Questions only visible to team members
- Assessments scoped to team
- Dashboard stats filtered by team
- Decision counts scoped to team candidates

### AI Scoring Pipeline
```
Video Recording → S3 Upload → AWS Transcribe → LLM Scoring
                                                 ↓
                              eu.claude-4.8-opus (fallback: eu.claude-5-sonnet)
                                                 ↓
                              4-dimension rubric: Relevance, Completeness,
                              Accuracy, Clarity (0-100 each)
                                                 ↓
                              Composite score + confidence level
                              If confidence < 0.6 → flagged for human review
```

### Proctoring (Smart per question type)
- **Coding questions:** Full monitoring (face, speech, tab switch, paste)
- **Interview questions:** Audio monitoring paused (speech expected), face + browser still active

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Backend | Python 3.12 + FastAPI | REST API, 35+ endpoints |
| Database | PostgreSQL 16 | All persistent data (14 tables) |
| Cache | Redis 7 | Sessions, rate limiting |
| Code Execution | Judge0 CE (RapidAPI) | Sandboxed execution, 47 languages |
| Frontend | React 18 + TypeScript + Vite | Single-page application |
| UI Framework | TailwindCSS 4 | Utility-first styling |
| Code Editor | Monaco Editor | VS Code-quality browser editor |
| Proctoring | TensorFlow.js + Web Audio API | Face detection + speech detection |
| Video Recording | MediaRecorder API | Webcam + mic capture |
| Transcription | AWS Transcribe + S3 | Speech-to-text (replaces local Whisper) |
| AI Scoring | LiteLLM Gateway (Claude) | Rubric-based evaluation |
| Auth | python-jose (JWT) + bcrypt | Token-based authentication |
| ORM | SQLAlchemy 2.0 (async) | Database models and queries |
| Infrastructure | Docker Compose | Local dev (PostgreSQL + Redis) |
| AWS | S3, Transcribe | Video storage + transcription |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET_KEY` | Yes | 256-bit random hex for signing JWTs |
| `JUDGE0_URL` | Yes | Judge0 CE endpoint |
| `RAPIDAPI_KEY` | Yes | RapidAPI key for Judge0 |
| `RAPIDAPI_HOST` | Yes | `judge0-ce.p.rapidapi.com` |
| `LLM_GATEWAY_URL` | For AI scoring | LiteLLM proxy URL |
| `LLM_GATEWAY_MODEL` | For AI scoring | Primary model (eu.claude-4.8-opus) |
| `LLM_GATEWAY_FALLBACK_MODEL` | For AI scoring | Fallback model (eu.claude-5-sonnet) |
| `LLM_GATEWAY_TOKEN` | For AI scoring | API key for LiteLLM |
| `AWS_REGION` | For transcription | AWS region (eu-central-1) |
| `AWS_ACCESS_KEY_ID` | For transcription | AWS credentials (or use IAM role) |
| `AWS_SECRET_ACCESS_KEY` | For transcription | AWS credentials |
| `AWS_SESSION_TOKEN` | For transcription | STS session token (if using temporary creds) |
| `S3_RECORDINGS_BUCKET` | For transcription | S3 bucket for video recordings |
| `REDIS_URL` | Optional | Redis connection |
| `FRONTEND_URL` | Optional | Frontend origin for CORS |

---

## Team

| Member | Role |
|--------|------|
| Ranjan Kumar | Team Lead |
| Vimal S | Tech Lead |
| Ashok Madhire | Data Lead |
| Rajasri Ravirala | Developer |
| Gatika Manaswini | Storyteller |

---

## What's Next (Future Enhancements)

- [ ] Okta SSO (replace email/password auth)
- [ ] OpenFGA fine-grained authorization
- [ ] Email delivery (SES/SMTP) for real notifications
- [ ] Docker deployment (Dockerfile + EKS Helm chart)
- [ ] Code plagiarism detection (Dolos)
- [ ] Video playback in review (stream from S3)
- [ ] Candidate comparison view (side-by-side)
- [ ] Custom scoring rubrics per question
- [ ] Bulk candidate import (CSV)
- [ ] Webhook integrations (Slack, Teams)

---

## License

Internal — Alter Domus

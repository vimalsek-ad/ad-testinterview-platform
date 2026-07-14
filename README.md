# AD Interview Platform

Enterprise coding assessment and interview platform for Alter Domus.

A unified platform where hiring teams can create coding challenges, conduct proctored assessments, record video interviews, auto-score submissions, and make data-driven hiring decisions — all in one place.

---

## Features Implemented

### ✅ Authentication & Authorization (Requirement 1-2)
- Email + password registration with bcrypt hashing
- JWT token-based authentication (1-hour expiry)
- Role-based access: Platform Admin, Team Lead, Interviewer, Candidate
- Protected endpoints with FastAPI dependency injection

### ✅ Team Management (Requirement 1)
- Create hiring teams (e.g., Data Engineering, DevOps, Frontend)
- Add/remove members with roles (team_lead, interviewer)
- Team-level data isolation — each team manages their own question bank
- Creator automatically assigned as team_lead

### ✅ Question Bank (Requirement 3-4)
- Create coding questions with title, description, difficulty, tags, supported languages
- Add test cases with input/output pairs (visible or hidden from candidates)
- Bulk support for multiple test cases per question (max 50)
- Full-text search capability (PostgreSQL tsvector)
- Question versioning support

### ✅ Assessment Engine (Requirement 5)
- Create assessments by selecting questions from the bank
- Configure time limits (5-300 minutes)
- Assign candidates — generates unique session tokens + shareable links
- Assessment status lifecycle: draft → published → closed

### ✅ Code Editor & Execution (Requirement 6-7)
- Monaco Editor (VS Code-quality) with syntax highlighting, bracket matching, code folding
- 47 programming languages supported via Judge0 CE (Python, Java, JavaScript, C++, Go, Rust, etc.)
- "Run" button — executes against visible test cases only
- "Submit" button — executes against ALL test cases (visible + hidden) and calculates score
- Real-time results: pass/fail, execution time, memory usage
- Sandboxed execution: 10s CPU limit, 256MB memory, no network access
- Auto-save support

### ✅ Proctoring & Monitoring (Requirement 8)
- **Browser Monitoring:** Tab switch detection, window blur, fullscreen lockdown, clipboard paste monitoring, rapid input detection (>200 chars without keystrokes)
- **Face Detection:** MediaPipe Face Mesh (468 landmarks) — face absent >5s, multiple faces, gaze away >10s
- **Audio Monitoring:** Web Audio API — speech detection >5 seconds (indicates another person speaking)
- **Proctoring SDK:** Client-side orchestrator that batches flags and sends to backend every 10 seconds
- **Flag severity levels:** Low, Medium, High, Critical
- **Integrity score:** Calculated from severity-weighted flags (0-100)
- **Camera preview:** Small webcam thumbnail in assessment top bar
- **Warning system:** Banner displayed when flag threshold exceeded

### ✅ Interview Q&A with Video Recording (Requirement 9)
- Video recording (webcam + microphone) using MediaRecorder API
- Configurable max duration per question (default: 3 minutes)
- Re-record support with configurable max attempts
- Auto-stop at max duration
- Progress indicators showing answered questions
- Recording upload to backend for reviewer playback

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Backend** | Python 3.12 + FastAPI | REST API with auto-generated Swagger docs |
| **Database** | PostgreSQL 16 | Primary data store (users, teams, questions, sessions) |
| **Cache** | Redis 7 | Sessions, rate limiting (future) |
| **Code Execution** | Judge0 CE (via RapidAPI) | Sandboxed code compilation and execution |
| **Frontend** | React 18 + TypeScript + Vite | Single-page application |
| **Code Editor** | Monaco Editor | VS Code-quality browser editor |
| **Styling** | TailwindCSS 4 | Utility-first CSS framework |
| **Proctoring ML** | MediaPipe Face Mesh | 468-point facial landmark detection + gaze tracking |
| **Video Recording** | MediaRecorder API | Browser-native video/audio recording |
| **Auth** | python-jose (JWT) + bcrypt | Token-based authentication |
| **ORM** | SQLAlchemy 2.0 (async) | Database models and queries |
| **HTTP Client** | httpx | Async HTTP calls to Judge0 |
| **Containerization** | Docker Compose | Local development infrastructure |

---

## Project Structure

```
ad-interview-platform/
├── services/
│   └── interview-api/              # FastAPI backend
│       ├── src/
│       │   ├── main.py             # App entry point, router registration
│       │   ├── config/
│       │   │   ├── settings.py     # Pydantic settings (from .env)
│       │   │   └── database.py     # SQLAlchemy engine + create_tables()
│       │   ├── auth/
│       │   │   ├── service.py      # Password hashing + JWT
│       │   │   ├── dependencies.py # get_current_user, require_role
│       │   │   └── router.py       # /auth/register, /auth/login, /auth/me
│       │   ├── teams/
│       │   │   └── router.py       # Team CRUD + member management
│       │   ├── questions/
│       │   │   └── router.py       # Question CRUD + test cases
│       │   ├── sessions/
│       │   │   └── router.py       # Assessments, candidate sessions, execution
│       │   ├── execution/
│       │   │   └── service.py      # Judge0 integration (RapidAPI + local fallback)
│       │   ├── proctoring/
│       │   │   └── router.py       # Flag ingestion + proctoring reports
│       │   ├── interviews/
│       │   │   └── router.py       # Video response upload + retrieval
│       │   └── models/
│       │       ├── user.py         # UserAccount
│       │       ├── team.py         # Team, TeamMembership
│       │       ├── question.py     # Question, TestCase
│       │       ├── assessment.py   # Assessment, CandidateSession
│       │       └── submission.py   # CodeSubmission
│       ├── requirements.txt
│       └── .env
├── web/                            # React frontend
│   ├── src/
│   │   ├── App.tsx                 # Router configuration
│   │   ├── lib/api.ts             # Axios client with JWT interceptor
│   │   ├── pages/
│   │   │   ├── Login.tsx           # Register + Login
│   │   │   ├── Dashboard.tsx       # Overview with nav
│   │   │   ├── Teams.tsx           # Team management UI
│   │   │   ├── Questions.tsx       # Question bank + test case UI
│   │   │   ├── Assessments.tsx     # Create assessments, assign candidates
│   │   │   ├── Assessment.tsx      # Coding assessment (Monaco + timer + run)
│   │   │   └── Interview.tsx       # Video interview recording
│   │   ├── components/
│   │   │   └── VideoRecorder.tsx   # Webcam recording component
│   │   └── proctoring/
│   │       ├── ProctoringSDK.ts    # Main orchestrator
│   │       ├── BrowserMonitor.ts   # Tab, fullscreen, paste detection
│   │       ├── FaceMonitor.ts      # MediaPipe face + gaze detection
│   │       ├── AudioMonitor.ts     # Speech detection
│   │       └── types.ts            # Flag types and interfaces
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml              # PostgreSQL + Redis + Judge0
├── .env.example
└── README.md
```

---

## Quick Start

### Prerequisites
- Docker Desktop (running)
- Python 3.12+
- Node.js 18+
- RapidAPI key for Judge0 CE (free tier: $0.0017/submission)

### 1. Start Infrastructure

```bash
docker compose up -d
```

Starts: PostgreSQL (port 5432), Redis (port 6379), Judge0 CE (port 2358)

### 2. Run Backend

```bash
cd services/interview-api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn src.main:app --reload --port 8000
```

- API: http://localhost:8000
- Swagger docs: http://localhost:8000/docs

### 3. Run Frontend

```bash
cd web
npm install
npm run dev
```

- Frontend: http://localhost:5173

### 4. Test the Platform

1. Open http://localhost:5173/login → Register an account
2. Go to **Questions** → Create a coding question + add test cases
3. Go to **Assessments** → Create assessment, select questions, assign a candidate
4. Copy the candidate link → Open in new tab
5. Write code → Click Run → Click Submit → See score!

---

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Create account |
| POST | `/api/v1/auth/login` | Login → JWT token |
| GET | `/api/v1/auth/me` | Get current user |

### Teams
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/teams/` | Create team |
| GET | `/api/v1/teams/` | List teams |
| GET | `/api/v1/teams/{id}` | Get team + members |
| POST | `/api/v1/teams/{id}/members` | Add member |
| DELETE | `/api/v1/teams/{id}/members/{user_id}` | Remove member |

### Questions
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/questions` | Create question |
| GET | `/api/v1/questions` | List questions |
| GET | `/api/v1/questions/{id}` | Get question + test cases |
| POST | `/api/v1/questions/{id}/test-cases` | Add test case |

### Assessments & Sessions
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/assessments` | Create assessment |
| POST | `/api/v1/assessments/{id}/assign` | Assign candidate → get link |
| GET | `/api/v1/sessions/{token}` | Start session (candidate) |
| POST | `/api/v1/sessions/{id}/execute` | Run code (visible tests) |
| POST | `/api/v1/sessions/{id}/submit` | Final submit (all tests + score) |

### Proctoring
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/sessions/{id}/proctoring/flags` | Ingest proctoring flags |
| GET | `/api/v1/sessions/{id}/proctoring/report` | Get proctoring report |

### Interview
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/interview/responses` | Upload video recording |
| GET | `/api/v1/interview/responses/{session_id}` | Get responses for session |

---

## Environment Variables

```env
DATABASE_URL=postgresql+asyncpg://admin:admin123@localhost:5432/interview_platform
JWT_SECRET_KEY=<random-256-bit-hex>
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60
JUDGE0_URL=https://judge0-ce.p.rapidapi.com
RAPIDAPI_KEY=<your-rapidapi-key>
RAPIDAPI_HOST=judge0-ce.p.rapidapi.com
REDIS_URL=redis://localhost:6379
FRONTEND_URL=http://localhost:5173
```

---

## Upcoming Features

| Feature | Status |
|---------|--------|
| AI Scoring (Ollama + Llama 3) | 🔄 In Progress |
| Review Dashboard (scores + flags + playback) | 📋 Planned |
| Audit Trail | 📋 Planned |
| Notifications (email invites + reminders) | 📋 Planned |
| Reporting & Analytics | 📋 Planned |
| Okta SSO Integration | 📋 Future |
| OpenFGA Fine-Grained Auth | 📋 Future |

---

## Team

| Member | Module |
|--------|--------|
| Vimal S (Tech Lead) | Foundation, Execution, Proctoring, Architecture |
| Ashok Madhire (Data Lead) | Questions, Assessments, AI Scoring |
| Rajasri Ravirala | Frontend (Candidate Experience) |
| Gatika Manaswini | Frontend (Admin Dashboard), Proctoring SDK |

---

## License

Internal — Alter Domus

# Backend API Documentation

## Overview

The AD Hire backend is a **FastAPI** application with **35+ REST endpoints** organized into 10 modules. It uses **PostgreSQL** for persistence, **Redis** for caching, **Judge0 CE** for code execution, **AWS S3 + Transcribe** for video transcription, and **LiteLLM Gateway** for AI scoring.

**Base URL:** `http://localhost:8000`  
**Swagger UI:** `http://localhost:8000/docs`  
**OpenAPI JSON:** `http://localhost:8000/openapi.json`

---

## Architecture

```
┌──────────────┐     ┌─────────────────────────────────────────────────────┐
│   Frontend   │────▶│                   FastAPI Backend                    │
│  (React)     │     │                                                     │
│  port 5173   │     │  ┌─────────┐  ┌──────────┐  ┌───────────────────┐  │
└──────────────┘     │  │  Auth   │  │  Teams   │  │    Questions      │  │
                     │  └────┬────┘  └────┬─────┘  └────────┬──────────┘  │
                     │       │            │                  │             │
                     │  ┌────┴────────────┴──────────────────┴──────────┐  │
                     │  │              SQLAlchemy 2.0 (async)           │  │
                     │  └────────────────────┬─────────────────────────┘  │
                     │                       │                            │
                     └───────────────────────┼────────────────────────────┘
                                             │
                     ┌───────────────────────┼────────────────────────────┐
                     │     PostgreSQL 16      │         Redis 7           │
                     │     (14 tables)        │       (sessions)          │
                     └───────────────────────┴────────────────────────────┘
```

---

## Step-by-Step Implementation

### Step 1: Project Setup

```bash
mkdir -p services/interview-api/src
cd services/interview-api
```

**requirements.txt:**
```
fastapi>=0.115.0
uvicorn[standard]>=0.30.0
sqlalchemy[asyncio]>=2.0
asyncpg>=0.29.0
pydantic>=2.0
pydantic-settings>=2.0
python-jose[cryptography]>=3.3
passlib[bcrypt]>=1.7
httpx>=0.27.0
python-multipart>=0.0.7
python-dotenv>=1.0
boto3>=1.35.0
```

### Step 2: Configuration (`src/config/`)

**settings.py** — All environment variables loaded via Pydantic:
```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    jwt_secret_key: str
    judge0_url: str
    rapidapi_key: str
    llm_gateway_url: str
    llm_gateway_model: str = "eu.claude-4.8-opus"
    llm_gateway_fallback_model: str = "eu.claude-5-sonnet"
    aws_region: str = "eu-central-1"
    s3_recordings_bucket: str = "ad-interview-recordings"
    # ... more settings
    
    class Config:
        env_file = ".env"

settings = Settings()
```

**database.py** — Async SQLAlchemy engine:
```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, DeclarativeBase

engine = create_async_engine(settings.database_url, echo=True)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession)

class Base(DeclarativeBase):
    pass

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
        await session.commit()
```

### Step 3: Models (`src/models/`) — 14 Tables

| Table | Key Fields |
|-------|-----------|
| `user_account` | id, email, password_hash, display_name, is_platform_admin |
| `team` | id, name, description |
| `team_membership` | id, team_id, user_id, role (team_lead/interviewer) |
| `question` | id, team_id, type, title, description, difficulty, reference_solution |
| `test_case` | id, question_id, input_data, expected_output, is_hidden |
| `assessment` | id, team_id, title, total_time_limit_minutes, status |
| `assessment_question` | id, assessment_id, question_id, order_index, weight |
| `candidate_session` | id, assessment_id, candidate_email, session_token, status, composite_score |
| `code_submission` | id, session_id, question_id, source_code, language, score |
| `interview_response` | id, session_id, question_id, filename, transcription, ai_score |
| `proctoring_flag` | id, session_id, flag_type, severity, description |
| `review_decision` | id, session_id, decision, notes, reviewer_email |
| `audit_log` | id, actor_id, method, path, status_code, duration_ms |
| `notification` | id, type, recipient_email, subject, status |

### Step 4: Auth Module (`src/auth/`)

**Implementation:**
1. `POST /auth/register` — Hash password with bcrypt, create user
2. `POST /auth/login` — Verify password, return JWT (1h expiry)
3. `GET /auth/me` — Decode JWT, return user object
4. `get_current_user` dependency — Inject into any endpoint for auth

```python
# JWT creation
payload = {"sub": str(user.id), "exp": datetime.utcnow() + timedelta(minutes=60)}
token = jwt.encode(payload, settings.jwt_secret_key, algorithm="HS256")
```

### Step 5: Teams Module (`src/teams/`)

**Key design decisions:**
- Platform admins see all teams; members see only their own
- Team leads can add/remove members
- `POST /teams/{id}/assign-content` — bulk-assigns orphaned questions to team

### Step 6: Questions Module (`src/questions/`)

**Team scoping logic:**
```python
# Non-admin users see: their team's questions + their own creations
conditions = [Question.created_by == user.id]
if user_team_ids:
    conditions.append(Question.team_id.in_(user_team_ids))
stmt = stmt.where(or_(*conditions))
```

**Auto-assign team on create:**
```python
if not team_id and not user.is_platform_admin:
    # Auto-assign to user's first team
    first_team = await get_user_first_team(user.id)
    team_id = first_team
```

### Step 7: Sessions & Code Execution (`src/sessions/`, `src/execution/`)

**Judge0 integration flow:**
```python
async def run_and_wait(source_code, language, stdin, expected_output):
    # 1. Map language name → Judge0 language_id
    # 2. POST to Judge0 /submissions (base64 encoded)
    # 3. Poll GET /submissions/{token} until status != "Processing"
    # 4. Compare stdout.strip() == expected_output.strip()
    # 5. Return {passed, status, stdout, time, memory}
```

### Step 8: Interview & Transcription (`src/interviews/`)

**Pipeline: Video → S3 → Transcribe → LLM**

```python
@router.post("/responses")
async def upload_response(file, question_id, session_id):
    # 1. Save file to /tmp
    # 2. Save metadata to PostgreSQL
    # 3. Kick off background task
    asyncio.create_task(_transcribe_and_score(...))

async def _transcribe_and_score(response_id, filepath, question_id):
    # 1. Upload to S3
    # 2. Start AWS Transcribe job
    # 3. Poll until complete (~10-15s)
    # 4. Get transcript text
    # 5. Call LLM for scoring
    # 6. Update DB with transcription + ai_score
```

### Step 9: AI Scoring (`src/scoring/`)

**LLM client with fallback:**
```python
models_to_try = [settings.llm_gateway_model, settings.llm_gateway_fallback_model]
for model in models_to_try:
    payload = {"model": model, "messages": messages, "max_tokens": 512}
    # Don't send temperature for Opus models (deprecated)
    if "opus" not in model:
        payload["temperature"] = 0.1
    try:
        response = await client.post(url, json=payload)
        return response.json()["choices"][0]["message"]["content"]
    except:
        continue  # Try fallback
```

**Scoring prompt structure:**
```
System: You are an expert technical interviewer. Score on 4 dimensions (0-100).
User: Question: {prompt} | Response: {transcription} | Return JSON only.
```

### Step 10: Reviews (`src/reviews/`)

**Candidate detail returns:**
- Code submissions with `question_title` + `reference_solution`
- Proctoring flags with severity + integrity score
- Interview responses with transcription + AI score
- Review decision if exists

### Step 11: Reporting (`src/reporting/`)

**All stats are team-scoped:**
- Candidates, assessments, questions counts filtered by team
- Decision counts (select/reject/hold/pending) scoped to team sessions
- Proctoring flags only from team's candidates
- Score averages only from team's sessions

---

## API Endpoints Reference

### Auth
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/auth/register` | No | Create account |
| POST | `/api/v1/auth/login` | No | Login → JWT |
| GET | `/api/v1/auth/me` | Yes | Current user info |

### Teams
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/teams/` | Admin | Create team |
| GET | `/api/v1/teams/` | Yes | List teams (scoped) |
| GET | `/api/v1/teams/{id}` | Yes | Team + members |
| POST | `/api/v1/teams/{id}/members` | Lead/Admin | Add member |
| DELETE | `/api/v1/teams/{id}/members/{user_id}` | Lead/Admin | Remove member |
| DELETE | `/api/v1/teams/{id}` | Admin | Delete team |
| POST | `/api/v1/teams/{id}/assign-content` | Lead/Admin | Assign orphaned content |

### Questions
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/questions` | Yes | Create question (auto-assigns team) |
| GET | `/api/v1/questions` | Yes | List questions (team-scoped) |
| GET | `/api/v1/questions/{id}` | Yes | Question + test cases |
| POST | `/api/v1/questions/{id}/test-cases` | Yes | Add test case |

### Assessments & Sessions
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/assessments` | Yes | Create assessment |
| GET | `/api/v1/assessments` | Yes | List assessments (team-scoped) |
| POST | `/api/v1/assessments/{id}/assign` | Yes | Assign candidate → unique link |
| GET | `/api/v1/sessions/{token}` | No (token) | Start session |
| POST | `/api/v1/sessions/{id}/execute` | No | Run code (visible tests) |
| POST | `/api/v1/sessions/{id}/submit` | No | Final submit (all tests) |

### Interview
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/interview/responses` | No | Upload video recording |
| GET | `/api/v1/interview/responses/{session_id}` | No | Get responses + transcriptions |

### Proctoring
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/sessions/{id}/proctoring/flags` | No | Receive flags from client |
| GET | `/api/v1/sessions/{id}/proctoring/report` | Yes | Get proctoring report |

### Scoring
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/scoring/interview/score` | Yes | Score response via LLM |
| POST | `/api/v1/scoring/text-score` | No | Score text (demo) |

### Reviews
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/reviews/assessments/{id}/candidates` | Yes | List candidates |
| GET | `/api/v1/reviews/candidates/{session_id}` | Yes | Full candidate detail |
| POST | `/api/v1/reviews/candidates/{session_id}/decision` | Yes | Record decision |

### Reporting
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/admin/analytics/overview` | Yes | Platform stats (team-scoped) |
| GET | `/api/v1/admin/analytics/scores` | Yes | Score distribution |
| GET | `/api/v1/admin/analytics/proctoring-stats` | Yes | Flag breakdown |
| GET | `/api/v1/admin/analytics/candidates` | Yes | All candidates with details |
| GET | `/api/v1/admin/analytics/team-average` | Yes | Team average score |

### Audit & Notifications
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/admin/audit/` | Admin | Query audit trail |
| POST | `/api/v1/notifications/send-invite` | Yes | Send invitation |
| POST | `/api/v1/notifications/send-reminder` | Yes | Send reminder |
| GET | `/api/v1/notifications/` | Yes | List notifications |

---

## Database Schema (ERD)

```
user_account ──┬── team_membership ──── team
               │
               ├── question ──── test_case
               │       │
               │       └── assessment_question ──── assessment
               │                                       │
               │                        candidate_session
               │                         │      │      │
               │              code_submission  interview_response  proctoring_flag
               │                                                        │
               └── review_decision ─────────────────────────────────────┘
                   audit_log
                   notification
```

---

## Running Tests

```bash
# Quick LLM test (no auth)
curl -X POST http://localhost:8000/api/v1/scoring/text-score \
  -H "Content-Type: application/json" \
  -d '{"question_prompt": "Explain REST APIs", "candidate_response": "REST is..."}'

# Health check
curl http://localhost:8000/docs
```

---

## Deployment Notes

- **AWS Account:** 757077150128 (eu-central-1)
- **S3 Bucket:** ad-interview-recordings
- **LLM Proxy:** litellm.alterdomus.cloud (models: eu.claude-4.8-opus, eu.claude-5-sonnet)
- **Judge0:** RapidAPI hosted ($0.0017/submission)

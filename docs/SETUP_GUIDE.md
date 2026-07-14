# Developer Setup Guide

Complete step-by-step guide to clone, run, and test the AD Hire platform locally.

---

## Prerequisites

Before you begin, ensure you have these installed:

| Tool | Version | Check command | Install |
|------|---------|---------------|---------|
| Docker Desktop | Latest | `docker --version` | https://docker.com/products/docker-desktop |
| Python | 3.12+ | `python3 --version` | https://python.org |
| Node.js | 18+ | `node --version` | https://nodejs.org |
| Git | Latest | `git --version` | `brew install git` |
| AWS CLI | v2 | `aws --version` | `brew install awscli` |

**Optional (for full AI pipeline):**
- AWS credentials (for S3 + Transcribe)
- LiteLLM API key (for AI scoring)

---

## Step 1: Clone the Repository

```bash
git clone https://github.com/vimalsek-ad/ad-testinterview-platform.git
cd ad-testinterview-platform
```

---

## Step 2: Start Database & Redis (Docker)

```bash
docker compose up -d
```

This starts:
- **PostgreSQL 16** on port `5432` (user: `admin`, password: `admin123`, db: `interview_platform`)
- **Redis 7** on port `6379`

**Verify:**
```bash
docker ps
# Should show 2 containers running

# Test PostgreSQL connection
docker exec -it $(docker ps -q -f name=postgres) psql -U admin -d interview_platform -c "SELECT 1;"
```

---

## Step 3: Setup the Backend

```bash
cd services/interview-api

# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate    # macOS/Linux
# .venv\Scripts\activate     # Windows

# Install dependencies
pip install -r requirements.txt
```

### Create the `.env` file

```bash
cp ../../.env.example .env   # If .env.example exists
# OR create manually:
```

Create `services/interview-api/.env`:

```env
# App
APP_NAME=interview-platform
DEBUG=true

# Database (must match docker-compose)
DATABASE_URL=postgresql+asyncpg://admin:admin123@localhost:5432/interview_platform

# JWT Auth
JWT_SECRET_KEY=a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60

# Code Execution (Judge0 via RapidAPI — get free key at https://rapidapi.com/judge0-official/api/judge0-ce)
JUDGE0_URL=https://judge0-ce.p.rapidapi.com
RAPIDAPI_KEY=<your-rapidapi-key>
RAPIDAPI_HOST=judge0-ce.p.rapidapi.com

# Redis
REDIS_URL=redis://localhost:6379

# AI Scoring (LiteLLM — optional, needed for interview AI scoring)
LLM_GATEWAY_URL=https://litellm.alterdomus.cloud/v1
LLM_GATEWAY_MODEL=eu.claude-4.8-opus
LLM_GATEWAY_FALLBACK_MODEL=eu.claude-5-sonnet
LLM_GATEWAY_TOKEN=<your-litellm-key>
LLM_GATEWAY_ORG_ID=

# AWS (optional — for video transcription)
AWS_REGION=eu-central-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_SESSION_TOKEN=
S3_RECORDINGS_BUCKET=ad-interview-recordings
TRANSCRIBE_LANGUAGE_CODE=en-US

# Frontend CORS
FRONTEND_URL=http://localhost:5173
```

### Start the Backend

```bash
uvicorn src.main:app --reload --port 8000
```

**Verify:**
```bash
# Should see: "✅ Database tables created" + "Application startup complete"

# Test the API
curl http://localhost:8000/docs
# Should return Swagger HTML

# Health-style check
curl http://localhost:8000/api/v1/auth/me
# Should return 403 (no token — means server is working)
```

**Swagger UI:** http://localhost:8000/docs (interactive API docs)

---

## Step 4: Setup the Frontend

```bash
cd web    # from project root

# Install dependencies
npm install
```

### Start the Frontend

```bash
npm run dev
```

**Verify:** Open http://localhost:5173 in your browser — you should see the AD Hire login page.

---

## Step 5: Create Your First Account

### Option A: Via the UI

1. Open http://localhost:5173/login
2. Click **Register** at the bottom
3. Fill in: Name, Email, Password
4. Click **Create Account**
5. You're now logged in and redirected to Dashboard

### Option B: Via curl

```bash
# Register
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"admin123","display_name":"Admin User"}'

# Login
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"admin123"}'

# Copy the access_token from the response
export TOKEN="eyJhbGciOi..."
```

### Make yourself a Platform Admin (first user)

The first registered user needs to be manually promoted to admin:

```bash
docker exec -it $(docker ps -q -f name=postgres) psql -U admin -d interview_platform -c \
  "UPDATE user_account SET is_platform_admin = true WHERE email = 'admin@test.com';"
```

Now logout and login again — you'll have full admin access.

---

## Step 6: Complete Setup Test

After login, verify all pages load:

| URL | Expected |
|-----|----------|
| http://localhost:5173/dashboard | Overview with stat cards |
| http://localhost:5173/teams | Team management |
| http://localhost:5173/questions | Question bank |
| http://localhost:5173/assessments | Assessment list |
| http://localhost:8000/docs | Swagger UI |

---

## Full End-to-End Test Flow

### 1. Create a Team

- Go to **Teams** → click **+ New Team**
- Name: "Data Engineering"
- Click Create
- (Optional) Add another user as a member

### 2. Create Questions

- Go to **Questions** → click **+ New Question**
- Create a **Coding question:**
  - Title: "FizzBuzz"
  - Description: "Print numbers 1 to N. For multiples of 3 print Fizz, 5 print Buzz, both print FizzBuzz."
  - Difficulty: Easy
  - Languages: Python
  - (Optional) Add Reference Solution
- Click Create
- Click the question → **+ Add Test Case**
  - Input: `5` → Expected: `1\n2\nFizz\n4\nBuzz` → Visible
  - Input: `15` → Expected: full FizzBuzz output → Hidden ✓

- Create an **Interview question:**
  - Switch to "🎬 Interview Question"
  - Title: "Explain CAP Theorem"
  - Description: "Explain the CAP theorem and give examples of databases for each trade-off."
  - Click Create

### 3. Create an Assessment

- Go to **Assessments** → click **+ New Assessment**
- Title: "DE Interview July 2026"
- Time limit: 30 minutes
- Select both questions
- Click **Create & Publish**

### 4. Assign a Candidate

- Click **Assign Candidates** on the assessment
- Enter email: `candidate1@test.com`
- Click **Assign & Get Link**
- **Copy the link** (looks like `http://localhost:5173/assessment/xyzToken...`)

### 5. Take the Assessment (as Candidate)

- Open the link in a **new incognito/private window**
- System Check page appears:
  - Allow camera ✓
  - Allow microphone ✓
  - Acknowledge proctoring ✓
  - Click "Start Assessment"
- **For Coding question:**
  - Write solution in Monaco Editor
  - Click **▶ Run** → see test results
  - Click **Submit** → score calculated
- **For Interview question:**
  - Click "Start Recording"
  - Speak your answer (at least 3-5 seconds)
  - Click "Stop" → "Submit Recording"
- Assessment completes → shows score

### 6. Review the Candidate

- Go back to original browser (interviewer)
- Go to **Assessments** → click **📊 Review**
- Click the candidate card → Full Candidate Dashboard opens:
  - Score vs team average chart
  - Question timing
  - Code tab (view source code)
  - Interview tab (transcription + AI score)
  - Proctoring tab (flags)
- Write notes → Click **✓ Select** or **✗ Reject**

---

## Testing Individual Features

### Test Code Execution Only

```bash
# Submit code without going through the full assessment flow
# First create a session (see Step 1.6-1.7 in the Backend API tests above)
# Then:
curl -X POST http://localhost:8000/api/v1/sessions/$SESSION_ID/execute \
  -H "Content-Type: application/json" \
  -d '{
    "question_id": "'$QUESTION_ID'",
    "source_code": "n = int(input())\nfor i in range(1, n+1):\n    print(i)",
    "language": "python"
  }'
```

### Test AI Scoring Only (no video needed)

```bash
curl -X POST http://localhost:8000/api/v1/scoring/text-score \
  -H "Content-Type: application/json" \
  -d '{
    "question_prompt": "Explain the CAP theorem",
    "candidate_response": "CAP theorem states that in a distributed system you can only have two of three: Consistency, Availability, Partition tolerance. DynamoDB chooses AP, while PostgreSQL chooses CA."
  }'
```

**Expected:** Returns scores for relevance, completeness, accuracy, clarity + composite.

### Test AWS Transcription Only

```bash
# Upload a test audio file
curl -X POST http://localhost:8000/api/v1/interview/responses \
  -F "file=@test-recording.webm" \
  -F "question_id=<question-uuid>" \
  -F "session_id=<session-uuid>"

# Check transcription status (wait ~15s)
curl http://localhost:8000/api/v1/interview/responses/<session-id>
```

### Test Proctoring (Manual)

While in an assessment:
1. **Tab switch:** Alt+Tab away from the browser → come back → flag counter increases
2. **Paste:** Copy text from another app, paste into editor → flag appears
3. **Speech (coding only):** Speak aloud for 5+ seconds → flag appears
4. **Face absent:** Cover camera → flag appears after 5 seconds

---

## Testing Error Scenarios

### Wrong Code (expected failures)

```python
# Wrong answer
n = int(input())
for i in range(1, n+1):
    print(i)  # No FizzBuzz logic
```
→ Should show ❌ Wrong Answer

```python
# Runtime error
x = 1 / 0
```
→ Should show ❌ Runtime Error

```python
# Timeout
while True:
    pass
```
→ Should show ⏱ Time Limit Exceeded (after ~10s)

### Unauthorized Access

```bash
# Try accessing without token
curl http://localhost:8000/api/v1/questions
# → 403 Forbidden

# Try accessing other team's data
# Login as user NOT in the team → should see empty results
```

---

## Ports Summary

| Service | Port | URL |
|---------|------|-----|
| Frontend (Vite) | 5173 | http://localhost:5173 |
| Backend (FastAPI) | 8000 | http://localhost:8000 |
| Swagger Docs | 8000 | http://localhost:8000/docs |
| PostgreSQL | 5432 | `psql -h localhost -U admin -d interview_platform` |
| Redis | 6379 | `redis-cli ping` |

---

## Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| `docker compose up` fails | Docker not running | Start Docker Desktop |
| Backend won't start | Missing `.env` | Create `.env` file (see Step 3) |
| "relation does not exist" | Tables not created | Restart backend (auto-creates on startup) |
| Judge0 returns 401/403 | Invalid RapidAPI key | Get a free key from rapidapi.com |
| Frontend shows "ERR_CONNECTION_REFUSED" | Backend not running | Start backend on port 8000 |
| CORS error in browser | Backend CORS config | Ensure `FRONTEND_URL=http://localhost:5173` in `.env` |
| Camera not working | Browser permission | Allow camera in browser settings, use localhost (not IP) |
| "TF.js model failed to load" | CDN unreachable or Vite bundling issue | Refresh page, check internet |
| AI Scoring returns error | No LLM key or model not available | Set `LLM_GATEWAY_TOKEN` in `.env` |
| Transcription stuck at "processing" | No AWS credentials | Set AWS keys in `.env` or skip (text scoring still works) |
| "Module not found" (Python) | Wrong directory | Make sure you're in `services/interview-api/` and venv is activated |
| npm install fails | Node version too old | Upgrade to Node 18+ |

---

## Stopping Everything

```bash
# Stop frontend: Ctrl+C in the terminal running npm run dev
# Stop backend: Ctrl+C in the terminal running uvicorn
# Stop Docker containers:
docker compose down

# Remove all data (fresh start):
docker compose down -v   # -v removes volumes (database data)
```

---

## Quick Reference: All Commands

```bash
# Start everything (3 terminals)
docker compose up -d                                          # Terminal 1
cd services/interview-api && source .venv/bin/activate && uvicorn src.main:app --reload --port 8000  # Terminal 2
cd web && npm run dev                                         # Terminal 3

# Stop everything
docker compose down
# Ctrl+C in backend and frontend terminals
```

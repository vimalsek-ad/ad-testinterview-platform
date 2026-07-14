# End-to-End Testing Guide

This guide walks through testing every feature of the platform from both the **backend (API)** and **frontend (UI)** perspectives.

---

## Prerequisites

Make sure all services are running:

```bash
# Terminal 1 — Infrastructure
cd ad-testinterview-platform
docker compose up -d

# Terminal 2 — Backend
cd services/interview-api
source .venv/bin/activate
uvicorn src.main:app --reload --port 8000

# Terminal 3 — Frontend
cd web
npm run dev
```

Verify:
- Backend: http://localhost:8000/health → `{"status": "ok"}`
- Swagger: http://localhost:8000/docs
- Frontend: http://localhost:5173

---

## Test Scenario: Complete Hiring Flow

This scenario simulates a real hiring flow: an interviewer creates questions, builds an assessment, assigns a candidate, the candidate takes the test, and the interviewer reviews and decides.

---

## Part 1: Backend API Testing (Swagger or curl)

Open http://localhost:8000/docs for interactive Swagger UI.

### 1.1 Register & Login

```bash
# Register an interviewer account
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"interviewer@alterdomus.com","password":"Test@1234","display_name":"Interviewer One"}'

# Login → get JWT token
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"interviewer@alterdomus.com","password":"Test@1234"}'

# Save the token (copy from response)
export TOKEN="<paste-access-token-here>"

# Verify token works
curl http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

**Expected:** Returns user profile with email and display name.

---

### 1.2 Create a Team

```bash
curl -X POST http://localhost:8000/api/v1/teams/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Data Engineering","description":"DE hiring team"}'
```

**Expected:** Returns team ID. You are auto-added as team_lead.

---

### 1.3 Create a Coding Question

```bash
curl -X POST http://localhost:8000/api/v1/questions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "title": "FizzBuzz",
    "description": "Write a program that prints numbers from 1 to N.\nFor multiples of 3, print Fizz.\nFor multiples of 5, print Buzz.\nFor multiples of both, print FizzBuzz.\n\nInput: A single integer N on one line.\nOutput: One value per line (number, Fizz, Buzz, or FizzBuzz).",
    "difficulty": "easy",
    "tags": ["loops", "conditionals"],
    "supported_languages": ["python", "javascript", "java"]
  }'

# Save the question ID
export QUESTION_ID="<paste-id-here>"
```

---

### 1.4 Add Test Cases

```bash
# Visible test case (candidate sees this)
curl -X POST http://localhost:8000/api/v1/questions/$QUESTION_ID/test-cases \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"input_data":"5","expected_output":"1\n2\nFizz\n4\nBuzz","is_hidden":false}'

# Hidden test case (candidate doesn't see this)
curl -X POST http://localhost:8000/api/v1/questions/$QUESTION_ID/test-cases \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"input_data":"15","expected_output":"1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz","is_hidden":true}'

# Verify question has test cases
curl http://localhost:8000/api/v1/questions/$QUESTION_ID \
  -H "Authorization: Bearer $TOKEN"
```

**Expected:** Question detail shows 2 test cases (one visible, one hidden).

---

### 1.5 Create an Assessment

```bash
curl -X POST http://localhost:8000/api/v1/assessments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"title\":\"DE Interview — July 2026\",\"total_time_limit_minutes\":30,\"question_ids\":[\"$QUESTION_ID\"]}"

# Save assessment ID
export ASSESSMENT_ID="<paste-id-here>"
```

---

### 1.6 Assign a Candidate

```bash
curl -X POST http://localhost:8000/api/v1/assessments/$ASSESSMENT_ID/assign \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"candidate_email":"candidate@example.com","candidate_name":"John Doe"}'

# Save session_token and session_id from response
export SESSION_TOKEN="<paste-session-token>"
export SESSION_ID="<paste-session-id>"
```

**Expected:** Returns `session_token`, `session_id`, and `link`.

---

### 1.7 Start Session (as Candidate)

```bash
# No auth needed — session token IS the auth
curl http://localhost:8000/api/v1/sessions/$SESSION_TOKEN
```

**Expected:** Returns assessment title, time limit, questions (with visible test cases only).

---

### 1.8 Execute Code (Run Button)

```bash
# Correct solution
curl -X POST http://localhost:8000/api/v1/sessions/$SESSION_ID/execute \
  -H "Content-Type: application/json" \
  -d "{
    \"question_id\": \"$QUESTION_ID\",
    \"source_code\": \"n = int(input())\\nfor i in range(1, n+1):\\n    if i % 15 == 0:\\n        print('FizzBuzz')\\n    elif i % 3 == 0:\\n        print('Fizz')\\n    elif i % 5 == 0:\\n        print('Buzz')\\n    else:\\n        print(i)\",
    \"language\": \"python\"
  }"
```

**Expected:** `{"results": [...], "passed": 1, "total": 1}` — runs only visible test case.

---

### 1.9 Submit Code (Final Submission)

```bash
curl -X POST http://localhost:8000/api/v1/sessions/$SESSION_ID/submit \
  -H "Content-Type: application/json" \
  -d "{
    \"question_id\": \"$QUESTION_ID\",
    \"source_code\": \"n = int(input())\\nfor i in range(1, n+1):\\n    if i % 15 == 0:\\n        print('FizzBuzz')\\n    elif i % 3 == 0:\\n        print('Fizz')\\n    elif i % 5 == 0:\\n        print('Buzz')\\n    else:\\n        print(i)\",
    \"language\": \"python\"
  }"
```

**Expected:** `{"score": 100, "passed": 2, "total": 2}` — runs ALL test cases including hidden.

---

### 1.10 Send Proctoring Flags

```bash
curl -X POST http://localhost:8000/api/v1/sessions/$SESSION_ID/proctoring/flags \
  -H "Content-Type: application/json" \
  -d '{
    "flags": [
      {"type":"tab_switch","severity":"high","description":"Switched to another tab","timestamp":"2026-07-14T10:00:00Z"},
      {"type":"face_absent","severity":"high","description":"No face detected for 8 seconds","timestamp":"2026-07-14T10:01:00Z"}
    ]
  }'

# Get proctoring report
curl http://localhost:8000/api/v1/sessions/$SESSION_ID/proctoring/report
```

**Expected:** Report shows 2 flags, severity score, integrity score.

---

### 1.11 Review Candidate

```bash
# List candidates for the assessment
curl http://localhost:8000/api/v1/reviews/assessments/$ASSESSMENT_ID/candidates \
  -H "Authorization: Bearer $TOKEN"

# Get full detail for the candidate
curl http://localhost:8000/api/v1/reviews/candidates/$SESSION_ID \
  -H "Authorization: Bearer $TOKEN"

# Make a decision
curl -X POST http://localhost:8000/api/v1/reviews/candidates/$SESSION_ID/decision \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"decision":"select","notes":"Strong solution, clean code, minor proctoring flags"}'
```

**Expected:** Decision recorded with reviewer email and timestamp.

---

### 1.12 Check Audit Trail

```bash
curl "http://localhost:8000/api/v1/admin/audit/?limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected:** Shows all your API calls logged with actor, path, method, duration.

---

### 1.13 Check Analytics

```bash
curl http://localhost:8000/api/v1/admin/analytics/overview \
  -H "Authorization: Bearer $TOKEN"
```

**Expected:** Platform stats — users, questions, assessments, sessions, scores, decisions, proctoring.

---

## Part 2: Frontend Testing (Browser)

### 2.1 Login Flow

1. Open http://localhost:5173/login
2. Click **Register** → Fill in name, email, password → Submit
3. Login with the same credentials
4. **Verify:** Redirected to Dashboard

---

### 2.2 Team Management

1. Click **Teams** in the nav bar
2. Click **+ New Team** → Enter "Data Engineering" → Create
3. **Verify:** Team appears in the list with 1 member (you)
4. Click the team → See yourself as team_lead
5. Click **+ Add Member** → Enter another registered user's email → Add

---

### 2.3 Question Bank

1. Click **Questions** in the nav bar
2. Click **+ New Question**
3. Fill in:
   - Title: "Reverse a String"
   - Description: "Given a string, return it reversed.\nInput: one string\nOutput: reversed string"
   - Difficulty: Easy
   - Languages: python, javascript
4. Click **Create**
5. **Verify:** Question appears in list
6. Click the question → Click **+ Add Test Case**
   - Input: `hello`
   - Expected: `olleh`
   - Hidden: unchecked
7. Add another test case:
   - Input: `racecar`
   - Expected: `racecar`
   - Hidden: checked ✓
8. **Verify:** 2 test cases shown (one visible, one hidden with orange badge)

---

### 2.4 Assessment Creation

1. Click **Assessments** in the nav bar
2. Click **+ New Assessment**
3. Fill in:
   - Title: "Backend Engineer — Test"
   - Time limit: 30 minutes
   - Select your question(s) from the list
4. Click **Create & Publish**
5. **Verify:** Assessment appears in the list
6. Click **Assign Candidates**
   - Enter email: `test@candidate.com`
   - Click **Assign & Get Link**
7. **Verify:** Link appears → Copy it

---

### 2.5 Candidate Experience (Coding Assessment)

1. Open the copied link in a **new browser tab** (or incognito window)
   - URL looks like: `http://localhost:5173/assessment/xyzTokenHere`
2. **Verify:** 
   - Assessment title shows at top
   - Timer starts counting down
   - Question appears on left panel
   - Monaco Editor on right with Python syntax highlighting
   - Visible test cases shown below the question
   - Camera preview appears (top right) if you allow webcam
3. Write your solution in the editor
4. Click **▶ Run** 
   - **Verify:** Test results appear below (✅/❌ for each visible test case)
5. Click **Submit**
   - **Verify:** Score page appears with percentage + tests passed/total
6. **Check proctoring:** While in the assessment, try:
   - Switch to another tab → Come back → Flag counter increments (🚨)
   - Paste text from outside → Flag counter increments

---

### 2.6 Review Dashboard

1. Go back to the interviewer browser tab
2. Navigate to **Assessments**
3. Click **📊 Review** on the assessment
4. **Verify:**
   - Candidate list shows with score and flag count
   - Click a candidate → Full detail view:
     - Code submission (syntax highlighted)
     - Test results (passed/failed)
     - Proctoring flags (if any) with severity dots
     - Integrity score
5. In the Decision panel:
   - Enter notes: "Good solution"
   - Click **✅ Select**
6. **Verify:** Green "select" badge appears on the candidate

---

## Part 3: Test Wrong/Failing Code

To verify error handling works:

### Wrong Answer
```python
# This will fail — doesn't handle FizzBuzz correctly
n = int(input())
for i in range(1, n+1):
    print(i)
```
**Expected:** Run shows ❌ Wrong Answer

### Runtime Error
```python
# This will crash
x = 1 / 0
```
**Expected:** Run shows ❌ Runtime Error

### Timeout (if code runs too long)
```python
# Infinite loop
while True:
    pass
```
**Expected:** Run shows ⏱ Time Limit Exceeded (after 10 seconds)

---

## Part 4: Test Different Languages

The platform supports 47 languages via Judge0. Test with:

### JavaScript
```javascript
const n = parseInt(require('readline').createInterface({input: process.stdin}).on('line', (line) => {
  const n = parseInt(line);
  for (let i = 1; i <= n; i++) {
    if (i % 15 === 0) console.log("FizzBuzz");
    else if (i % 3 === 0) console.log("Fizz");
    else if (i % 5 === 0) console.log("Buzz");
    else console.log(i);
  }
  process.exit();
}));
```

### Java
```java
import java.util.Scanner;
public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        for (int i = 1; i <= n; i++) {
            if (i % 15 == 0) System.out.println("FizzBuzz");
            else if (i % 3 == 0) System.out.println("Fizz");
            else if (i % 5 == 0) System.out.println("Buzz");
            else System.out.println(i);
        }
    }
}
```

---

## Part 5: API Testing Checklist

Use Swagger (http://localhost:8000/docs) to click "Try it out" on each endpoint:

| ✅ | Endpoint | What to test |
|----|----------|-------------|
| ☐ | POST /auth/register | Create account → 201 |
| ☐ | POST /auth/login | Get JWT → 200 |
| ☐ | GET /auth/me | Returns user with token → 200 |
| ☐ | GET /auth/me (no token) | Returns 401 |
| ☐ | POST /teams/ | Create team → 201 |
| ☐ | GET /teams/ | List your teams → 200 |
| ☐ | POST /teams/{id}/members | Add member → 201 |
| ☐ | POST /questions | Create question → 201 |
| ☐ | GET /questions | List questions → 200 |
| ☐ | POST /questions/{id}/test-cases | Add test case → 201 |
| ☐ | POST /assessments | Create assessment → 201 |
| ☐ | POST /assessments/{id}/assign | Get candidate link → 201 |
| ☐ | GET /sessions/{token} | Start session → 200 |
| ☐ | POST /sessions/{id}/execute | Run code → 200 |
| ☐ | POST /sessions/{id}/submit | Submit → score → 200 |
| ☐ | POST /sessions/{id}/proctoring/flags | Ingest flags → 200 |
| ☐ | GET /sessions/{id}/proctoring/report | Get report → 200 |
| ☐ | POST /interview/responses | Upload file → 201 |
| ☐ | POST /scoring/text-score | AI score (needs LLM Gateway) |
| ☐ | GET /reviews/assessments/{id}/candidates | List candidates → 200 |
| ☐ | GET /reviews/candidates/{id} | Full detail → 200 |
| ☐ | POST /reviews/candidates/{id}/decision | Record decision → 201 |
| ☐ | GET /admin/audit/ | Audit log → 200 |
| ☐ | GET /admin/analytics/overview | Stats → 200 |
| ☐ | POST /notifications/send-invite | Log notification → 201 |

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `docker compose up` fails | Make sure Docker Desktop is running |
| Backend won't start | Check `.env` exists in `services/interview-api/` |
| "Internal Server Error" on register | Tables may not exist — restart the backend (auto-creates on startup) |
| Judge0 returns errors | Check `RAPIDAPI_KEY` in `.env` is correct |
| Frontend CORS error | Make sure backend is running on port 8000 |
| Camera not working | Allow browser camera permission + use HTTPS or localhost |
| AI Scoring returns 401 | Need VPN + valid LLM Gateway token |

# Frontend Documentation

## Overview

The AD Hire frontend is a **React 18 + TypeScript** single-page application built with **Vite** and styled with **TailwindCSS 4**. It features a shared layout with Alter Domus branding, dark theme, and role-based navigation.

**Dev URL:** `http://localhost:5173`  
**Build:** `npm run build` (outputs to `web/dist/`)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                               │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    App.tsx                            │   │
│  │         (BrowserRouter + Routes)                     │   │
│  │                                                     │   │
│  │  ┌──────────────────────────────────────────────┐   │   │
│  │  │              Layout.tsx                       │   │   │
│  │  │  ┌─────────┐  ┌──────────────────────────┐  │   │   │
│  │  │  │ Sidebar │  │     Page Component       │  │   │   │
│  │  │  │  Nav    │  │  (Dashboard/Teams/etc.)  │  │   │   │
│  │  │  └─────────┘  └──────────────────────────┘  │   │   │
│  │  └──────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────┐  ┌──────────────────────────────┐   │
│  │  Proctoring SDK  │  │    Monaco Editor             │   │
│  │  (Face/Audio/    │  │    (Code editing)            │   │
│  │   Browser)       │  │                              │   │
│  └──────────────────┘  └──────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
         │                          │
         ▼                          ▼
┌─────────────────┐      ┌──────────────────┐
│  FastAPI Backend │      │   Judge0 (code)  │
│  localhost:8000  │      │   TF.js (face)   │
└─────────────────┘      │   AWS (video)    │
                         └──────────────────┘
```

---

## Step-by-Step Implementation

### Step 1: Project Setup

```bash
npm create vite@latest web -- --template react-ts
cd web
npm install
npm install axios @monaco-editor/react react-router-dom
npm install -D tailwindcss @tailwindcss/vite
npm install @tensorflow/tfjs @tensorflow-models/face-detection
```

**vite.config.ts:**
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    exclude: ['@tensorflow-models/face-detection', '@mediapipe/face_detection'],
  },
})
```

### Step 2: API Client (`src/lib/api.ts`)

```typescript
import axios from "axios";

export const api = axios.create({
  baseURL: "http://localhost:8000",
  headers: { "Content-Type": "application/json" },
});

// Auto-attach JWT to all requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

### Step 3: Routing (`src/App.tsx`)

```typescript
<BrowserRouter>
  <Routes>
    {/* Public */}
    <Route path="/login" element={<Login />} />
    
    {/* Admin pages (wrapped in Layout) */}
    <Route path="/dashboard" element={<Layout><Dashboard /></Layout>} />
    <Route path="/teams" element={<Layout><Teams /></Layout>} />
    <Route path="/questions" element={<Layout><Questions /></Layout>} />
    <Route path="/assessments" element={<Layout><Assessments /></Layout>} />
    <Route path="/review/:assessmentId" element={<Layout><Review /></Layout>} />
    <Route path="/candidate/:sessionId" element={<Layout><CandidateReview /></Layout>} />
    
    {/* Candidate-facing (no layout, full screen) */}
    <Route path="/assessment/:token" element={<Assessment />} />
    <Route path="/interview/:token" element={<Interview />} />
  </Routes>
</BrowserRouter>
```

### Step 4: Shared Layout (`src/components/Layout.tsx`)

**Structure:**
- **Header** (fixed top): Alter Domus logo + "AD HIRE" + theme toggle + user avatar + logout
- **Sidebar** (left 56px): Navigation items with active state + notification badge
- **Main content** (flex-1): Dark themed area for page content

**Key features:**
- Loads user via `GET /auth/me` on mount
- Checks for new submissions (notification badge)
- Stores last visit timestamp in localStorage

### Step 5: Login Page (`src/pages/Login.tsx`)

**Layout:** Split view — role cards (left) + login form (right)

**Roles displayed:**
| Role | Icon | Description |
|------|------|-------------|
| Platform Admin | 🛡️ | Full system access, manages teams |
| Team Lead | 👑 | Manages assessments, reviews candidates |
| Interviewer | 🎯 | Reviews candidates, provides feedback |

**Each role has expandable "Info" showing responsibilities.**

**Login flow:**
1. User selects role (visual only — backend determines actual role)
2. Enters email + password
3. POST `/auth/login` → receives JWT
4. Stores token in localStorage
5. Redirects to `/dashboard`

### Step 6: Dashboard (`src/pages/Dashboard.tsx`)

**Sections:**
1. **Stat cards** (4): Candidates, Assessments, Questions, Avg Score
2. **Decision cards** (4): Selected, On Hold, Rejected, Review Pending
3. **Bar charts** (2): Candidate Pipeline + Integrity Overview
4. **Recent Candidates list**: Clickable, shows time ago
5. **Candidate detail panel**: Shows on click with scores, timing, action button

**Data sources:**
- `GET /admin/analytics/overview` — stats
- `GET /admin/analytics/candidates` — candidate list

### Step 7: Questions Page (`src/pages/Questions.tsx`)

**Features:**
- Search bar (filters by title + tags)
- Dropdown filters: Difficulty (Easy/Medium/Hard), Type (Coding/Interview)
- Split panel: list (left 35%) + detail (right 65%)
- Create modal: title, description, difficulty, tags, languages, reference solution
- Test case modal: input, expected output, hidden toggle

### Step 8: Assessments Page (`src/pages/Assessments.tsx`)

**Features:**
- Assessment list with colored status badges
- Create modal: title, time limit, select questions (checkbox list)
- Assign modal: enter candidate email → generates unique link
- Copy link button with clipboard API
- Review button → navigates to Review page

### Step 9: Review Page (`src/pages/Review.tsx`)

**Design:** Card grid (not split panel)

**Features:**
- Stat cards at top (Total, Selected, Hold, Rejected, Pending) — clickable filters
- 3-column responsive grid of candidate cards
- Each card shows: avatar, name, email, score, status, flags, decision badge
- Click card → navigates to `/candidate/:sessionId`

### Step 10: Candidate Dashboard (`src/pages/CandidateReview.tsx`)

**The richest page — full candidate review experience.**

**Header section:**
- Large avatar + name + email + assessment title
- 4xl composite score with color
- Decision badge
- 5 mini-stat cards: Status, Started, Submitted, Duration, Integrity

**Score vs Team Average chart:**
- Bar chart comparing this candidate to all team candidates
- Shows "X% above/below avg" indicator

**Question-level Timing:**
- Lists each question with time spent and score
- Calculated from submission timestamps

**Tabs:**
| Tab | Content |
|-----|---------|
| 📊 Overview | Score bars + Activity Timeline + Decision panel |
| 💻 Code | Source code (expandable) + Reference solution toggle |
| 🎬 Interview | Transcription text + AI score |
| 🛡️ Proctoring | All flags with severity, description, timestamp |

**PDF Export:**
- Opens new window with formatted HTML report
- Print-ready layout with all candidate data
- "Generated by AD Hire" footer

### Step 11: Assessment Page — Candidate Experience (`src/pages/Assessment.tsx`)

**Full-screen, no layout (candidate-facing)**

**Flow:**
1. Load session via token → get questions + time limit
2. System Check gate (camera + mic + acknowledgment)
3. Start proctoring SDK
4. For each question:
   - **Coding**: Monaco Editor + Run/Submit buttons + results panel
   - **Interview**: VideoRecorder component + submit recording
5. Timer countdown (auto-submit on expiry)
6. Completion screen with scores

**Proctoring behavior:**
- Audio monitoring **paused** during interview questions (speech expected)
- Audio monitoring **active** during coding questions (speech suspicious)
- Face + browser monitoring always active

### Step 12: Proctoring SDK (`src/proctoring/`)

**Files:**
| File | Purpose |
|------|---------|
| `ProctoringSDK.ts` | Orchestrator — starts/stops all monitors, batches flags |
| `BrowserMonitor.ts` | Tab switch, window blur, paste, rapid input detection |
| `FaceMonitor.ts` | TensorFlow.js face detection (absent, multiple, gaze) |
| `AudioMonitor.ts` | Web Audio API speech detection with pause/resume |
| `types.ts` | TypeScript interfaces for flags and config |

**ProctoringSDK API:**
```typescript
const sdk = new ProctoringSDK({
  sessionId: "...",
  level: "basic",  // "none" | "basic" | "full"
  onFlag: (flag) => { /* update UI */ },
  onWarning: (msg) => { /* show banner */ },
});

await sdk.start();      // Start all monitors
sdk.pauseAudio();       // Pause for interview questions
sdk.resumeAudio();      // Resume for coding questions
sdk.stop();             // Stop all, flush remaining flags
```

**Flag batching:**
- Flags stored in buffer
- Every 3 seconds: POST to backend (`/proctoring/flags`)
- On failure: flags re-queued for next flush

### Step 13: Video Recorder (`src/components/VideoRecorder.tsx`)

```typescript
// Uses MediaRecorder API
const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });

recorder.ondataavailable = (e) => chunks.push(e.data);
recorder.onstop = () => {
  const blob = new Blob(chunks, { type: "video/webm" });
  onSubmit(blob);  // Passed to parent for upload
};
```

---

## File Structure

```
web/
├── src/
│   ├── App.tsx                      # Router + Layout wrapping
│   ├── main.tsx                     # Entry point
│   ├── index.css                    # Tailwind imports
│   │
│   ├── lib/
│   │   └── api.ts                   # Axios client + JWT interceptor
│   │
│   ├── components/
│   │   ├── Layout.tsx               # Shared header + sidebar + main area
│   │   ├── VideoRecorder.tsx        # Webcam recording component
│   │   └── SystemCheck.tsx          # Camera/mic permission gate
│   │
│   ├── pages/
│   │   ├── Login.tsx                # Role selection + auth forms
│   │   ├── Dashboard.tsx            # Overview with charts + candidates
│   │   ├── Teams.tsx                # Team CRUD + members
│   │   ├── Questions.tsx            # Question bank + search/filter
│   │   ├── Assessments.tsx          # Create/assign/review
│   │   ├── Review.tsx               # Candidate card grid
│   │   ├── CandidateReview.tsx      # Full candidate dashboard
│   │   ├── Assessment.tsx           # Candidate coding experience
│   │   └── Interview.tsx            # Candidate video interview
│   │
│   └── proctoring/
│       ├── ProctoringSDK.ts         # Orchestrator
│       ├── BrowserMonitor.ts        # Tab/paste/blur detection
│       ├── FaceMonitor.ts           # TF.js face detection
│       ├── AudioMonitor.ts          # Speech detection (pause/resume)
│       └── types.ts                 # Interfaces
│
├── package.json
├── vite.config.ts
├── tsconfig.json
└── index.html
```

---

## Key Design Decisions

| Decision | Why |
|----------|-----|
| Dark theme | Matches coding environment, reduces eye strain during reviews |
| Split layout (sidebar + content) | Consistent navigation, matches AD Admin Center |
| No external charting library | Simple CSS bar charts avoid bundle bloat |
| Proctoring runs in browser | No server load, real-time detection, works offline |
| Audio pause for interviews | Candidates must speak — false positives avoided |
| PDF export via window.print() | No server-side PDF generation needed |
| Token in localStorage | Simple, works with Axios interceptor, clears on logout |
| Monaco Editor | VS Code experience in browser, 47 language support |

---

## State Management

No external state library (Redux/Zustand) — each page manages its own state via `useState` + `useEffect`. Shared state:

| Data | Where stored | How shared |
|------|-------------|-----------|
| JWT token | localStorage | Axios interceptor reads it |
| User info | Fetched per page via `/auth/me` | Layout caches in state |
| Theme | localStorage `theme` key | CSS class toggle |
| Last visit | localStorage `last_dashboard_visit` | Notification badge |

---

## Build & Deploy

```bash
# Development
npm run dev

# Production build
npm run build      # Outputs to dist/
npm run preview    # Preview production build locally

# Type checking
npx tsc --noEmit
```

**Production considerations:**
- Set `VITE_API_URL` env var for production API endpoint
- Enable gzip/brotli compression on CDN
- TF.js model cached after first load (~1.7MB)
- Monaco Editor chunks are code-split automatically

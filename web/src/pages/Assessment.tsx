import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import Editor from "@monaco-editor/react";
import { api } from "../lib/api";
import type { ProctoringFlag } from "../proctoring/types";
import VideoRecorder from "../components/VideoRecorder";

interface TestCase {
  input: string;
  expected_output: string;
}

interface Question {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  type: string;  // "coding" | "interview"
  supported_languages: string[];
  test_cases: TestCase[];
}

interface RunResult {
  test_case_index: number;
  passed: boolean;
  status: string;
  stdout?: string;
  time?: number;
  memory?: number;
}

export default function Assessment() {
  const { token } = useParams<{ token: string }>();
  const [session, setSession] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("python");
  const [results, setResults] = useState<RunResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [error, setError] = useState("");
  const [submittedQuestions, setSubmittedQuestions] = useState<Set<string>>(new Set());
  const [questionScores, setQuestionScores] = useState<Record<string, number>>({});
  const [proctoringFlags, setProctoringFlags] = useState<ProctoringFlag[]>([]);
  const [proctoringWarning, setProctoringWarning] = useState("");
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const proctoringRef = useRef<any>(null);

  // Load session
  useEffect(() => {
    async function loadSession() {
      try {
        const res = await api.get(`/api/v1/sessions/${token}`);
        setSession(res.data);
        setQuestions(res.data.questions);
        setTimeLeft(res.data.time_limit_minutes * 60);

        // Start proctoring (dynamic import to avoid crash if MediaPipe fails)
        try {
          const { ProctoringSDK } = await import("../proctoring/ProctoringSDK");
          const sdk = new ProctoringSDK({
            sessionId: res.data.session_id,
            level: "basic",
            faceCheckIntervalMs: 3000,
            gazeAwayThresholdMs: 10000,
            speechThresholdMs: 5000,
            onFlag: (flag: ProctoringFlag) => setProctoringFlags((prev) => [...prev, flag]),
            onWarning: (msg: string) => setProctoringWarning(msg),
          });
          proctoringRef.current = sdk;
          const video = await sdk.start();
          if (video) setVideoEl(video);
        } catch (procErr) {
          console.warn("Proctoring initialization failed (non-critical):", procErr);
        }
      } catch (err: any) {
        setError("Session not found or expired");
      }
    }
    loadSession();
    return () => { proctoringRef.current?.stop(); };
  }, [token]);

  // Timer
  useEffect(() => {
    if (timeLeft <= 0 || submitted) return;
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timer);
          handleSubmit(); // Auto-submit on timeout
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, submitted]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleRun = async () => {
    if (!session || !questions[currentQ]) return;
    setIsRunning(true);
    setResults([]);
    try {
      const res = await api.post(`/api/v1/sessions/${session.session_id}/execute`, {
        question_id: questions[currentQ].id,
        source_code: code,
        language,
      });
      setResults(res.data.results);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Execution failed");
    }
    setIsRunning(false);
  };

  const handleSubmit = async () => {
    if (!session || !questions[currentQ]) return;
    setIsSubmitting(true);
    try {
      const res = await api.post(`/api/v1/sessions/${session.session_id}/submit`, {
        question_id: questions[currentQ].id,
        source_code: code,
        language,
      });

      // Mark this question as submitted
      const newSubmitted = new Set(submittedQuestions);
      newSubmitted.add(questions[currentQ].id);
      setSubmittedQuestions(newSubmitted);
      setQuestionScores({ ...questionScores, [questions[currentQ].id]: res.data.score });
      setResults(res.data.results);

      // If all questions submitted → show completion
      if (newSubmitted.size >= questions.length) {
        const avgScore = Object.values({ ...questionScores, [questions[currentQ].id]: res.data.score })
          .reduce((a, b) => a + b, 0) / questions.length;
        setScore(avgScore);
        setSubmitted(true);
      } else {
        // Navigate to next unsubmitted question
        const nextIdx = questions.findIndex((q, idx) => idx > currentQ && !newSubmitted.has(q.id));
        if (nextIdx !== -1) {
          setCurrentQ(nextIdx);
          setCode("");
          setResults([]);
        } else {
          // All remaining were already submitted — find any unsubmitted
          const anyUnsubmitted = questions.findIndex((q) => !newSubmitted.has(q.id));
          if (anyUnsubmitted !== -1) {
            setCurrentQ(anyUnsubmitted);
            setCode("");
            setResults([]);
          } else {
            const avgScore = Object.values({ ...questionScores, [questions[currentQ].id]: res.data.score })
              .reduce((a, b) => a + b, 0) / questions.length;
            setScore(avgScore);
            setSubmitted(true);
          }
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || "Submission failed");
    }
    setIsSubmitting(false);
  };

  if (error && !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-red-400 text-xl">{error}</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white text-xl">Loading assessment...</div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="bg-gray-800 p-8 rounded-lg text-center max-w-md">
          <h1 className="text-3xl font-bold text-white mb-4">✅ Assessment Complete!</h1>
          <p className="text-gray-300 mb-4">All {questions.length} questions submitted.</p>
          <div className="text-5xl font-bold text-blue-400 mb-4">{score?.toFixed(0)}%</div>
          <p className="text-gray-400 mb-4">Average score across all questions</p>
          <div className="space-y-2 text-left">
            {questions.map((q, idx) => (
              <div key={q.id} className="flex justify-between text-sm bg-gray-700 px-3 py-2 rounded">
                <span className="text-gray-300">Q{idx + 1}: {q.title}</span>
                <span className={questionScores[q.id] >= 70 ? "text-green-400" : "text-red-400"}>
                  {questionScores[q.id]?.toFixed(0) || 0}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const question = questions[currentQ];

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-white">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-4">
          <h1 className="font-semibold">{session.assessment_title}</h1>
          <span className="text-sm text-gray-400">
            Q{currentQ + 1}/{questions.length}
          </span>
          {proctoringFlags.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded bg-red-900 text-red-300">
              🚨 {proctoringFlags.length} flag{proctoringFlags.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          {/* Camera Preview */}
          {videoEl && (
            <div className="w-16 h-12 rounded overflow-hidden border border-gray-600">
              <video
                ref={(el) => { if (el && videoEl) { el.srcObject = videoEl.srcObject; el.play(); } }}
                className="w-full h-full object-cover"
                autoPlay
                muted
                playsInline
              />
            </div>
          )}
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="bg-gray-700 text-white px-3 py-1 rounded border border-gray-600"
          >
            {question?.supported_languages.map((lang) => (
              <option key={lang} value={lang}>{lang}</option>
            ))}
          </select>
          <div className={`font-mono text-lg ${timeLeft < 60 ? "text-red-400" : "text-green-400"}`}>
            ⏱ {formatTime(timeLeft)}
          </div>
        </div>
      </div>

      {/* Proctoring Warning */}
      {proctoringWarning && (
        <div className="bg-yellow-900/80 border-b border-yellow-600 px-4 py-2 text-yellow-200 text-sm text-center">
          {proctoringWarning}
          <button onClick={() => setProctoringWarning("")} className="ml-4 text-yellow-400">✕</button>
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Question Navigation Sidebar */}
        <div className="w-12 bg-gray-800 border-r border-gray-700 flex flex-col items-center py-2 gap-1">
          {questions.map((q, idx) => (
            <button
              key={q.id}
              onClick={() => { setCurrentQ(idx); setResults([]); if (!submittedQuestions.has(q.id)) setCode(""); }}
              className={`w-8 h-8 rounded text-xs font-bold flex items-center justify-center ${
                idx === currentQ
                  ? "bg-blue-600 text-white"
                  : submittedQuestions.has(q.id)
                  ? "bg-green-600 text-white"
                  : "bg-gray-700 text-gray-400 hover:bg-gray-600"
              }`}
              title={`${q.title} ${submittedQuestions.has(q.id) ? '✓' : ''}`}
            >
              {idx + 1}
            </button>
          ))}
        </div>

        {/* Left Panel — Question */}
        <div className="w-[35%] p-4 overflow-y-auto border-r border-gray-700">
          <h2 className="text-xl font-bold mb-2">{question?.title}</h2>
          <span className={`inline-block px-2 py-0.5 rounded text-xs mb-3 ${
            question?.difficulty === "easy" ? "bg-green-900 text-green-300" :
            question?.difficulty === "medium" ? "bg-yellow-900 text-yellow-300" :
            "bg-red-900 text-red-300"
          }`}>
            {question?.difficulty}
          </span>
          <pre className="text-gray-300 whitespace-pre-wrap text-sm leading-relaxed">
            {question?.description}
          </pre>

          {question?.test_cases.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-gray-400 mb-2">Sample Test Cases:</h3>
              {question.test_cases.map((tc, idx) => (
                <div key={idx} className="bg-gray-800 rounded p-3 mb-2 text-sm">
                  <div className="text-gray-400">Input:</div>
                  <pre className="text-gray-200 mb-1">{tc.input}</pre>
                  <div className="text-gray-400">Expected:</div>
                  <pre className="text-gray-200">{tc.expected_output}</pre>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Panel — Code Editor OR Video Recorder based on question type */}
        <div className="flex-1 flex flex-col">
          {question?.type === "interview" ? (
            /* ─── Interview Question: Video Recorder ─── */
            <div className="flex-1 flex flex-col items-center justify-center p-6">
              <h3 className="text-lg font-semibold mb-2 text-gray-300">🎬 Record Your Answer</h3>
              <p className="text-gray-400 text-sm mb-6 text-center">
                Speak clearly and look at the camera. Your response will be transcribed and scored by AI.
              </p>
              <VideoRecorder
                maxDurationSeconds={180}
                maxAttempts={3}
                onSubmit={async (blob) => {
                  // Upload video recording
                  const formData = new FormData();
                  formData.append("file", blob, `response_${question.id}.webm`);
                  formData.append("question_id", question.id);
                  formData.append("session_id", session.session_id);
                  try {
                    await api.post("/api/v1/interview/responses", formData, {
                      headers: { "Content-Type": "multipart/form-data" },
                    });
                  } catch (err) {
                    // Upload may fail but that's ok for prototype
                    console.warn("Upload error (non-critical):", err);
                  }

                  // Mark as submitted and move to next question regardless
                  const newSubmitted = new Set(submittedQuestions);
                  newSubmitted.add(question.id);
                  setSubmittedQuestions(newSubmitted);
                  setQuestionScores({ ...questionScores, [question.id]: 100 });

                  if (newSubmitted.size >= questions.length) {
                    const avgScore = Object.values({ ...questionScores, [question.id]: 100 })
                      .reduce((a, b) => a + b, 0) / questions.length;
                    setScore(avgScore);
                    setSubmitted(true);
                  } else {
                    const nextIdx = questions.findIndex((q, idx) => idx > currentQ && !newSubmitted.has(q.id));
                    if (nextIdx !== -1) { setCurrentQ(nextIdx); setCode(""); setResults([]); }
                    else {
                      const anyLeft = questions.findIndex((q) => !newSubmitted.has(q.id));
                      if (anyLeft !== -1) { setCurrentQ(anyLeft); setCode(""); setResults([]); }
                      else { setScore(100); setSubmitted(true); }
                    }
                  }
                }}
              />
            </div>
          ) : (
            /* ─── Coding Question: Monaco Editor + Run/Submit ─── */
            <>
              <div className="flex-1">
                <Editor
                  height="100%"
                  language={language}
                  value={code}
                  onChange={(val) => setCode(val || "")}
                  theme="vs-dark"
                  options={{
                    fontSize: 14,
                    minimap: { enabled: false },
                    automaticLayout: true,
                    padding: { top: 12 },
                    bracketPairColorization: { enabled: true },
                  }}
                />
              </div>

              {/* Results Panel */}
              <div className="h-[200px] border-t border-gray-700 bg-gray-850 overflow-y-auto">
                <div className="flex items-center justify-between px-4 py-2 bg-gray-800">
                  <span className="text-sm text-gray-400">
                    {results.length > 0
                      ? `Results: ${results.filter((r) => r.passed).length}/${results.length} passed`
                      : "Run your code to see results"}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={handleRun}
                      disabled={isRunning || !code}
                      className="px-4 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white text-sm rounded font-medium transition"
                    >
                      {isRunning ? "Running..." : "▶ Run"}
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={isSubmitting || !code}
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-sm rounded font-medium transition"
                    >
                      {isSubmitting ? "Submitting..." : "Submit"}
                    </button>
                  </div>
                </div>
                <div className="px-4 py-2">
                  {error && <div className="text-red-400 text-sm mb-2">{error}</div>}
                  {results.map((r, idx) => (
                    <div key={idx} className="flex items-center gap-3 py-1.5 border-b border-gray-700/50 text-sm">
                      <span className="text-lg">{r.passed ? "✅" : "❌"}</span>
                      <span className="text-gray-300">Test {r.test_case_index + 1}</span>
                      <span className={r.passed ? "text-green-400" : "text-red-400"}>
                        {r.status}
                      </span>
                      {r.time && <span className="text-gray-500 ml-auto">{r.time}s</span>}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

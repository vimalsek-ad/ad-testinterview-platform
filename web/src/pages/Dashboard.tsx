import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

interface Candidate {
  session_id: string;
  candidate_name: string;
  candidate_email: string;
  assessment_id: string;
  assessment_title: string;
  status: string;
  score: number | null;
  started_at: string | null;
  submitted_at: string | null;
  time_spent_minutes: number | null;
  flag_count: number;
  decision: string | null;
  code_submissions: {
    question_id: string;
    language: string;
    score: number | null;
    tests_passed: number | null;
    tests_total: number | null;
    submitted_at: string;
  }[];
  interview_responses: {
    question_id: string;
    transcription: string | null;
    ai_score: number | null;
    submitted_at: string;
  }[];
}

interface Overview {
  platform: { total_users: number; total_questions: number; total_assessments: number; total_sessions: number; total_submissions: number };
  sessions_by_status: Record<string, number>;
  scoring: { average_score: number | null; completion_rate: number };
  decisions: { select: number; reject: number; hold: number; pending_review: number };
  proctoring: { total_flags: number; sessions_with_flags: number; clean_sessions: number };
}

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      try {
        const userRes = await api.get("/api/v1/auth/me");
        setUser(userRes.data);
        const [overviewRes, candidatesRes] = await Promise.all([
          api.get("/api/v1/admin/analytics/overview"),
          api.get("/api/v1/admin/analytics/candidates"),
        ]);
        setOverview(overviewRes.data);
        setCandidates(candidatesRes.data.candidates);
      } catch {
        navigate("/login");
      }
      setLoading(false);
    }
    load();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  if (loading || !user) {
    return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Loading...</div>;
  }

  const statusColor = (status: string) => {
    switch (status) {
      case "submitted": return "bg-green-900 text-green-300";
      case "in_progress": return "bg-blue-900 text-blue-300";
      case "invited": return "bg-gray-700 text-gray-300";
      case "scored": return "bg-purple-900 text-purple-300";
      default: return "bg-gray-700 text-gray-300";
    }
  };

  const decisionColor = (d: string | null) => {
    if (d === "select") return "bg-green-600 text-white";
    if (d === "reject") return "bg-red-600 text-white";
    if (d === "hold") return "bg-yellow-600 text-white";
    return "bg-gray-600 text-gray-300";
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="border-b border-gray-700 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">🎯 Interview Platform</h1>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/teams")} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm">👥 Teams</button>
          <button onClick={() => navigate("/questions")} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm">📝 Questions</button>
          <button onClick={() => navigate("/assessments")} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm">📋 Assessments</button>
          <span className="text-gray-400 text-sm">{user.display_name}</span>
          <button onClick={handleLogout} className="text-red-400 hover:underline text-sm">Logout</button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* Overview Stats Cards */}
        {overview && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
            <StatCard label="Candidates" value={overview.platform.total_sessions} icon="👤" />
            <StatCard label="Assessments" value={overview.platform.total_assessments} icon="📋" />
            <StatCard label="Questions" value={overview.platform.total_questions} icon="📝" />
            <StatCard label="Avg Score" value={overview.scoring.average_score ? `${overview.scoring.average_score}%` : "—"} icon="📊" />
            <StatCard label="Completion" value={`${overview.scoring.completion_rate}%`} icon="✅" />
            <StatCard label="Flags" value={overview.proctoring.total_flags} icon="🚨" color={overview.proctoring.total_flags > 0 ? "red" : "green"} />
          </div>
        )}

        {/* Decisions Summary */}
        {overview && (
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="bg-green-900/30 border border-green-700 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-green-400">{overview.decisions.select}</p>
              <p className="text-sm text-green-300">Selected</p>
            </div>
            <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-yellow-400">{overview.decisions.hold}</p>
              <p className="text-sm text-yellow-300">On Hold</p>
            </div>
            <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-red-400">{overview.decisions.reject}</p>
              <p className="text-sm text-red-300">Rejected</p>
            </div>
            <div className="bg-gray-800 border border-gray-600 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-blue-400">{overview.decisions.pending_review}</p>
              <p className="text-sm text-blue-300">Review Pending</p>
            </div>
          </div>
        )}

        {/* Candidates Table + Detail */}
        <div className="flex gap-6">
          {/* Candidates List */}
          <div className="w-[45%]">
            <h2 className="text-lg font-bold mb-3">📋 All Candidates ({candidates.length})</h2>
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
              {candidates.map((c) => (
                <div
                  key={c.session_id}
                  onClick={() => setSelectedCandidate(c)}
                  className={`p-4 rounded-lg cursor-pointer transition border ${
                    selectedCandidate?.session_id === c.session_id
                      ? "bg-blue-900/40 border-blue-500"
                      : "bg-gray-800 border-gray-700 hover:border-gray-500"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{c.candidate_name}</p>
                      <p className="text-xs text-gray-400">{c.candidate_email}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${(c.score ?? 0) >= 70 ? "text-green-400" : (c.score ?? 0) >= 40 ? "text-yellow-400" : "text-red-400"}`}>
                        {c.score !== null ? `${c.score.toFixed(0)}%` : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${statusColor(c.status)}`}>{c.status}</span>
                    {c.decision && <span className={`text-xs px-2 py-0.5 rounded ${decisionColor(c.decision)}`}>{c.decision}</span>}
                    {c.flag_count > 0 && <span className="text-xs px-2 py-0.5 rounded bg-red-900 text-red-300">🚨 {c.flag_count}</span>}
                    {c.time_spent_minutes && <span className="text-xs text-gray-500">⏱ {c.time_spent_minutes}min</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{c.assessment_title}</p>
                </div>
              ))}
              {candidates.length === 0 && (
                <p className="text-gray-500 text-center py-10">No candidates yet. Assign candidates from the Assessments page.</p>
              )}
            </div>
          </div>

          {/* Candidate Detail */}
          <div className="flex-1">
            {selectedCandidate ? (
              <CandidateDetail candidate={selectedCandidate} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <p>Select a candidate to view full details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: string; color?: string }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <div className="flex items-center gap-2 mb-1">
        <span>{icon}</span>
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${color === "red" ? "text-red-400" : color === "green" ? "text-green-400" : "text-white"}`}>
        {value}
      </p>
    </div>
  );
}

function CandidateDetail({ candidate }: { candidate: Candidate }) {
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">{candidate.candidate_name}</h2>
            <p className="text-sm text-gray-400">{candidate.candidate_email}</p>
            <p className="text-xs text-gray-500 mt-1">{candidate.assessment_title}</p>
          </div>
          <div className="text-right">
            <p className={`text-3xl font-bold ${(candidate.score ?? 0) >= 70 ? "text-green-400" : (candidate.score ?? 0) >= 40 ? "text-yellow-400" : "text-red-400"}`}>
              {candidate.score !== null ? `${candidate.score.toFixed(0)}%` : "—"}
            </p>
            {candidate.decision && (
              <span className={`text-xs px-3 py-1 rounded mt-1 inline-block ${
                candidate.decision === "select" ? "bg-green-600" : candidate.decision === "reject" ? "bg-red-600" : "bg-yellow-600"
              }`}>{candidate.decision}</span>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
          <div>
            <p className="text-gray-500">Started</p>
            <p className="text-gray-300">{candidate.started_at ? new Date(candidate.started_at).toLocaleString() : "—"}</p>
          </div>
          <div>
            <p className="text-gray-500">Submitted</p>
            <p className="text-gray-300">{candidate.submitted_at ? new Date(candidate.submitted_at).toLocaleString() : "—"}</p>
          </div>
          <div>
            <p className="text-gray-500">Time Spent</p>
            <p className="text-gray-300 font-semibold">{candidate.time_spent_minutes ? `${candidate.time_spent_minutes} min` : "—"}</p>
          </div>
        </div>
      </div>

      {/* Code Submissions */}
      {candidate.code_submissions.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="font-semibold mb-3">💻 Code Submissions ({candidate.code_submissions.length})</h3>
          <div className="space-y-2">
            {candidate.code_submissions.map((sub, idx) => (
              <div key={idx} className="flex items-center justify-between bg-gray-900 rounded p-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs bg-gray-700 px-2 py-0.5 rounded">{sub.language}</span>
                  <span className="text-xs text-gray-400">Q: {sub.question_id.slice(0, 8)}...</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`text-sm font-medium ${(sub.score ?? 0) >= 70 ? "text-green-400" : "text-red-400"}`}>
                    {sub.tests_passed}/{sub.tests_total} passed ({sub.score?.toFixed(0) ?? 0}%)
                  </span>
                  <span className="text-xs text-gray-500">{new Date(sub.submitted_at).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Interview Responses */}
      {candidate.interview_responses.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="font-semibold mb-3">🎬 Interview Responses ({candidate.interview_responses.length})</h3>
          <div className="space-y-3">
            {candidate.interview_responses.map((resp, idx) => (
              <div key={idx} className="bg-gray-900 rounded p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">Q: {resp.question_id.slice(0, 8)}...</span>
                  <div className="flex items-center gap-3">
                    {resp.ai_score !== null && (
                      <span className={`text-sm font-medium ${resp.ai_score >= 70 ? "text-green-400" : resp.ai_score >= 40 ? "text-yellow-400" : "text-red-400"}`}>
                        AI: {resp.ai_score}%
                      </span>
                    )}
                    <span className="text-xs text-gray-500">{new Date(resp.submitted_at).toLocaleTimeString()}</span>
                  </div>
                </div>
                {resp.transcription && (
                  <p className="text-sm text-gray-300 bg-gray-800 p-2 rounded border border-gray-700">
                    📝 {resp.transcription}
                  </p>
                )}
                {!resp.transcription && <p className="text-xs text-yellow-400">⏳ Processing...</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Proctoring */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h3 className="font-semibold mb-2">🛡️ Proctoring</h3>
        {candidate.flag_count === 0 ? (
          <p className="text-green-400 text-sm">✅ No suspicious activity detected</p>
        ) : (
          <p className="text-red-400 text-sm">🚨 {candidate.flag_count} flag{candidate.flag_count > 1 ? "s" : ""} detected</p>
        )}
      </div>

      {/* Quick Action */}
      <button
        onClick={() => navigate(`/review/${candidate.assessment_id}`)}
        className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium text-center"
      >
        📊 Open Full Review
      </button>
    </div>
  );
}
